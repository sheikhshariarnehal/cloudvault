import fs from "fs";
import { Response } from "express";
import mime from "mime-types";
import path from "path";

/**
 * Stream a local file to an Express response with proper headers.
 * Supports Range requests for video seeking / resumable downloads.
 */
export function streamFileToResponse(
  filePath: string,
  res: Response,
  options: {
    fileName?: string;
    mimeType?: string;
    inline?: boolean;
    rangeHeader?: string;
  } = {}
): void {
  const stat = fs.statSync(filePath);
  const fileSize = stat.size;

  const contentType =
    options.mimeType ||
    mime.lookup(filePath) ||
    "application/octet-stream";

  const disposition = options.inline ? "inline" : "attachment";
  const fileName = options.fileName || path.basename(filePath);

  // Handle Range requests (for video streaming / resumable downloads)
  if (options.rangeHeader) {
    const parts = options.rangeHeader.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

    if (start >= fileSize || end >= fileSize) {
      res.status(416).set("Content-Range", `bytes */${fileSize}`).end();
      return;
    }

    const chunkSize = end - start + 1;

    res.status(206).set({
      "Content-Range": `bytes ${start}-${end}/${fileSize}`,
      "Accept-Ranges": "bytes",
      "Content-Length": chunkSize.toString(),
      "Content-Type": contentType,
      "Content-Disposition": `${disposition}; filename="${encodeURIComponent(fileName)}"`,
    });

    const stream = fs.createReadStream(filePath, { start, end });
    stream.pipe(res);
  } else {
    res.set({
      "Content-Length": fileSize.toString(),
      "Content-Type": contentType,
      "Accept-Ranges": "bytes",
      "Content-Disposition": `${disposition}; filename="${encodeURIComponent(fileName)}"`,
      "Cache-Control": "private, max-age=3600",
    });

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  }
}

/**
 * Read a file and return it as a base64 data URI
 */
export function fileToBase64DataUri(
  filePath: string,
  mimeType?: string
): string {
  const buffer = fs.readFileSync(filePath);
  const type = mimeType || mime.lookup(filePath) || "application/octet-stream";
  return `data:${type};base64,${buffer.toString("base64")}`;
}
