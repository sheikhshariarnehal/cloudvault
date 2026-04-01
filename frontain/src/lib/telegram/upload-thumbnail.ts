import { generateThumbnail, type ThumbnailOptions } from "@/lib/telegram/thumbnail";
import { uploadThumbnail, isR2Configured } from "@/lib/r2";
import { SupabaseClient } from "@supabase/supabase-js";

/**
 * Generate and persist a thumbnail for a newly uploaded file.
 *
 * 1. Try Telegram-based thumbnail (TDLib extracts from the uploaded media)
 * 2. Fallback: use the client-generated base64 thumbnail from the browser
 *
 * Non-fatal — returns the R2 URL if successful, null otherwise.
 * Mutates fileRecord.thumbnail_url in place when a URL is obtained.
 */
export async function resolveUploadThumbnail(
  supabase: SupabaseClient,
  fileRecord: {
    id: string;
    mime_type?: string | null;
    telegram_message_id?: number | null;
    storage_type?: string | null;
    telegram_chat_id?: number | null;
    thumbnail_url?: string | null;
  },
  opts: {
    storageType: string;
    userId: string | null;
    clientThumbnail: string | null;
    logLabel?: string;
  },
): Promise<string | null> {
  if (
    !fileRecord.mime_type?.startsWith("image/") &&
    !fileRecord.mime_type?.startsWith("video/")
  ) {
    return null;
  }

  const thumbOpts: ThumbnailOptions = {
    storageType: fileRecord.storage_type || opts.storageType,
    userId: opts.userId,
    chatId: fileRecord.telegram_chat_id,
  };

  // 1. Try Telegram-based thumbnail
  let r2Url = await generateThumbnail(
    fileRecord.id,
    fileRecord.telegram_message_id!,
    thumbOpts,
  );

  // 2. Fallback: client-generated thumbnail
  if (!r2Url && opts.clientThumbnail && isR2Configured()) {
    try {
      const buffer = Buffer.from(opts.clientThumbnail, "base64");
      if (buffer.length > 0) {
        r2Url = await uploadThumbnail(fileRecord.id, buffer, "image/jpeg");
        await supabase
          .from("files")
          .update({ thumbnail_url: r2Url })
          .eq("id", fileRecord.id);
        console.log(`[Upload] Client thumbnail saved to R2 for ${opts.logLabel || fileRecord.id}`);
      }
    } catch (thumbErr) {
      console.error("[Upload] Client thumbnail R2 upload failed:", thumbErr);
    }
  }

  if (r2Url) fileRecord.thumbnail_url = r2Url;
  return r2Url;
}
