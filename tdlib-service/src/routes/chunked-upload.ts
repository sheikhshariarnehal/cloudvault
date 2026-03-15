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
import { sessionManager } from "../session-manager.js";
import { cleanupTempFile } from "../utils/temp-file.js";
import {
  sendMessageWithFallback,
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
  /** Storage routing: 'bot' (guest/legacy) or 'user' (personal Telegram). */
  storageType: string;
  /** Supabase user ID — needed to resolve user TDLib session on /complete. */
  userId: string | null;
  /** Persistent write stream — stays open entire session, prevents EBUSY on Windows */
  writeStream: fs.WriteStream;
  /** Serialises all writes to the assembled file — prevents EBUSY on Windows */
  flushLock: Promise<void>;
}

type CompleteJobState = "assembling" | "uploading" | "success" | "failed";

interface CompleteJob {
  jobId: string;
  uploadId: string;
  state: CompleteJobState;
  error: string | null;
  result: Record<string, unknown> | null;
  createdAt: number;
  updatedAt: number;
}

const sessions = new Map<string, UploadSession>();
const completeJobs = new Map<string, CompleteJob>();
const uploadToJobId = new Map<string, string>();

// Clean up stale sessions every 15 minutes
const sessionCleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (now - session.createdAt > 60 * 60 * 1000) {
      // 1 hour expiry
      cleanupSession(session);
      sessions.delete(id);
      console.log(`[ChunkedUpload] Expired session ${id}`);
    }
  }
}, 15 * 60 * 1000);
sessionCleanupTimer.unref(); // allow clean shutdown

const completeJobCleanupTimer = setInterval(() => {
  const now = Date.now();
  const ttlMs = 60 * 60 * 1000;
  for (const [jobId, job] of completeJobs) {
    if (now - job.updatedAt > ttlMs) {
      completeJobs.delete(jobId);
      if (uploadToJobId.get(job.uploadId) === jobId) {
        uploadToJobId.delete(job.uploadId);
      }
    }
  }
}, 15 * 60 * 1000);
completeJobCleanupTimer.unref();

function generateJobId(): string {
  return `${Date.now()}-${crypto.randomBytes(6).toString("hex")}`;
}

async function appendChunkToAssembled(session: UploadSession, chunkPath: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const readStream = fs.createReadStream(chunkPath);
    let writtenBytes = 0;

    const fail = (err: Error) => {
      readStream.destroy();
      reject(err);
    };

    readStream.on("error", fail);

    readStream.on("data", (chunk) => {
      const data = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      writtenBytes += data.length;
      const canContinue = session.writeStream.write(data);
      if (!canContinue) {
        readStream.pause();
        session.writeStream.once("drain", () => readStream.resume());
      }
    });

    readStream.on("end", () => {
      session.assembledBytes += writtenBytes;
      try { fs.unlinkSync(chunkPath); } catch { /* ignore */ }
      resolve();
    });
  });
}

async function flushContiguousChunks(session: UploadSession): Promise<void> {
  while (session.receivedChunks.has(session.nextFlushIndex)) {
    const flushPath = path.join(session.dir, String(session.nextFlushIndex));
    if (fs.existsSync(flushPath)) {
      await appendChunkToAssembled(session, flushPath);
    }
    session.nextFlushIndex++;
  }
}

function getMissingChunks(session: UploadSession): number[] {
  const missing: number[] = [];
  for (let i = 0; i < session.totalChunks; i++) {
    if (!session.receivedChunks.has(i)) missing.push(i);
  }
  return missing;
}

async function closeWriteStream(session: UploadSession): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    session.writeStream.end((err: Error | undefined) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

async function performCompleteUpload(session: UploadSession, uploadId: string): Promise<Record<string, unknown>> {
  await session.flushLock;

  try {
    await flushContiguousChunks(session);
  } catch (flushErr) {
    console.error(`[ChunkedUpload] Final flush error:`, flushErr);
    throw flushErr;
  }

  await closeWriteStream(session);
  cleanupSessionDir(session.dir);

  const assembledPath = session.assembledPath;
  const stats = fs.statSync(assembledPath);
  console.log(`[ChunkedUpload] Assembled file: ${stats.size} bytes (expected ${session.fileSize})`);

  if (stats.size === 0) {
    cleanupTempFile(assembledPath);
    sessions.delete(uploadId);
    throw new Error("Assembled file is empty");
  }

  const { client, chatId, actualStorageType, sessionExpired } = await sessionManager.resolveClientAndChat(
    session.storageType,
    session.userId || undefined,
  );

  const { sentMessage, fileInfo } = await sendMessageWithFallback(
    client,
    chatId,
    assembledPath,
    session.fileName,
    session.mimeType,
    session.fileSize,
    session,
  );

  return {
    file_id: fileInfo.remoteFileId,
    tdlib_file_id: fileInfo.tdlibFileId,
    message_id: sentMessage.id,
    thumbnail_data: null,
    file_size: fileInfo.size,
    chat_id: chatId,
    storage_type: actualStorageType,
    session_expired: sessionExpired || false,
  };
}

function startCompleteJob(jobId: string, uploadId: string, session: UploadSession): void {
  const job = completeJobs.get(jobId);
  if (!job) return;

  void (async () => {
    try {
      job.state = "uploading";
      job.updatedAt = Date.now();
      const result = await performCompleteUpload(session, uploadId);
      job.state = "success";
      job.result = result;
      job.updatedAt = Date.now();
      cleanupTempFile(session.assembledPath);
      sessions.delete(uploadId);
    } catch (err) {
      cleanupTempFile(session.assembledPath);
      sessions.delete(uploadId);
      const errMsg = err instanceof Error ? err.message : String(err);
      job.state = "failed";
      job.error = errMsg;
      job.updatedAt = Date.now();
      console.error("[ChunkedUpload] Async complete error:", err);
    }
  })();
}

function cleanupSessionDir(dir: string) {
  try {
    if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    console.warn(`[ChunkedUpload] Failed to clean up dir: ${dir}`);
  }
}

function cleanupSession(session: UploadSession) {
  try {
    session.writeStream.end(); // Close stream if still open
  } catch { /* ignore */ }
  cleanupSessionDir(session.dir);
  cleanupTempFile(session.assembledPath);
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
  const { fileName, fileSize, mimeType, totalChunks, storageType, userId } = req.body;

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

  // Create persistent write stream that stays open for entire upload session
  const writeStream = fs.createWriteStream(assembledPath, { flags: "w" });

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
    storageType: storageType || "bot",
    userId: userId || null,
    writeStream,
    flushLock: Promise.resolve(),
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

  // ── Progressive flush: serialised through flushLock to prevent EBUSY ───
  // Multiple concurrent chunk handlers call this, but only one write runs
  // at a time thanks to the promise chain. Uses persistent WriteStream.
  const doFlush = async () => {
    await flushContiguousChunks(session);
  };

  // Chain onto the lock — each flush waits for the previous one to finish
  session.flushLock = session.flushLock.then(doFlush).catch((flushErr) => {
    console.warn(`[ChunkedUpload] Flush error for ${uploadId}:`, flushErr);
  });

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
// POST /api/chunked-upload/complete-start
// Starts Telegram upload in background and returns a jobId immediately.
// ─────────────────────────────────────────────────────────────────────────────
router.post("/complete-start", (req: Request, res: Response) => {
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

  const existingJobId = uploadToJobId.get(uploadId);
  if (existingJobId) {
    const job = completeJobs.get(existingJobId);
    if (job) {
      res.status(200).json({ jobId: existingJobId, state: job.state });
      return;
    }
  }

  const missing = getMissingChunks(session);
  if (missing.length > 0) {
    res.status(400).json({
      error: `Missing chunks: received ${session.receivedChunks.size} of ${session.totalChunks}`,
      missing,
    });
    return;
  }

  const jobId = generateJobId();
  const job: CompleteJob = {
    jobId,
    uploadId,
    state: "assembling",
    error: null,
    result: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  completeJobs.set(jobId, job);
  uploadToJobId.set(uploadId, jobId);
  startCompleteJob(jobId, uploadId, session);

  res.status(202).json({ jobId, state: job.state });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/chunked-upload/complete-status?jobId=xxx
// ─────────────────────────────────────────────────────────────────────────────
router.get("/complete-status", (req: Request, res: Response) => {
  const jobId = req.query.jobId as string;
  if (!jobId) {
    res.status(400).json({ error: "Missing jobId" });
    return;
  }

  const job = completeJobs.get(jobId);
  if (!job) {
    res.status(404).json({ error: "Complete job not found or expired" });
    return;
  }

  const session = sessions.get(job.uploadId);
  res.status(200).json({
    jobId,
    uploadId: job.uploadId,
    state: job.state,
    telegramProgress: session?.telegramProgress ?? (job.state === "success" ? 1 : 0),
    error: job.error,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/chunked-upload/complete-result?jobId=xxx
// ─────────────────────────────────────────────────────────────────────────────
router.get("/complete-result", (req: Request, res: Response) => {
  const jobId = req.query.jobId as string;
  if (!jobId) {
    res.status(400).json({ error: "Missing jobId" });
    return;
  }

  const job = completeJobs.get(jobId);
  if (!job) {
    res.status(404).json({ error: "Complete job not found or expired" });
    return;
  }

  if (job.state === "failed") {
    const waitSec = parseFloodWait(job.error || "");
    if (waitSec !== null) {
      res
        .status(429)
        .set("Retry-After", String(waitSec))
        .json({ error: `Rate limited by Telegram. Retry after ${waitSec} seconds.`, retry_after: waitSec });
      return;
    }

    res.status(500).json({ error: `Chunked upload failed: ${job.error || "Unknown error"}` });
    return;
  }

  if (job.state !== "success" || !job.result) {
    res.status(202).json({ jobId, state: job.state });
    return;
  }

  res.status(200).json(job.result);
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

  const missing = getMissingChunks(session);
  if (missing.length > 0) {
    res.status(400).json({
      error: `Missing chunks: received ${session.receivedChunks.size} of ${session.totalChunks}`,
      missing,
    });
    return;
  }

  try {
    const result = await performCompleteUpload(session, uploadId);

    res.status(201).json(result);

    // Cleanup in background (don't block response)
    cleanupTempFile(session.assembledPath);
    sessions.delete(uploadId);
  } catch (err) {
    cleanupTempFile(session.assembledPath);
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
