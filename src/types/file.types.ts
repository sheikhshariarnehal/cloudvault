import type { Database } from "./database.types";

export type DbFile = Database["public"]["Tables"]["files"]["Row"];
export type DbFolder = Database["public"]["Tables"]["folders"]["Row"];
export type DbUser = Database["public"]["Tables"]["users"]["Row"];
export type DbSharedLink = Database["public"]["Tables"]["shared_links"]["Row"];

export type FileInsert = Database["public"]["Tables"]["files"]["Insert"];
export type FolderInsert = Database["public"]["Tables"]["folders"]["Insert"];

export type ViewMode = "grid" | "list";

export type FileCategory = "image" | "video" | "audio" | "document" | "pdf" | "archive" | "other";

export interface UploadQueueItem {
  id: string;
  file: File;
  folderId: string | null;
  progress: number;
  status: "pending" | "uploading" | "success" | "error";
  error?: string;
}

export interface BreadcrumbItem {
  id: string | null;
  name: string;
}

export function getFileCategory(mimeType: string): FileCategory {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType === "application/pdf") return "pdf";
  if (
    mimeType.includes("zip") ||
    mimeType.includes("rar") ||
    mimeType.includes("tar") ||
    mimeType.includes("7z") ||
    mimeType.includes("gzip")
  )
    return "archive";
  if (
    mimeType.includes("document") ||
    mimeType.includes("text") ||
    mimeType.includes("sheet") ||
    mimeType.includes("presentation") ||
    mimeType.includes("msword") ||
    mimeType.includes("json") ||
    mimeType.includes("xml")
  )
    return "document";
  return "other";
}

export function getFileExtension(filename: string): string {
  const parts = filename.split(".");
  return parts.length > 1 ? parts.pop()!.toLowerCase() : "";
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

const ALLOWED_MIME_TYPES = [
  // Images
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "image/bmp",
  "image/tiff",
  "image/x-icon",
  "image/avif",
  
  // Videos
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-msvideo",
  "video/x-matroska",
  "video/mpeg",
  
  // Audio
  "audio/mpeg",
  "audio/wav",
  "audio/ogg",
  "audio/webm",
  "audio/aac",
  "audio/x-m4a",
  "audio/flac",
  
  // Documents
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/rtf",
  "application/vnd.oasis.opendocument.text",
  "application/vnd.oasis.opendocument.spreadsheet",
  "application/vnd.oasis.opendocument.presentation",
  
  // Archives
  "application/zip",
  "application/x-rar-compressed",
  "application/x-7z-compressed",
  "application/gzip",
  "application/x-tar",
  "application/x-bzip2",
  "application/x-compressed",
  "application/x-compress",
  
  // Text & Code
  "text/plain",
  "text/markdown",
  "text/csv",
  "text/html",
  "text/css",
  "text/javascript",
  "text/typescript",
  "application/javascript",
  "application/typescript",
  "application/json",
  "application/xml",
  "text/xml",
  "application/x-sql",
  "application/sql",
  "text/x-sql",
  "text/x-python",
  "text/x-java",
  "text/x-c",
  "text/x-c++",
  "text/x-csharp",
  "text/x-php",
  "text/x-ruby",
  "text/x-go",
  "text/x-rust",
  "text/x-swift",
  "text/x-kotlin",
  "application/x-yaml",
  "text/yaml",
  
  // Others
  "application/octet-stream",
];

const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024; // 2GB

export function validateFile(file: File): { valid: boolean; error?: string } {
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: `File size exceeds the 2GB limit` };
  }
  if (!ALLOWED_MIME_TYPES.includes(file.type) && file.type !== "") {
    return { valid: false, error: `File type "${file.type}" is not supported` };
  }
  return { valid: true };
}
