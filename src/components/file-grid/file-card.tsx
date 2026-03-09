"use client";

import { useState, useRef, useEffect } from "react";
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

/**
 * Returns the thumbnail src for a file card.
 * - R2 URL in thumbnail_url → use directly (zero API calls)
 * - base64 data-URI → use inline
 * - null → fall back to /api/thumbnail/[id] which fetches from TDLib + uploads to R2
 */
function getThumbnailSrc(file: DbFile, category: string): string | null {
  if (file.thumbnail_url) {
    // R2 URL or base64 data-URI — use directly
    if (file.thumbnail_url.startsWith("https://") || file.thumbnail_url.startsWith("data:"))
      return file.thumbnail_url;
  }
  // Fallback: trigger on-demand fetch + R2 upload via API route
  if (category === "image" || category === "video") {
    return `/api/thumbnail/${file.id}`;
  }
  return null;
}

/** Whether a file category should attempt to show a thumbnail preview.
 *  SVGs are sent as documents by Telegram — no thumbnail available. */
function shouldShowThumbnail(file: DbFile, category: string): boolean {
  if (file.mime_type === "image/svg+xml") return false;
  return category === "image" || category === "video";
}

export function FileCard({ file }: FileCardProps) {
  const { setPreviewFileId } = useUIStore();
  const category = getFileCategory(file.mime_type);

  const config = getSmartConfig(file.mime_type, category);
  const Icon = config.icon;

  const [imgError, setImgError] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const hasThumbnail = shouldShowThumbnail(file, category) && !imgError;
  const thumbnailSrc = hasThumbnail ? getThumbnailSrc(file, category) : null;

  // IntersectionObserver — only load thumbnails when the card enters the viewport
  useEffect(() => {
    if (!hasThumbnail || !thumbnailSrc) return;

    const el = cardRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" } // start loading 200px before visible
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [hasThumbnail, thumbnailSrc]);

  return (
    <div
      ref={cardRef}
      className="group flex flex-col rounded-lg border border-[#dadce0] bg-white hover:border-[#174ea6] hover:shadow-[0_1px_3px_0_rgba(60,64,67,0.3),0_4px_8px_3px_rgba(60,64,67,0.15)] transition-[box-shadow,border-color] duration-200 overflow-hidden cursor-pointer h-[200px]"
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
        {hasThumbnail && thumbnailSrc && isVisible ? (
          <img
            src={thumbnailSrc}
            alt={file.name}
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
            loading="lazy"
            decoding="async"
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
