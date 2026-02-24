/**
 * HMAC-based signed URL tokens for direct browser → TDLib service downloads.
 *
 * Flow:
 *   1. Vercel authenticates the user and looks up the file in Supabase.
 *   2. Vercel calls `createSignedToken(payload, secret)` → compact URL-safe token.
 *   3. Browser navigates to `https://do-service/api/dl/{token}/{filename}`.
 *   4. TDLib service calls `verifySignedToken(token, secret)` → payload or null.
 *
 * Token format:  base64url(JSON payload) + "." + base64url(HMAC-SHA256 signature)
 *
 * The token is short-lived (default 15 min) — enough for preview/download
 * but not a permanent link. The secret is the shared TDLIB_SERVICE_API_KEY.
 */

import crypto from "crypto";

/** Payload embedded inside every signed download token. */
export interface SignedTokenPayload {
  /** Telegram remote file_id (string) */
  fid: string;
  /** Telegram message_id for file-reference refresh */
  mid?: number;
  /** MIME type */
  ct: string;
  /** Original filename */
  fn: string;
  /** File size in bytes (for Content-Length) */
  sz?: number;
  /** Expiry timestamp (seconds since epoch) */
  exp: number;
}

const DEFAULT_TTL_SEC = 15 * 60; // 15 minutes

function toBase64Url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(str: string): Buffer {
  let b64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (b64.length % 4) b64 += "=";
  return Buffer.from(b64, "base64");
}

/**
 * Create a signed download token.
 *
 * @param payload  File metadata to embed in the token
 * @param secret   Shared secret (TDLIB_SERVICE_API_KEY)
 * @param ttlSec   Token lifetime in seconds (default 15 min)
 */
export function createSignedToken(
  payload: Omit<SignedTokenPayload, "exp">,
  secret: string,
  ttlSec: number = DEFAULT_TTL_SEC,
): string {
  const full: SignedTokenPayload = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + ttlSec,
  };

  const payloadBuf = Buffer.from(JSON.stringify(full), "utf-8");
  const payloadB64 = toBase64Url(payloadBuf);

  const hmac = crypto.createHmac("sha256", secret).update(payloadB64).digest();
  const sigB64 = toBase64Url(hmac);

  return `${payloadB64}.${sigB64}`;
}

/**
 * Verify a signed download token.
 *
 * @returns The decoded payload if valid and not expired, or `null`.
 */
export function verifySignedToken(
  token: string,
  secret: string,
): SignedTokenPayload | null {
  const dotIdx = token.indexOf(".");
  if (dotIdx === -1) return null;

  const payloadB64 = token.substring(0, dotIdx);
  const sigB64 = token.substring(dotIdx + 1);

  // Verify HMAC
  const expectedSig = toBase64Url(
    crypto.createHmac("sha256", secret).update(payloadB64).digest(),
  );
  if (sigB64 !== expectedSig) return null;

  // Decode payload
  let payload: SignedTokenPayload;
  try {
    payload = JSON.parse(fromBase64Url(payloadB64).toString("utf-8"));
  } catch {
    return null;
  }

  // Check expiry
  if (payload.exp < Math.floor(Date.now() / 1000)) {
    return null;
  }

  return payload;
}
