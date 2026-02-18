/**
 * Download files from Telegram via the TDLib microservice.
 *
 * The TDLib service downloads files using MTProto protocol,
 * which supports files up to 2GB (vs Bot API's 20MB getFile limit).
 */

const TDLIB_SERVICE_URL = process.env.TDLIB_SERVICE_URL || "http://localhost:3001";
const TDLIB_SERVICE_API_KEY = process.env.TDLIB_SERVICE_API_KEY || "";

/**
 * Download a file from Telegram via the TDLib microservice.
 * Returns a ReadableStream that can be piped directly to the response.
 *
 * Supports files up to 2GB (MTProto protocol, no Bot API getFile limits).
 */
export async function downloadFromTelegram(
  fileId: string,
  options?: {
    fileName?: string;
    mimeType?: string;
    inline?: boolean;
  }
): Promise<{
  stream: ReadableStream;
  contentType: string;
  contentLength?: number;
}> {
  const params = new URLSearchParams();
  if (options?.fileName) params.set("filename", options.fileName);
  if (options?.mimeType) params.set("mime_type", options.mimeType);
  if (options?.inline) params.set("inline", "true");

  const url = `${TDLIB_SERVICE_URL}/api/download/${encodeURIComponent(fileId)}${params.toString() ? `?${params}` : ""}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${TDLIB_SERVICE_API_KEY}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => response.statusText);
    throw new Error(
      `Failed to download file from TDLib service: ${errorText}`
    );
  }

  const contentLength = response.headers.get("content-length");

  return {
    stream: response.body!,
    contentType:
      response.headers.get("content-type") || "application/octet-stream",
    contentLength: contentLength ? parseInt(contentLength, 10) : undefined,
  };
}

/**
 * Check the download/cache status of a file in the TDLib service.
 * Useful for pre-warming the cache before streaming to users.
 */
export async function getDownloadStatus(fileId: string): Promise<{
  is_complete: boolean;
  is_downloading: boolean;
  downloaded_size: number;
  size: number;
}> {
  const response = await fetch(
    `${TDLIB_SERVICE_URL}/api/download/status/${encodeURIComponent(fileId)}`,
    {
      headers: {
        Authorization: `Bearer ${TDLIB_SERVICE_API_KEY}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error("Failed to check download status");
  }

  return response.json();
}
