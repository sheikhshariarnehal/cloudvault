import { Router, Request, Response } from "express";
import fs from "fs";
import path from "path";
import { sessionManager } from "../session-manager.js";
import { streamFileToResponse, streamFileProgressively } from "../utils/stream.js";

const router = Router();

// ── Application-level file cache ─────────────────────────────────────────────
// Survives TDLib state resets and avoids re-downloading files already on disk.
//
// Two classes of cached files are tracked differently:
//   • TDLib-managed  – files in tdlib-files/documents|videos|photos|…
//                      TDLib owns their lifecycle; we only store the path in-memory
//                      and never delete them from disk ourselves.
//   • App-managed     – files we wrote to tdlib-files/temp/ (Bot API fallback,
//                      forward-refresh).  We are responsible for deleting them
//                      when they are evicted.
//
// Eviction strategy (runs every CACHE_SWEEP_INTERVAL_MS):
//   1. TTL  : evict app-managed entries untouched for > CACHE_TTL_MS.
//   2. Size : if total app-managed bytes > CACHE_MAX_BYTES, evict LRU entries
//             until under the cap.
//   3. Map  : if in-memory Map > MAX_MAP_ENTRIES, evict LRU entries from the
//             Map only (TDLib-managed files are not deleted from disk).
//
// Tunable via environment variables:
//   CACHE_MAX_SIZE_MB   (default 512 = 512 MB  — safe for a 25 GB DigitalOcean droplet)
//   CACHE_TTL_HOURS     (default 6  — free disk sooner on a small server)
//
// DigitalOcean / Railway disk budget (25 GB typical):
//   OS + Node + TDLib binary  ~2 GB
//   TDLib db + binlog          ~0.5 GB
//   TDLib downloaded files     up to ~10 GB (managed by optimizeStorage)
//   Uploads staging (temp)     up to ~2 GB
//   App-managed cache          CACHE_MAX_SIZE_MB  (default 512 MB)
//   Headroom                   ~10 GB free

interface CacheEntry {
  localPath: string;
  fileSize: number;       // bytes; 0 if unknown
  lastAccessedAt: number; // ms since epoch
  createdAt: number;
  isAppManaged: boolean;  // true → we may delete this file from disk
}

interface PersistedCacheEntry {
  remoteFileId: string;
  localPath: string;
  fileSize: number;
  lastAccessedAt: number;
  createdAt: number;
  isAppManaged: boolean;
}

const fileCache = new Map<string, CacheEntry>();

// DigitalOcean 1 GB RAM droplet defaults — set env vars to override
const CACHE_MAX_BYTES =
  parseInt(process.env.CACHE_MAX_SIZE_MB || "512", 10) * 1024 * 1024;
const CACHE_TTL_MS =
  parseFloat(process.env.CACHE_TTL_HOURS || "6") * 60 * 60 * 1000;
const MAX_MAP_ENTRIES = 500;             // ~150 KB RAM for the Map itself
const CACHE_SWEEP_INTERVAL_MS = 5 * 60 * 1000; // sweep every 5 minutes

const MB = 1024 * 1024;
const TDLIB_DOWNLOAD_PRIORITY = parseInt(process.env.TDLIB_DOWNLOAD_PRIORITY || "32", 10);
const PROGRESSIVE_THRESHOLD_BYTES =
  parseInt(process.env.DOWNLOAD_PROGRESSIVE_THRESHOLD_MB || "5", 10) * MB;
const ENABLE_PROGRESSIVE_FOR_LARGE =
  process.env.DOWNLOAD_PROGRESSIVE_FOR_LARGE !== "false";

function getFilesBasePath(): string {
  const rawFilesPath = process.env.TDLIB_FILES_PATH || "./tdlib-files";
  return path.isAbsolute(rawFilesPath)
    ? rawFilesPath
    : path.join(process.cwd(), rawFilesPath);
}

function getTempDirPath(): string {
  return path.join(getFilesBasePath(), "temp");
}

function getCacheIndexPath(): string {
  return path.join(getTempDirPath(), "cache-index.json");
}

let cacheIndexDirty = false;
let cacheIndexSaveTimer: NodeJS.Timeout | null = null;

function markCacheIndexDirty(): void {
  cacheIndexDirty = true;
  if (cacheIndexSaveTimer) return;
  cacheIndexSaveTimer = setTimeout(() => {
    cacheIndexSaveTimer = null;
    if (!cacheIndexDirty) return;
    cacheIndexDirty = false;
    saveCacheIndex();
  }, 2000);
  cacheIndexSaveTimer.unref();
}

function saveCacheIndex(): void {
  try {
    const tempDir = getTempDirPath();
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

    const entries: PersistedCacheEntry[] = [];
    for (const [remoteFileId, entry] of fileCache.entries()) {
      entries.push({
        remoteFileId,
        localPath: entry.localPath,
        fileSize: entry.fileSize,
        lastAccessedAt: entry.lastAccessedAt,
        createdAt: entry.createdAt,
        isAppManaged: entry.isAppManaged,
      });
    }

    fs.writeFileSync(
      getCacheIndexPath(),
      JSON.stringify({ savedAt: Date.now(), entries }),
      "utf8",
    );
  } catch (err) {
    console.warn("[Cache] Failed to save cache index:", err instanceof Error ? err.message : err);
  }
}

function loadCacheIndex(): void {
  try {
    const indexPath = getCacheIndexPath();
    if (!fs.existsSync(indexPath)) return;

    const raw = fs.readFileSync(indexPath, "utf8");
    const parsed = JSON.parse(raw) as { entries?: PersistedCacheEntry[] };
    const entries = Array.isArray(parsed.entries) ? parsed.entries : [];
    let restored = 0;

    for (const item of entries) {
      if (!item?.remoteFileId || !item.localPath) continue;
      if (!fs.existsSync(item.localPath)) continue;

      fileCache.set(item.remoteFileId, {
        localPath: item.localPath,
        fileSize: item.fileSize || 0,
        lastAccessedAt: item.lastAccessedAt || Date.now(),
        createdAt: item.createdAt || Date.now(),
        isAppManaged: !!item.isAppManaged,
      });
      restored++;
    }

    if (restored > 0) {
      console.log(`[Cache] Restored ${restored} entries from cache-index.json`);
    }
  } catch (err) {
    console.warn("[Cache] Failed to load cache index:", err instanceof Error ? err.message : err);
  }
}

function cleanupOrphanTempFiles(now: number, appManagedTrackedBytes: number): void {
  const tempDir = getTempDirPath();
  if (!fs.existsSync(tempDir)) return;

  const trackedAppManagedPaths = new Set(
    [...fileCache.values()]
      .filter((entry) => entry.isAppManaged)
      .map((entry) => path.normalize(entry.localPath)),
  );

  const orphanFiles: Array<{ fullPath: string; size: number; mtimeMs: number }> = [];
  for (const name of fs.readdirSync(tempDir)) {
    if (!name.startsWith("botapi_")) continue;
    const fullPath = path.join(tempDir, name);
    const normalized = path.normalize(fullPath);
    if (trackedAppManagedPaths.has(normalized)) continue;

    try {
      const stat = fs.statSync(fullPath);
      if (!stat.isFile()) continue;
      orphanFiles.push({ fullPath, size: stat.size, mtimeMs: stat.mtimeMs });
    } catch {
      // ignore transient files
    }
  }

  let orphanBytes = orphanFiles.reduce((sum, f) => sum + f.size, 0);

  // TTL cleanup for orphan files
  for (const file of orphanFiles) {
    if (now - file.mtimeMs <= CACHE_TTL_MS) continue;
    try {
      fs.unlinkSync(file.fullPath);
      orphanBytes -= file.size;
      console.log(`[Cache] Orphan TTL evict: ${file.fullPath}`);
    } catch {
      // ignore
    }
  }

  // Size cleanup for orphan files if tracked + orphan exceeds cap
  let totalAppManagedBytes = appManagedTrackedBytes + orphanBytes;
  if (totalAppManagedBytes > CACHE_MAX_BYTES) {
    const sortedByOldest = orphanFiles.sort((a, b) => a.mtimeMs - b.mtimeMs);
    for (const file of sortedByOldest) {
      if (totalAppManagedBytes <= CACHE_MAX_BYTES) break;
      try {
        if (!fs.existsSync(file.fullPath)) continue;
        fs.unlinkSync(file.fullPath);
        totalAppManagedBytes -= file.size;
        console.log(`[Cache] Orphan size evict: ${file.fullPath}`);
      } catch {
        // ignore
      }
    }
  }
}

/** True if this path was written by us (Bot API / forward-refresh downloads). */
function isAppManagedPath(p: string): boolean {
  return p.includes(`${path.sep}temp${path.sep}botapi_`) ||
         p.replace(/\\/g, "/").includes("/temp/botapi_");
}

/** Return cached local path (updates LRU timestamp), or null on miss/stale. */
function getCachedPath(remoteFileId: string): string | null {
  const entry = fileCache.get(remoteFileId);
  if (!entry) return null;
  if (fs.existsSync(entry.localPath)) {
    entry.lastAccessedAt = Date.now(); // LRU touch
    markCacheIndexDirty();
    return entry.localPath;
  }
  // File deleted externally — evict stale entry
  fileCache.delete(remoteFileId);
  return null;
}

/** Store a successful download in the app-level cache. */
function cacheFile(remoteFileId: string, localPath: string): void {
  let fileSize = 0;
  try { fileSize = fs.statSync(localPath).size; } catch { /* best effort */ }

  fileCache.set(remoteFileId, {
    localPath,
    fileSize,
    lastAccessedAt: Date.now(),
    createdAt: Date.now(),
    isAppManaged: isAppManagedPath(localPath),
  });

  markCacheIndexDirty();
}

/** Evict a single cache entry, deleting app-managed files from disk. */
function evictEntry(remoteFileId: string, entry: CacheEntry): void {
  fileCache.delete(remoteFileId);
  if (entry.isAppManaged) {
    try {
      if (fs.existsSync(entry.localPath)) fs.unlinkSync(entry.localPath);
    } catch { /* best effort */ }
  }

  markCacheIndexDirty();
}

/** Periodic sweep: TTL expiry → size cap → Map size cap. */
function runCacheSweep(): void {
  const now = Date.now();
  let appManagedBytes = 0;

  // Pass 1: evict TTL-expired app-managed entries & sum sizes
  for (const [id, entry] of fileCache) {
    if (entry.isAppManaged) {
      if (now - entry.lastAccessedAt > CACHE_TTL_MS) {
        console.log(`[Cache] TTL evict: ${entry.localPath} (idle ${Math.round((now - entry.lastAccessedAt) / 3600000)}h)`);
        evictEntry(id, entry);
      } else {
        appManagedBytes += entry.fileSize;
      }
    }
  }

  // Pass 2: size cap — evict LRU app-managed entries until under CACHE_MAX_BYTES
  if (appManagedBytes > CACHE_MAX_BYTES) {
    const appEntries = [...fileCache.entries()]
      .filter(([, e]) => e.isAppManaged)
      .sort(([, a], [, b]) => a.lastAccessedAt - b.lastAccessedAt); // oldest first

    for (const [id, entry] of appEntries) {
      if (appManagedBytes <= CACHE_MAX_BYTES) break;
      console.log(`[Cache] Size evict (${Math.round(appManagedBytes / 1024 / 1024)}MB > ${Math.round(CACHE_MAX_BYTES / 1024 / 1024)}MB): ${entry.localPath}`);
      appManagedBytes -= entry.fileSize;
      evictEntry(id, entry);
    }
  }

  // Pass 3: Map cap — evict oldest LRU entries (just from Map, not disk) if too many
  if (fileCache.size > MAX_MAP_ENTRIES) {
    const all = [...fileCache.entries()]
      .sort(([, a], [, b]) => a.lastAccessedAt - b.lastAccessedAt);
    const toRemove = fileCache.size - MAX_MAP_ENTRIES;
    for (let i = 0; i < toRemove; i++) {
      const [id, entry] = all[i];
      console.log(`[Cache] Map-cap evict: ${id.substring(0, 20)}…`);
      evictEntry(id, entry);
    }
  }

  cleanupOrphanTempFiles(now, appManagedBytes);

  const totalEntries = fileCache.size;
  const appMB = Math.round(appManagedBytes / 1024 / 1024);
  if (totalEntries > 0) {
    console.log(`[Cache] Sweep done — entries: ${totalEntries}, app-managed disk: ${appMB} MB`);
  }

  markCacheIndexDirty();
}

// Start the periodic sweep

export function getCacheStats() {
  let appManagedBytes = 0;
  const entries: any[] = [];
  for (const [id, entry] of fileCache.entries()) {
    if (entry.isAppManaged) appManagedBytes += entry.fileSize;
    entries.push({
      id: id.substring(0, 8) + '...',
      size: entry.fileSize,
      isAppManaged: entry.isAppManaged,
      lastAccessed: entry.lastAccessedAt
    });
  }
  return {
    totalEntries: fileCache.size,
    appManagedBytes,
    maxBytes: CACHE_MAX_BYTES,
    entries: entries.sort((a, b) => b.lastAccessed - a.lastAccessed)
  };
}

export function clearCache() {
  let clearedBytes = 0;
  let clearedCount = 0;
  for (const [id, entry] of fileCache) {
    if (entry.isAppManaged) {
      try {
        if (fs.existsSync(entry.localPath)) {
          fs.unlinkSync(entry.localPath);
          clearedBytes += entry.fileSize;
          clearedCount++;
        }
      } catch (err) { /* ignore */ }
    }
    fileCache.delete(id);
  }
  console.log(`[Cache] Admin triggered clear. Removed ${clearedCount} app-managed files (${Math.round(clearedBytes / 1024 / 1024)} MB).`);
  markCacheIndexDirty();
  return { clearedCount, clearedBytes };
}
loadCacheIndex();
setInterval(runCacheSweep, CACHE_SWEEP_INTERVAL_MS).unref();

/** Log disk usage of the tdlib-files directory (best-effort, non-blocking). */
export function logDiskStats(): void {
  try {
    const rawFilesPath = process.env.TDLIB_FILES_PATH || "./tdlib-files";
    const filesBase = path.isAbsolute(rawFilesPath)
      ? rawFilesPath
      : path.join(process.cwd(), rawFilesPath);

    function dirSize(dir: string): number {
      if (!fs.existsSync(dir)) return 0;
      return fs.readdirSync(dir).reduce((acc, name) => {
        const full = path.join(dir, name);
        try {
          const stat = fs.statSync(full);
          return acc + (stat.isDirectory() ? dirSize(full) : stat.size);
        } catch { return acc; }
      }, 0);
    }

    const totalBytes = dirSize(filesBase);
    const totalMB = Math.round(totalBytes / 1024 / 1024);
    const cacheMB = Math.round(CACHE_MAX_BYTES / 1024 / 1024);
    const ttlH = Math.round(CACHE_TTL_MS / 3600000);

    console.log("[Cache] ── Disk / Cache Configuration ─────────────────────────────");
    console.log(`[Cache]   tdlib-files total on disk : ${totalMB} MB`);
    console.log(`[Cache]   app-managed cache cap     : ${cacheMB} MB  (CACHE_MAX_SIZE_MB)`);
    console.log(`[Cache]   app-managed TTL           : ${ttlH}h  (CACHE_TTL_HOURS)`);
    console.log(`[Cache]   in-memory Map cap         : ${MAX_MAP_ENTRIES} entries`);
    console.log(`[Cache]   sweep interval            : ${CACHE_SWEEP_INTERVAL_MS / 60000} min`);
    console.log("[Cache] ───────────────────────────────────────────────────────────");
  } catch (err) {
    console.warn("[Cache] Could not compute disk stats:", err);
  }
}

/** Read config lazily so dotenv has time to load. */
function getChannelId(): number {
  return parseInt(process.env.TELEGRAM_CHANNEL_ID || "0", 10);
}
function getBotToken(): string {
  return process.env.TELEGRAM_BOT_TOKEN || "";
}

/**
 * Fallback: download a file via the Bot HTTP API.
 * Works for files up to 20 MB.  Returns the local path on success or null.
 */
async function downloadViaBotApi(remoteFileId: string): Promise<string | null> {
  const token = getBotToken();
  if (!token) return null;

  try {
    const resp = await fetch(
      `https://api.telegram.org/bot${token}/getFile?file_id=${encodeURIComponent(remoteFileId)}`
    );
    const json = await resp.json() as { ok: boolean; result?: { file_path?: string; file_size?: number } };
    if (!json.ok || !json.result?.file_path) return null;

    const filePath = json.result.file_path;
    console.log(`[Download][BotAPI] Got file_path: ${filePath}`);

    const fileResp = await fetch(
      `https://api.telegram.org/file/bot${token}/${filePath}`
    );
    if (!fileResp.ok) return null;

    const rawFilesPath = process.env.TDLIB_FILES_PATH || "./tdlib-files";
    const tempDir = path.isAbsolute(rawFilesPath)
      ? path.join(rawFilesPath, "temp")
      : path.join(process.cwd(), rawFilesPath, "temp");
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

    const tempFile = path.join(tempDir, `botapi_${Date.now()}_${Math.random().toString(36).slice(2)}`);
    const arrayBuffer = await fileResp.arrayBuffer();
    fs.writeFileSync(tempFile, Buffer.from(arrayBuffer));

    console.log(`[Download][BotAPI] Saved ${arrayBuffer.byteLength} bytes to ${tempFile}`);
    return tempFile;
  } catch (err) {
    console.warn("[Download][BotAPI] Fallback failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Refresh expired photo file references by forwarding the message via Bot API.
 * TDLib bot sessions cannot refresh file references (getMessage/getChatHistory
 * are unavailable). But the Bot API's forwardMessage returns a new Message
 * with fresh file_ids that we can then use.
 *
 * Returns { fresh_file_id, local_path } or null.
 */
async function refreshViaForward(
  tdlibMessageId: number,
  targetRemoteId: string,
): Promise<{ freshFileId: string; localPath: string } | null> {
  const token = getBotToken();
  const channelId = getChannelId();
  if (!token || !channelId) return null;

  // Convert TDLib message_id to Bot API server message_id
  // TDLib uses server_message_id * 1048576 for channel messages.
  // Some records already have plain server message IDs (<= 1048576).
  const serverMsgId = tdlibMessageId > 1048576
    ? Math.floor(tdlibMessageId / 1048576)
    : tdlibMessageId;
  if (serverMsgId < 1) return null;

  let forwardedMsgId: number | null = null;

  try {
    // 1. Forward the message to the same channel (creates a copy with fresh refs)
    const fwdResp = await fetch(`https://api.telegram.org/bot${token}/forwardMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: channelId,
        from_chat_id: channelId,
        message_id: serverMsgId,
      }),
    });
    const fwdJson = await fwdResp.json() as {
      ok: boolean;
      result?: {
        message_id?: number;
        photo?: Array<{ file_id: string; file_size?: number; width: number; height: number }>;
        document?: { file_id: string; file_size?: number };
        video?: { file_id: string; file_size?: number };
        audio?: { file_id: string; file_size?: number };
      };
    };

    if (!fwdJson.ok || !fwdJson.result) {
      console.warn(`[Download][Forward] forwardMessage failed for msg ${serverMsgId}:`, fwdJson);
      return null;
    }

    forwardedMsgId = fwdJson.result.message_id || null;
    const msg = fwdJson.result;

    // 2. Extract the fresh file_id from the forwarded message
    let freshFileId: string | null = null;

    if (msg.photo?.length) {
      // For photos, get the largest size (last in array)
      const largest = msg.photo[msg.photo.length - 1];
      freshFileId = largest.file_id;
    } else if (msg.document) {
      freshFileId = msg.document.file_id;
    } else if (msg.video) {
      freshFileId = msg.video.file_id;
    } else if (msg.audio) {
      freshFileId = msg.audio.file_id;
    }

    if (!freshFileId) {
      console.warn(`[Download][Forward] No file found in forwarded msg ${serverMsgId}`);
      return null;
    }

    console.log(`[Download][Forward] Got fresh file_id from forward: ${freshFileId.substring(0, 30)}...`);

    // 3. Download using the fresh file_id via Bot API
    const localPath = await downloadViaBotApi(freshFileId);
    if (localPath) {
      return { freshFileId, localPath };
    }

    return null;
  } catch (err) {
    console.warn("[Download][Forward] Refresh failed:", err instanceof Error ? err.message : err);
    return null;
  } finally {
    // 4. Clean up: delete the forwarded message
    if (forwardedMsgId) {
      try {
        await fetch(`https://api.telegram.org/bot${token}/deleteMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: channelId,
            message_id: forwardedMsgId,
          }),
        });
      } catch { /* best effort */ }
    }
  }
}

/**
 * GET /api/download/:remoteFileId
 * Download a file from Telegram via TDLib (MTProto).
 * Uses the Bot API-compatible remote file_id string.
 *
 * Query params:
 *   - filename: Optional filename for Content-Disposition
 *   - mime_type: Optional MIME type override
 *   - inline: If "true", use inline disposition (for preview)
 *   - message_id: Telegram channel message ID (for file-reference refresh)
 *
 * Supports Range headers for video seeking / resumable downloads.
 *
 * Download strategy (in order):
 *   1. Check TDLib local cache
 *   2. TDLib synchronous downloadFile
 *   3. Clear stale TDLib state + retry
 *   4. Refresh file reference via forwardMessage + Bot API fallback
 *   5. Bot HTTP API fallback (≤ 20 MB files)
 */
router.get(
  "/:remoteFileId",
  async (req: Request, res: Response) => {
    const { remoteFileId } = req.params;
    const requestStartedAt = Date.now();
    const rangeRequested = !!req.headers.range;
    const fileName = (req.query.filename as string) || "download";
    const mimeType = req.query.mime_type as string | undefined;
    const inline = req.query.inline === "true";
    const messageId = req.query.message_id
      ? parseInt(req.query.message_id as string, 10)
      : undefined;
    const storageType = (req.query.storage_type as string) || "bot";
    const userId = req.query.user_id as string | undefined;
    let fileSizeHint = 0;

    function logDownloadMetric(status: number, pathUsed: string, detail?: string): void {
      const elapsedMs = Date.now() - requestStartedAt;
      const sizeText = fileSizeHint > 0 ? String(fileSizeHint) : "unknown";
      const suffix = detail ? ` detail=${detail}` : "";
      console.log(
        `[Download][Metrics] status=${status} path=${pathUsed} range=${rangeRequested} size=${sizeText} elapsed_ms=${elapsedMs}${suffix}`,
      );
    }

    if (!remoteFileId) {
      res.status(400).json({ error: "Remote file ID required" });
      return;
    }

    // Quick-reject obviously invalid file IDs (e.g. numeric-only TDLib IDs stored by a past bug)
    if (/^\d+$/.test(remoteFileId)) {
      res.status(422).json({
        error: "Invalid file ID format (numeric-only). This file record needs repair.",
        needs_repair: true,
      });
      return;
    }

    const streamOpts = { fileName, mimeType, inline, rangeHeader: req.headers.range };

    // ─── 0. App-level cache (instant, no TDLib calls) ─────────────
    const cachedPath = getCachedPath(remoteFileId);
    if (cachedPath) {
      try { fileSizeHint = fs.statSync(cachedPath).size; } catch {}
      console.log(`[Download] App-cache HIT for ${remoteFileId.substring(0, 20)}… → ${cachedPath}`);
      logDownloadMetric(200, "app-cache-hit");
      streamFileToResponse(cachedPath, res, streamOpts);
      return;
    }

    try {
      const { client } = await sessionManager.resolveClientAndChat(storageType, userId);

      // ─── Helpers ──────────────────────────────────────────────────────

      /** Synchronous downloadFile; returns local path or null. */
      async function tryDownloadSync(fileId: number): Promise<string | null> {
        try {
          const dl = await client.invoke({
            _: "downloadFile",
            file_id: fileId,
            priority: TDLIB_DOWNLOAD_PRIORITY,
            offset: 0,
            limit: 0,
            synchronous: true,
          });
          const p = dl.local?.path as string;
          return (p && fs.existsSync(p)) ? p : null;
        } catch {
          return null;
        }
      }

      /** Clear any stale download / cache state for a file. */
      async function clearState(fileId: number): Promise<void> {
        try { await client.invoke({ _: "cancelDownloadFile", file_id: fileId, only_if_pending: false }); } catch {}
        try { await client.invoke({ _: "deleteFile", file_id: fileId }); } catch {}
        await new Promise(r => setTimeout(r, 200));
      }

      /**
       * Progressive download: start async TDLib download and stream file as it downloads.
       * Returns true on success (file cached) or false on failure (for fallback).
       */
      async function tryDownloadProgressively(fileId: number, sizeHintFallback = 0): Promise<boolean> {
        try {
          const info = await client.invoke({
            _: "getFile",
            file_id: fileId,
          });
          const expectedSize = (info.size as number) || (info.expected_size as number) || sizeHintFallback || 0;
          if (expectedSize <= 0) {
            console.warn(`[Download] Progressive: invalid expectedSize=${expectedSize}`);
            return false;
          }

          let downloadedSize = 0;
          let downloadError: Error | undefined;
          let isComplete = false;

          const progressObj = {
            getDownloadedSize: () => downloadedSize,
            getExpectedSize: () => expectedSize,
            isComplete: () => isComplete,
            getError: () => downloadError,
          };

          const listener = (update: any) => {
            if (update._ === "updateFile" && update.file?.id === fileId) {
              const file = update.file as Record<string, any>;
              const local = file.local as Record<string, any> | undefined;
              if (local?.downloaded_size !== undefined) {
                downloadedSize = local.downloaded_size;
              }
              if (local?.is_downloading_completed) {
                isComplete = true;
              }
            }
          };
          client.on("update", listener);

          let localPath: string | null = null;
          try {
            const dl = await client.invoke({
              _: "downloadFile",
              file_id: fileId,
              priority: TDLIB_DOWNLOAD_PRIORITY,
              offset: 0,
              limit: 0,
              synchronous: false,
            });
            localPath = (dl.local?.path as string) || null;
          } catch (err) {
            downloadError = err instanceof Error ? err : new Error(String(err));
            client.off("update", listener);
            return false;
          }

          if (!localPath) {
            console.warn(`[Download] Progressive: no local path available after async invoke`);
            client.off("update", listener);
            return false;
          }

          try {
            await streamFileProgressively(localPath, res, progressObj, streamOpts);
            if (!res.closed && isComplete) {
              try { fileSizeHint = fs.statSync(localPath).size; } catch {}
              cacheFile(remoteFileId, localPath);
              logDownloadMetric(200, "tdlib-progressive");
              console.log(`[Download] Progressive stream succeeded for ${remoteFileId.substring(0, 20)}…`);
            }
            return true;
          } catch (err) {
            console.warn(`[Download] Progressive streaming failed:`, err instanceof Error ? err.message : err);
            return false;
          } finally {
            client.off("update", listener);
          }
        } catch (err) {
          console.warn(`[Download] Progressive setup failed:`, err instanceof Error ? err.message : err);
          return false;
        }
      }

      // ─── 1. Resolve remote file_id → TDLib file object ────────────
      const remoteFile = await client.invoke({
        _: "getRemoteFile",
        remote_file_id: remoteFileId,
      });
      let tdlibFileId = remoteFile.id as number;

      if (!tdlibFileId) {
        res.status(404).json({ error: "File not found in Telegram" });
        return;
      }

      // ─── 2. Check TDLib local cache ────────────────────────────────
      {
        const info = await client.invoke({ _: "getFile", file_id: tdlibFileId });
        fileSizeHint = (info.size as number) || (info.expected_size as number)
          || parseInt(req.query.file_size as string || "0", 10) || 0;
        const local = info.local as Record<string, unknown> | undefined;
        if (local?.is_downloading_completed && local.path && fs.existsSync(local.path as string)) {
          cacheFile(remoteFileId, local.path as string);
          logDownloadMetric(200, "tdlib-local-hit");
          streamFileToResponse(local.path as string, res, streamOpts);
          return;
        }
      }

      // ─── 3. Try direct TDLib download ─────────────────────────────
      const forceProgressive = req.query.stream === "true" || process.env.ENABLE_PROGRESSIVE_DOWNLOAD === "true";
      const autoProgressive =
        ENABLE_PROGRESSIVE_FOR_LARGE &&
        !rangeRequested &&
        fileSizeHint >= PROGRESSIVE_THRESHOLD_BYTES;
      const wantStream = forceProgressive || autoProgressive;
      if (wantStream && !streamOpts.rangeHeader) {
        if (autoProgressive) {
          console.log(
            `[Download] Auto progressive enabled for ${remoteFileId.substring(0, 20)}… size=${fileSizeHint}`,
          );
        }
        if (await tryDownloadProgressively(tdlibFileId, fileSizeHint)) {
          return;
        }
        console.warn(`[Download] Progressive failed for ${tdlibFileId}, falling back to sync`);
      }

      let localPath = await tryDownloadSync(tdlibFileId);
      if (localPath) {
        try { fileSizeHint = fs.statSync(localPath).size; } catch {}
        cacheFile(remoteFileId, localPath);
        logDownloadMetric(200, "tdlib-sync");
        streamFileToResponse(localPath, res, streamOpts);
        return;
      }

      console.warn(`[Download] Direct TDLib download failed for file ${tdlibFileId}, attempting recovery...`);

      // ─── 4. Clear stale state & retry via TDLib ───────────────────
      await clearState(tdlibFileId);
      try {
        const fresh = await client.invoke({ _: "getRemoteFile", remote_file_id: remoteFileId });
        tdlibFileId = (fresh.id as number) || tdlibFileId;
      } catch {}

      localPath = await tryDownloadSync(tdlibFileId);
      if (localPath) {
        try { fileSizeHint = fs.statSync(localPath).size; } catch {}
        cacheFile(remoteFileId, localPath);
        logDownloadMetric(200, "tdlib-sync-retry");
        streamFileToResponse(localPath, res, streamOpts);
        return;
      }

      // ─── 4.5. Refresh file reference via channel message forward ──
      //     (Only for photo file_ids whose references expire)
      if (messageId) {
        console.log(`[Download] Refreshing via forwardMessage (tdlib_msg_id=${messageId})...`);
        const result = await refreshViaForward(messageId, remoteFileId);
        if (result) {
          try { fileSizeHint = fs.statSync(result.localPath).size; } catch {}
          cacheFile(remoteFileId, result.localPath);
          logDownloadMetric(200, "forward-refresh");
          streamFileToResponse(result.localPath, res, streamOpts);
          // File is now cached — don't delete it
          return;
        }
      }

      // ─── 5. Fallback: download via Bot HTTP API (≤ 20 MB) ────────
      console.log(`[Download] TDLib recovery failed, trying Bot HTTP API fallback...`);
      const botApiPath = await downloadViaBotApi(remoteFileId);
      if (botApiPath) {
        try { fileSizeHint = fs.statSync(botApiPath).size; } catch {}
        cacheFile(remoteFileId, botApiPath);
        logDownloadMetric(200, "bot-api-fallback");
        streamFileToResponse(botApiPath, res, streamOpts);
        // File is now cached — don't delete it
        return;
      }

      // ─── 6. All attempts exhausted ────────────────────────────────
      console.error(`[Download] ALL download methods failed for remote_id=${remoteFileId}`);
      logDownloadMetric(500, "all-methods-failed");
      res.status(500).json({ error: "File download has failed or was canceled" });
    } catch (err) {
      console.error("[Download] Error:", err);

      const errorMsg = err instanceof Error ? err.message : "Download failed";

      if (errorMsg.includes("Wrong remote file identifier")) {
        logDownloadMetric(404, "invalid-remote-file-id", errorMsg);
        res.status(404).json({ error: "Invalid file ID" });
        return;
      }

      logDownloadMetric(500, "exception", errorMsg);
      res.status(500).json({ error: errorMsg });
    }
  }
);

/**
 * POST /api/download/repair
 * Repair broken file records by forwarding their Telegram messages via Bot API
 * to obtain fresh, valid file_ids.
 *
 * Body (JSON):
 *   - records: Array of { db_id, telegram_message_id, telegram_file_id }
 *
 * For each record the original message is forwarded to the same channel
 * (which returns fresh file references), the file_id is extracted, and
 * the forwarded copy is deleted.
 *
 * Returns the correct remote file_id for each message.
 * The caller (frontend) is responsible for updating the database.
 */
router.post(
  "/repair",
  async (req: Request, res: Response) => {
    const { records } = req.body as {
      records: Array<{
        db_id: string;
        telegram_message_id: number;
        telegram_file_id: string;
      }>;
    };

    if (!records?.length) {
      res.status(400).json({ error: "No records provided" });
      return;
    }

    const token = getBotToken();
    const channelId = getChannelId();
    if (!token || !channelId) {
      res.status(500).json({ error: "Bot token or channel ID not configured" });
      return;
    }

    const results: Array<{
      db_id: string;
      old_file_id: string;
      new_file_id: string | null;
      status: string;
    }> = [];

    for (const rec of records) {
      // Convert message_id: TDLib IDs are server_id * 1048576 for channels
      const serverMsgId = rec.telegram_message_id > 1048576
        ? Math.floor(rec.telegram_message_id / 1048576)
        : rec.telegram_message_id;

      if (serverMsgId < 1) {
        results.push({ db_id: rec.db_id, old_file_id: rec.telegram_file_id, new_file_id: null, status: "invalid_message_id" });
        continue;
      }

      let forwardedMsgId: number | null = null;
      try {
        // Forward
        const fwdResp = await fetch(`https://api.telegram.org/bot${token}/forwardMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: channelId, from_chat_id: channelId, message_id: serverMsgId }),
        });
        const fwdJson = (await fwdResp.json()) as {
          ok: boolean;
          description?: string;
          result?: {
            message_id?: number;
            photo?: Array<{ file_id: string }>;
            document?: { file_id: string };
            video?: { file_id: string };
            audio?: { file_id: string };
            animation?: { file_id: string };
          };
        };

        if (!fwdJson.ok || !fwdJson.result) {
          results.push({ db_id: rec.db_id, old_file_id: rec.telegram_file_id, new_file_id: null, status: `forward_failed: ${fwdJson.description || "unknown"}` });
          continue;
        }

        forwardedMsgId = fwdJson.result.message_id || null;
        const msg = fwdJson.result;

        // Extract fresh file_id
        let freshFileId: string | null = null;
        if (msg.photo?.length) freshFileId = msg.photo[msg.photo.length - 1].file_id;
        else if (msg.document) freshFileId = msg.document.file_id;
        else if (msg.video) freshFileId = msg.video.file_id;
        else if (msg.audio) freshFileId = msg.audio.file_id;
        else if (msg.animation) freshFileId = msg.animation.file_id;

        if (!freshFileId) {
          results.push({ db_id: rec.db_id, old_file_id: rec.telegram_file_id, new_file_id: null, status: "no_file_in_message" });
          continue;
        }

        results.push({ db_id: rec.db_id, old_file_id: rec.telegram_file_id, new_file_id: freshFileId, status: "repaired" });
      } catch (err) {
        results.push({
          db_id: rec.db_id,
          old_file_id: rec.telegram_file_id,
          new_file_id: null,
          status: `error: ${err instanceof Error ? err.message : String(err)}`,
        });
      } finally {
        // Delete the forwarded message (best effort)
        if (forwardedMsgId) {
          try {
            await fetch(`https://api.telegram.org/bot${token}/deleteMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ chat_id: channelId, message_id: forwardedMsgId }),
            });
          } catch { /* best effort */ }
        }
      }

      // Small delay to avoid rate limiting
      await new Promise(r => setTimeout(r, 300));
    }

    const repaired = results.filter(r => r.status === "repaired").length;
    res.json({ total: records.length, repaired, results });
  }
);

/**
 * GET /api/download/status/:remoteFileId
 * Check if a file has been downloaded/cached locally by TDLib.
 */
router.get(
  "/status/:remoteFileId",
  async (req: Request, res: Response) => {
    const { remoteFileId } = req.params;

    try {
      const storageTypeStatus = (req.query.storage_type as string) || "bot";
      const userIdStatus = req.query.user_id as string | undefined;
      const { client } = await sessionManager.resolveClientAndChat(storageTypeStatus, userIdStatus);

      const remoteFile = await client.invoke({
        _: "getRemoteFile",
        remote_file_id: remoteFileId,
      });

      const tdlibFileId = remoteFile.id as number;
      const fileInfo = await client.invoke({
        _: "getFile",
        file_id: tdlibFileId,
      });

      const local = fileInfo.local as Record<string, unknown>;

      res.json({
        file_id: tdlibFileId,
        remote_file_id: remoteFileId,
        size: fileInfo.size || fileInfo.expected_size,
        is_downloading: local?.is_downloading_active || false,
        is_complete: local?.is_downloading_completed || false,
        downloaded_size: local?.downloaded_size || 0,
        local_path: local?.is_downloading_completed ? local?.path : null,
      });
    } catch (err) {
      console.error("[Download Status] Error:", err);
      res.status(500).json({
        error: err instanceof Error ? err.message : "Status check failed",
      });
    }
  }
);

export default router;
