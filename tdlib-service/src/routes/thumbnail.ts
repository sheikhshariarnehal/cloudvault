import { Router, Request, Response } from "express";
import fs from "fs";
import { sessionManager } from "../session-manager.js";
import { fileToBase64DataUri } from "../utils/stream.js";
import { isR2Configured, uploadThumbnailToR2 } from "../utils/r2.js";

const router = Router();

/** Extract thumbnail file ID and minithumbnail from a TDLib message content. */
function extractThumbnailInfo(content: Record<string, unknown>): {
  thumbnailFileId: number | null;
  minithumbnail: string | null;
} {
  let thumbnailFileId: number | null = null;
  let minithumbnail: string | null = null;

  switch (content?._) {
    case "messagePhoto": {
      const photo = content.photo as Record<string, unknown>;
      const sizes = photo?.sizes as Array<Record<string, unknown>>;
      if (sizes?.length) {
        const thumbFile = (sizes[0].photo as Record<string, unknown>);
        thumbnailFileId = thumbFile?.id as number ?? null;
      }
      const mini = (photo?.minithumbnail as Record<string, unknown>);
      if (mini?.data) minithumbnail = `data:image/jpeg;base64,${mini.data}`;
      break;
    }
    case "messageVideo": {
      const video = content.video as Record<string, unknown>;
      const thumb = video?.thumbnail as Record<string, unknown>;
      if (thumb) {
        const thumbFile = thumb.file as Record<string, unknown>;
        thumbnailFileId = thumbFile?.id as number ?? null;
      }
      const mini = (video?.minithumbnail as Record<string, unknown>);
      if (mini?.data) minithumbnail = `data:image/jpeg;base64,${mini.data}`;
      break;
    }
    case "messageDocument": {
      const doc = content.document as Record<string, unknown>;
      const thumb = doc?.thumbnail as Record<string, unknown>;
      if (thumb) {
        const thumbFile = thumb.file as Record<string, unknown>;
        thumbnailFileId = thumbFile?.id as number ?? null;
      }
      break;
    }
  }

  return { thumbnailFileId, minithumbnail };
}

/**
 * GET /api/thumbnail/:remoteFileId
 * Get a persistent thumbnail for a file stored in Telegram.
 *
 * Query params:
 *   - format: "base64" (default) returns data URI, "raw" streams the image
 *
 * Unlike Bot API thumbnail URLs that expire after ~1 hour,
 * TDLib downloads thumbnails to local disk permanently.
 */
router.get(
  "/:remoteFileId",
  async (req: Request, res: Response) => {
    const { remoteFileId } = req.params;
    const format = (req.query.format as string) || "base64";

    if (!remoteFileId) {
      res.status(400).json({ error: "Remote file ID required" });
      return;
    }

    try {
      const storageType = (req.query.storage_type as string) || "bot";
      const userId = req.query.user_id as string | undefined;
      const { client } = await sessionManager.resolveClientAndChat(storageType, userId);
      const remoteFile = await client.invoke({
        _: "getRemoteFile",
        remote_file_id: remoteFileId,
      });

      const tdlibFileId = remoteFile.id as number;

      // Download the thumbnail file (small file, fast)
      const downloadedThumb = await client.invoke({
        _: "downloadFile",
        file_id: tdlibFileId,
        priority: 32,
        synchronous: true,
      });

      const localPath = downloadedThumb.local?.path as string;

      if (!localPath || !fs.existsSync(localPath)) {
        res.status(404).json({ error: "Thumbnail not available" });
        return;
      }

      if (format === "raw") {
        // Stream the thumbnail file directly
        res.set({
          "Content-Type": "image/jpeg",
          "Cache-Control": "public, max-age=86400", // Cache for 24h
        });
        fs.createReadStream(localPath).pipe(res);
      } else {
        // Return as base64 data URI
        const dataUri = fileToBase64DataUri(localPath, "image/jpeg");
        res.json({
          thumbnail: dataUri,
          cached: true,
        });
      }
    } catch (err) {
      console.error("[Thumbnail] Error:", err);
      res.status(500).json({
        error: err instanceof Error ? err.message : "Thumbnail fetch failed",
      });
    }
  }
);

/**
 * POST /api/thumbnail/from-message
 * Get thumbnail from a specific message in the channel.
 * More reliable than using file_id for thumbnails.
 *
 * Body: { chat_id, message_id }
 */
router.post("/from-message", async (req: Request, res: Response) => {
  const { chat_id, message_id, file_id } = req.body;

  if (!chat_id || !message_id) {
    res.status(400).json({ error: "chat_id and message_id required" });
    return;
  }

  const parsedChatId = parseInt(chat_id, 10);
  const parsedMessageId = parseInt(message_id, 10);
  if (Number.isNaN(parsedChatId) || Number.isNaN(parsedMessageId)) {
    res.status(400).json({ error: "chat_id and message_id must be numeric" });
    return;
  }

  try {
    const storageType = (req.body.storage_type as string) || "bot";
    const userId = req.body.user_id as string | undefined;
    const { client } = await sessionManager.resolveClientAndChat(storageType, userId);

    const message = await client.invoke({
      _: "getMessage",
      chat_id: parsedChatId,
      message_id: parsedMessageId,
    });

    const content = message.content as Record<string, unknown>;
    const { thumbnailFileId, minithumbnail } = extractThumbnailInfo(content);

    if (!thumbnailFileId && !minithumbnail) {
      res.status(404).json({ error: "No thumbnail available for this message" });
      return;
    }

    // ── Download the real thumbnail file (better quality than minithumbnail) ──
    let localPath: string | null = null;
    if (thumbnailFileId) {
      const downloaded = await client.invoke({
        _: "downloadFile",
        file_id: thumbnailFileId,
        priority: 32,
        synchronous: true,
      });
      const p = downloaded.local?.path as string;
      if (p && fs.existsSync(p)) localPath = p;
    }

    // ── Upload raw file buffer to R2 (skip base64 round-trip) ──
    let r2Url: string | null = null;
    if (file_id && isR2Configured()) {
      try {
        if (localPath) {
          // Fast path: read file bytes directly → R2
          const buffer = fs.readFileSync(localPath);
          r2Url = await uploadThumbnailToR2(file_id, buffer, "image/jpeg");
        } else if (minithumbnail) {
          // Fallback: decode minithumbnail base64 → R2
          const match = minithumbnail.match(/^data:([^;]+);base64,(.+)$/);
          if (match) {
            r2Url = await uploadThumbnailToR2(
              file_id,
              Buffer.from(match[2], "base64"),
              match[1],
            );
          }
        }
      } catch (uploadErr) {
        console.error("[Thumbnail] R2 upload failed:", uploadErr);
      }
    }

    // Always build base64 fallback so the frontend has something to show
    let thumbnailData: string | null = null;
    if (!r2Url) {
      if (localPath) {
        thumbnailData = fileToBase64DataUri(localPath, "image/jpeg");
      } else {
        thumbnailData = minithumbnail;
      }
    }

    res.json({
      thumbnail: thumbnailData,
      r2_url: r2Url,
      has_minithumbnail: !!minithumbnail,
      has_full_thumbnail: !!thumbnailFileId,
    });
  } catch (err) {
    console.error("[Thumbnail from-message] Error:", err);
    res.status(500).json({
      error: err instanceof Error ? err.message : "Thumbnail fetch failed",
    });
  }
});

export default router;
