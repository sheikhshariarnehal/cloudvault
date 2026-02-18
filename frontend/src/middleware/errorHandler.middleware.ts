import { Request, Response, NextFunction } from "express";
import { MulterError } from "multer";

/**
 * Global Express error handler (4-argument signature).
 */
export function errorHandlerMiddleware(
  err: Error & { statusCode?: number },
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error("[Error]", err.message, err.stack);

  // Multer file-size limit
  if (err instanceof MulterError && err.code === "LIMIT_FILE_SIZE") {
    res.status(413).json({ error: "File size exceeds the 2GB limit" });
    return;
  }

  // General multer errors
  if (err instanceof MulterError) {
    res.status(400).json({ error: err.message });
    return;
  }

  const status = err.statusCode ?? 500;
  res.status(status).json({ error: err.message || "Internal server error" });
}
