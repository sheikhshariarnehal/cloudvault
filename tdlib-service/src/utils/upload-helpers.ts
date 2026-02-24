/**
 * Shared upload helper functions used by both upload.ts and chunked-upload.ts.
 *
 * Previously these were duplicated in both route files. Centralising them
 * eliminates drift and makes behaviour changes apply everywhere.
 */

import fs from "fs";
import { getTDLibClient } from "../tdlib-client.js";
import { fileToBase64DataUri } from "./stream.js";
import { acquireUploadSlot, releaseUploadSlot } from "./concurrency.js";

// ── Re-export concurrency helpers for convenience ────────────────────────────
export { acquireUploadSlot, releaseUploadSlot } from "./concurrency.js";

/**
 * Optional session reference so we can update Telegram upload progress
 * on chunked uploads (the chunked handler passes the session object).
 */
export interface ProgressSession {
  telegramProgress: number;
}

/**
 * Invoke a TDLib method after acquiring a concurrency slot.
 * The slot is released in the `finally` block regardless of outcome.
 */
export async function invokeWithSlot(
  client: Awaited<ReturnType<typeof getTDLibClient>>,
  params: Parameters<typeof client.invoke>[0],
): Promise<Record<string, unknown>> {
  await acquireUploadSlot();
  try {
    return (await client.invoke(params)) as Record<string, unknown>;
  } finally {
    releaseUploadSlot();
  }
}

/**
 * Check whether a Telegram error message indicates a media-type rejection
 * (e.g. image too large, invalid dimensions). When true, the caller should
 * retry as a generic document.
 */
export function isMediaRejection(msg: string): boolean {
  return (
    msg.includes("IMAGE_PROCESS_FAILED") ||
    msg.includes("PHOTO_INVALID_DIMENSIONS") ||
    msg.includes("MEDIA_INVALID") ||
    msg.includes("too big for a photo")
  );
}

/**
 * Wait for TDLib to finish sending the message.
 * Timeout scales with file size and resets on upload progress,
 * so even very large files (1-2 GB) won't time out while data is moving.
 */
export async function waitForMessageSent(
  client: Awaited<ReturnType<typeof getTDLibClient>>,
  pendingMessage: Record<string, unknown>,
  fileSize: number = 0,
  session?: ProgressSession,
): Promise<Record<string, unknown>> {
  const messageId = pendingMessage.id as number;

  // If the message already has a sending_state of null, it's already sent
  if (!pendingMessage.sending_state) {
    return pendingMessage;
  }

  // Base: 2 min. Add 1 min per 100 MB, min 2 min, max 30 min.
  const baseTotalMs = Math.max(
    2 * 60 * 1000,
    Math.min(
      30 * 60 * 1000,
      2 * 60 * 1000 + Math.ceil(fileSize / (100 * 1024 * 1024)) * 60 * 1000,
    ),
  );
  // If no progress event for 3 min, give up
  const idleTimeoutMs = 3 * 60 * 1000;

  return new Promise((resolve, reject) => {
    let lastActivity = Date.now();

    // Absolute deadline
    const absoluteTimer = setTimeout(() => {
      cleanup();
      reject(
        new Error(
          `Message send timeout after ${Math.round(baseTotalMs / 1000)}s (file: ${Math.round(fileSize / 1024 / 1024)} MB)`,
        ),
      );
    }, baseTotalMs);

    // Idle timer — resets every time we see upload progress
    let idleTimer = setTimeout(checkIdle, idleTimeoutMs);

    function checkIdle() {
      if (Date.now() - lastActivity >= idleTimeoutMs) {
        cleanup();
        reject(
          new Error(
            `Message send stalled — no upload progress for ${Math.round(idleTimeoutMs / 1000)}s`,
          ),
        );
      } else {
        idleTimer = setTimeout(checkIdle, idleTimeoutMs);
      }
    }

    function cleanup() {
      clearTimeout(absoluteTimer);
      clearTimeout(idleTimer);
      client.off("update", handler);
    }

    const handler = (update: Record<string, unknown>) => {
      // Upload progress — reset idle timer
      if (update._ === "updateFile") {
        const file = update.file as Record<string, unknown> | undefined;
        const remote = file?.remote as Record<string, unknown> | undefined;
        if (remote?.is_uploading_active) {
          lastActivity = Date.now();
          // Update session progress if provided (chunked uploads poll this)
          if (session && fileSize > 0) {
            const uploaded = (remote.uploaded_size as number) || 0;
            session.telegramProgress = uploaded / fileSize;
          }
        }
      }

      if (
        update._ === "updateMessageSendSucceeded" &&
        (update.old_message_id as number) === messageId
      ) {
        cleanup();
        resolve(update.message as Record<string, unknown>);
      } else if (
        update._ === "updateMessageSendFailed" &&
        (update.old_message_id as number) === messageId
      ) {
        cleanup();
        const tdErr = update.error as
          | { code?: number; message?: string }
          | undefined;
        const errorCode = tdErr?.code ?? 0;
        const errorMsg = tdErr?.message || "Unknown error";
        reject(new Error(`Message send failed [${errorCode}]: ${errorMsg}`));
      }
    };

    client.on("update", handler);

    console.log(
      `[Upload] Waiting for Telegram upload (timeout: ${Math.round(baseTotalMs / 1000)}s, idle: ${Math.round(idleTimeoutMs / 1000)}s, fileSize: ${Math.round(fileSize / 1024 / 1024)} MB)`,
    );
  });
}

/**
 * Extract file_id, TDLib numeric file ID, and thumbnail info
 * from a TDLib message object.
 */
export function extractFileInfo(
  message: Record<string, unknown>,
): {
  remoteFileId: string;
  tdlibFileId: number;
  thumbnailFileId: number | null;
  size: number;
} | null {
  const content = message.content as Record<string, unknown>;
  if (!content) return null;

  let document: Record<string, unknown> | null = null;
  let thumbnail: Record<string, unknown> | null = null;

  switch (content._) {
    case "messagePhoto": {
      const photo = content.photo as Record<string, unknown>;
      const sizes = photo?.sizes as Array<Record<string, unknown>>;
      if (sizes && sizes.length > 0) {
        // Largest photo size
        const largest = sizes[sizes.length - 1];
        document = largest.photo as Record<string, unknown>;
        // Smallest for thumbnail
        if (sizes.length > 1) {
          const smallest = sizes[0];
          thumbnail = smallest.photo as Record<string, unknown>;
        }
      }
      break;
    }
    case "messageVideo": {
      const video = content.video as Record<string, unknown>;
      document = video?.video as Record<string, unknown>;
      const thumb = video?.thumbnail as Record<string, unknown>;
      if (thumb) {
        thumbnail = thumb.file as Record<string, unknown>;
      }
      break;
    }
    case "messageAudio": {
      const audio = content.audio as Record<string, unknown>;
      document = audio?.audio as Record<string, unknown>;
      const thumb = audio?.album_cover_thumbnail as Record<string, unknown>;
      if (thumb) {
        thumbnail = thumb.file as Record<string, unknown>;
      }
      break;
    }
    case "messageDocument": {
      const doc = content.document as Record<string, unknown>;
      document = doc?.document as Record<string, unknown>;
      const thumb = doc?.thumbnail as Record<string, unknown>;
      if (thumb) {
        thumbnail = thumb.file as Record<string, unknown>;
      }
      break;
    }
    default:
      return null;
  }

  if (!document) return null;

  const remote = document.remote as Record<string, unknown>;

  return {
    remoteFileId: (remote?.id as string) || "",
    tdlibFileId: (document.id as number) || 0,
    thumbnailFileId: thumbnail ? (thumbnail.id as number) || null : null,
    size:
      (document.size as number) || (document.expected_size as number) || 0,
  };
}

/**
 * Download a thumbnail and return it as a base64 data URI, or null on failure.
 */
export async function getThumbnailDataUri(
  client: Awaited<ReturnType<typeof getTDLibClient>>,
  thumbnailFileId: number | null,
): Promise<string | null> {
  if (!thumbnailFileId) return null;
  try {
    const thumbFile = await client.invoke({
      _: "downloadFile",
      file_id: thumbnailFileId,
      priority: 32,
      synchronous: true,
    });

    if (thumbFile.local?.path && fs.existsSync(thumbFile.local.path)) {
      return fileToBase64DataUri(thumbFile.local.path, "image/jpeg");
    }
  } catch (err) {
    console.warn("[Upload] Failed to download thumbnail:", err);
  }
  return null;
}

/**
 * Build sendMessage params for TDLib, choosing the right content type
 * based on MIME type. Images are always sent as documents to preserve
 * original quality (no Telegram compression).
 */
export function buildSendParams(
  channelId: string,
  localFilePath: string,
  fileName: string,
  mimeType: string,
): Parameters<Awaited<ReturnType<typeof getTDLibClient>>["invoke"]>[0] {
  const caption = { _: "formattedText" as const, text: fileName };
  const inputFile = { _: "inputFileLocal" as const, path: localFilePath };
  const chatId = parseInt(channelId, 10);

  if (mimeType.startsWith("video/")) {
    return {
      _: "sendMessage",
      chat_id: chatId,
      input_message_content: { _: "inputMessageVideo", video: inputFile, caption },
    };
  }
  if (mimeType.startsWith("audio/")) {
    return {
      _: "sendMessage",
      chat_id: chatId,
      input_message_content: { _: "inputMessageAudio", audio: inputFile, caption },
    };
  }
  return {
    _: "sendMessage",
    chat_id: chatId,
    input_message_content: { _: "inputMessageDocument", document: inputFile, caption },
    };
}

/**
 * Build a document-fallback sendMessage (used when Telegram rejects a media type).
 */
export function buildDocumentFallbackParams(
  channelId: string,
  localFilePath: string,
  fileName: string,
): Parameters<Awaited<ReturnType<typeof getTDLibClient>>["invoke"]>[0] {
  return {
    _: "sendMessage",
    chat_id: parseInt(channelId, 10),
    input_message_content: {
      _: "inputMessageDocument",
      document: { _: "inputFileLocal" as const, path: localFilePath },
      caption: { _: "formattedText" as const, text: fileName },
    },
  };
}

/**
 * Ensure the Telegram channel is loaded in TDLib's local chat DB.
 * TDLib returns "Chat not found" if the chat hasn't been resolved yet.
 * Throws a descriptive error on failure.
 */
export async function ensureChannelLoaded(
  client: Awaited<ReturnType<typeof getTDLibClient>>,
  channelId: string,
): Promise<void> {
  const chatIdNum = parseInt(channelId, 10);
  try {
    await client.invoke({ _: "getChat", chat_id: chatIdNum });
  } catch {
    console.log("[Upload] Channel not in cache, loading chats...");
    try {
      await client.invoke({
        _: "loadChats",
        chat_list: { _: "chatListMain" },
        limit: 100,
      });
      await client.invoke({ _: "getChat", chat_id: chatIdNum });
    } catch (loadErr) {
      throw new Error(
        `Channel not accessible. Make sure the bot is admin in channel ${channelId}. Details: ${loadErr}`,
      );
    }
  }
}

/**
 * Parse a Telegram FLOOD_WAIT / rate-limit error and return the wait seconds,
 * or null if it's not a rate-limit error.
 */
export function parseFloodWait(errMsg: string): number | null {
  const floodMatch =
    errMsg.match(/FLOOD_WAIT[_\s](\d+)/i) ||
    errMsg.match(/retry after (\d+)/i) ||
    errMsg.match(/\[429\]/i);

  if (!floodMatch) return null;

  const retryMatch =
    errMsg.match(/(\d+)\s*$/) ||
    errMsg.match(/retry after (\d+)/i) ||
    errMsg.match(/FLOOD_WAIT[_\s](\d+)/i);
  return retryMatch ? parseInt(retryMatch[1], 10) : 30;
}
