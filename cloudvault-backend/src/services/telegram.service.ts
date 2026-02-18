import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { Api } from "telegram/tl";
import { CustomFile } from "telegram/client/uploads";
import { PassThrough } from "stream";
import bigInt from "big-integer";
import * as fs from "fs";
import { config } from "../config/env";
import type { UploadResult } from "../types";

let client: TelegramClient;

/**
 * Initialize the singleton GramJS TelegramClient.
 * Must be called once at server startup before handling any requests.
 */
export async function initTelegramClient(): Promise<void> {
  const session = new StringSession(config.TELEGRAM_SESSION);
  client = new TelegramClient(session, config.TELEGRAM_API_ID, config.TELEGRAM_API_HASH, {
    connectionRetries: 5,
  });

  await client.connect();

  // Verify the session is still valid
  const me = await client.getMe();
  console.log(`[Telegram] Connected as ${(me as Api.User).username ?? me.id}`);
}

/**
 * Gracefully disconnect the Telegram client.
 */
export async function disconnectTelegramClient(): Promise<void> {
  if (client) {
    await client.disconnect();
    console.log("[Telegram] Disconnected");
  }
}

/**
 * Resolve the chat entity for file storage.
 * Always returns a string — GramJS accepts 'me' or numeric ID as string.
 */
function getChatId(): string {
  return config.TELEGRAM_CHAT_ID;
}

/**
 * Upload a file from disk to Telegram and return identifiers.
 */
export async function uploadFile(
  filePath: string,
  fileName: string,
  mimeType: string
): Promise<UploadResult> {
  const chatId = getChatId();
  const fileSize = fs.statSync(filePath).size;

  // Create a CustomFile so GramJS streams from disk instead of loading into memory
  const customFile = new CustomFile(fileName, fileSize, filePath);

  const inputFile = await client.uploadFile({
    file: customFile,
    workers: 4,
  });

  const message = await client.sendFile(chatId, {
    file: inputFile,
    caption: fileName,
    forceDocument: true,
  });

  // Extract identifiers from the sent message
  const media = message.media as Api.MessageMediaDocument | undefined;
  const document = media?.document as Api.Document | undefined;

  const file_id = document?.id?.toString() ?? "";
  const message_id = message.id;

  // Attempt to extract thumbnail URL (for images that got a thumb)
  let thumbnail_url: string | null = null;
  if (document?.thumbs && document.thumbs.length > 0) {
    // Thumbnails are stored as PhotoSize on the document; we don't have a
    // public URL from Telegram, so we leave this null. The frontend can
    // generate its own thumbnail or fetch via the download endpoint.
    thumbnail_url = null;
  }

  return { file_id, message_id, thumbnail_url };
}

/**
 * Download a file from Telegram by message ID and return a readable stream.
 * Uses iterDownload to avoid buffering large files in memory.
 */
export async function downloadFileStream(
  messageId: number
): Promise<PassThrough> {
  const chatId = getChatId();

  const messages = await client.getMessages(chatId, { ids: [messageId] });
  const message = messages[0];

  if (!message || !message.media) {
    throw Object.assign(new Error("Message not found or has no media"), {
      statusCode: 404,
    });
  }

  const media = message.media as Api.MessageMediaDocument;
  const document = media.document as Api.Document;

  const passThrough = new PassThrough();

  // Stream chunks from Telegram into the PassThrough
  (async () => {
    try {
      const fileSize = Number(document.size);
      const chunkSize = 512 * 1024; // 512 KB per chunk

      for await (const chunk of client.iterDownload({
        file: new Api.InputDocumentFileLocation({
          id: document.id,
          accessHash: document.accessHash,
          fileReference: document.fileReference,
          thumbSize: "",
        }),
        requestSize: chunkSize,
        fileSize: bigInt(fileSize),
      })) {
        if (!passThrough.write(chunk)) {
          // Backpressure: wait for drain before writing more
          await new Promise<void>((resolve) => passThrough.once("drain", resolve));
        }
      }
      passThrough.end();
    } catch (err) {
      passThrough.destroy(err instanceof Error ? err : new Error(String(err)));
    }
  })();

  return passThrough;
}
