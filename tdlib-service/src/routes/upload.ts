import { Router, Request, Response } from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getTDLibClient } from "../tdlib-client.js";
import { getTempFilePath, cleanupTempFile } from "../utils/temp-file.js";
import { fileToBase64DataUri } from "../utils/stream.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVICE_ROOT = path.resolve(__dirname, "..", "..");

// ── Concurrency limiter ──────────────────────────────────────────────────────
// Telegram MTProto chokes when many messages are sent simultaneously.
// We queue TDLib sendMessage calls and process at most MAX_CONCURRENT at once.
const MAX_CONCURRENT = 3;
let activeUploads = 0;
const uploadQueue: Array<() => void> = [];

function acquireUploadSlot(): Promise<void> {
  return new Promise((resolve) => {
    if (activeUploads < MAX_CONCURRENT) {
      activeUploads++;
      resolve();
    } else {
      uploadQueue.push(() => {
        activeUploads++;
        resolve();
      });
    }
  });
}

function releaseUploadSlot(): void {
  activeUploads--;
  const next = uploadQueue.shift();
  if (next) next();
}

const router = Router();

// Configure multer to store uploads in temp directory
const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      const rawFilesPath = process.env.TDLIB_FILES_PATH || "./tdlib-files";
      const filesBase = path.isAbsolute(rawFilesPath)
        ? rawFilesPath
        : path.join(SERVICE_ROOT, rawFilesPath);
      const dir = path.join(filesBase, "uploads");
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (_req, file, cb) => {
      const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2)}-${file.originalname}`;
      cb(null, uniqueName);
    },
  }),
  limits: {
    fileSize: 2 * 1024 * 1024 * 1024, // 2GB max
  },
});

/**
 * POST /api/upload
 * Upload a file to Telegram channel via TDLib (MTProto).
 *
 * Body (multipart/form-data):
 *   - file: The file to upload
 *   - mime_type: Optional MIME type override
 *
 * Response:
 *   { file_id, message_id, thumbnail_data }
 */
router.post("/", upload.single("file"), async (req: Request, res: Response) => {
  const uploadedFile = req.file;

  if (!uploadedFile) {
    res.status(400).json({ error: "No file provided" });
    return;
  }

  const localFilePath = uploadedFile.path;

  try {
    const client = await getTDLibClient();
    const channelId = process.env.TELEGRAM_CHANNEL_ID;

    if (!channelId) {
      res.status(500).json({ error: "TELEGRAM_CHANNEL_ID not configured" });
      return;
    }

    const mimeType =
      (req.body.mime_type as string) ||
      uploadedFile.mimetype ||
      "application/octet-stream";
    const fileName = uploadedFile.originalname;

    // Guard: reject 0-byte files before handing to TDLib
    const fileStats = fs.statSync(localFilePath);
    if (fileStats.size === 0) {
      cleanupTempFile(localFilePath);
      console.error(`[Upload] File is 0 bytes after multer write: ${localFilePath}`);
      res.status(400).json({ error: "Uploaded file is empty — upload may have been interrupted" });
      return;
    }
    console.log(`[Upload] File received: ${fileName} (${fileStats.size} bytes) → ${localFilePath}`);

    // Build the appropriate input message content based on MIME type
    const caption = { _: "formattedText" as const, text: fileName };
    const inputFile = { _: "inputFileLocal" as const, path: localFilePath };

    let sendParams: Parameters<typeof client.invoke>[0];

    const MAX_PHOTO_SIZE = 10 * 1024 * 1024; // Telegram photo limit
    if (mimeType.startsWith("image/") && !mimeType.includes("svg") && fileStats.size <= MAX_PHOTO_SIZE) {
      sendParams = {
        _: "sendMessage",
        chat_id: parseInt(channelId, 10),
        input_message_content: {
          _: "inputMessagePhoto",
          photo: inputFile,
          caption,
        },
      };
    } else if (mimeType.startsWith("video/")) {
      sendParams = {
        _: "sendMessage",
        chat_id: parseInt(channelId, 10),
        input_message_content: {
          _: "inputMessageVideo",
          video: inputFile,
          caption,
        },
      };
    } else if (mimeType.startsWith("audio/")) {
      sendParams = {
        _: "sendMessage",
        chat_id: parseInt(channelId, 10),
        input_message_content: {
          _: "inputMessageAudio",
          audio: inputFile,
          caption,
        },
      };
    } else {
      sendParams = {
        _: "sendMessage",
        chat_id: parseInt(channelId, 10),
        input_message_content: {
          _: "inputMessageDocument",
          document: inputFile,
          caption,
        },
      };
    }

    // Ensure channel is loaded in TDLib's local chat DB before sending.
    // TDLib returns "Chat not found" if the chat hasn't been resolved yet.
    const chatIdNum = parseInt(channelId, 10);
    try {
      await client.invoke({ _: "getChat", chat_id: chatIdNum });
    } catch {
      // Not cached — load chats from server and try again
      console.log("[Upload] Channel not in cache, loading chats...");
      try {
        await client.invoke({ _: "loadChats", chat_list: { _: "chatListMain" }, limit: 100 });
        await client.invoke({ _: "getChat", chat_id: chatIdNum });
      } catch (loadErr) {
        cleanupTempFile(localFilePath);
        res.status(400).json({
          error: `Channel not accessible. Make sure the bot is admin in channel ${channelId}. Details: ${loadErr}`,
        });
        return;
      }
    }

    // ── Helper: invoke sendMessage with concurrency slot management ─────────
    async function invokeWithSlot(
      params: Parameters<typeof client.invoke>[0]
    ): Promise<Record<string, unknown>> {
      await acquireUploadSlot();
      try {
        return await client.invoke(params) as Record<string, unknown>;
      } finally {
        releaseUploadSlot();
      }
    }

    // ── Helper: send and wait, with document fallback on image rejection ─────
    const isMediaRejection = (msg: string) =>
      msg.includes("IMAGE_PROCESS_FAILED") ||
      msg.includes("PHOTO_INVALID_DIMENSIONS") ||
      msg.includes("MEDIA_INVALID") ||
      msg.includes("too big for a photo");

    const documentFallbackParams = {
      _: "sendMessage" as const,
      chat_id: parseInt(channelId, 10),
      input_message_content: {
        _: "inputMessageDocument" as const,
        document: inputFile,
        caption: { _: "formattedText" as const, text: fileName },
      },
    };

    let sentMessage: Record<string, unknown>;
    try {
      const pending = await invokeWithSlot(sendParams);
      sentMessage = await waitForMessageSent(client, pending, fileStats.size);
    } catch (sendErr) {
      const sendErrMsg = sendErr instanceof Error ? sendErr.message : String(sendErr);
      if (isMediaRejection(sendErrMsg)) {
        console.warn(`[Upload] Media rejected by Telegram (${sendErrMsg}), retrying as document...`);
        const pending = await invokeWithSlot(documentFallbackParams);
        sentMessage = await waitForMessageSent(client, pending, fileStats.size);
      } else {
        throw sendErr;
      }
    }

    // Extract file info from the sent message
    const fileInfo = extractFileInfo(sentMessage);

    if (!fileInfo) {
      res.status(500).json({ error: "Failed to extract file info from Telegram response" });
      return;
    }

    // Safety net: reject numeric-only file IDs (TDLib internal IDs stored by mistake)
    if (!fileInfo.remoteFileId || /^\d+$/.test(fileInfo.remoteFileId)) {
      console.error("[Upload] Got invalid numeric-only file_id — aborting:", fileInfo.remoteFileId);
      res.status(500).json({ error: "Telegram returned an invalid file ID. Please retry." });
      return;
    }

    // Try to get thumbnail as base64 data URI
    let thumbnailData: string | null = null;
    if (fileInfo.thumbnailFileId) {
      try {
        const thumbFile = await client.invoke({
          _: "downloadFile",
          file_id: fileInfo.thumbnailFileId,
          priority: 32,
          synchronous: true,
        });

        if (thumbFile.local?.path && fs.existsSync(thumbFile.local.path)) {
          thumbnailData = fileToBase64DataUri(thumbFile.local.path, "image/jpeg");
        }
      } catch (err) {
        console.warn("[Upload] Failed to download thumbnail:", err);
      }
    }

    // Clean up the uploaded temp file
    cleanupTempFile(localFilePath);

    res.status(201).json({
      file_id: fileInfo.remoteFileId,
      tdlib_file_id: fileInfo.tdlibFileId,
      message_id: sentMessage.id,
      thumbnail_data: thumbnailData,
      file_size: fileInfo.size,
    });
  } catch (err) {
    // Clean up on error
    cleanupTempFile(localFilePath);
    console.error("[Upload] Error:", err);

    const errMsg = err instanceof Error ? err.message : String(err);

    // Surface Telegram rate-limit errors clearly so the client can retry.
    // TDLib may report this as FLOOD_WAIT_N or as [429]: Too Many Requests: retry after N
    const floodMatch =
      errMsg.match(/FLOOD_WAIT[_\s](\d+)/i) ||
      errMsg.match(/retry after (\d+)/i) ||
      errMsg.match(/\[429\]/i);
    if (floodMatch) {
      // Try to extract the wait seconds from whichever pattern matched
      const retryMatch = errMsg.match(/(\d+)\s*$/) ||
        errMsg.match(/retry after (\d+)/i) ||
        errMsg.match(/FLOOD_WAIT[_\s](\d+)/i);
      const waitSec = retryMatch ? parseInt(retryMatch[1], 10) : 30;
      res
        .status(429)
        .set("Retry-After", String(waitSec))
        .json({ error: `Rate limited by Telegram. Retry after ${waitSec} seconds.`, retry_after: waitSec });
      return;
    }

    res.status(500).json({
      error: `TDLib upload failed: ${errMsg}`,
    });
  }
});

/**
 * Wait for TDLib to finish sending the message.
 * Timeout scales with file size and resets on upload progress,
 * so even very large files (1-2 GB) won't time out while data is moving.
 */
async function waitForMessageSent(
  client: Awaited<ReturnType<typeof getTDLibClient>>,
  pendingMessage: Record<string, unknown>,
  fileSize: number = 0,
): Promise<Record<string, unknown>> {
  const chatId = pendingMessage.chat_id as number;
  const messageId = pendingMessage.id as number;

  // If the message already has a sending_state of null, it's already sent
  if (!pendingMessage.sending_state) {
    return pendingMessage;
  }

  // Base: 2 min. Add 1 min per 100 MB, min 2 min, max 30 min.
  const baseTotalMs = Math.max(
    2 * 60 * 1000,
    Math.min(30 * 60 * 1000, 2 * 60 * 1000 + Math.ceil(fileSize / (100 * 1024 * 1024)) * 60 * 1000)
  );
  // If no progress event for 3 min, give up
  const idleTimeoutMs = 3 * 60 * 1000;

  return new Promise((resolve, reject) => {
    let lastActivity = Date.now();

    // Absolute deadline
    const absoluteTimer = setTimeout(() => {
      cleanup();
      reject(new Error(`Message send timeout after ${Math.round(baseTotalMs / 1000)}s (file: ${Math.round(fileSize / 1024 / 1024)} MB)`));
    }, baseTotalMs);

    // Idle timer — resets every time we see upload progress
    let idleTimer = setTimeout(checkIdle, idleTimeoutMs);

    function checkIdle() {
      if (Date.now() - lastActivity >= idleTimeoutMs) {
        cleanup();
        reject(new Error(`Message send stalled — no upload progress for ${Math.round(idleTimeoutMs / 1000)}s`));
      } else {
        idleTimer = setTimeout(checkIdle, idleTimeoutMs);
      }
    }

    function cleanup() {
      clearTimeout(absoluteTimer);
      clearTimeout(idleTimer);
      client.off("update", handler);
    }

    // Listen for message updates
    const handler = (update: Record<string, unknown>) => {
      // Upload progress — reset idle timer
      if (update._ === "updateFile") {
        const file = update.file as Record<string, unknown> | undefined;
        const remote = file?.remote as Record<string, unknown> | undefined;
        if (remote?.is_uploading_active) {
          lastActivity = Date.now();
        }
      }

      if (
        update._ === "updateMessageSendSucceeded" &&
        (update.old_message_id as number) === messageId
      ) {
        cleanup();
        resolve(update.message as Record<string, unknown>);
      } else if (
        update._ === "updateMessageSendFailed" &&
        (update.old_message_id as number) === messageId
      ) {
        cleanup();
        // TDLib error is in update.error: { _: "error", code: number, message: string }
        const tdErr = update.error as { code?: number; message?: string } | undefined;
        const errorCode = tdErr?.code ?? 0;
        const errorMsg = tdErr?.message || "Unknown error";
        reject(new Error(`Message send failed [${errorCode}]: ${errorMsg}`));
      }
    };

    client.on("update", handler);

    console.log(`[Upload] Waiting for Telegram upload (timeout: ${Math.round(baseTotalMs / 1000)}s, idle: ${Math.round(idleTimeoutMs / 1000)}s, fileSize: ${Math.round(fileSize / 1024 / 1024)} MB)`);
  });
}

/**
 * Extract file_id, TDLib numeric file ID, and thumbnail info
 * from a TDLib message object.
 */
function extractFileInfo(message: Record<string, unknown>): {
  remoteFileId: string;
  tdlibFileId: number;
  thumbnailFileId: number | null;
  size: number;
} | null {
  const content = message.content as Record<string, unknown>;
  if (!content) return null;

  let document: Record<string, unknown> | null = null;
  let thumbnail: Record<string, unknown> | null = null;

  switch (content._) {
    case "messagePhoto": {
      const photo = content.photo as Record<string, unknown>;
      const sizes = photo?.sizes as Array<Record<string, unknown>>;
      if (sizes && sizes.length > 0) {
        // Largest photo size
        const largest = sizes[sizes.length - 1];
        document = largest.photo as Record<string, unknown>;
        // Smallest for thumbnail
        if (sizes.length > 1) {
          const smallest = sizes[0];
          const thumbFile = smallest.photo as Record<string, unknown>;
          thumbnail = thumbFile;
        }
      }
      break;
    }
    case "messageVideo": {
      const video = content.video as Record<string, unknown>;
      document = video?.video as Record<string, unknown>;
      const thumb = video?.thumbnail as Record<string, unknown>;
      if (thumb) {
        thumbnail = thumb.file as Record<string, unknown>;
      }
      break;
    }
    case "messageAudio": {
      const audio = content.audio as Record<string, unknown>;
      document = audio?.audio as Record<string, unknown>;
      const thumb = audio?.album_cover_thumbnail as Record<string, unknown>;
      if (thumb) {
        thumbnail = thumb.file as Record<string, unknown>;
      }
      break;
    }
    case "messageDocument": {
      const doc = content.document as Record<string, unknown>;
      document = doc?.document as Record<string, unknown>;
      const thumb = doc?.thumbnail as Record<string, unknown>;
      if (thumb) {
        thumbnail = thumb.file as Record<string, unknown>;
      }
      break;
    }
    default:
      return null;
  }

  if (!document) return null;

  const remote = document.remote as Record<string, unknown>;

  return {
    remoteFileId: (remote?.id as string) || "",
    tdlibFileId: (document.id as number) || 0,
    thumbnailFileId: thumbnail ? (thumbnail.id as number) || null : null,
    size: (document.size as number) || (document.expected_size as number) || 0,
  };
}

export default router;
