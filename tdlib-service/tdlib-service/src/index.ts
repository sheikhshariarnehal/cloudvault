import { config } from "dotenv";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

// Load .env from the service root regardless of cwd
const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "..", ".env") });

import express from "express";
import { initLogger } from "./utils/logger.js";
initLogger(); // Initialize log interception

import { authMiddleware } from "./middleware/auth.js";
import { signedUrlAuth } from "./middleware/signed-url-auth.js";
import { sessionManager } from "./session-manager.js";
import { cleanupOldTempFiles } from "./utils/temp-file.js";
import uploadRouter from "./routes/upload.js";
import chunkedUploadRouter from "./routes/chunked-upload.js";
import downloadRouter, { logDiskStats } from "./routes/download.js";
import thumbnailRouter from "./routes/thumbnail.js";
import deleteRouter from "./routes/delete.js";
import telegramAuthRouter from "./routes/telegram-auth.js";
import adminRouter from "./routes/admin.js";

const app = express();
const PORT = parseInt(process.env.PORT || "3001", 10);

// ─── Global Middleware ───────────────────────────────────────────────
app.use(express.json({ limit: "10mb" }));

// CORS for direct browser access (chunk uploads + signed-URL downloads)
app.use((req, res, next) => {
  let origin = req.headers.origin;
  if (true) { origin = origin || '*' ;
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, HEAD, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Upload-Id, X-Chunk-Index, Range");
    res.setHeader("Access-Control-Expose-Headers", "Content-Length, Content-Type, Content-Disposition, Content-Range, Accept-Ranges");
    res.setHeader("Access-Control-Max-Age", "86400");
  }
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  next();
});

// Health check (no auth required)
app.get("/health", (_req, res) => {
  const stats = sessionManager.getStats();
  res.json({
    status: "ok",
    tdlib_ready: stats.botReady,
    active_sessions: stats.activeSessions,
    max_sessions: stats.maxSessions,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// ─── Chunked upload: /init and /chunk are public (browser direct) ────
// /complete requires API key (called from Vercel backend)
// Security: uploadId is 32-char random hex, unguessable
const chunkedUploadAuth = (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => {
  // Completion and job-inspection endpoints require API key auth.
  if (
    req.path === "/complete" ||
    req.path === "/complete-start" ||
    req.path === "/complete-status" ||
    req.path === "/complete-result"
  ) {
    return authMiddleware(req, res, next);
  }
  next();
};
app.use("/api/chunked-upload", chunkedUploadAuth, chunkedUploadRouter);

// ─── Protected API Routes ────────────────────────────────────────────
app.use("/api/upload", authMiddleware, uploadRouter);
app.use("/api/download", authMiddleware, downloadRouter);
app.use("/api/thumbnail", authMiddleware, thumbnailRouter);
app.use("/api/message", authMiddleware, deleteRouter);
app.use("/api/telegram", authMiddleware, telegramAuthRouter);
app.use("/api/admin", authMiddleware, adminRouter);

// ─── Static Admin Dashboard ──────────────────────────────────────────
// Requires users to supply the TDLIB_SERVICE_API_KEY inside the page UI
app.use("/admin", express.static(join(__dirname, "..", "public", "admin")));

// ─── Public signed-URL download route ────────────────────────────────
// Browser fetches files directly via signed short-lived tokens.
// signedUrlAuth verifies HMAC, injects payload, then reuses the same
// download handler — zero code duplication.
const requireSignedUrl = (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
) => {
  if (!req.signedPayload) {
    res.status(401).json({ error: "Signed URL required" });
    return;
  }
  next();
};
app.use("/api/dl", signedUrlAuth, requireSignedUrl, downloadRouter);

// ─── 404 Handler ─────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

// ─── Error Handler ───────────────────────────────────────────────────
app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error("[Server Error]", err);
    res.status(500).json({
      error: "Internal server error",
      message: err.message,
    });
  }
);

// ─── Startup ─────────────────────────────────────────────────────────
async function start() {
  console.log("╔══════════════════════════════════════════╗");
  console.log("║   CloudVault TDLib Service               ║");
  console.log("╚══════════════════════════════════════════╝");
  console.log("");

  // Initialize TDLib session manager (bot session)
  console.log("[Startup] Initializing session manager...");
  try {
    await sessionManager.initBot();
    console.log("[Startup] Session manager ready (bot session active)");
  } catch (err) {
    console.error("[Startup] Failed to initialize session manager:", err);
    process.exit(1);
  }

  // Log disk/cache stats once at startup so we can see disk usage in logs
  logDiskStats();

  // Start periodic temp file cleanup (every 30 minutes, files older than 1 hour)
  setInterval(() => {
    cleanupOldTempFiles(3600000);
  }, 30 * 60 * 1000).unref();

  // ── TDLib storage optimisation ────────────────────────────────────────
  // TDLib accumulates downloaded files in tdlib-files/ indefinitely.
  // optimizeStorage tells TDLib to delete files it has already fully sent
  // or that haven't been accessed recently, keeping disk use under control.
  // Runs once at startup (after 60 s delay) then every 6 hours.
  const runOptimizeStorage = async () => {
    try {
      const client = sessionManager.getBotClient();
      // Keep only files accessed in the last 6 hours; cap total at 8 GB.
      // Thumbnails are excluded (small, useful for quick preview).
      const result = await client.invoke({
        _: "optimizeStorage",
        size: 8 * 1024 * 1024 * 1024,   // 8 GB hard cap for TDLib files
        ttl: 6 * 60 * 60,               // delete files not accessed in 6 h
        count: 0,
        immunity_delay: 60,
        file_types: [
          { _: "fileTypeDocument" },
          { _: "fileTypeVideo" },
          { _: "fileTypeAudio" },
          { _: "fileTypePhoto" },
          { _: "fileTypeAnimation" },
        ],
        chat_ids: [],
        exclude_chat_ids: [],
        return_deleted_file_statistics: true,
      }) as { size: number; count: number };
      const freedMB = Math.round((result.size || 0) / 1024 / 1024);
      const files   = result.count || 0;
      if (files > 0) {
        console.log(`[TDLib] optimizeStorage freed ${freedMB} MB (${files} files removed)`);
      } else {
        console.log(`[TDLib] optimizeStorage: nothing to clean up`);
      }
      // Re-log disk stats so we can see the effect in logs
      logDiskStats();
    } catch (err) {
      console.warn("[TDLib] optimizeStorage failed:", err instanceof Error ? err.message : err);
    }
  };

  setTimeout(runOptimizeStorage, 60_000);                    // 60 s after boot
  setInterval(runOptimizeStorage, 6 * 60 * 60 * 1000).unref(); // then every 6 h

  // Start HTTP server
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Server] Listening on http://0.0.0.0:${PORT}`);
    console.log(`[Server] Health check: http://0.0.0.0:${PORT}/health`);
    console.log("");
    console.log("Endpoints:");
    console.log(`  POST   /api/upload`);
    console.log(`  POST   /api/chunked-upload/init`);
    console.log(`  POST   /api/chunked-upload/chunk`);
    console.log(`  POST   /api/chunked-upload/complete`);
    console.log(`  GET    /api/download/:remoteFileId`);
    console.log(`  GET    /api/download/status/:remoteFileId`);
    console.log(`  GET    /api/dl/:remoteFileId?sig=TOKEN  (public, signed-URL)`);
    console.log(`  GET    /api/thumbnail/:remoteFileId`);
    console.log(`  POST   /api/thumbnail/from-message`);
    console.log(`  DELETE /api/message/:chatId/:messageId`);
    console.log(`  POST   /api/message/cleanup`);
    console.log(`  POST   /api/telegram/send-code`);
    console.log(`  POST   /api/telegram/verify-code`);
    console.log(`  POST   /api/telegram/verify-password`);
    console.log(`  GET    /api/telegram/status/:userId`);
    console.log(`  POST   /api/telegram/disconnect`);
    console.log("");
  });
}

// ─── Graceful Shutdown ───────────────────────────────────────────────
async function shutdown(signal: string) {
  console.log(`\n[Shutdown] Received ${signal}, shutting down...`);
  await sessionManager.shutdown();
  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

// Unhandled rejection handler
process.on("unhandledRejection", (reason) => {
  console.error("[Unhandled Rejection]", reason);
});

start().catch((err) => {
  console.error("[Fatal]", err);
  process.exit(1);
});
