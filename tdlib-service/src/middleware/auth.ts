import { Request, Response, NextFunction } from "express";

/**
 * Middleware to verify API key authentication.
 * Accepts either:
 *   - Authorization: Bearer <TDLIB_SERVICE_API_KEY>
 *   - X-API-Key: <TDLIB_SERVICE_API_KEY>
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

  // Try X-API-Key header first, then Authorization: Bearer
  const xApiKey = req.headers["x-api-key"] as string | undefined;
  const authHeader = req.headers.authorization;

  let token: string | undefined;

  if (xApiKey) {
    token = xApiKey;
  } else if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.slice(7);
  }

  if (!token) {
    res.status(401).json({ error: "Missing X-API-Key or Authorization header" });
    return;
  }

  if (token !== apiKey) {
    res.status(403).json({ error: "Invalid API key" });
    return;
  }

  next();
}
