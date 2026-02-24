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
  type ProgressSession,
} from "../utils/upload-helpers.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVICE_ROOT = path.resolve(__dirname, "..", "..");

const CHUNKS_DIR = path.join(os.tmpdir(), "cloudvault-tdlib", "chunks");

// Ensure base chunks directory exists
if (!fs.existsSync(CHUNKS_DIR)) {
  fs.mkdirSync(CHUNKS_DIR, { recursive: true });
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
const sessionCleanupTimer = setInterval(() => {
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
sessionCleanupTimer.unref(); // allow clean shutdown

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
router.post("/chunk", chunkUpload.single("chunk"), async (req: Request, res: Response) => {
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
  // Uses streams instead of readFileSync to keep memory usage low on 1 GB server.
  // Only out-of-order chunks stay on disk. With 5 parallel uploads, max buffered = 4 chunks × 10MB = 40MB.
  try {
    while (session.receivedChunks.has(session.nextFlushIndex)) {
      const flushPath = path.join(session.dir, String(session.nextFlushIndex));
      if (fs.existsSync(flushPath)) {
        const chunkSize = fs.statSync(flushPath).size;
        await new Promise<void>((resolve, reject) => {
          const readStream = fs.createReadStream(flushPath);
          const writeStream = fs.createWriteStream(session.assembledPath, { flags: "a" });
          readStream.pipe(writeStream);
          writeStream.on("finish", () => {
            session.assembledBytes += chunkSize;
            try { fs.unlinkSync(flushPath); } catch { /* ignore */ }
            resolve();
          });
          readStream.on("error", reject);
          writeStream.on("error", reject);
        });
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

    // ── Upload to Telegram (using shared helpers) ────────────────────────
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

    const sendParams = buildSendParams(channelId, assembledPath, fileName, mimeType);
    const documentFallbackParams = buildDocumentFallbackParams(channelId, assembledPath, fileName);

    // Ensure channel is loaded
    try {
      await ensureChannelLoaded(client, channelId);
    } catch (chErr) {
      cleanupTempFile(assembledPath);
      sessions.delete(uploadId);
      res.status(400).json({ error: (chErr as Error).message });
      return;
    }

    // sendMessage with media rejection fallback
    let sentMessage: Record<string, unknown>;
    try {
      const pending = await invokeWithSlot(client, sendParams);
      sentMessage = await waitForMessageSent(client, pending, session.fileSize, session);
    } catch (sendErr) {
      const sendErrMsg = sendErr instanceof Error ? sendErr.message : String(sendErr);
      if (isMediaRejection(sendErrMsg)) {
        console.warn(`[ChunkedUpload] Media rejected (${sendErrMsg}), retrying as document...`);
        const pending = await invokeWithSlot(client, documentFallbackParams);
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
    const thumbnailData = await getThumbnailDataUri(client, fileInfo.thumbnailFileId);

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
    const waitSec = parseFloodWait(errMsg);
    if (waitSec !== null) {
      res
        .status(429)
        .set("Retry-After", String(waitSec))
        .json({ error: `Rate limited by Telegram. Retry after ${waitSec} seconds.`, retry_after: waitSec });
      return;
    }

    res.status(500).json({ error: `Chunked upload failed: ${errMsg}` });
  }
});

export default router;
