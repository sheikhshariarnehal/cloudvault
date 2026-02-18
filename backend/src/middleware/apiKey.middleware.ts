import { Request, Response, NextFunction } from "express";
import { timingSafeEqual } from "crypto";
import { config } from "../config/env";

/**
 * Middleware that validates the X-API-Key header using constant-time comparison.
 */
export function apiKeyMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Allow health check and SSE progress stream without API-key auth.
  // The progress uploadId UUID acts as its own secret (only the uploading
  // client knows it), and EventSource cannot send custom headers.
  if (req.path === "/health" || req.path.startsWith("/upload/progress/")) {
    next();
    return;
  }

  const provided = req.headers["x-api-key"];

  if (!provided || typeof provided !== "string") {
    res.status(401).json({ error: "Missing X-API-Key header" });
    return;
  }

  const expected = config.API_KEY;

  // Ensure both buffers are the same length for timingSafeEqual
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);

  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    res.status(401).json({ error: "Invalid API key" });
    return;
  }

  next();
}
