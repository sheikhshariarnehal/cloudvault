"use client";

import { useState, useRef, useEffect, useCallback } from "react";
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
  Play,
} from "lucide-react";
import type { DbFile } from "@/types/file.types";

interface FileCardProps {
  file: DbFile;
  priority?: boolean;
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
 * - R2 URL in thumbnail_url → use directly (zero API calls, R2 serves with immutable cache)
 * - base64 data-URI → use inline
 * - Telegram Bot API URLs → skip (blocked by ORB/CORS in browser)
 * - null → no thumbnail available (don't hit API — avoids wasteful 404s)
 */
function getThumbnailSrc(file: DbFile): string | null {
  if (file.thumbnail_url) {
    // Skip Telegram Bot API URLs — blocked by browser ORB/CORS
    if (file.thumbnail_url.includes("api.telegram.org")) return null;
    if (file.thumbnail_url.startsWith("https://") || file.thumbnail_url.startsWith("data:"))
      return file.thumbnail_url;
  }
  return null;
}

/** Whether a file category should attempt to show a thumbnail preview. */
function shouldShowThumbnail(file: DbFile, category: string): boolean {
  if (file.mime_type === "image/svg+xml") return false;
  if (category !== "image" && category !== "video") return false;
  // Only show thumbnail if we have a URL — avoids 404 API calls for files without thumbnails
  return !!getThumbnailSrc(file);
}

export function FileCard({ file, priority = false }: FileCardProps) {
  const { setPreviewFileId } = useUIStore();
  const category = getFileCategory(file.mime_type);

  const config = getSmartConfig(file.mime_type, category);
  const Icon = config.icon;

  const [imgError, setImgError] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [isVisible, setIsVisible] = useState(priority); // Only render image when visible
  const cardRef = useRef<HTMLDivElement>(null);

  const hasThumbnail = shouldShowThumbnail(file, category) && !imgError;
  const thumbnailSrc = hasThumbnail ? getThumbnailSrc(file) : null;

  const onImgLoad = useCallback(() => setImgLoaded(true), []);
  const onImgError = useCallback(() => setImgError(true), []);

  // Lazy visibility detection - only load image when card enters viewport
  useEffect(() => {
    if (priority || isVisible) return; // Already visible or priority
    
    const card = cardRef.current;
    if (!card) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px 0px" } // Start loading 200px before visible for smoother scrolling
    );

    observer.observe(card);
    return () => observer.disconnect();
  }, [priority, isVisible]);

  return (
    <div
      ref={cardRef}
      className="group flex flex-col rounded-lg border border-[#dadce0] bg-card hover:border-[#174ea6] hover:shadow-[0_1px_3px_0_rgba(60,64,67,0.3),0_4px_8px_3px_rgba(60,64,67,0.15)] transition-[box-shadow,border-color] duration-200 overflow-hidden cursor-pointer aspect-square"
    >
      {/* ===== TOP BAR: icon + name + ⋮ ===== */}
      <div className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 h-8 sm:h-10 min-h-[32px] sm:min-h-[40px] max-h-[32px] sm:max-h-[40px] min-w-0 flex-shrink-0">
        <Icon className="h-4 w-4 sm:h-[18px] sm:w-[18px] flex-shrink-0" style={{ color: config.color }} />
        <span className="flex-1 min-w-0 text-[11px] sm:text-[13px] font-medium text-[#202124] truncate leading-4 sm:leading-5">
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
        {/* Skeleton placeholder - prevents CLS by reserving space */}
        {hasThumbnail && !imgLoaded && (
          <div className="absolute inset-0 bg-gradient-to-br from-[#f1f3f4] to-[#e8eaed] animate-pulse" />
        )}

        {/* Placeholder background — always rendered, visible until image loads */}
        <div className={`absolute inset-0 flex items-center justify-center ${config.bgClass} ${imgLoaded ? 'opacity-0' : 'opacity-100'} transition-opacity duration-200`}>
          {category !== "video" && (
            <Icon className="h-8 w-8 sm:h-12 sm:w-12 opacity-20" style={{ color: config.color }} />
          )}
        </div>

        {/* Thumbnail image — only render when visible (lazy) or priority */}
        {hasThumbnail && thumbnailSrc && isVisible && (
          <img
            src={thumbnailSrc}
            alt=""
            className={`relative w-full h-full object-cover transition-opacity duration-300 ${
              imgLoaded ? "opacity-100" : "opacity-0"
            }`}
            onLoad={onImgLoad}
            onError={onImgError}
            loading={priority ? "eager" : "lazy"}
            fetchPriority={priority ? "high" : "auto"}
            decoding="async"
          />
        )}

        {/* Play icon overlay for video files */}
        {category === "video" && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-black/40">
              <Play className="h-5 w-5 text-white fill-white translate-x-0.5" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
