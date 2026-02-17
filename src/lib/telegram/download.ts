import { getTelegramFileUrl } from "./upload";

export async function downloadFromTelegram(fileId: string): Promise<{
  stream: ReadableStream;
  contentType: string;
}> {
  const fileUrl = await getTelegramFileUrl(fileId);

  const response = await fetch(fileUrl);

  if (!response.ok) {
    throw new Error(`Failed to download file from Telegram: ${response.statusText}`);
  }

  return {
    stream: response.body!,
    contentType: response.headers.get("content-type") || "application/octet-stream",
  };
}
