import { Router, Request, Response } from "express";
import { getTDLibClient } from "../tdlib-client.js";

const router = Router();

/**
 * DELETE /api/message/:chatId/:messageId
 * Delete a message (file) from the Telegram channel.
 *
 * This is called when a user permanently deletes a file from CloudVault.
 * Previously, telegram_message_id was stored but never used — this fixes that.
 */
router.delete(
  "/:chatId/:messageId",
  async (req: Request, res: Response) => {
    const { chatId, messageId } = req.params;

    if (!chatId || !messageId) {
      res.status(400).json({ error: "chatId and messageId required" });
      return;
    }

    try {
      const client = await getTDLibClient();

      await client.invoke({
        _: "deleteMessages",
        chat_id: parseInt(chatId, 10),
        message_ids: [parseInt(messageId, 10)],
        revoke: true, // Delete for everyone in the channel
      });

      console.log(
        `[Delete] Deleted message ${messageId} from chat ${chatId}`
      );

      res.json({
        success: true,
        deleted_message_id: parseInt(messageId, 10),
        chat_id: parseInt(chatId, 10),
      });
    } catch (err) {
      console.error("[Delete] Error:", err);

      const errorMsg =
        err instanceof Error ? err.message : "Delete failed";

      // Don't fail hard if message was already deleted
      if (
        errorMsg.includes("message not found") ||
        errorMsg.includes("MESSAGE_ID_INVALID")
      ) {
        res.json({
          success: true,
          already_deleted: true,
          deleted_message_id: parseInt(messageId, 10),
        });
        return;
      }

      res.status(500).json({ error: errorMsg });
    }
  }
);

/**
 * POST /api/message/cleanup
 * Bulk delete messages from the channel.
 * Used for emptying the trash, bulk file deletion, etc.
 *
 * Body: { chat_id, message_ids: number[] }
 */
router.post("/cleanup", async (req: Request, res: Response) => {
  const { chat_id, message_ids } = req.body;

  if (!chat_id || !Array.isArray(message_ids) || message_ids.length === 0) {
    res
      .status(400)
      .json({ error: "chat_id and message_ids[] required" });
    return;
  }

  try {
    const client = await getTDLibClient();

    // TDLib deleteMessages supports up to 100 messages at once
    const batchSize = 100;
    let deletedCount = 0;
    const failedIds: number[] = [];

    for (let i = 0; i < message_ids.length; i += batchSize) {
      const batch = message_ids.slice(i, i + batchSize).map(Number);

      try {
        await client.invoke({
          _: "deleteMessages",
          chat_id: parseInt(chat_id, 10),
          message_ids: batch,
          revoke: true,
        });
        deletedCount += batch.length;
      } catch {
        failedIds.push(...batch);
      }
    }

    console.log(
      `[Cleanup] Deleted ${deletedCount}/${message_ids.length} messages from chat ${chat_id}`
    );

    res.json({
      success: true,
      deleted_count: deletedCount,
      failed_count: failedIds.length,
      failed_ids: failedIds.length > 0 ? failedIds : undefined,
    });
  } catch (err) {
    console.error("[Cleanup] Error:", err);
    res.status(500).json({
      error: err instanceof Error ? err.message : "Cleanup failed",
    });
  }
});

export default router;
