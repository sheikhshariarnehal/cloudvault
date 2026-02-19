import fs from "fs";
import path from "path";
import os from "os";
import crypto from "crypto";

const TEMP_DIR = path.join(os.tmpdir(), "cloudvault-tdlib");

// Ensure temp directory exists
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

/**
 * Generate a unique temp file path
 */
export function getTempFilePath(extension?: string): string {
  const id = crypto.randomBytes(16).toString("hex");
  const ext = extension ? `.${extension.replace(/^\./, "")}` : "";
  return path.join(TEMP_DIR, `${id}${ext}`);
}

/**
 * Clean up a temp file (ignores errors if file doesn't exist)
 */
export function cleanupTempFile(filePath: string): void {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch {
    console.warn(`[TempFile] Failed to clean up: ${filePath}`);
  }
}

/**
 * Clean up all temp files older than maxAgeMs (default: 1 hour)
 */
export function cleanupOldTempFiles(maxAgeMs: number = 3600000): void {
  try {
    if (!fs.existsSync(TEMP_DIR)) return;

    const now = Date.now();
    const files = fs.readdirSync(TEMP_DIR);

    for (const file of files) {
      const filePath = path.join(TEMP_DIR, file);
      const stat = fs.statSync(filePath);

      if (now - stat.mtimeMs > maxAgeMs) {
        fs.unlinkSync(filePath);
      }
    }
  } catch {
    console.warn("[TempFile] Cleanup sweep failed");
  }
}
