"use client";

import { useState } from "react";
import { useUIStore } from "@/store/ui-store";
import { FileContextMenu } from "@/components/context-menu/file-context-menu";
import { getFileCategory } from "@/types/file.types";
import {
  FileText,
  Image as ImageIcon,
  Film,
  Music,
  Archive,
  FileIcon,
  FileSpreadsheet,
  Presentation,
  ListOrdered,
} from "lucide-react";
import type { DbFile } from "@/types/file.types";

interface FileCardProps {
  file: DbFile;
}

/* Google Drive icon + color per file category */
const fileTypeConfig: Record<
  string,
  { icon: typeof FileIcon; color: string; bgClass: string }
> = {
  image: { icon: ImageIcon, color: "#D93025", bgClass: "bg-[#fce8e6]" },
  video: { icon: Film, color: "#D93025", bgClass: "bg-[#fce8e6]" },
  audio: { icon: Music, color: "#E37400", bgClass: "bg-[#fef7e0]" },
  document: { icon: FileText, color: "#4285F4", bgClass: "bg-[#e8f0fe]" },
  pdf: { icon: FileSpreadsheet, color: "#D93025", bgClass: "bg-[#fce8e6]" },
  archive: { icon: Archive, color: "#5F6368", bgClass: "bg-[#f1f3f4]" },
  other: { icon: FileIcon, color: "#5F6368", bgClass: "bg-[#f1f3f4]" },
};

function getSmartConfig(mimeType: string, category: string) {
  const m = mimeType.toLowerCase();
  if (m.includes("spreadsheet") || m.includes("excel") || m.includes("csv") || m.includes("sheet"))
    return { icon: FileSpreadsheet, color: "#0F9D58", bgClass: "bg-[#e6f4ea]" };
  if (m.includes("presentation") || m.includes("powerpoint") || m.includes("pptx"))
    return { icon: Presentation, color: "#F4B400", bgClass: "bg-[#fef7e0]" };
  if (m.includes("pdf"))
    return fileTypeConfig.pdf;
  if (m.includes("apk") || m.includes("octet-stream"))
    return { icon: ListOrdered, color: "#5F6368", bgClass: "bg-[#f1f3f4]" };
  return fileTypeConfig[category] || fileTypeConfig.other;
}

export function FileCard({ file }: FileCardProps) {
  const { setPreviewFileId } = useUIStore();
  const category = getFileCategory(file.mime_type);
  const [imgError, setImgError] = useState(false);

  const config = getSmartConfig(file.mime_type, category);
  const Icon = config.icon;

  const thumbnailSrc =
    file.thumbnail_url || (category === "image" ? `/api/download/${file.id}` : null);
  const showThumbnail =
    (category === "image" || (category === "video" && file.thumbnail_url) || ((category === "pdf" || category === "document") && file.thumbnail_url)) && !imgError && !!thumbnailSrc;

  return (
    <div
      className="group flex flex-col rounded-lg border border-[#dadce0] bg-white hover:border-[#174ea6] hover:shadow-[0_1px_3px_0_rgba(60,64,67,0.3),0_4px_8px_3px_rgba(60,64,67,0.15)] transition-all duration-200 overflow-hidden cursor-pointer h-[200px]"
    >
      {/* ===== TOP BAR: icon + name + ⋮ ===== */}
      <div className="flex items-center gap-2 px-3 h-10 min-h-[40px] max-h-[40px] min-w-0 flex-shrink-0">
        <Icon className="h-[18px] w-[18px] flex-shrink-0" style={{ color: config.color }} />
        <span className="flex-1 min-w-0 text-[13px] font-medium text-[#202124] truncate leading-5">
          {file.name}
        </span>
        <div
          className="flex-shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <FileContextMenu file={file} />
        </div>
      </div>

      {/* ===== THUMBNAIL / PREVIEW AREA ===== */}
      <div
        className="relative w-full flex-1 border-t border-[#e0e0e0] overflow-hidden"
        onClick={() => setPreviewFileId(file.id)}
      >
        {showThumbnail ? (
          <img
            src={thumbnailSrc!}
            alt={file.name}
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
            loading="lazy"
          />
        ) : (
          <div className={`flex items-center justify-center w-full h-full ${config.bgClass}`}>
            <Icon className="h-12 w-12 opacity-20" style={{ color: config.color }} />
          </div>
        )}
      </div>
    </div>
  );
}
