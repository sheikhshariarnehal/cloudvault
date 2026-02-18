import { Request, Response, NextFunction } from "express";
import * as telegramService from "../services/telegram.service";

export async function downloadController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const messageId = parseInt(req.params.messageId as string, 10);

    if (Number.isNaN(messageId) || messageId <= 0) {
      res.status(400).json({ error: "Invalid messageId parameter" });
      return;
    }

    const mime = (req.query.mime as string) || "application/octet-stream";
    const isDownload = req.query.download !== undefined;

    console.log("[Download] Requesting messageId:", messageId, "mime:", mime);

    const stream = await telegramService.downloadFileStream(messageId);

    // Set response headers
    res.setHeader("Content-Type", mime);
    res.setHeader(
      "Content-Disposition",
      isDownload ? "attachment" : "inline"
    );
    res.setHeader("Cache-Control", "private, max-age=3600");

    // Pipe the Telegram download stream to the HTTP response
    stream.pipe(res);

    // Handle stream errors
    stream.on("error", (err) => {
      console.error("[Download] Stream error:", err.message);
      if (!res.headersSent) {
        res.status(500).json({ error: "Download stream failed" });
      } else {
        res.destroy();
      }
    });
  } catch (err) {
    next(err);
  }
}
