import { Router, Request, Response } from "express";
import fs from "fs";
import { getTDLibClient } from "../tdlib-client.js";
import { streamFileToResponse } from "../utils/stream.js";

const router = Router();

/**
 * GET /api/download/:remoteFileId
 * Download a file from Telegram via TDLib (MTProto).
 * Uses the Bot API-compatible remote file_id string.
 *
 * Query params:
 *   - filename: Optional filename for Content-Disposition
 *   - mime_type: Optional MIME type override
 *   - inline: If "true", use inline disposition (for preview)
 *
 * Supports Range headers for video seeking / resumable downloads.
 *
 * This bypasses the 20MB getFile limitation of the Bot API.
 * TDLib can download files up to 2GB via MTProto.
 */
router.get(
  "/:remoteFileId",
  async (req: Request, res: Response) => {
    const { remoteFileId } = req.params;
    const fileName = (req.query.filename as string) || "download";
    const mimeType = req.query.mime_type as string | undefined;
    const inline = req.query.inline === "true";

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

      if (!tdlibFileId) {
        res.status(404).json({ error: "File not found in Telegram" });
        return;
      }

      // Download the file via MTProto (supports up to 2GB)
      // synchronous: true means TDLib will complete the download before returning
      const downloadedFile = await client.invoke({
        _: "downloadFile",
        file_id: tdlibFileId,
        priority: 32,
        synchronous: true,
      });

      const localPath = downloadedFile.local?.path as string;

      if (!localPath || !fs.existsSync(localPath)) {
        res.status(500).json({ error: "File download failed — no local path" });
        return;
      }

      // Stream the file to response with Range support
      streamFileToResponse(localPath, res, {
        fileName,
        mimeType,
        inline,
        rangeHeader: req.headers.range,
      });
    } catch (err) {
      console.error("[Download] Error:", err);

      // Handle specific TDLib errors
      const errorMsg =
        err instanceof Error ? err.message : "Download failed";

      if (errorMsg.includes("Wrong remote file identifier")) {
        res.status(404).json({ error: "Invalid file ID" });
        return;
      }

      res.status(500).json({ error: errorMsg });
    }
  }
);

/**
 * GET /api/download/status/:remoteFileId
 * Check if a file has been downloaded/cached locally by TDLib.
 * Useful for pre-warming cache before streaming to users.
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
