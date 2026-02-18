import { Router, Request, Response } from "express";
import uploadRouter from "./upload.route";
import downloadRouter from "./download.route";
import { getProgressEmitter } from "../services/progress.service";

const router = Router();

// Health check — no auth required (excluded in apiKey middleware)
router.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

/**
 * SSE endpoint: GET /upload/progress/:uploadId
 * Streams real GramJS upload progress (0–100) as Server-Sent Events.
 * Auth is skipped in apiKey middleware because EventSource cannot send headers;
 * the uploadId UUID acts as a short-lived secret.
 */
router.get("/upload/progress/:uploadId", (req: Request, res: Response) => {
  const uploadId = String(req.params.uploadId);
  const emitter = getProgressEmitter(uploadId);

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  if (!emitter) {
    // Upload not found or already finished — send 100 and close
    res.write("data: 100\n\n");
    res.end();
    return;
  }

  const onProgress = (pct: number) => {
    res.write(`data: ${pct}\n\n`);
  };

  emitter.on("progress", onProgress);

  // Clean up when client disconnects
  req.on("close", () => {
    emitter.off("progress", onProgress);
  });
});

// Core routes
router.use("/upload", uploadRouter);
router.use("/download", downloadRouter);

export default router;
