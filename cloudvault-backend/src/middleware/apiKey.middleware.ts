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
  // Allow health check without auth
  if (req.path === "/health") {
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
