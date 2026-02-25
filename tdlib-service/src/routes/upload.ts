import { Router, Request, Response } from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getTDLibClient } from "../tdlib-client.js";
import { cleanupTempFile } from "../utils/temp-file.js";
import {
  invokeWithSlot,
  isMediaRejection,
  waitForMessageSent,
  extractFileInfo,
  getThumbnailDataUri,
  buildSendParams,
  buildDocumentFallbackParams,
  ensureChannelLoaded,
  parseFloodWait,
} from "../utils/upload-helpers.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVICE_ROOT = path.resolve(__dirname, "..", "..");

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
      res.status(400).json({ error: "Uploaded file is 0 bytes — upload may have been interrupted" });
      return;
    }
    console.log(`[Upload] File received: ${fileName} (${fileStats.size} bytes) → ${localFilePath}`);

    // Build the appropriate send params based on MIME type
    const sendParams = buildSendParams(channelId, localFilePath, fileName, mimeType);
    const documentFallbackParams = buildDocumentFallbackParams(channelId, localFilePath, fileName);

    // Ensure channel is loaded in TDLib's local chat DB
    try {
      await ensureChannelLoaded(client, channelId);
    } catch (chErr) {
      cleanupTempFile(localFilePath);
      res.status(400).json({ error: (chErr as Error).message });
      return;
    }

    // ── Send with document fallback on media rejection ─────────────────
    let sentMessage: Record<string, unknown>;
    try {
      const pending = await invokeWithSlot(client, sendParams);
      sentMessage = await waitForMessageSent(client, pending, fileStats.size);
    } catch (sendErr) {
      const sendErrMsg = sendErr instanceof Error ? sendErr.message : String(sendErr);
      if (isMediaRejection(sendErrMsg)) {
        console.warn(`[Upload] Media rejected by Telegram (${sendErrMsg}), retrying as document...`);
        const pending = await invokeWithSlot(client, documentFallbackParams);
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

    // Send response immediately - don't wait for thumbnail
    res.status(201).json({
      file_id: fileInfo.remoteFileId,
      tdlib_file_id: fileInfo.tdlibFileId,
      message_id: sentMessage.id,
      thumbnail_data: null, // Will be fetched by frontend if needed
      file_size: fileInfo.size,
    });

    // Clean up in background (don't block response)
    cleanupTempFile(localFilePath);
  } catch (err) {
    // Clean up on error
    cleanupTempFile(localFilePath);
    console.error("[Upload] Error:", err);

    const errMsg = err instanceof Error ? err.message : String(err);

    // Surface Telegram rate-limit errors clearly so the client can retry.
    const waitSec = parseFloodWait(errMsg);
    if (waitSec !== null) {
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

export default router;
