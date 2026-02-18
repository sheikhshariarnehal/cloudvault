import { Request, Response, NextFunction } from "express";
import * as fs from "fs/promises";
import * as telegramService from "../services/telegram.service";
import * as supabaseService from "../services/supabase.service";
import type { FileInsert } from "../types";

export async function uploadController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const tempPath = req.file?.path;

  try {
    if (!req.file) {
      res.status(400).json({ error: "No file provided" });
      return;
    }

    const userId = req.body.user_id as string | undefined;
    const guestSessionId = req.body.guest_session_id as string | undefined;
    const folderId = req.body.folder_id as string | undefined;

    if (!userId && !guestSessionId) {
      res.status(400).json({ error: "User ID or Guest Session ID required" });
      return;
    }

    console.log("[Upload] Starting:", {
      fileName: req.file.originalname,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      userId,
      guestSessionId,
    });

    // 1. Upload to Telegram
    const telegramResult = await telegramService.uploadFile(
      req.file.path,
      req.file.originalname,
      req.file.mimetype
    );

    console.log("[Upload] Telegram upload complete:", telegramResult);

    // 2. Build the DB record (matches the Next.js upload route shape)
    const fileRecord: FileInsert = {
      user_id: userId ?? null,
      guest_session_id: guestSessionId ?? null,
      folder_id: folderId ?? null,
      name: req.file.originalname,
      original_name: req.file.originalname,
      mime_type: req.file.mimetype || "application/octet-stream",
      size_bytes: req.file.size,
      telegram_file_id: telegramResult.file_id,
      telegram_message_id: telegramResult.message_id,
      thumbnail_url: telegramResult.thumbnail_url,
    };

    // 3. Insert into Supabase
    const dbFile = await supabaseService.insertFileRecord(fileRecord);

    // 4. Increment storage usage
    if (userId) {
      await supabaseService.incrementStorage(userId, req.file.size);
    }

    console.log("[Upload] Complete:", dbFile.id);

    res.status(201).json({ file: dbFile });
  } catch (err) {
    next(err);
  } finally {
    // Always clean up the temp file
    if (tempPath) {
      await fs.unlink(tempPath).catch(() => {
        /* ignore cleanup errors */
      });
    }
  }
}
