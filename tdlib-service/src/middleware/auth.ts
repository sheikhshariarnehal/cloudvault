import { Request, Response, NextFunction } from "express";

/**
 * Middleware to verify API key authentication.
 * Expects: Authorization: Bearer <TDLIB_SERVICE_API_KEY>
 */
export function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const apiKey = process.env.TDLIB_SERVICE_API_KEY;

  if (!apiKey) {
    console.error("[Auth] TDLIB_SERVICE_API_KEY not configured");
    res.status(500).json({ error: "Service misconfigured" });
    return;
  }

  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or invalid Authorization header" });
    return;
  }

  const token = authHeader.slice(7);

  if (token !== apiKey) {
    res.status(403).json({ error: "Invalid API key" });
    return;
  }

  next();
}
