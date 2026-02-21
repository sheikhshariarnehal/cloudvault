"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { getFileCategory, formatFileSize } from "@/types/file.types";
import {
  Download,
  FileIcon,
  FileText,
  Image as ImageIcon,
  Video,
  Music,
  Archive,
  Loader2,
  AlertCircle,
  CloudOff,
  Folder,
  ChevronRight,
  ArrowLeft,
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

function getCategoryIcon(category: string, size: "sm" | "lg" = "lg") {
  const cls = size === "lg" ? "h-16 w-16" : "h-5 w-5";
  switch (category) {
    case "image":
      return <ImageIcon className={`${cls} text-blue-500`} />;
    case "video":
      return <Video className={`${cls} text-purple-500`} />;
    case "audio":
      return <Music className={`${cls} text-green-500`} />;
    case "pdf":
      return <FileText className={`${cls} text-red-500`} />;
    case "archive":
      return <Archive className={`${cls} text-yellow-600`} />;
    case "document":
      return <FileText className={`${cls} text-blue-600`} />;
    default:
      return <FileIcon className={`${cls} text-gray-500`} />;
  }
}

function getFileIconColor(mimeType: string): string {
  const cat = getFileCategory(mimeType);
  switch (cat) {
    case "image": return "text-blue-400";
    case "video": return "text-purple-400";
    case "audio": return "text-green-400";
    case "pdf": return "text-red-400";
    case "archive": return "text-yellow-500";
    case "document": return "text-blue-500";
    default: return "text-gray-400";
  }
}

export default function SharePage() {
  const params = useParams();
  const token = params.token as string;

  const [data, setData] = useState<ShareData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentSubfolderId, setCurrentSubfolderId] = useState<string | null>(null);

  const fetchShareData = useCallback(async (subfolderId?: string | null) => {
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
  }, [token]);

  useEffect(() => {
    fetchShareData(currentSubfolderId);
  }, [token, currentSubfolderId, fetchShareData]);

  const navigateToFolder = (folderId: string) => {
    setCurrentSubfolderId(folderId);
  };

  const navigateToBreadcrumb = (folderId: string) => {
    // If clicking the root folder, reset to null
    if (data?.type === "folder" && folderId === data.rootFolder.id) {
      setCurrentSubfolderId(null);
    } else {
      setCurrentSubfolderId(folderId);
    }
  };

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
    const { file, shareLink } = data;
    const category = getFileCategory(file.mime_type);
    const previewUrl = `/api/share/${token}?preview=true&_t=${Date.now()}`;
    const downloadUrl = `/api/share/${token}?download=true`;

    return (
      <div className="min-h-screen bg-[#202124] flex flex-col">
        <header className="bg-[#202124] h-16 flex-shrink-0">
          <div className="max-w-7xl mx-auto px-4 h-full flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <a href="/" className="flex items-center gap-2 text-white/80 hover:text-white">
                <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 16.2A4.5 4.5 0 0 0 17.5 8h-1.8A7 7 0 1 0 4 14.9" />
                  <path d="M12 12v9" />
                  <path d="m16 16-4-4-4 4" />
                </svg>
                <span className="font-bold text-sm">CloudVault</span>
              </a>
              <div className="w-px h-6 bg-white/20 mx-1" />
              <div className="min-w-0">
                <h1 className="text-[15px] font-medium text-white truncate">{file.name}</h1>
                <p className="text-xs text-white/50">{formatFileSize(file.size_bytes)}</p>
              </div>
            </div>
            <a href={downloadUrl} className="p-2.5 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-colors" title="Download">
              <Download className="h-5 w-5" />
            </a>
          </div>
        </header>

        <main className="flex-1 flex items-center justify-center p-4 sm:p-8 overflow-hidden">
          {category === "image" && (
            <img src={previewUrl} alt={file.name} className="max-w-full max-h-[calc(100vh-128px)] object-contain" />
          )}
          {category === "video" && (
            <div className="max-w-5xl w-full">
              <video controls className="w-full max-h-[calc(100vh-128px)] rounded-lg mx-auto">
                <source src={previewUrl} type={file.mime_type} />
              </video>
            </div>
          )}
          {category === "pdf" && (
            <div className="max-w-5xl w-full h-[calc(100vh-128px)]">
              <iframe src={previewUrl} className="w-full h-full rounded-lg border-0" title={file.name} allow="fullscreen" />
            </div>
          )}
          {category === "audio" && (
            <div className="text-center max-w-md w-full">
              <div className="text-white/30 flex justify-center mb-6">{getCategoryIcon(category)}</div>
              <p className="text-lg font-medium text-white mt-4 mb-6">{file.name}</p>
              <audio controls src={previewUrl} className="w-full" />
            </div>
          )}
          {(category === "document" || category === "archive" || category === "other") && (
            <div className="text-center max-w-md w-full">
              <div className="text-white/30 flex justify-center mb-4">{getCategoryIcon(category)}</div>
              <p className="text-lg font-medium text-white mt-4 mb-1">{file.name}</p>
              <p className="text-sm text-white/50 mb-6">{formatFileSize(file.size_bytes)} &middot; Preview not available for this file type</p>
              <a href={downloadUrl} className="inline-flex items-center gap-2 px-6 py-3 bg-[#8ab4f8] text-[#202124] rounded-full font-medium hover:bg-[#aecbfa] transition-colors">
                <Download className="h-4 w-4" />
                Download File
              </a>
            </div>
          )}
        </main>

        <footer className="bg-[#202124] border-t border-white/10 py-4 flex-shrink-0">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 text-center">
            <p className="text-sm text-white/30">
              Shared via <a href="/" className="text-white/50 hover:text-white/70 font-medium">CloudVault</a>
            </p>
          </div>
        </footer>
      </div>
    );
  }

  // ===== FOLDER SHARE VIEW =====
  const { folder, rootFolder, files, folders, totalSize, breadcrumbs, shareLink } = data;
  const fileCount = files.length;
  const folderCount = folders.length;

  return (
    <div className="min-h-screen bg-[#202124] flex flex-col">
      {/* Header */}
      <header className="bg-[#202124] border-b border-white/10 flex-shrink-0">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <a href="/" className="flex items-center gap-2 text-white/80 hover:text-white shrink-0">
                <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 16.2A4.5 4.5 0 0 0 17.5 8h-1.8A7 7 0 1 0 4 14.9" />
                  <path d="M12 12v9" />
                  <path d="m16 16-4-4-4 4" />
                </svg>
                <span className="font-bold text-sm">CloudVault</span>
              </a>
              <div className="w-px h-6 bg-white/20 mx-1" />
              <div className="min-w-0">
                <div className="flex items-center gap-1 text-sm">
                  <Folder className="h-4 w-4 shrink-0" style={{ color: folder.color || "#EAB308" }} />
                  <h1 className="text-[15px] font-medium text-white truncate">{folder.name}</h1>
                </div>
                <p className="text-xs text-white/50">
                  {folderCount > 0 && `${folderCount} folder${folderCount !== 1 ? "s" : ""}, `}
                  {fileCount} file{fileCount !== 1 ? "s" : ""} &middot; {formatFileSize(totalSize)}
                </p>
              </div>
            </div>
          </div>

          {/* Breadcrumbs */}
          {breadcrumbs.length > 1 && (
            <nav className="mt-3 flex items-center gap-1 text-sm overflow-x-auto">
              {breadcrumbs.map((crumb, idx) => (
                <span key={crumb.id} className="flex items-center gap-1 shrink-0">
                  {idx > 0 && <ChevronRight className="h-3 w-3 text-white/30" />}
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
          {/* Back button when in subfolder */}
          {currentSubfolderId && breadcrumbs.length > 1 && (
            <button
              onClick={() => {
                const parentIdx = breadcrumbs.length - 2;
                if (parentIdx >= 0) {
                  navigateToBreadcrumb(breadcrumbs[parentIdx].id);
                }
              }}
              className="flex items-center gap-2 text-sm text-white/60 hover:text-white mb-4 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
          )}

          {/* Sub-folders */}
          {folders.length > 0 && (
            <div className="mb-6">
              <h2 className="text-xs font-medium text-white/40 uppercase tracking-wider mb-3">Folders</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                {folders.map((subfolder) => (
                  <button
                    key={subfolder.id}
                    onClick={() => navigateToFolder(subfolder.id)}
                    className="flex items-center gap-3 p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-left group"
                  >
                    <Folder className="h-5 w-5 shrink-0" style={{ color: subfolder.color || "#EAB308" }} />
                    <span className="text-sm text-white/80 group-hover:text-white truncate">{subfolder.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Files */}
          {files.length > 0 && (
            <div>
              <h2 className="text-xs font-medium text-white/40 uppercase tracking-wider mb-3">Files</h2>
              <div className="bg-white/5 rounded-lg overflow-hidden divide-y divide-white/5">
                {files.map((file) => {
                  const category = getFileCategory(file.mime_type);
                  const downloadUrl = `/api/share/${token}?downloadFileId=${file.id}`;
                  const previewUrl = `/api/share/${token}?previewFileId=${file.id}`;
                  const isImage = category === "image";
                  const isVideo = category === "video";
                  const isAudio = category === "audio";

                  return (
                    <div
                      key={file.id}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors group"
                    >
                      {/* Thumbnail for images */}
                      {isImage ? (
                        <div className="h-10 w-10 rounded overflow-hidden bg-white/10 shrink-0">
                          <img
                            src={previewUrl}
                            alt={file.name}
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        </div>
                      ) : (
                        <div className={`shrink-0 ${getFileIconColor(file.mime_type)}`}>
                          {getCategoryIcon(category, "sm")}
                        </div>
                      )}

                      {/* File info */}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-white/90 truncate">{file.name}</p>
                        <p className="text-xs text-white/40">{formatFileSize(file.size_bytes)}</p>
                      </div>

                      {/* Preview / Download actions */}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {(isImage || isVideo || isAudio) && (
                          <a
                            href={previewUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                            title="Preview"
                          >
                            <FileIcon className="h-4 w-4" />
                          </a>
                        )}
                        <a
                          href={downloadUrl}
                          className="p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                          title="Download"
                        >
                          <Download className="h-4 w-4" />
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
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
            Shared via <a href="/" className="text-white/50 hover:text-white/70 font-medium">CloudVault</a>
          </p>
        </div>
      </footer>
    </div>
  );
}
