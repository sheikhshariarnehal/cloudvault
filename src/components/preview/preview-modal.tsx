"use client";

import { useEffect, useState, useCallback } from "react";
import { useFilesStore } from "@/store/files-store";
import { useUIStore } from "@/store/ui-store";
import { ImagePreview } from "@/components/preview/image-preview";
import { PdfPreview } from "@/components/preview/pdf-preview";
import { VideoPreview } from "@/components/preview/video-preview";
import {
  Download,
  X,
  FileIcon,
  ChevronLeft,
  ChevronRight,
  Share2,
  Printer,
  MoreVertical,
} from "lucide-react";
import { getFileCategory, formatFileSize } from "@/types/file.types";
import { getFileUrl } from "@/lib/utils";

export function PreviewModal() {
  const { files } = useFilesStore();
  const { previewFileId, setPreviewFileId, setShareModalOpen, setShareFileId } =
    useUIStore();
  const [fileUrl, setFileUrl] = useState<string | null>(null);

  const file = files.find((f) => f.id === previewFileId);

  // Get only previewable image files for navigation
  const imageFiles = files.filter(
    (f) => getFileCategory(f.mime_type) === "image"
  );
  const currentImageIndex = imageFiles.findIndex(
    (f) => f.id === previewFileId
  );
  const category = file ? getFileCategory(file.mime_type) : null;
  const isImage = category === "image";

  // Build the file URL when the preview file changes
  useEffect(() => {
    if (!previewFileId || !file) {
      setFileUrl(null);
      return;
    }
    setFileUrl(getFileUrl(previewFileId, file.name));
  }, [previewFileId, file]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!previewFileId) return;

      if (e.key === "Escape") {
        setPreviewFileId(null);
      } else if (e.key === "ArrowLeft" && isImage && currentImageIndex > 0) {
        setPreviewFileId(imageFiles[currentImageIndex - 1].id);
      } else if (
        e.key === "ArrowRight" &&
        isImage &&
        currentImageIndex < imageFiles.length - 1
      ) {
        setPreviewFileId(imageFiles[currentImageIndex + 1].id);
      }
    },
    [previewFileId, isImage, currentImageIndex, imageFiles, setPreviewFileId]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (previewFileId) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [previewFileId]);

  if (!file || !previewFileId) return null;

  const handleDownload = () => {
    window.open(getFileUrl(file.id, file.name, true), "_blank");
  };

  const handleShare = () => {
    setShareFileId(file.id);
    setShareModalOpen(true);
  };

  const handlePrint = () => {
    if (fileUrl && isImage) {
      const printWindow = window.open(fileUrl, "_blank");
      printWindow?.addEventListener("load", () => printWindow.print());
    }
  };

  const handlePrev = () => {
    if (currentImageIndex > 0) {
      setPreviewFileId(imageFiles[currentImageIndex - 1].id);
    }
  };

  const handleNext = () => {
    if (currentImageIndex < imageFiles.length - 1) {
      setPreviewFileId(imageFiles[currentImageIndex + 1].id);
    }
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      setPreviewFileId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-[#202124]">
      {/* ===== TOP BAR - Google Drive style ===== */}
      <div className="flex items-center justify-between h-16 px-4 bg-[#202124] flex-shrink-0">
        {/* Left: Close + filename */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => setPreviewFileId(null)}
            className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-colors flex-shrink-0"
            title="Close"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="min-w-0">
            <h2 className="text-[15px] font-medium text-white truncate">
              {file.name}
            </h2>
            {file.size_bytes && (
              <p className="text-xs text-white/50">
                {formatFileSize(file.size_bytes)}
              </p>
            )}
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {isImage && (
            <button
              onClick={handlePrint}
              className="p-2.5 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-colors"
              title="Print"
            >
              <Printer className="h-5 w-5" />
            </button>
          )}
          <button
            onClick={handleDownload}
            className="p-2.5 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-colors"
            title="Download"
          >
            <Download className="h-5 w-5" />
          </button>
          <button
            onClick={handleShare}
            className="p-2.5 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-colors"
            title="Share"
          >
            <Share2 className="h-5 w-5" />
          </button>
          <button className="p-2.5 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-colors" title="More actions">
            <MoreVertical className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* ===== MAIN CONTENT AREA ===== */}
      <div
        className="flex-1 relative flex items-center justify-center overflow-hidden"
        onClick={handleOverlayClick}
      >
        {/* Left navigation arrow */}
        {isImage && currentImageIndex > 0 && (
          <button
            onClick={handlePrev}
            className="absolute left-4 z-10 p-3 text-white/60 hover:text-white bg-black/30 hover:bg-black/50 rounded-full transition-all"
            title="Previous"
          >
            <ChevronLeft className="h-7 w-7" />
          </button>
        )}

        {/* Preview content */}
        <div className="w-full h-full flex items-center justify-center">
          {fileUrl && (
            <>
              {isImage && <ImagePreview src={fileUrl} alt={file.name} fallbackSrc={file.thumbnail_url} />}
              {category === "pdf" && (
                <div className="w-full h-full">
                  <PdfPreview src={fileUrl} />
                </div>
              )}
              {category === "video" && (
                <div className="max-w-5xl w-full px-8">
                  <VideoPreview src={fileUrl} />
                </div>
              )}
              {category === "audio" && (
                <div className="p-8 text-center">
                  <FileIcon className="h-20 w-20 text-white/30 mx-auto mb-6" />
                  <p className="text-lg font-medium mb-6 text-white">
                    {file.name}
                  </p>
                  <audio controls src={fileUrl} className="w-full max-w-md" />
                </div>
              )}
              {(category === "document" ||
                category === "archive" ||
                category === "other") && (
                <div className="p-8 text-center">
                  <FileIcon className="h-20 w-20 text-white/30 mx-auto mb-6" />
                  <p className="text-lg font-medium mb-2 text-white">
                    {file.name}
                  </p>
                  <p className="text-sm text-white/50 mb-1">
                    {file.mime_type}
                  </p>
                  <p className="text-sm text-white/50 mb-6">
                    Preview is not available for this file type. Download the file to view it.
                  </p>
                  <button
                    onClick={handleDownload}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-[#8ab4f8] text-[#202124] rounded-full font-medium hover:bg-[#aecbfa] transition-colors"
                  >
                    <Download className="h-4 w-4" />
                    Download File
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Right navigation arrow */}
        {isImage && currentImageIndex < imageFiles.length - 1 && (
          <button
            onClick={handleNext}
            className="absolute right-4 z-10 p-3 text-white/60 hover:text-white bg-black/30 hover:bg-black/50 rounded-full transition-all"
            title="Next"
          >
            <ChevronRight className="h-7 w-7" />
          </button>
        )}
      </div>

      {/* Image counter for multi-image navigation */}
      {isImage && imageFiles.length > 1 && (
        <div className="absolute bottom-6 right-6 text-xs text-white/50 bg-[#2d2e30] px-3 py-1.5 rounded-full">
          {currentImageIndex + 1} / {imageFiles.length}
        </div>
      )}
    </div>
  );
}
