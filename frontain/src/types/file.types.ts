import type { Database } from "./database.types";

export type DbFile = Database["public"]["Tables"]["files"]["Row"];
export type DbFolder = Database["public"]["Tables"]["folders"]["Row"];
export type DbUser = Database["public"]["Tables"]["users"]["Row"];
export type DbSharedLink = Database["public"]["Tables"]["shared_links"]["Row"];

export type FileInsert = Database["public"]["Tables"]["files"]["Insert"];
export type FolderInsert = Database["public"]["Tables"]["folders"]["Insert"];

export type ViewMode = "grid" | "list";

export type FileCategory = "image" | "video" | "audio" | "document" | "pdf" | "archive" | "other";

/**
 * MIME types supported by the Microsoft Office Online Viewer.
 */
const OFFICE_MIME_TYPES = [
  "application/msword",                                                          // .doc
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",     // .docx
  "application/vnd.ms-excel",                                                    // .xls
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",           // .xlsx
];

/** Extensions accepted by the Office client-side previewer (Word & Excel only). */
const OFFICE_EXTENSIONS = ["doc", "docx", "xls", "xlsx"];

/**
 * Returns true when the file can be previewed with Microsoft Office Online.
 */
export function isOfficeFile(mimeType: string, fileName?: string): boolean {
  if (OFFICE_MIME_TYPES.includes(mimeType)) return true;
  if (fileName) {
    const ext = fileName.split(".").pop()?.toLowerCase();
    return !!ext && OFFICE_EXTENSIONS.includes(ext);
  }
  return false;
}

/**
 * Returns true when the file is a CSV that can be previewed client-side.
 */
export function isCsvFile(mimeType: string, fileName?: string): boolean {
  if (mimeType === "text/csv") return true;
  if (fileName) {
    return fileName.toLowerCase().endsWith(".csv");
  }
  return false;
}

/** Extensions recognised as PowerPoint presentations (modern XML-based only). */
const PPTX_EXTENSIONS = ["pptx"];
const PPTX_MIME_TYPES = [
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
];

/**
 * Returns true when the file is a legacy binary PowerPoint (.ppt) that
 * cannot be previewed client-side.
 */
export function isLegacyPptFile(mimeType: string, fileName?: string): boolean {
  if (mimeType === "application/vnd.ms-powerpoint") return true;
  if (fileName) return fileName.toLowerCase().endsWith(".ppt") && !fileName.toLowerCase().endsWith(".pptx");
  return false;
}

/**
 * Returns true when the file is a PowerPoint presentation.
 */
export function isPptxFile(mimeType: string, fileName?: string): boolean {
  if (PPTX_MIME_TYPES.includes(mimeType)) return true;
  if (fileName) {
    const ext = fileName.split(".").pop()?.toLowerCase();
    return !!ext && PPTX_EXTENSIONS.includes(ext);
  }
  return false;
}

/**
 * Returns true when the file is a JSON file.
 */
export function isJsonFile(mimeType: string, fileName?: string): boolean {
  if (mimeType === "application/json") return true;
  if (fileName) {
    return fileName.toLowerCase().endsWith(".json");
  }
  return false;
}

/** Extensions and MIME types for plain-text / code files (previewable as text). */
const TEXT_EXTENSIONS = [
  "txt", "md", "markdown", "log", "cfg", "conf", "ini", "env",
  "sh", "bash", "zsh", "bat", "cmd", "ps1",
  "py", "rb", "pl", "lua", "r",
  "js", "jsx", "ts", "tsx", "mjs", "cjs",
  "html", "htm", "css", "scss", "sass", "less",
  "java", "c", "h", "cpp", "cc", "cxx", "hpp",
  "cs", "go", "rs", "swift", "kt", "kts",
  "php", "sql", "graphql", "gql",
  "xml", "svg", "yaml", "yml", "toml",
  "dockerfile", "makefile", "gitignore", "editorconfig",
  "vue", "svelte", "astro",
];

const TEXT_MIME_PREFIXES = ["text/"];
const TEXT_MIME_EXACT = [
  "application/javascript",
  "application/typescript",
  "application/xml",
  "application/x-yaml",
  "application/sql",
  "application/x-sql",
  "application/x-sh",
  "application/x-httpd-php",
];

/**
 * Returns true when the file can be previewed as plain text / code.
 * Excludes CSV (has its own previewer) and JSON (has its own previewer).
 */
export function isTextFile(mimeType: string, fileName?: string): boolean {
  // Exclude CSV & JSON – they have dedicated previewers
  if (isCsvFile(mimeType, fileName) || isJsonFile(mimeType, fileName)) return false;

  if (TEXT_MIME_EXACT.includes(mimeType)) return true;
  if (TEXT_MIME_PREFIXES.some((p) => mimeType.startsWith(p))) return true;

  if (fileName) {
    const lower = fileName.toLowerCase();
    const ext = lower.split(".").pop() ?? "";
    // Also check the full filename for dot-files like "Makefile", "Dockerfile"
    return TEXT_EXTENSIONS.includes(ext) || TEXT_EXTENSIONS.includes(lower);
  }
  return false;
}

export interface UploadQueueItem {
  id: string;
  file: File;
  folderId: string | null;
  progress: number;
  bytesLoaded: number;
  bytesTotal: number;
  status: "pending" | "uploading" | "success" | "error" | "duplicate";
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
    mimeType.includes("xml") ||
    mimeType.includes("javascript") ||
    mimeType.includes("typescript") ||
    mimeType.includes("sql") ||
    mimeType.includes("yaml") ||
    mimeType.includes("markdown") ||
    mimeType.includes("x-python") ||
    mimeType.includes("x-httpd-php") ||
    mimeType.includes("x-sh")
  )
    return "document";
  return "other";
}

/**
 * Returns true when the file can be previewed by any of the built-in
 * previewers (text, JSON, CSV, Office, PPTX). Useful for fallback logic.
 */
export function isPreviewableFile(mimeType: string, fileName?: string): boolean {
  return (
    isTextFile(mimeType, fileName) ||
    isJsonFile(mimeType, fileName) ||
    isCsvFile(mimeType, fileName) ||
    isOfficeFile(mimeType, fileName) ||
    isPptxFile(mimeType, fileName) ||
    isLegacyPptFile(mimeType, fileName)
  );
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
  "image/heic",
  "image/heif",
  
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
  return { valid: true };
}
