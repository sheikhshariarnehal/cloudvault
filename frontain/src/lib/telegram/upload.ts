/**
 * Telegram file operations via TDLib microservice.
 *
 * Instead of calling the Telegram Bot API directly, we route all
 * file operations through the CloudVault TDLib service which uses
 * MTProto protocol for better performance and 2GB download support.
 */

const TDLIB_SERVICE_URL = process.env.TDLIB_SERVICE_URL || "http://localhost:3001";
const TDLIB_SERVICE_API_KEY = process.env.TDLIB_SERVICE_API_KEY || "";

interface TelegramUploadResult {
  file_id: string;
  tdlib_file_id?: number;
  message_id: number;
  thumbnail_url: string | null;
}

/**
 * Build authorization headers for the TDLib microservice
 */
function getServiceHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${TDLIB_SERVICE_API_KEY}`,
  };
}

/**
 * Upload a file to Telegram via the TDLib microservice.
 * The microservice handles MTProto upload to the configured channel.
 */
export async function uploadToTelegram(
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string
): Promise<TelegramUploadResult> {
  const formData = new FormData();
  const blob = new Blob([new Uint8Array(fileBuffer)], { type: mimeType });
  formData.append("file", blob, fileName);
  formData.append("mime_type", mimeType);

  const response = await fetch(`${TDLIB_SERVICE_URL}/api/upload`, {
    method: "POST",
    headers: getServiceHeaders(),
    body: formData,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`TDLib upload failed: ${error}`);
  }

  const result = await response.json();

  return {
    file_id: result.file_id,
    tdlib_file_id: result.tdlib_file_id,
    message_id: result.message_id,
    // thumbnail_data is a base64 data URI (permanent, never expires)
    thumbnail_url: result.thumbnail_data || null,
  };
}

/**
 * Get a persistent thumbnail for a file via TDLib microservice.
 * Returns a base64 data URI that never expires (unlike Bot API URLs).
 */
export async function getTelegramThumbnail(
  remoteFileId: string
): Promise<string | null> {
  try {
    const response = await fetch(
      `${TDLIB_SERVICE_URL}/api/thumbnail/${encodeURIComponent(remoteFileId)}?format=base64`,
      { headers: getServiceHeaders() }
    );

    if (!response.ok) return null;

    const result = await response.json();
    return result.thumbnail || null;
  } catch {
    return null;
  }
}

/**
 * Get a thumbnail using the message ID (more reliable for media).
 */
export async function getThumbnailFromMessage(
  chatId: string,
  messageId: number
): Promise<string | null> {
  try {
    const response = await fetch(
      `${TDLIB_SERVICE_URL}/api/thumbnail/from-message`,
      {
        method: "POST",
        headers: {
          ...getServiceHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ chat_id: chatId, message_id: messageId }),
      }
    );

    if (!response.ok) return null;

    const result = await response.json();
    return result.thumbnail || null;
  } catch {
    return null;
  }
}

/**
 * Delete a file's message from the Telegram channel.
 * Called when a user permanently deletes a file.
 */
export async function deleteFromTelegram(
  chatId: string,
  messageId: number
): Promise<boolean> {
  try {
    const response = await fetch(
      `${TDLIB_SERVICE_URL}/api/message/${encodeURIComponent(chatId)}/${messageId}`,
      {
        method: "DELETE",
        headers: getServiceHeaders(),
      }
    );

    if (!response.ok) return false;

    const result = await response.json();
    return result.success === true;
  } catch {
    return false;
  }
}

/**
 * Bulk delete messages from the channel (e.g., emptying trash).
 */
export async function bulkDeleteFromTelegram(
  chatId: string,
  messageIds: number[]
): Promise<{ deleted: number; failed: number }> {
  try {
    const response = await fetch(
      `${TDLIB_SERVICE_URL}/api/message/cleanup`,
      {
        method: "POST",
        headers: {
          ...getServiceHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ chat_id: chatId, message_ids: messageIds }),
      }
    );

    if (!response.ok) {
      return { deleted: 0, failed: messageIds.length };
    }

    const result = await response.json();
    return {
      deleted: result.deleted_count || 0,
      failed: result.failed_count || 0,
    };
  } catch {
    return { deleted: 0, failed: messageIds.length };
  }
}

/**
 * @deprecated Use downloadFromTelegram() from download.ts instead.
 * Kept for backward compatibility — resolves a file URL via TDLib service.
 */
export async function getTelegramFileUrl(fileId: string): Promise<string> {
  // With TDLib, we don't use direct URLs anymore.
  // This returns the TDLib service download endpoint URL.
  return `${TDLIB_SERVICE_URL}/api/download/${encodeURIComponent(fileId)}`;
}
