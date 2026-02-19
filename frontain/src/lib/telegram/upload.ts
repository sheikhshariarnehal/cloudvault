/**
 * Telegram file operations via the TDLib MTProto microservice.
 *
 * All file I/O is routed through the CloudVault TDLib service which
 * uses TDLib MTProto for 2GB upload/download support.
 * Supabase DB inserts are handled in the Next.js API routes (not here).
 */

const BACKEND_URL = process.env.TDLIB_SERVICE_URL || "http://localhost:3001";
const API_KEY = process.env.TDLIB_SERVICE_API_KEY || "";

/** Raw response from the TDLib service''s POST /api/upload endpoint. */
export interface TDLibUploadResponse {
  /** Telegram Bot API remote file_id (string, for getFile / download) */
  file_id: string;
  /** TDLib local numeric file ID */
  tdlib_file_id: number;
  /** Telegram message ID in the channel */
  message_id: number;
  /** Inline base64 data URI thumbnail, or null */
  thumbnail_data: string | null;
  /** File size in bytes as reported by Telegram */
  file_size: number;
}

/**
 * Build authorization headers for the TDLib service.
 */
function getServiceHeaders(): Record<string, string> {
  return {
    "X-API-Key": API_KEY,
  };
}

/**
 * Upload a file to Telegram via the TDLib microservice.
 * Returns the raw Telegram upload info - the caller is responsible
 * for inserting a record into Supabase.
 */
export async function uploadToBackend(
  file: File | Blob,
  fileName: string,
  mimeType: string,
  options?: {
    userId?: string | null;
    guestSessionId?: string | null;
    folderId?: string | null;
    uploadId?: string;
  }
): Promise<TDLibUploadResponse> {
  const formData = new FormData();
  formData.append("file", file, fileName);
  if (options?.userId) formData.append("user_id", options.userId);
  if (options?.guestSessionId) formData.append("guest_session_id", options.guestSessionId);
  if (options?.folderId) formData.append("folder_id", options.folderId);

  const headers: Record<string, string> = { ...getServiceHeaders() };
  if (options?.uploadId) headers["X-Upload-Id"] = options.uploadId;

  const response = await fetch(`${BACKEND_URL}/api/upload`, {
    method: "POST",
    headers,
    body: formData,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Backend upload failed: ${error}`);
  }

  return response.json() as Promise<TDLibUploadResponse>;
}

/**
 * Upload a file buffer to Telegram via the TDLib microservice.
 * Returns raw Telegram upload info; caller inserts the Supabase record.
 */
export async function uploadToTelegram(
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string,
  options?: {
    userId?: string | null;
    guestSessionId?: string | null;
    folderId?: string | null;
  }
): Promise<TDLibUploadResponse> {
  const blob = new Blob([new Uint8Array(fileBuffer)], { type: mimeType });
  return uploadToBackend(blob, fileName, mimeType, options);
}

/**
 * Delete a file''s message from the Telegram channel.
 */
export async function deleteFromTelegram(
  chatId: string,
  messageId: number
): Promise<boolean> {
  console.warn("[deleteFromTelegram] Not implemented in current backend");
  return false;
}

/**
 * Bulk delete messages from the channel (e.g., emptying trash).
 */
export async function bulkDeleteFromTelegram(
  chatId: string,
  messageIds: number[]
): Promise<{ deleted: number; failed: number }> {
  console.warn("[bulkDeleteFromTelegram] Not implemented in current backend");
  return { deleted: 0, failed: messageIds.length };
}

/**
 * @deprecated Use downloadFromTelegram() from download.ts instead.
 */
export async function getTelegramFileUrl(fileId: string): Promise<string> {
  return `${BACKEND_URL}/api/download/${encodeURIComponent(fileId)}`;
}
