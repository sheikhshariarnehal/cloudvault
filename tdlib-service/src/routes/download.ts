import { Router, Request, Response } from "express";
import fs from "fs";
import path from "path";
import { getTDLibClient } from "../tdlib-client.js";
import { streamFileToResponse } from "../utils/stream.js";

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

const fileCache = new Map<string, CacheEntry>();

// DigitalOcean 1 GB RAM droplet defaults — set env vars to override
const CACHE_MAX_BYTES =
  parseInt(process.env.CACHE_MAX_SIZE_MB || "512", 10) * 1024 * 1024;
const CACHE_TTL_MS =
  parseFloat(process.env.CACHE_TTL_HOURS || "6") * 60 * 60 * 1000;
const MAX_MAP_ENTRIES = 500;             // ~150 KB RAM for the Map itself
const CACHE_SWEEP_INTERVAL_MS = 5 * 60 * 1000; // sweep every 5 minutes

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
}

/** Evict a single cache entry, deleting app-managed files from disk. */
function evictEntry(remoteFileId: string, entry: CacheEntry): void {
  fileCache.delete(remoteFileId);
  if (entry.isAppManaged) {
    try {
      if (fs.existsSync(entry.localPath)) fs.unlinkSync(entry.localPath);
    } catch { /* best effort */ }
  }
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

  const totalEntries = fileCache.size;
  const appMB = Math.round(appManagedBytes / 1024 / 1024);
  if (totalEntries > 0) {
    console.log(`[Cache] Sweep done — entries: ${totalEntries}, app-managed disk: ${appMB} MB`);
  }
}

// Start the periodic sweep
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
    const fileName = (req.query.filename as string) || "download";
    const mimeType = req.query.mime_type as string | undefined;
    const inline = req.query.inline === "true";
    const messageId = req.query.message_id
      ? parseInt(req.query.message_id as string, 10)
      : undefined;

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
      console.log(`[Download] App-cache HIT for ${remoteFileId.substring(0, 20)}… → ${cachedPath}`);
      streamFileToResponse(cachedPath, res, streamOpts);
      return;
    }

    try {
      const client = await getTDLibClient();

      // ─── Helpers ──────────────────────────────────────────────────────

      /** Synchronous downloadFile; returns local path or null. */
      async function tryDownloadSync(fileId: number): Promise<string | null> {
        try {
          const dl = await client.invoke({
            _: "downloadFile",
            file_id: fileId,
            priority: 32,
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
        const local = info.local as Record<string, unknown> | undefined;
        if (local?.is_downloading_completed && local.path && fs.existsSync(local.path as string)) {
          cacheFile(remoteFileId, local.path as string);
          streamFileToResponse(local.path as string, res, streamOpts);
          return;
        }
      }

      // ─── 3. Try direct TDLib download ─────────────────────────────
      let localPath = await tryDownloadSync(tdlibFileId);
      if (localPath) {
        cacheFile(remoteFileId, localPath);
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
        cacheFile(remoteFileId, localPath);
        streamFileToResponse(localPath, res, streamOpts);
        return;
      }

      // ─── 4.5. Refresh file reference via channel message forward ──
      //     (Only for photo file_ids whose references expire)
      if (messageId) {
        console.log(`[Download] Refreshing via forwardMessage (tdlib_msg_id=${messageId})...`);
        const result = await refreshViaForward(messageId, remoteFileId);
        if (result) {
          cacheFile(remoteFileId, result.localPath);
          streamFileToResponse(result.localPath, res, streamOpts);
          // File is now cached — don't delete it
          return;
        }
      }

      // ─── 5. Fallback: download via Bot HTTP API (≤ 20 MB) ────────
      console.log(`[Download] TDLib recovery failed, trying Bot HTTP API fallback...`);
      const botApiPath = await downloadViaBotApi(remoteFileId);
      if (botApiPath) {
        cacheFile(remoteFileId, botApiPath);
        streamFileToResponse(botApiPath, res, streamOpts);
        // File is now cached — don't delete it
        return;
      }

      // ─── 6. All attempts exhausted ────────────────────────────────
      console.error(`[Download] ALL download methods failed for remote_id=${remoteFileId}`);
      res.status(500).json({ error: "File download has failed or was canceled" });
    } catch (err) {
      console.error("[Download] Error:", err);

      const errorMsg = err instanceof Error ? err.message : "Download failed";

      if (errorMsg.includes("Wrong remote file identifier")) {
        res.status(404).json({ error: "Invalid file ID" });
        return;
      }

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
      const client = await getTDLibClient();

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
