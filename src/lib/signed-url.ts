/**
 * Create HMAC-signed download tokens on the Vercel side.
 *
 * These tokens allow the browser to fetch files directly from the
 * TDLib service (DigitalOcean) without proxying through Vercel.
 *
 * Token format:  base64url(JSON payload) + "." + base64url(HMAC-SHA256)
 * Default TTL:   15 minutes
 */

import crypto from "crypto";

/** Payload embedded inside every signed download token. */
export interface SignedTokenPayload {
  /** Telegram remote file_id */
  fid: string;
  /** Telegram message_id */
  mid?: number;
  /** MIME type */
  ct: string;
  /** Original filename */
  fn: string;
  /** File size in bytes */
  sz?: number;
  /** Expiry (seconds since epoch) */
  exp: number;
}

const DEFAULT_TTL_SEC = 15 * 60; // 15 minutes

function toBase64Url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Create a short-lived HMAC-signed token carrying the file metadata.
 * The TDLib service verifies this token and streams the file directly.
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
 * Build the full direct-download URL pointing at the TDLib service.
 *
 * @param backendUrl  Public URL of the TDLib service (e.g. https://your-do-app.ondigitalocean.app)
 * @param token       The HMAC-signed token from `createSignedToken()`
 * @param remoteFileId  Telegram remote file_id
 * @param fileName    Human-readable filename (for Content-Disposition)
 */
export function buildDirectUrl(
  backendUrl: string,
  token: string,
  remoteFileId: string,
  fileName: string,
): string {
  const base = backendUrl.replace(/\/+$/, "");
  return `${base}/api/dl/${encodeURIComponent(remoteFileId)}?sig=${encodeURIComponent(token)}&filename=${encodeURIComponent(fileName)}`;
}
