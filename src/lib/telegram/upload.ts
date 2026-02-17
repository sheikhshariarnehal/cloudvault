const TELEGRAM_API_BASE = "https://api.telegram.org/bot";

interface TelegramUploadResult {
  file_id: string;
  message_id: number;
  thumbnail_url: string | null;
}

export async function uploadToTelegram(
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string
): Promise<TelegramUploadResult> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN!;
  const channelId = process.env.TELEGRAM_CHANNEL_ID!;

  const formData = new FormData();
  const blob = new Blob([new Uint8Array(fileBuffer)], { type: mimeType });
  formData.append("chat_id", channelId);

  let endpoint: string;

  if (mimeType.startsWith("image/") && !mimeType.includes("svg")) {
    endpoint = "sendPhoto";
    formData.append("photo", blob, fileName);
  } else if (mimeType.startsWith("video/")) {
    endpoint = "sendVideo";
    formData.append("video", blob, fileName);
  } else if (mimeType.startsWith("audio/")) {
    endpoint = "sendAudio";
    formData.append("audio", blob, fileName);
  } else {
    endpoint = "sendDocument";
    formData.append("document", blob, fileName);
  }

  formData.append("caption", fileName);

  const response = await fetch(`${TELEGRAM_API_BASE}${botToken}/${endpoint}`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Telegram upload failed: ${error}`);
  }

  const result = await response.json();
  const message = result.result;

  let fileId: string;
  let thumbnailUrl: string | null = null;

  if (message.photo) {
    // Photos come as array of sizes, pick the largest
    const largestPhoto = message.photo[message.photo.length - 1];
    fileId = largestPhoto.file_id;
    // Get thumbnail from smallest size
    if (message.photo.length > 1) {
      const thumbFileId = message.photo[0].file_id;
      thumbnailUrl = await getTelegramFileUrl(thumbFileId);
    }
  } else if (message.video) {
    fileId = message.video.file_id;
    if (message.video.thumb) {
      thumbnailUrl = await getTelegramFileUrl(message.video.thumb.file_id);
    }
  } else if (message.audio) {
    fileId = message.audio.file_id;
  } else if (message.document) {
    fileId = message.document.file_id;
    if (message.document.thumb) {
      thumbnailUrl = await getTelegramFileUrl(message.document.thumb.file_id);
    }
  } else {
    throw new Error("Unknown Telegram response format");
  }

  return {
    file_id: fileId,
    message_id: message.message_id,
    thumbnail_url: thumbnailUrl,
  };
}

export async function getTelegramFileUrl(fileId: string): Promise<string> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN!;

  const response = await fetch(
    `${TELEGRAM_API_BASE}${botToken}/getFile?file_id=${fileId}`
  );

  if (!response.ok) {
    throw new Error("Failed to get file from Telegram");
  }

  const result = await response.json();
  const filePath = result.result.file_path;

  return `https://api.telegram.org/file/bot${botToken}/${filePath}`;
}
