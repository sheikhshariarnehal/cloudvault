/**
 * Chunked upload endpoints for large files.
 *
 * Flow:
 *   1. POST /api/chunked-upload/init   → create session, return uploadId
 *   2. POST /api/chunked-upload/chunk  → receive one chunk (multipart)
 *   3. POST /api/chunked-upload/complete → assemble chunks, upload to Telegram
 *
 * Chunks are written to disk under <TEMP_DIR>/chunks/<uploadId>/<index>.
 * The complete endpoint concatenates them, uploads the assembled file via
 * the existing sendMessage-based upload path, then cleans up.
 */

import { Router, Request, Response } from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import os from "os";
import { fileURLToPath } from "url";
import { getTDLibClient } from "../tdlib-client.js";
import { cleanupTempFile } from "../utils/temp-file.js";
import { fileToBase64DataUri } from "../utils/stream.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVICE_ROOT = path.resolve(__dirname, "..", "..");

const CHUNKS_DIR = path.join(os.tmpdir(), "cloudvault-tdlib", "chunks");

// Ensure base chunks directory exists
if (!fs.existsSync(CHUNKS_DIR)) {
  fs.mkdirSync(CHUNKS_DIR, { recursive: true });
}

// ── Concurrency limiter (shared idea with upload.ts) ─────────────────────────
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

// ── In-memory session map ────────────────────────────────────────────────────
interface UploadSession {
  uploadId: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  totalChunks: number;
  receivedChunks: Set<number>;
  nextFlushIndex: number;        // next chunk to append to assembled file
  assembledPath: string;         // output file being built progressively
  assembledBytes: number;        // bytes flushed so far
  telegramProgress: number;      // 0–1 fraction of Telegram upload
  createdAt: number;
  dir: string;
}

const sessions = new Map<string, UploadSession>();

// Clean up stale sessions every 15 minutes
setInterval(() => {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (now - session.createdAt > 60 * 60 * 1000) {
      // 1 hour expiry
      cleanupSessionDir(session.dir);
      cleanupTempFile(session.assembledPath);
      sessions.delete(id);
      console.log(`[ChunkedUpload] Expired session ${id}`);
    }
  }
}, 15 * 60 * 1000);

function cleanupSessionDir(dir: string) {
  try {
    if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    console.warn(`[ChunkedUpload] Failed to clean up dir: ${dir}`);
  }
}

// ── multer for chunk endpoint ────────────────────────────────────────────────
const chunkUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      // Temp staging; we move the file into the session dir in the handler
      const dir = path.join(CHUNKS_DIR, "_staging");
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (_req, _file, cb) => {
      cb(null, `chunk_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`);
    },
  }),
  limits: { fileSize: 12 * 1024 * 1024 }, // 12 MB per chunk max (10MB chunk + multipart overhead)
});

const router = Router();

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/chunked-upload/init
// ─────────────────────────────────────────────────────────────────────────────
router.post("/init", (req: Request, res: Response) => {
  const { fileName, fileSize, mimeType, totalChunks } = req.body;

  if (!fileName || !fileSize || !totalChunks) {
    res.status(400).json({ error: "Missing required fields: fileName, fileSize, totalChunks" });
    return;
  }

  // Validate size (2 GB max)
  if (fileSize > 2 * 1024 * 1024 * 1024) {
    res.status(400).json({ error: "File size exceeds the 2 GB limit" });
    return;
  }

  const uploadId = crypto.randomBytes(16).toString("hex");
  const dir = path.join(CHUNKS_DIR, uploadId);
  fs.mkdirSync(dir, { recursive: true });

  // Pre-create the assembled output file path so we can flush progressively
  const rawFilesPath = process.env.TDLIB_FILES_PATH || "./tdlib-files";
  const filesBase = path.isAbsolute(rawFilesPath)
    ? rawFilesPath
    : path.join(SERVICE_ROOT, rawFilesPath);
  const uploadsDir = path.join(filesBase, "uploads");
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
  const assembledName = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}-${fileName}`;
  const assembledPath = path.join(uploadsDir, assembledName);

  const session: UploadSession = {
    uploadId,
    fileName,
    mimeType: mimeType || "application/octet-stream",
    fileSize,
    totalChunks,
    receivedChunks: new Set(),
    nextFlushIndex: 0,
    assembledPath,
    assembledBytes: 0,
    telegramProgress: 0,
    createdAt: Date.now(),
    dir,
  };

  sessions.set(uploadId, session);
  console.log(`[ChunkedUpload] Init session ${uploadId}: ${fileName} (${totalChunks} chunks, ${fileSize} bytes)`);

  res.status(200).json({ uploadId });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/chunked-upload/chunk
// ─────────────────────────────────────────────────────────────────────────────
router.post("/chunk", chunkUpload.single("chunk"), (req: Request, res: Response) => {
  const uploadId = req.body.uploadId || req.headers["x-upload-id"];
  const chunkIndex = parseInt(req.body.chunkIndex ?? req.headers["x-chunk-index"], 10);

  if (!uploadId || isNaN(chunkIndex)) {
    if (req.file) cleanupTempFile(req.file.path);
    res.status(400).json({ error: "Missing uploadId or chunkIndex" });
    return;
  }

  const session = sessions.get(uploadId as string);
  if (!session) {
    if (req.file) cleanupTempFile(req.file.path);
    res.status(404).json({ error: "Upload session not found or expired" });
    return;
  }

  if (!req.file) {
    res.status(400).json({ error: "No chunk data provided" });
    return;
  }

  // Move chunk from staging to session directory
  const destPath = path.join(session.dir, String(chunkIndex));
  try {
    fs.renameSync(req.file.path, destPath);
  } catch {
    // Cross-device rename? Fall back to copy + delete
    fs.copyFileSync(req.file.path, destPath);
    cleanupTempFile(req.file.path);
  }

  session.receivedChunks.add(chunkIndex);

  // ── Progressive flush: append sequential chunks to output file ─────────
  // This keeps disk usage minimal — only out-of-order chunks stay on disk.
  // With 5 parallel uploads, max buffered = 4 chunks × 10MB = 40MB.
  try {
    while (session.receivedChunks.has(session.nextFlushIndex)) {
      const flushPath = path.join(session.dir, String(session.nextFlushIndex));
      if (fs.existsSync(flushPath)) {
        const chunkData = fs.readFileSync(flushPath);
        fs.appendFileSync(session.assembledPath, chunkData);
        session.assembledBytes += chunkData.length;
        fs.unlinkSync(flushPath); // free disk space immediately
      }
      session.nextFlushIndex++;
    }
  } catch (flushErr) {
    console.warn(`[ChunkedUpload] Flush error for ${uploadId}:`, flushErr);
  }

  const flushedMB = Math.round(session.assembledBytes / 1024 / 1024);
  const buffered = session.receivedChunks.size - session.nextFlushIndex;
  console.log(
    `[ChunkedUpload] ${uploadId} chunk ${chunkIndex + 1}/${session.totalChunks} received` +
    ` (flushed: ${session.nextFlushIndex}/${session.totalChunks} = ${flushedMB}MB, buffered: ${buffered})`
  );

  res.status(200).json({
    received: chunkIndex,
    totalReceived: session.receivedChunks.size,
    totalChunks: session.totalChunks,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/chunked-upload/status?uploadId=xxx
// Polled by the browser during the Telegram upload phase for live progress
// ─────────────────────────────────────────────────────────────────────────────
router.get("/status", (req: Request, res: Response) => {
  const uploadId = req.query.uploadId as string;
  if (!uploadId) {
    res.status(400).json({ error: "Missing uploadId" });
    return;
  }
  const session = sessions.get(uploadId);
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  res.json({
    receivedChunks: session.receivedChunks.size,
    totalChunks: session.totalChunks,
    flushedBytes: session.assembledBytes,
    telegramProgress: session.telegramProgress,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/chunked-upload/complete
// ─────────────────────────────────────────────────────────────────────────────
router.post("/complete", async (req: Request, res: Response) => {
  const { uploadId } = req.body;

  if (!uploadId) {
    res.status(400).json({ error: "Missing uploadId" });
    return;
  }

  const session = sessions.get(uploadId);
  if (!session) {
    res.status(404).json({ error: "Upload session not found or expired" });
    return;
  }

  // Verify all chunks received
  if (session.receivedChunks.size !== session.totalChunks) {
    res.status(400).json({
      error: `Missing chunks: received ${session.receivedChunks.size} of ${session.totalChunks}`,
    });
    return;
  }

  // Flush any remaining buffered chunks (shouldn't be many)
  try {
    while (session.nextFlushIndex < session.totalChunks) {
      const flushPath = path.join(session.dir, String(session.nextFlushIndex));
      if (fs.existsSync(flushPath)) {
        const chunkData = fs.readFileSync(flushPath);
        fs.appendFileSync(session.assembledPath, chunkData);
        session.assembledBytes += chunkData.length;
        fs.unlinkSync(flushPath);
      }
      session.nextFlushIndex++;
    }
  } catch (flushErr) {
    console.error(`[ChunkedUpload] Final flush error:`, flushErr);
  }

  // Clean up chunk directory (should be empty now)
  cleanupSessionDir(session.dir);

  const assembledPath = session.assembledPath;

  try {
    // Verify assembled size
    const stats = fs.statSync(assembledPath);
    console.log(`[ChunkedUpload] Assembled file: ${stats.size} bytes (expected ${session.fileSize})`);

    if (stats.size === 0) {
      cleanupTempFile(assembledPath);
      sessions.delete(uploadId);
      res.status(400).json({ error: "Assembled file is empty" });
      return;
    }

    // ── Upload to Telegram (reuse logic from upload.ts) ────────────────────
    const client = await getTDLibClient();
    const channelId = process.env.TELEGRAM_CHANNEL_ID;

    if (!channelId) {
      cleanupTempFile(assembledPath);
      sessions.delete(uploadId);
      res.status(500).json({ error: "TELEGRAM_CHANNEL_ID not configured" });
      return;
    }

    const mimeType = session.mimeType;
    const fileName = session.fileName;

    const caption = { _: "formattedText" as const, text: fileName };
    const inputFile = { _: "inputFileLocal" as const, path: assembledPath };

    let sendParams: Parameters<typeof client.invoke>[0];

    // Always send images as documents to preserve original quality (no Telegram compression)
    if (mimeType.startsWith("video/")) {
      sendParams = {
        _: "sendMessage",
        chat_id: parseInt(channelId, 10),
        input_message_content: { _: "inputMessageVideo", video: inputFile, caption },
      };
    } else if (mimeType.startsWith("audio/")) {
      sendParams = {
        _: "sendMessage",
        chat_id: parseInt(channelId, 10),
        input_message_content: { _: "inputMessageAudio", audio: inputFile, caption },
      };
    } else {
      sendParams = {
        _: "sendMessage",
        chat_id: parseInt(channelId, 10),
        input_message_content: { _: "inputMessageDocument", document: inputFile, caption },
      };
    }

    // Ensure channel is loaded
    const chatIdNum = parseInt(channelId, 10);
    try {
      await client.invoke({ _: "getChat", chat_id: chatIdNum });
    } catch {
      console.log("[ChunkedUpload] Channel not in cache, loading chats...");
      try {
        await client.invoke({ _: "loadChats", chat_list: { _: "chatListMain" }, limit: 100 });
        await client.invoke({ _: "getChat", chat_id: chatIdNum });
      } catch (loadErr) {
        cleanupTempFile(assembledPath);
        sessions.delete(uploadId);
        res.status(400).json({
          error: `Channel not accessible. Details: ${loadErr}`,
        });
        return;
      }
    }

    // sendMessage with concurrency management
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

    async function invokeWithSlot(
      params: Parameters<typeof client.invoke>[0]
    ): Promise<Record<string, unknown>> {
      await acquireUploadSlot();
      try {
        return (await client.invoke(params)) as Record<string, unknown>;
      } finally {
        releaseUploadSlot();
      }
    }

    let sentMessage: Record<string, unknown>;
    try {
      const pending = await invokeWithSlot(sendParams);
      sentMessage = await waitForMessageSent(client, pending, session.fileSize, session);
    } catch (sendErr) {
      const sendErrMsg = sendErr instanceof Error ? sendErr.message : String(sendErr);
      if (isMediaRejection(sendErrMsg)) {
        console.warn(`[ChunkedUpload] Media rejected (${sendErrMsg}), retrying as document...`);
        const pending = await invokeWithSlot(documentFallbackParams);
        sentMessage = await waitForMessageSent(client, pending, session.fileSize, session);
      } else {
        throw sendErr;
      }
    }

    // Extract file info
    const fileInfo = extractFileInfo(sentMessage);
    if (!fileInfo) {
      cleanupTempFile(assembledPath);
      sessions.delete(uploadId);
      res.status(500).json({ error: "Failed to extract file info from Telegram response" });
      return;
    }

    if (!fileInfo.remoteFileId || /^\d+$/.test(fileInfo.remoteFileId)) {
      cleanupTempFile(assembledPath);
      sessions.delete(uploadId);
      res.status(500).json({ error: "Telegram returned an invalid file ID. Please retry." });
      return;
    }

    // Thumbnail
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
        console.warn("[ChunkedUpload] Failed to download thumbnail:", err);
      }
    }

    // Cleanup
    cleanupTempFile(assembledPath);
    sessions.delete(uploadId);

    res.status(201).json({
      file_id: fileInfo.remoteFileId,
      tdlib_file_id: fileInfo.tdlibFileId,
      message_id: sentMessage.id,
      thumbnail_data: thumbnailData,
      file_size: fileInfo.size,
    });
  } catch (err) {
    cleanupTempFile(assembledPath);
    sessions.delete(uploadId);
    console.error("[ChunkedUpload] Error:", err);

    const errMsg = err instanceof Error ? err.message : String(err);

    // Surface Telegram rate-limit errors
    const floodMatch =
      errMsg.match(/FLOOD_WAIT[_\s](\d+)/i) ||
      errMsg.match(/retry after (\d+)/i) ||
      errMsg.match(/\[429\]/i);
    if (floodMatch) {
      const retryMatch =
        errMsg.match(/(\d+)\s*$/) ||
        errMsg.match(/retry after (\d+)/i) ||
        errMsg.match(/FLOOD_WAIT[_\s](\d+)/i);
      const waitSec = retryMatch ? parseInt(retryMatch[1], 10) : 30;
      res
        .status(429)
        .set("Retry-After", String(waitSec))
        .json({ error: `Rate limited by Telegram. Retry after ${waitSec} seconds.`, retry_after: waitSec });
      return;
    }

    res.status(500).json({ error: `Chunked upload failed: ${errMsg}` });
  }
});

// ── Helpers (duplicated from upload.ts to keep module self-contained) ────────

/**
 * Wait for TDLib to confirm the message was sent (uploaded to Telegram).
 * Timeout scales with file size and resets whenever TDLib reports upload progress,
 * so even very large files (1-2 GB) won't time out as long as the upload is moving.
 */
async function waitForMessageSent(
  client: Awaited<ReturnType<typeof getTDLibClient>>,
  pendingMessage: Record<string, unknown>,
  fileSize: number = 0,
  session?: UploadSession,
): Promise<Record<string, unknown>> {
  if (!pendingMessage.sending_state) return pendingMessage;

  // Base: 2 min. Add 1 min per 100 MB, min 2 min, max 30 min.
  const baseTotalMs = Math.max(
    2 * 60 * 1000,
    Math.min(30 * 60 * 1000, 2 * 60 * 1000 + Math.ceil(fileSize / (100 * 1024 * 1024)) * 60 * 1000)
  );
  // Per-tick idle timeout: if no progress event for 3 min, give up
  const idleTimeoutMs = 3 * 60 * 1000;

  return new Promise((resolve, reject) => {
    const messageId = pendingMessage.id as number;
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

    const handler = (update: Record<string, unknown>) => {
      // Upload progress — reset idle timer
      if (update._ === "updateFile") {
        const file = update.file as Record<string, unknown> | undefined;
        const remote = file?.remote as Record<string, unknown> | undefined;
        if (remote?.is_uploading_active) {
          const uploaded = remote.uploaded_size as number || 0;
          lastActivity = Date.now();
          if (uploaded > 0 && fileSize > 0) {
            const ratio = uploaded / fileSize;
            if (session) session.telegramProgress = ratio;
            const pct = Math.round(ratio * 100);
            if (pct % 10 === 0) {
              console.log(`[ChunkedUpload] Telegram upload progress: ${pct}% (${Math.round(uploaded / 1024 / 1024)} MB / ${Math.round(fileSize / 1024 / 1024)} MB)`);
            }
          }
        }
      }

      if (update._ === "updateMessageSendSucceeded" && (update.old_message_id as number) === messageId) {
        cleanup();
        resolve(update.message as Record<string, unknown>);
      } else if (update._ === "updateMessageSendFailed" && (update.old_message_id as number) === messageId) {
        cleanup();
        const tdErr = update.error as { code?: number; message?: string } | undefined;
        reject(new Error(`Message send failed [${tdErr?.code ?? 0}]: ${tdErr?.message || "Unknown error"}`));
      }
    };

    client.on("update", handler);

    console.log(`[ChunkedUpload] Waiting for Telegram upload (timeout: ${Math.round(baseTotalMs / 1000)}s, idle: ${Math.round(idleTimeoutMs / 1000)}s, fileSize: ${Math.round(fileSize / 1024 / 1024)} MB)`);
  });
}

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
      if (sizes?.length) {
        document = sizes[sizes.length - 1].photo as Record<string, unknown>;
        if (sizes.length > 1) thumbnail = sizes[0].photo as Record<string, unknown>;
      }
      break;
    }
    case "messageVideo": {
      const video = content.video as Record<string, unknown>;
      document = video?.video as Record<string, unknown>;
      const thumb = video?.thumbnail as Record<string, unknown>;
      if (thumb) thumbnail = thumb.file as Record<string, unknown>;
      break;
    }
    case "messageAudio": {
      const audio = content.audio as Record<string, unknown>;
      document = audio?.audio as Record<string, unknown>;
      const thumb = audio?.album_cover_thumbnail as Record<string, unknown>;
      if (thumb) thumbnail = thumb.file as Record<string, unknown>;
      break;
    }
    case "messageDocument": {
      const doc = content.document as Record<string, unknown>;
      document = doc?.document as Record<string, unknown>;
      const thumb = doc?.thumbnail as Record<string, unknown>;
      if (thumb) thumbnail = thumb.file as Record<string, unknown>;
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
