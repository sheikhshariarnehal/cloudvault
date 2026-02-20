import { config } from "dotenv";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

// Load .env from the service root regardless of cwd
const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "..", ".env") });

import express from "express";
import { authMiddleware } from "./middleware/auth.js";
import { getTDLibClient, closeTDLibClient, isClientReady } from "./tdlib-client.js";
import { cleanupOldTempFiles } from "./utils/temp-file.js";
import uploadRouter from "./routes/upload.js";
import chunkedUploadRouter from "./routes/chunked-upload.js";
import downloadRouter from "./routes/download.js";
import thumbnailRouter from "./routes/thumbnail.js";
import deleteRouter from "./routes/delete.js";

const app = express();
const PORT = parseInt(process.env.PORT || "3001", 10);

// ─── Global Middleware ───────────────────────────────────────────────
app.use(express.json({ limit: "10mb" }));

// CORS for direct chunk uploads from browser
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Upload-Id, X-Chunk-Index");
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
  res.json({
    status: "ok",
    tdlib_ready: isClientReady(),
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// ─── Public: chunk upload (auth via uploadId session token) ──────────
app.use("/api/chunked-upload/chunk", chunkedUploadRouter);

// ─── Protected API Routes ────────────────────────────────────────────
app.use("/api/upload", authMiddleware, uploadRouter);
app.use("/api/chunked-upload", authMiddleware, chunkedUploadRouter);
app.use("/api/download", authMiddleware, downloadRouter);
app.use("/api/thumbnail", authMiddleware, thumbnailRouter);
app.use("/api/message", authMiddleware, deleteRouter);

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

  // Initialize TDLib client
  console.log("[Startup] Initializing TDLib client...");
  try {
    await getTDLibClient();
    console.log("[Startup] TDLib client ready");
  } catch (err) {
    console.error("[Startup] Failed to initialize TDLib:", err);
    process.exit(1);
  }

  // Start periodic temp file cleanup (every 30 minutes)
  setInterval(() => {
    cleanupOldTempFiles(3600000); // Clean files older than 1 hour
  }, 30 * 60 * 1000);

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
    console.log(`  GET    /api/thumbnail/:remoteFileId`);
    console.log(`  POST   /api/thumbnail/from-message`);
    console.log(`  DELETE /api/message/:chatId/:messageId`);
    console.log(`  POST   /api/message/cleanup`);
    console.log("");
  });
}

// ─── Graceful Shutdown ───────────────────────────────────────────────
async function shutdown(signal: string) {
  console.log(`\n[Shutdown] Received ${signal}, shutting down...`);
  await closeTDLibClient();
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
