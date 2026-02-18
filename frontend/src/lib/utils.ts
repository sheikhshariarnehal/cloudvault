import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Encode a UUID into a compact base64url token (22 chars).
 * e.g. "b0586168-4f90-4d29-90dc-799a35e916f4" → "sFhhZE-QTSmQ3HmaNekhb0"
 */
export function encodeFileToken(uuid: string): string {
  const hex = uuid.replace(/-/g, "");
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  // Convert to base64, then to base64url
  let b64 = "";
  if (typeof Buffer !== "undefined") {
    b64 = Buffer.from(bytes).toString("base64");
  } else {
    b64 = btoa(String.fromCharCode(...bytes));
  }
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Decode a base64url token back to a UUID string.
 */
export function decodeFileToken(token: string): string {
  // Restore base64 padding
  let b64 = token.replace(/-/g, "+").replace(/_/g, "/");
  while (b64.length % 4) b64 += "=";

  let bytes: Uint8Array;
  if (typeof Buffer !== "undefined") {
    bytes = new Uint8Array(Buffer.from(b64, "base64"));
  } else {
    bytes = new Uint8Array(
      atob(b64).split("").map((c) => c.charCodeAt(0))
    );
  }

  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return [
    hex.substring(0, 8),
    hex.substring(8, 12),
    hex.substring(12, 16),
    hex.substring(16, 20),
    hex.substring(20, 32),
  ].join("-");
}

/**
 * Generate a clean, professional file URL with encoded token + filename.
 * Result: /file/{shortToken}/{filename}
 * The raw UUID is never exposed in the URL.
 */
export function getFileUrl(fileId: string, fileName: string, download?: boolean): string {
  const token = encodeFileToken(fileId);
  const encodedName = encodeURIComponent(fileName);
  const base = `/file/${token}/${encodedName}`;
  return download ? `${base}?download=true` : base;
}
