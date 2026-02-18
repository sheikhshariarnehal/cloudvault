import { Router, Request, Response } from "express";
import uploadRouter from "./upload.route";
import downloadRouter from "./download.route";

const router = Router();

// Health check — no auth required (excluded in apiKey middleware)
router.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Core routes
router.use("/upload", uploadRouter);
router.use("/download", downloadRouter);

export default router;
