/**
 * Download a file from Telegram via the MTProto VPS backend.
 *
 * @param messageId  The Telegram message ID stored in telegram_message_id.
 * @param mimeType   MIME type stored in the DB; forwarded to the backend so
 *                   it can set the correct Content-Type on the response.
 */
export async function downloadFromTelegram(
  messageId: number,
  mimeType: string
): Promise<{
  stream: ReadableStream;
  contentType: string;
}> {
  const backendUrl = process.env.MTPROTO_BACKEND_URL!;
  const apiKey = process.env.MTPROTO_API_KEY!;

  const url = `${backendUrl}/download/${messageId}?mime=${encodeURIComponent(mimeType)}`;

  const response = await fetch(url, {
    headers: { "X-API-Key": apiKey },
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`MTProto backend download failed: ${response.status} ${detail}`);
  }

  return {
    stream: response.body!,
    contentType: mimeType || response.headers.get("content-type") || "application/octet-stream",
  };
}
