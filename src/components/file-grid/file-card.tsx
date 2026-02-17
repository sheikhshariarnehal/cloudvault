"use client";

import { useState } from "react";
import { useUIStore } from "@/store/ui-store";
import { FileContextMenu } from "@/components/context-menu/file-context-menu";
import { getFileCategory, formatDate } from "@/types/file.types";
import {
  FileText,
  Image as ImageIcon,
  Film,
  Music,
  Archive,
  FileIcon,
  FileSpreadsheet,
  Presentation,
} from "lucide-react";
import type { DbFile } from "@/types/file.types";

interface FileCardProps {
  file: DbFile;
}

/* Google-Drive-style color scheme per file type */
const fileTypeConfig: Record<
  string,
  { icon: typeof FileIcon; color: string; bgClass: string; badgeBg: string }
> = {
  image: {
    icon: ImageIcon,
    color: "#D93025",
    bgClass: "bg-red-50",
    badgeBg: "#D93025",
  },
  video: {
    icon: Film,
    color: "#D93025",
    bgClass: "bg-red-50",
    badgeBg: "#D93025",
  },
  audio: {
    icon: Music,
    color: "#E37400",
    bgClass: "bg-orange-50",
    badgeBg: "#E37400",
  },
  document: {
    icon: FileText,
    color: "#4285F4",
    bgClass: "bg-blue-50",
    badgeBg: "#4285F4",
  },
  pdf: {
    icon: FileSpreadsheet,
    color: "#D93025",
    bgClass: "bg-red-50",
    badgeBg: "#D93025",
  },
  archive: {
    icon: Archive,
    color: "#5F6368",
    bgClass: "bg-gray-100",
    badgeBg: "#5F6368",
  },
  other: {
    icon: FileIcon,
    color: "#5F6368",
    bgClass: "bg-gray-100",
    badgeBg: "#5F6368",
  },
};

/* Detect Google Workspace-like types for specific badge colors */
function getSmartConfig(mimeType: string, category: string) {
  const m = mimeType.toLowerCase();
  if (m.includes("spreadsheet") || m.includes("excel") || m.includes("csv") || m.includes("sheet"))
    return { ...fileTypeConfig.document, icon: FileSpreadsheet, color: "#0F9D58", badgeBg: "#0F9D58", bgClass: "bg-green-50" };
  if (m.includes("presentation") || m.includes("powerpoint") || m.includes("pptx"))
    return { ...fileTypeConfig.document, icon: Presentation, color: "#F4B400", badgeBg: "#F4B400", bgClass: "bg-yellow-50" };
  if (m.includes("pdf"))
    return fileTypeConfig.pdf;
  return fileTypeConfig[category] || fileTypeConfig.other;
}

export function FileCard({ file }: FileCardProps) {
  const { setPreviewFileId } = useUIStore();
  const category = getFileCategory(file.mime_type);
  const [imgError, setImgError] = useState(false);

  const config = getSmartConfig(file.mime_type, category);
  const Icon = config.icon;

  // Show thumbnail for images and videos
  const thumbnailSrc =
    file.thumbnail_url || (category === "image" ? `/api/download/${file.id}` : null);
  const showThumbnail =
    (category === "image" || (category === "video" && file.thumbnail_url)) && !imgError;

  // Relative date
  const dateLabel = (() => {
    const d = new Date(file.updated_at || file.created_at);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    return formatDate(file.updated_at || file.created_at);
  })();

  return (
    <div className="group relative flex flex-col rounded-xl border border-[#dadce0] bg-white hover:shadow-md transition-shadow duration-200 overflow-hidden cursor-pointer">
      {/* ---- Thumbnail / Preview Area ---- */}
      <div
        className="relative w-full aspect-[4/3] overflow-hidden"
        onClick={() => setPreviewFileId(file.id)}
      >
        {showThumbnail && thumbnailSrc ? (
          <>
            <img
              src={thumbnailSrc}
              alt={file.name}
              className="w-full h-full object-cover"
              onError={() => setImgError(true)}
              loading="lazy"
            />
            {/* Subtle gradient overlay at bottom for readability */}
            <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/10 to-transparent" />
          </>
        ) : (
          <div
            className={`flex items-center justify-center w-full h-full ${config.bgClass}`}
          >
            <Icon className="h-16 w-16 opacity-30" style={{ color: config.color }} />
          </div>
        )}

        {/* File-type badge — top-left */}
        <div
          className="absolute top-2.5 left-2.5 flex items-center justify-center h-7 w-7 rounded-full shadow-sm"
          style={{ backgroundColor: config.badgeBg }}
        >
          <Icon className="h-3.5 w-3.5 text-white" />
        </div>
      </div>

      {/* ---- Bottom Info Bar ---- */}
      <div className="flex items-center gap-2.5 px-3 py-2.5 border-t border-[#e0e0e0] min-w-0">
        {/* File type icon (small, colored) */}
        <div className="flex-shrink-0">
          <Icon className="h-5 w-5" style={{ color: config.color }} />
        </div>

        {/* Name + metadata */}
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-medium text-[#202124] truncate leading-snug">
            {file.name}
          </p>
          <div className="flex items-center gap-1.5 mt-0.5">
            {/* Owner avatar placeholder */}
            <div className="h-4 w-4 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
              <span className="text-[8px] font-bold text-white leading-none">
                {(file.user_id || "G").charAt(0).toUpperCase()}
              </span>
            </div>
            <span className="text-[11px] text-[#5f6368] truncate">
              {dateLabel}
            </span>
          </div>
        </div>

        {/* Three-dot menu */}
        <div
          className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150"
          onClick={(e) => e.stopPropagation()}
        >
          <FileContextMenu file={file} />
        </div>
      </div>
    </div>
  );
}
