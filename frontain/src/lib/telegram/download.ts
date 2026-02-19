/**
 * Download files from Telegram via the TDLib MTProto microservice.
 */

const BACKEND_URL = process.env.TDLIB_SERVICE_URL || "http://localhost:3001";
const API_KEY = process.env.TDLIB_SERVICE_API_KEY || "";

/** Custom error that carries the HTTP status code returned by the backend. */
export class TelegramDownloadError extends Error {
  constructor(message: string, public readonly statusCode: number) {
    super(message);
    this.name = "TelegramDownloadError";
  }
}

/**
 * Download a file from Telegram via the TDLib backend service.
 *
 * @param fileId     The Telegram remote file_id string (telegram_file_id from DB)
 * @param mimeType   The file''s MIME type for the Content-Type header
 */
export async function downloadFromTelegram(
  fileId: string,
  mimeType: string
): Promise<{
  stream: ReadableStream;
  contentType: string;
  contentLength?: number;
}> {
  const url = `${BACKEND_URL}/api/download/${encodeURIComponent(fileId)}`;

  const response = await fetch(url, {
    headers: {
      "X-API-Key": API_KEY,
    },
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => response.statusText);
    throw new TelegramDownloadError(
      `Failed to download file from backend: ${errorText}`,
      response.status
    );
  }

  const contentLength = response.headers.get("content-length");

  return {
    stream: response.body!,
    contentType: mimeType || response.headers.get("content-type") || "application/octet-stream",
    contentLength: contentLength ? parseInt(contentLength, 10) : undefined,
  };
}
