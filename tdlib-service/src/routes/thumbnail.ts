import { Router, Request, Response } from "express";
import fs from "fs";
import { getTDLibClient } from "../tdlib-client.js";
import { fileToBase64DataUri } from "../utils/stream.js";

const router = Router();

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
      const client = await getTDLibClient();

      // Resolve Bot API file_id to TDLib file object
      const remoteFile = await client.invoke({
        _: "getRemoteFile",
        remote_file_id: remoteFileId,
      });

      const tdlibFileId = remoteFile.id as number;

      // Get the full file info to find the thumbnail
      const fileInfo = await client.invoke({
        _: "getFile",
        file_id: tdlibFileId,
      });

      // For thumbnails, we need the original message.
      // Instead, try to download a small version of the file itself.
      // TDLib stores minithumbnails inline in the file metadata.

      // First, let's try to get the file's thumbnail if it exists
      // We need to find the message that contains this file to get its thumbnail
      // Alternative approach: use the file_id directly to download a smaller version

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
  const { chat_id, message_id } = req.body;

  if (!chat_id || !message_id) {
    res.status(400).json({ error: "chat_id and message_id required" });
    return;
  }

  try {
    const client = await getTDLibClient();

    // Get the message from the channel
    const message = await client.invoke({
      _: "getMessage",
      chat_id: parseInt(chat_id, 10),
      message_id: parseInt(message_id, 10),
    });

    const content = message.content as Record<string, unknown>;
    let thumbnailFileId: number | null = null;

    // Extract thumbnail based on content type
    switch (content?._) {
      case "messagePhoto": {
        const photo = content.photo as Record<string, unknown>;
        const sizes = photo?.sizes as Array<Record<string, unknown>>;
        if (sizes && sizes.length > 0) {
          // Use smallest size as thumbnail
          const smallest = sizes[0];
          const thumbFile = smallest.photo as Record<string, unknown>;
          thumbnailFileId = thumbFile?.id as number;
        }
        break;
      }
      case "messageVideo": {
        const video = content.video as Record<string, unknown>;
        const thumb = video?.thumbnail as Record<string, unknown>;
        if (thumb) {
          const thumbFile = thumb.file as Record<string, unknown>;
          thumbnailFileId = thumbFile?.id as number;
        }
        break;
      }
      case "messageDocument": {
        const doc = content.document as Record<string, unknown>;
        const thumb = doc?.thumbnail as Record<string, unknown>;
        if (thumb) {
          const thumbFile = thumb.file as Record<string, unknown>;
          thumbnailFileId = thumbFile?.id as number;
        }
        break;
      }
    }

    // Also check for minithumbnail (inline tiny preview)
    let minithumbnail: string | null = null;
    switch (content?._) {
      case "messagePhoto": {
        const photo = content.photo as Record<string, unknown>;
        const mini = photo?.minithumbnail as Record<string, unknown>;
        if (mini?.data) {
          minithumbnail = `data:image/jpeg;base64,${mini.data}`;
        }
        break;
      }
      case "messageVideo": {
        const video = content.video as Record<string, unknown>;
        const mini = video?.minithumbnail as Record<string, unknown>;
        if (mini?.data) {
          minithumbnail = `data:image/jpeg;base64,${mini.data}`;
        }
        break;
      }
    }

    if (!thumbnailFileId && !minithumbnail) {
      res.status(404).json({ error: "No thumbnail available for this message" });
      return;
    }

    let thumbnailData: string | null = minithumbnail;

    // If we have a real thumbnail file, download it (better quality than minithumbnail)
    if (thumbnailFileId) {
      const downloadedThumb = await client.invoke({
        _: "downloadFile",
        file_id: thumbnailFileId,
        priority: 32,
        synchronous: true,
      });

      const localPath = downloadedThumb.local?.path as string;
      if (localPath && fs.existsSync(localPath)) {
        thumbnailData = fileToBase64DataUri(localPath, "image/jpeg");
      }
    }

    res.json({
      thumbnail: thumbnailData,
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
