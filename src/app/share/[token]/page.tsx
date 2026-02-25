"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { ImagePreview } from "@/components/preview/image-preview";
import { VideoPreview } from "@/components/preview/video-preview";
import { PdfPreview } from "@/components/preview/pdf-preview";
import { OfficePreview } from "@/components/preview/office-preview";
import { CsvPreview } from "@/components/preview/csv-preview";
import { TextPreview } from "@/components/preview/text-preview";
import { JsonPreview } from "@/components/preview/json-preview";
import { PptxPreview } from "@/components/preview/pptx-preview";
import { getFileCategory, formatFileSize, isOfficeFile, isCsvFile, isPptxFile, isJsonFile, isTextFile, isPreviewableFile, isLegacyPptFile } from "@/types/file.types";
import {
  Download,
  FileIcon,
  FileText,
  FileCode,
  FileSpreadsheet,
  Presentation,
  Image as ImageIcon,
  Film,
  Music,
  Archive,
  Loader2,
  CloudOff,
  Folder,
  ChevronRight,
  ChevronLeft,
  ArrowLeft,
  X,
  Eye,
} from "lucide-react";

interface SharedFile {
  id: string;
  name: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
}

interface SharedFolder {
  id: string;
  name: string;
  color: string;
  created_at: string;
}

interface BreadcrumbItem {
  id: string;
  name: string;
}

interface FileShareData {
  type: "file";
  file: SharedFile;
  shareLink: {
    token: string;
    created_at: string;
  };
}

interface FolderShareData {
  type: "folder";
  folder: SharedFolder;
  rootFolder: { id: string; name: string };
  files: SharedFile[];
  folders: SharedFolder[];
  totalSize: number;
  breadcrumbs: BreadcrumbItem[];
  shareLink: {
    token: string;
    created_at: string;
  };
}

type ShareData = FileShareData | FolderShareData;

interface SmartIconConfig {
  Icon: React.ElementType;
  color: string; // tailwind text color
}

function getSmartIconConfig(mimeType: string, fileName?: string): SmartIconConfig {
  const m = mimeType.toLowerCase();
  const name = (fileName ?? "").toLowerCase();

  // Images
  if (m.startsWith("image/")) return { Icon: ImageIcon, color: "text-blue-400" };
  // Video
  if (m.startsWith("video/")) return { Icon: Film, color: "text-purple-400" };
  // Audio
  if (m.startsWith("audio/")) return { Icon: Music, color: "text-green-400" };
  // PDF
  if (m === "application/pdf" || name.endsWith(".pdf")) return { Icon: FileText, color: "text-red-500" };
  // Spreadsheets (Excel, CSV, ODS)
  if (m.includes("spreadsheet") || m.includes("excel") || m.includes("csv") || m.includes(".sheet"))
    return { Icon: FileSpreadsheet, color: "text-emerald-500" };
  if (name.endsWith(".csv") || name.endsWith(".xlsx") || name.endsWith(".xls") || name.endsWith(".ods"))
    return { Icon: FileSpreadsheet, color: "text-emerald-500" };
  // Presentations (PowerPoint, PPTX, ODP)
  if (m.includes("presentation") || m.includes("powerpoint"))
    return { Icon: Presentation, color: "text-amber-400" };
  if (name.endsWith(".pptx") || name.endsWith(".ppt") || name.endsWith(".odp"))
    return { Icon: Presentation, color: "text-amber-400" };
  // Word / rich text documents (DOC, DOCX, ODT, RTF)
  if (m.includes("msword") || m.includes("wordprocessing") || m.includes("rtf") || m.includes("opendocument.text"))
    return { Icon: FileText, color: "text-blue-500" };
  if (name.endsWith(".doc") || name.endsWith(".docx") || name.endsWith(".odt") || name.endsWith(".rtf"))
    return { Icon: FileText, color: "text-blue-500" };
  // Archives (ZIP, RAR, 7z, tar, gz)
  if (m.includes("zip") || m.includes("rar") || m.includes("tar") || m.includes("7z") || m.includes("gzip") || m.includes("bzip"))
    return { Icon: Archive, color: "text-yellow-500" };
  if (name.endsWith(".zip") || name.endsWith(".rar") || name.endsWith(".7z") || name.endsWith(".tar") || name.endsWith(".gz"))
    return { Icon: Archive, color: "text-yellow-500" };
  // Code / text files
  if (
    m.includes("javascript") || m.includes("typescript") || m.includes("x-python") ||
    m.includes("x-sh") || m.includes("sql") || m.includes("yaml") || m.includes("markdown") ||
    m.includes("html") || m.includes("css") || m.includes("json") || m.includes("xml")
  ) return { Icon: FileCode, color: "text-slate-400" };
  if (name.endsWith(".json") || name.endsWith(".xml") || name.endsWith(".yaml") || name.endsWith(".yml"))
    return { Icon: FileCode, color: "text-slate-400" };
  if (name.endsWith(".js") || name.endsWith(".ts") || name.endsWith(".py") || name.endsWith(".sh") ||
      name.endsWith(".html") || name.endsWith(".css") || name.endsWith(".sql") || name.endsWith(".md"))
    return { Icon: FileCode, color: "text-slate-400" };
  // Plain text
  if (m.startsWith("text/") || name.endsWith(".txt")) return { Icon: FileText, color: "text-gray-400" };
  // Generic
  return { Icon: FileIcon, color: "text-gray-500" };
}

function getSmartIcon(mimeType: string, fileName?: string, size: "sm" | "lg" = "lg") {
  const { Icon, color } = getSmartIconConfig(mimeType, fileName);
  const cls = size === "lg" ? "h-8 w-8" : "h-5 w-5";
  return <Icon className={`${cls} ${color}`} />;
}

/** Check if a file type can be previewed inline */
function isPreviewable(mimeType: string, fileName?: string): boolean {
  const cat = getFileCategory(mimeType);
  if (["image", "video", "audio", "pdf"].includes(cat)) return true;
  return isPreviewableFile(mimeType, fileName);
}

// ─────────────────────────────────────────────
// Inline Preview Modal (reuses app preview components)
// ─────────────────────────────────────────────
function SharePreviewModal({
  file,
  token,
  files,
  onClose,
  onNavigate,
}: {
  file: SharedFile;
  token: string;
  files: SharedFile[];
  onClose: () => void;
  onNavigate: (fileId: string) => void;
}) {
  const category = getFileCategory(file.mime_type);
  const previewUrl = `/api/share/${token}?previewFileId=${file.id}`;
  const downloadUrl = `/api/share/${token}?downloadFileId=${file.id}`;

  // Navigable previewable files for arrow navigation
  const previewableFiles = files.filter((f) => isPreviewable(f.mime_type, f.name));
  const currentIndex = previewableFiles.findIndex((f) => f.id === file.id);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < previewableFiles.length - 1;

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft" && hasPrev)
        onNavigate(previewableFiles[currentIndex - 1].id);
      else if (e.key === "ArrowRight" && hasNext)
        onNavigate(previewableFiles[currentIndex + 1].id);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, onNavigate, hasPrev, hasNext, currentIndex, previewableFiles]);

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-[#202124]">
      {/* Top bar */}
      <div className="flex items-center justify-between h-16 px-4 bg-[#202124] flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onClose}
            className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-colors flex-shrink-0"
            title="Close"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="min-w-0">
            <h2 className="text-[15px] font-medium text-white truncate">
              {file.name}
            </h2>
            <p className="text-xs text-white/50">
              {formatFileSize(file.size_bytes)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <a
            href={downloadUrl}
            className="p-2.5 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-colors"
            title="Download"
          >
            <Download className="h-5 w-5" />
          </a>
        </div>
      </div>

      {/* Preview content */}
      <div
        className="flex-1 relative flex items-center justify-center overflow-hidden"
        onClick={handleOverlayClick}
      >
        {/* Left arrow */}
        {hasPrev && (
          <button
            onClick={() => onNavigate(previewableFiles[currentIndex - 1].id)}
            className="absolute left-4 z-10 p-3 text-white/60 hover:text-white bg-black/30 hover:bg-black/50 rounded-full transition-all"
            title="Previous"
          >
            <ChevronLeft className="h-7 w-7" />
          </button>
        )}

        {/* Content */}
        <div className="w-full h-full flex items-center justify-center">
          {category === "image" && (
            <ImagePreview src={previewUrl} alt={file.name} />
          )}
          {category === "pdf" && (
            <div className="w-full h-full">
              <PdfPreview src={previewUrl} />
            </div>
          )}
          {category === "video" && (
            <div className="max-w-5xl w-full px-8">
              <VideoPreview src={previewUrl} />
            </div>
          )}
          {category === "audio" && (
            <div className="p-8 text-center">
              <FileIcon className="h-20 w-20 text-white/30 mx-auto mb-6" />
              <p className="text-lg font-medium mb-6 text-white">
                {file.name}
              </p>
              <audio
                controls
                src={previewUrl}
                className="w-full max-w-md mx-auto"
              />
            </div>
          )}
          {/* Office documents (Word, Excel) — NOT PowerPoint */}
          {isOfficeFile(file.mime_type, file.name) && !isPptxFile(file.mime_type, file.name) && (
            <div className="w-full h-full">
              <OfficePreview src={previewUrl} fileName={file.name} />
            </div>
          )}
          {/* PowerPoint presentations (.pptx) */}
          {isPptxFile(file.mime_type, file.name) && (
            <div className="w-full h-full">
              <PptxPreview src={previewUrl} fileName={file.name} />
            </div>
          )}
          {/* Legacy PowerPoint (.ppt) */}
          {isLegacyPptFile(file.mime_type, file.name) && (
            <div className="w-full h-full">
              <PptxPreview src={previewUrl} fileName={file.name} />
            </div>
          )}
          {/* CSV files */}
          {isCsvFile(file.mime_type, file.name) && (
            <div className="w-full h-full">
              <CsvPreview src={previewUrl} fileName={file.name} />
            </div>
          )}
          {/* JSON files */}
          {isJsonFile(file.mime_type, file.name) && (
            <div className="w-full h-full">
              <JsonPreview src={previewUrl} fileName={file.name} />
            </div>
          )}
          {/* Text / code files */}
          {isTextFile(file.mime_type, file.name) && (
            <div className="w-full h-full">
              <TextPreview src={previewUrl} fileName={file.name} />
            </div>
          )}
        </div>

        {/* Right arrow */}
        {hasNext && (
          <button
            onClick={() => onNavigate(previewableFiles[currentIndex + 1].id)}
            className="absolute right-4 z-10 p-3 text-white/60 hover:text-white bg-black/30 hover:bg-black/50 rounded-full transition-all"
            title="Next"
          >
            <ChevronRight className="h-7 w-7" />
          </button>
        )}
      </div>

      {/* Counter */}
      {previewableFiles.length > 1 && (
        <div className="absolute bottom-6 right-6 text-xs text-white/50 bg-[#2d2e30] px-3 py-1.5 rounded-full">
          {currentIndex + 1} / {previewableFiles.length}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Main Share Page
// ─────────────────────────────────────────────
export default function SharePage() {
  const params = useParams();
  const token = params.token as string;

  const [data, setData] = useState<ShareData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentSubfolderId, setCurrentSubfolderId] = useState<string | null>(
    null
  );
  const [previewFileId, setPreviewFileId] = useState<string | null>(null);

  const fetchShareData = useCallback(
    async (subfolderId?: string | null) => {
      setIsLoading(true);
      try {
        let url = `/api/share/${token}`;
        if (subfolderId) {
          url += `?subfolderId=${subfolderId}`;
        }
        const response = await fetch(url);
        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || "Share link not found");
        }
        const shareData = await response.json();
        setData(shareData);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load shared content"
        );
      } finally {
        setIsLoading(false);
      }
    },
    [token]
  );

  useEffect(() => {
    fetchShareData(currentSubfolderId);
  }, [token, currentSubfolderId, fetchShareData]);

  const navigateToFolder = (folderId: string) => {
    setCurrentSubfolderId(folderId);
  };

  const navigateToBreadcrumb = (folderId: string) => {
    if (data?.type === "folder" && folderId === data.rootFolder.id) {
      setCurrentSubfolderId(null);
    } else {
      setCurrentSubfolderId(folderId);
    }
  };

  // ─── Loading ───
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">Loading shared content...</p>
        </div>
      </div>
    );
  }

  // ─── Error ───
  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-6">
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <CloudOff className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h1 className="text-xl font-semibold text-gray-900 mb-2">
              Link Unavailable
            </h1>
            <p className="text-gray-500 mb-6">
              {error || "This share link is no longer available."}
            </p>
            <a
              href="/"
              className="inline-flex items-center px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors text-sm"
            >
              Go to CloudVault
            </a>
          </div>
        </div>
      </div>
    );
  }

  // ===== FILE SHARE VIEW =====
  if (data.type === "file") {
    const { file } = data;
    const category = getFileCategory(file.mime_type);
    const previewUrl = `/api/share/${token}?preview=true&_t=${Date.now()}`;
    const downloadUrl = `/api/share/${token}?download=true`;

    return (
      <div className="min-h-screen bg-[#202124] flex flex-col">
        <header className="bg-[#202124] h-16 flex-shrink-0">
          <div className="max-w-7xl mx-auto px-4 h-full flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <a
                href="/"
                className="flex items-center gap-2 text-white/80 hover:text-white"
              >
                <svg
                  className="h-6 w-6"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M20 16.2A4.5 4.5 0 0 0 17.5 8h-1.8A7 7 0 1 0 4 14.9" />
                  <path d="M12 12v9" />
                  <path d="m16 16-4-4-4 4" />
                </svg>
                <span className="font-bold text-sm">CloudVault</span>
              </a>
              <div className="w-px h-6 bg-white/20 mx-1" />
              <div className="min-w-0">
                <h1 className="text-[15px] font-medium text-white truncate">
                  {file.name}
                </h1>
                <p className="text-xs text-white/50">
                  {formatFileSize(file.size_bytes)}
                </p>
              </div>
            </div>
            <a
              href={downloadUrl}
              className="p-2.5 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-colors"
              title="Download"
            >
              <Download className="h-5 w-5" />
            </a>
          </div>
        </header>

        <main className="flex-1 flex items-center justify-center overflow-hidden">
          {category === "image" && (
            <div className="w-full h-full">
              <ImagePreview src={previewUrl} alt={file.name} />
            </div>
          )}
          {category === "video" && (
            <div className="max-w-5xl w-full px-8">
              <VideoPreview src={previewUrl} />
            </div>
          )}
          {category === "pdf" && (
            <div className="w-full h-full">
              <PdfPreview src={previewUrl} />
            </div>
          )}
          {category === "audio" && (
            <div className="p-8 text-center">
              <FileIcon className="h-20 w-20 text-white/30 mx-auto mb-6" />
              <p className="text-lg font-medium text-white mb-6">{file.name}</p>
              <audio
                controls
                src={previewUrl}
                className="w-full max-w-md mx-auto"
              />
            </div>
          )}
          {/* Office documents (Word, Excel) — NOT PowerPoint */}
          {isOfficeFile(file.mime_type, file.name) && !isPptxFile(file.mime_type, file.name) && (
            <div className="w-full h-full">
              <OfficePreview src={previewUrl} fileName={file.name} />
            </div>
          )}
          {/* PowerPoint presentations (.pptx) */}
          {isPptxFile(file.mime_type, file.name) && (
            <div className="w-full h-full">
              <PptxPreview src={previewUrl} fileName={file.name} />
            </div>
          )}
          {/* Legacy PowerPoint (.ppt) */}
          {isLegacyPptFile(file.mime_type, file.name) && (
            <div className="w-full h-full">
              <PptxPreview src={previewUrl} fileName={file.name} />
            </div>
          )}
          {/* CSV files */}
          {isCsvFile(file.mime_type, file.name) && (
            <div className="w-full h-full">
              <CsvPreview src={previewUrl} fileName={file.name} />
            </div>
          )}
          {/* JSON files */}
          {isJsonFile(file.mime_type, file.name) && (
            <div className="w-full h-full">
              <JsonPreview src={previewUrl} fileName={file.name} />
            </div>
          )}
          {/* Text / code files */}
          {isTextFile(file.mime_type, file.name) && (
            <div className="w-full h-full">
              <TextPreview src={previewUrl} fileName={file.name} />
            </div>
          )}
          {!isPreviewable(file.mime_type, file.name) && (
            <div className="text-center max-w-md w-full">
              <div className="flex justify-center mb-4">
                {getSmartIcon(file.mime_type, file.name, "lg")}
              </div>
              <p className="text-lg font-medium text-white mt-4 mb-1">
                {file.name}
              </p>
              <p className="text-sm text-white/50 mb-6">
                {formatFileSize(file.size_bytes)} &middot; Preview not available
              </p>
              <a
                href={downloadUrl}
                className="inline-flex items-center gap-2 px-6 py-3 bg-[#8ab4f8] text-[#202124] rounded-full font-medium hover:bg-[#aecbfa] transition-colors"
              >
                <Download className="h-4 w-4" />
                Download File
              </a>
            </div>
          )}
        </main>

        <footer className="bg-[#202124] border-t border-white/10 py-4 flex-shrink-0">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 text-center">
            <p className="text-sm text-white/30">
              Shared via{" "}
              <a
                href="/"
                className="text-white/50 hover:text-white/70 font-medium"
              >
                CloudVault
              </a>
            </p>
          </div>
        </footer>
      </div>
    );
  }

  // ===== FOLDER SHARE VIEW =====
  const { folder, rootFolder, files, folders, totalSize, breadcrumbs } = data;
  const fileCount = files.length;
  const folderCount = folders.length;

  // File currently being previewed
  const previewFile = previewFileId
    ? files.find((f) => f.id === previewFileId)
    : null;

  return (
    <div className="min-h-screen bg-[#202124] flex flex-col">
      {/* Inline preview modal */}
      {previewFile && (
        <SharePreviewModal
          file={previewFile}
          token={token}
          files={files}
          onClose={() => setPreviewFileId(null)}
          onNavigate={(id) => setPreviewFileId(id)}
        />
      )}

      {/* Header */}
      <header className="bg-[#202124] border-b border-white/10 flex-shrink-0">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <a
                href="/"
                className="flex items-center gap-2 text-white/80 hover:text-white shrink-0"
              >
                <svg
                  className="h-6 w-6"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M20 16.2A4.5 4.5 0 0 0 17.5 8h-1.8A7 7 0 1 0 4 14.9" />
                  <path d="M12 12v9" />
                  <path d="m16 16-4-4-4 4" />
                </svg>
                <span className="font-bold text-sm">CloudVault</span>
              </a>
              <div className="w-px h-6 bg-white/20 mx-1" />
              <div className="min-w-0">
                <div className="flex items-center gap-1 text-sm">
                  <Folder
                    className="h-4 w-4 shrink-0"
                    style={{ color: folder.color || "#EAB308" }}
                  />
                  <h1 className="text-[15px] font-medium text-white truncate">
                    {folder.name}
                  </h1>
                </div>
                <p className="text-xs text-white/50">
                  {folderCount > 0 &&
                    `${folderCount} folder${folderCount !== 1 ? "s" : ""}, `}
                  {fileCount} file{fileCount !== 1 ? "s" : ""} &middot;{" "}
                  {formatFileSize(totalSize)}
                </p>
              </div>
            </div>
          </div>

          {/* Breadcrumbs */}
          {breadcrumbs.length > 1 && (
            <nav className="mt-3 flex items-center gap-1 text-sm overflow-x-auto">
              {breadcrumbs.map((crumb, idx) => (
                <span
                  key={crumb.id}
                  className="flex items-center gap-1 shrink-0"
                >
                  {idx > 0 && (
                    <ChevronRight className="h-3 w-3 text-white/30" />
                  )}
                  {idx < breadcrumbs.length - 1 ? (
                    <button
                      onClick={() => navigateToBreadcrumb(crumb.id)}
                      className="text-[#8ab4f8] hover:text-[#aecbfa] hover:underline transition-colors"
                    >
                      {crumb.name}
                    </button>
                  ) : (
                    <span className="text-white/70">{crumb.name}</span>
                  )}
                </span>
              ))}
            </nav>
          )}
        </div>
      </header>

      {/* Folder Contents */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
          {/* Back button */}
          {currentSubfolderId && breadcrumbs.length > 1 && (
            <button
              onClick={() => {
                const parentIdx = breadcrumbs.length - 2;
                if (parentIdx >= 0)
                  navigateToBreadcrumb(breadcrumbs[parentIdx].id);
              }}
              className="flex items-center gap-2 text-sm text-white/60 hover:text-white mb-4 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
          )}

          {/* List table header */}
          {(folders.length > 0 || files.length > 0) && (
            <div className="hidden sm:grid grid-cols-[minmax(0,1fr)_120px_80px] gap-4 px-3 pb-2 border-b border-white/10 text-xs font-medium text-white/30 uppercase tracking-wider">
              <span>Name</span>
              <span>Size</span>
              <span className="text-right">Actions</span>
            </div>
          )}

          {/* Sub-folders */}
          {folders.length > 0 && (
            <div className="mt-1">
              {folders.map((subfolder) => (
                <button
                  key={subfolder.id}
                  onClick={() => navigateToFolder(subfolder.id)}
                  className="w-full grid grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[minmax(0,1fr)_120px_80px] gap-4 items-center px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors text-left group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Folder
                      className="h-5 w-5 shrink-0"
                      style={{ color: subfolder.color || "#EAB308" }}
                    />
                    <span className="text-sm text-white/80 group-hover:text-white truncate">
                      {subfolder.name}
                    </span>
                  </div>
                  <span className="text-xs text-white/30 hidden sm:block">—</span>
                  <span className="text-xs text-white/30 text-right">
                    <ChevronRight className="h-4 w-4 inline-block text-white/30 group-hover:text-white/60" />
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Files */}
          {files.length > 0 && (
            <div className="mt-1">
              {files.map((file) => {
                const downloadUrl = `/api/share/${token}?downloadFileId=${file.id}`;
                const canPreview = isPreviewable(file.mime_type, file.name);

                return (
                  <div
                    key={file.id}
                    className={`group grid grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[minmax(0,1fr)_120px_80px] gap-4 items-center px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors ${canPreview ? "cursor-pointer" : ""}`}
                    onClick={() => canPreview && setPreviewFileId(file.id)}
                  >
                    {/* Name + icon */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="shrink-0">
                        {getSmartIcon(file.mime_type, file.name, "sm")}
                      </div>
                      <span className="text-sm text-white/80 group-hover:text-white truncate" title={file.name}>
                        {file.name}
                      </span>
                    </div>

                    {/* Size */}
                    <span className="text-xs text-white/40 hidden sm:block whitespace-nowrap">
                      {formatFileSize(file.size_bytes)}
                    </span>

                    {/* Actions */}
                    <div
                      className="flex items-center justify-end gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {canPreview && (
                        <button
                          onClick={() => setPreviewFileId(file.id)}
                          className="p-1.5 text-white/40 hover:text-white hover:bg-white/10 rounded-full transition-colors opacity-0 group-hover:opacity-100"
                          title="Preview"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      )}
                      <a
                        href={downloadUrl}
                        className="p-1.5 text-white/40 hover:text-white hover:bg-white/10 rounded-full transition-colors opacity-0 group-hover:opacity-100"
                        title="Download"
                      >
                        <Download className="h-4 w-4" />
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Empty state */}
          {files.length === 0 && folders.length === 0 && (
            <div className="text-center py-16">
              <Folder className="h-16 w-16 text-white/20 mx-auto mb-4" />
              <p className="text-white/50 text-lg">This folder is empty</p>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-[#202124] border-t border-white/10 py-4 flex-shrink-0">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 text-center">
          <p className="text-sm text-white/30">
            Shared via{" "}
            <a
              href="/"
              className="text-white/50 hover:text-white/70 font-medium"
            >
              CloudVault
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
