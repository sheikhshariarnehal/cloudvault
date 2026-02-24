/**
 * Shared concurrency limiter for TDLib uploads.
 *
 * Telegram MTProto chokes when many messages are sent simultaneously.
 * This module provides a single, process-wide queue so that upload.ts
 * and chunked-upload.ts share the same slot pool instead of running
 * independent limiters (which could double the actual concurrency).
 */

const MAX_CONCURRENT = parseInt(process.env.MAX_CONCURRENT_UPLOADS || "3", 10);
let activeUploads = 0;
const uploadQueue: Array<() => void> = [];

/**
 * Wait until a concurrency slot is available, then claim it.
 * Must be paired with `releaseUploadSlot()` in a `finally` block.
 */
export function acquireUploadSlot(): Promise<void> {
  return new Promise((resolve) => {
    if (activeUploads < MAX_CONCURRENT) {
      activeUploads++;
      resolve();
    } else {
      uploadQueue.push(() => {
        activeUploads++;
        resolve();
      });
    }
  });
}

/**
 * Release a concurrency slot, allowing the next queued upload to proceed.
 */
export function releaseUploadSlot(): void {
  activeUploads--;
  const next = uploadQueue.shift();
  if (next) next();
}

/**
 * Current concurrency stats (for logging / health checks).
 */
export function getUploadStats(): { active: number; queued: number; max: number } {
  return {
    active: activeUploads,
    queued: uploadQueue.length,
    max: MAX_CONCURRENT,
  };
}
