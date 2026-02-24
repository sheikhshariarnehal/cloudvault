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
 * @param fileId      The Telegram remote file_id string (telegram_file_id from DB)
 * @param mimeType    The file's MIME type for the Content-Type header
 * @param messageId   Optional Telegram message ID (for file-reference refresh)
 * @param options.rangeHeader  Optional HTTP Range header (e.g. "bytes=0-1023") for
 *                             video seeking and resumable downloads. The TDLib service
 *                             handles Range internally once the file is on disk.
 */
export async function downloadFromTelegram(
  fileId: string,
  mimeType: string,
  messageId?: number | null,
  options?: { rangeHeader?: string },
): Promise<{
  stream: ReadableStream;
  contentType: string;
  contentLength?: number;
  contentRange?: string;
  status: number;
}> {
  const params = new URLSearchParams();
  if (messageId) {
    params.set("message_id", String(messageId));
  }
  const qs = params.toString();
  const url = `${BACKEND_URL}/api/download/${encodeURIComponent(fileId)}${qs ? `?${qs}` : ""}`;

  const requestHeaders: Record<string, string> = { "X-API-Key": API_KEY };
  if (options?.rangeHeader) {
    requestHeaders["Range"] = options.rangeHeader;
  }

  const response = await fetch(url, { headers: requestHeaders });

  // 206 Partial Content is a success status for Range requests
  if (!response.ok) {
    const errorText = await response.text().catch(() => response.statusText);
    throw new TelegramDownloadError(
      `Failed to download file from backend: ${errorText}`,
      response.status
    );
  }

  const contentLength = response.headers.get("content-length");
  const contentRange  = response.headers.get("content-range");

  return {
    stream: response.body!,
    contentType: mimeType || response.headers.get("content-type") || "application/octet-stream",
    contentLength: contentLength ? parseInt(contentLength, 10) : undefined,
    contentRange:  contentRange  ?? undefined,
    status: response.status,
  };
}
