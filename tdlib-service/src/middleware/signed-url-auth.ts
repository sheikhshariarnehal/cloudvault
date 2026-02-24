/**
 * Middleware that authenticates requests using a signed URL token.
 *
 * When a request has a `sig` query parameter, this middleware verifies the
 * HMAC signature and checks expiry. On success it injects the decoded
 * payload into `req.signedPayload` and rewrites `req.params.remoteFileId`
 * so the existing download handler can serve the file.
 *
 * When no `sig` param is present, the request falls through (allowing the
 * standard X-API-Key auth to run instead).
 */

import { Request, Response, NextFunction } from "express";
import { verifySignedToken, type SignedTokenPayload } from "../utils/signed-url.js";

// Extend Express Request to carry the decoded payload
declare global {
  namespace Express {
    interface Request {
      signedPayload?: SignedTokenPayload;
    }
  }
}

/**
 * Express middleware: verify `?sig=` signed token.
 * Falls through to next() on success, or returns 401/403 on failure.
 * If the request has no `sig` param this middleware does nothing (next()).
 */
export function signedUrlAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const token = req.query.sig as string | undefined;

  // No signed token → let the next middleware handle auth
  if (!token) {
    next();
    return;
  }

  const secret = process.env.TDLIB_SERVICE_API_KEY;
  if (!secret) {
    res.status(500).json({ error: "Service misconfigured" });
    return;
  }

  const payload = verifySignedToken(token, secret);
  if (!payload) {
    res.status(403).json({ error: "Invalid or expired signed URL" });
    return;
  }

  // Inject the decoded payload so the download handler can use it
  req.signedPayload = payload;

  // Pre-populate query params that the download handler reads
  // (only set values not already present from the original query string)
  req.query.mime_type = payload.ct;
  req.query.filename = payload.fn;
  // inline — honour the URL query param if present; default to "true"
  if (req.query.inline === undefined) {
    req.query.inline = "true";
  }
  if (payload.mid) {
    req.query.message_id = String(payload.mid);
  }

  next();
}
