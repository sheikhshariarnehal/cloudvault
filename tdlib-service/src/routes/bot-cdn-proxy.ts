/**
 * Bot API CDN proxy — streams files ≤ 20 MB directly from Telegram's
 * CDN servers without writing anything to disk.
 *
 * Flow:
 *   1. signedUrlAuth middleware verifies HMAC token → sets req.signedPayload
 *   2. This handler calls Bot API `getFile` → resolves file_path
 *   3. Streams `https://api.telegram.org/file/bot<TOKEN>/<file_path>` → client
 *
 * The bot token is never exposed to the browser.
 * Supports Range requests so video/audio seeking works.
 */

import { Router, Request, Response } from "express";

const router = Router();

const BOT_API_MAX_BYTES = 20 * 1024 * 1024; // 20 MB — Telegram Bot API limit

function getBotToken(): string {
  return process.env.TELEGRAM_BOT_TOKEN || "";
}

router.get("/:remoteFileId", async (req: Request, res: Response) => {
  // signedUrlAuth + requireSignedUrl guard ensures payload is present
  const payload = req.signedPayload;
  if (!payload) {
    res.status(401).json({ error: "Signed URL required" });
    return;
  }

  const remoteFileId = payload.fid; // use value from signed token, not URL (tamper-proof)
  const fileName = payload.fn || "file";
  const mimeType = payload.ct || "application/octet-stream";
  const fileSize = payload.sz;

  const botToken = getBotToken();
  if (!botToken) {
    res.status(500).json({ error: "Bot token not configured" });
    return;
  }

  // Reject if we already know the file is too large
  if (fileSize && fileSize > BOT_API_MAX_BYTES) {
    res.status(413).json({ error: "File too large for Bot API (max 20 MB)" });
    return;
  }

  const inline = req.query.inline !== "false"; // default: inline
  const safeFileName = encodeURIComponent(fileName);

  try {
    // ── Step 1: Resolve file_path via Bot API getFile ──────────────
    const getFileUrl = `https://api.telegram.org/bot${botToken}/getFile?file_id=${encodeURIComponent(remoteFileId)}`;
    const getFileRes = await fetch(getFileUrl);

    if (!getFileRes.ok) {
      console.error(`[BotCDN] getFile HTTP ${getFileRes.status} for ${remoteFileId.substring(0, 20)}…`);
      res.status(502).json({ error: "Failed to resolve file from Telegram" });
      return;
    }

    const getFileData = (await getFileRes.json()) as {
      ok: boolean;
      result?: { file_size?: number; file_path?: string };
      description?: string;
    };

    if (!getFileData.ok || !getFileData.result?.file_path) {
      console.error(`[BotCDN] getFile error: ${getFileData.description}`);
      res.status(502).json({ error: getFileData.description || "Telegram returned no file_path" });
      return;
    }

    const { file_path, file_size } = getFileData.result;

    // Double-check size Telegram reported
    if (file_size && file_size > BOT_API_MAX_BYTES) {
      res.status(413).json({ error: "File too large for Bot API (max 20 MB)" });
      return;
    }

    // ── Step 2: Stream from Telegram CDN → client (no disk) ───────
    const cdnUrl = `https://api.telegram.org/file/bot${botToken}/${file_path}`;

    const fetchHeaders: Record<string, string> = {};
    const rangeHeader = req.headers.range;
    if (rangeHeader) {
      fetchHeaders["Range"] = rangeHeader;
    }

    const cdnRes = await fetch(cdnUrl, { headers: fetchHeaders });

    if (!cdnRes.ok && cdnRes.status !== 206) {
      console.error(`[BotCDN] CDN fetch HTTP ${cdnRes.status}`);
      res.status(502).json({ error: "Failed to fetch from Telegram CDN" });
      return;
    }

    // ── Step 3: Forward headers ────────────────────────────────────
    const contentLength = cdnRes.headers.get("content-length");
    const contentRange = cdnRes.headers.get("content-range");

    res.status(cdnRes.status); // 200 or 206
    res.setHeader("Content-Type", mimeType); // use DB mime_type, not Telegram's
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Cache-Control", "public, max-age=3600");

    if (contentLength) res.setHeader("Content-Length", contentLength);
    if (contentRange) res.setHeader("Content-Range", contentRange);

    if (inline) {
      res.setHeader("Content-Disposition", `inline; filename="${safeFileName}"`);
    } else {
      res.setHeader("Content-Disposition", `attachment; filename="${safeFileName}"`);
    }

    // ── Step 4: Pipe body — no buffering, no disk write ────────────
    if (!cdnRes.body) {
      res.status(502).json({ error: "No body from Telegram CDN" });
      return;
    }

    const reader = (cdnRes.body as unknown as ReadableStream<Uint8Array>).getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        // Honour back-pressure so slow clients don't bloat RAM
        const ok = res.write(value);
        if (!ok) {
          await new Promise<void>((resolve) => res.once("drain", resolve));
        }
      }
      res.end();
    } catch (streamErr: unknown) {
      const msg = streamErr instanceof Error ? streamErr.message : String(streamErr);
      // Client disconnected mid-stream — normal for video seeking
      if ((streamErr as NodeJS.ErrnoException).code === "ERR_STREAM_PREMATURE_CLOSE" ||
          msg.includes("aborted") || msg.includes("ECONNRESET")) {
        return;
      }
      console.error("[BotCDN] Stream error:", streamErr);
      if (!res.headersSent) {
        res.status(500).json({ error: "Stream failed" });
      }
    }
  } catch (err: unknown) {
    console.error("[BotCDN] Unexpected error:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: "Bot CDN proxy error" });
    }
  }
});

export default router;
