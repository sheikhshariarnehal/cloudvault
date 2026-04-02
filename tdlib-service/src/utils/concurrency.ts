/**
 * Shared concurrency limiter for TDLib uploads.
 *
 * Telegram MTProto chokes when many messages are sent simultaneously.
 * This module provides a single, process-wide queue so that upload.ts
 * and chunked-upload.ts share the same slot pool instead of running
 * independent limiters (which could double the actual concurrency).
 */

const MAX_CONCURRENT = Math.max(1, parseInt(process.env.MAX_CONCURRENT_UPLOADS || "1", 10));
let activeUploads = 0;
const uploadQueue: Array<() => void> = [];
let rateLimitUntil = 0;
let cooldownTimer: NodeJS.Timeout | null = null;

function getCooldownMs(): number {
  return Math.max(0, rateLimitUntil - Date.now());
}

function scheduleDrain(): void {
  if (uploadQueue.length === 0) return;

  const cooldownMs = getCooldownMs();
  if (cooldownMs <= 0) {
    queueMicrotask(drainQueue);
    return;
  }

  if (cooldownTimer) return;
  cooldownTimer = setTimeout(() => {
    cooldownTimer = null;
    drainQueue();
  }, cooldownMs);
  cooldownTimer.unref?.();
}

function drainQueue(): void {
  const cooldownMs = getCooldownMs();
  if (cooldownMs > 0) {
    scheduleDrain();
    return;
  }

  while (activeUploads < MAX_CONCURRENT && uploadQueue.length > 0) {
    const next = uploadQueue.shift();
    if (!next) return;
    activeUploads++;
    next();
  }
}

/**
 * Wait until a concurrency slot is available, then claim it.
 * Must be paired with `releaseUploadSlot()` in a `finally` block.
 */
export function acquireUploadSlot(): Promise<void> {
  return new Promise((resolve) => {
    uploadQueue.push(resolve);
    drainQueue();
  });
}

/**
 * Release a concurrency slot, allowing the next queued upload to proceed.
 */
export function releaseUploadSlot(): void {
  activeUploads = Math.max(0, activeUploads - 1);
  drainQueue();
}

/**
 * Apply a global cooldown when Telegram responds with FLOOD_WAIT / retry_after.
 * New uploads will remain queued until the cooldown expires.
 */
export function markUploadRateLimited(retryAfterSeconds: number): void {
  const safeSeconds = Number.isFinite(retryAfterSeconds)
    ? Math.max(1, Math.ceil(retryAfterSeconds))
    : 1;
  const nextUntil = Date.now() + safeSeconds * 1000;

  if (nextUntil > rateLimitUntil) {
    rateLimitUntil = nextUntil;
  }

  if (cooldownTimer) {
    clearTimeout(cooldownTimer);
    cooldownTimer = null;
  }

  scheduleDrain();
}

/**
 * Current concurrency stats (for logging / health checks).
 */
export function getUploadStats(): { active: number; queued: number; max: number; cooldownMs: number } {
  return {
    active: activeUploads,
    queued: uploadQueue.length,
    max: MAX_CONCURRENT,
    cooldownMs: getCooldownMs(),
  };
}
