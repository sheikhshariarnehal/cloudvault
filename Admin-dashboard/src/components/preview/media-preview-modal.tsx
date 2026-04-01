"use client";

import { useEffect, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import { useFilesStore } from "@/store/files-store";
import { useUIStore } from "@/store/ui-store";
import {
  Download,
  FileIcon,
  ChevronLeft,
  ChevronRight,
  Share2,
  MoreVertical,
  ArrowLeft,
  SlidersHorizontal,
  ZoomIn,
  Info,
  Star,
  Trash2,
} from "lucide-react";
import { getFileCategory, formatFileSize, isOfficeFile, isCsvFile, isPptxFile, isJsonFile, isTextFile, isPreviewableFile, isLegacyPptFile } from "@/types/file.types";
import { getFileUrl } from "@/lib/utils";

const ImagePreview = dynamic(() => import("@/components/preview/image-preview").then((m) => m.ImagePreview));
const PdfPreview = dynamic(() => import("@/components/preview/pdf-preview").then((m) => m.PdfPreview));
const VideoPreview = dynamic(() => import("@/components/preview/video-preview").then((m) => m.VideoPreview));
const OfficePreview = dynamic(() => import("@/components/preview/office-preview").then((m) => m.OfficePreview));
const CsvPreview = dynamic(() => import("@/components/preview/csv-preview").then((m) => m.CsvPreview));
const TextPreview = dynamic(() => import("@/components/preview/text-preview").then((m) => m.TextPreview));
const JsonPreview = dynamic(() => import("@/components/preview/json-preview").then((m) => m.JsonPreview));
const PptxPreview = dynamic(() => import("@/components/preview/pptx-preview").then((m) => m.PptxPreview));

export function MediaPreviewModal() {
  const { files } = useFilesStore();
  const { previewFileId, setPreviewFileId, shareModalOpen, setShareModalOpen, setShareFileId } =
    useUIStore();

  const file = useMemo(
    () => files.find((f) => f.id === previewFileId),
    [files, previewFileId]
  );

  // Get only previewable image files for navigation
  const imageFiles = useMemo(
    () => files.filter((f) => getFileCategory(f.mime_type) === "image"),
    [files]
  );
  const currentImageIndex = useMemo(
    () => imageFiles.findIndex((f) => f.id === previewFileId),
    [imageFiles, previewFileId]
  );
  const category = useMemo(
    () => (file ? getFileCategory(file.mime_type) : null),
    [file]
  );
  const isImage = category === "image";
  const fileUrl = useMemo(
    () => (previewFileId && file ? getFileUrl(previewFileId, file.name) : null),
    [previewFileId, file]
  );

  const prevImageId = useMemo(
    () => (currentImageIndex > 0 ? imageFiles[currentImageIndex - 1]?.id : null),
    [currentImageIndex, imageFiles]
  );
  const nextImageId = useMemo(
    () =>
      currentImageIndex >= 0 && currentImageIndex < imageFiles.length - 1
        ? imageFiles[currentImageIndex + 1]?.id
        : null,
    [currentImageIndex, imageFiles]
  );

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!previewFileId || shareModalOpen) return;

      if (e.key === "Escape") {
        setPreviewFileId(null);
      } else if (e.key === "ArrowLeft" && isImage && prevImageId) {
        setPreviewFileId(prevImageId);
      } else if (e.key === "ArrowRight" && isImage && nextImageId) {
        setPreviewFileId(nextImageId);
      }
    },
    [previewFileId, isImage, prevImageId, nextImageId, setPreviewFileId, shareModalOpen]
  );

  useEffect(() => {
    if (!previewFileId) return;

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [previewFileId, handleKeyDown]);

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

  // Print removed to match Google Photos cleaner top-bar experience
  // but keeping handleDownload below intact.

  const handlePrev = () => {
    if (prevImageId) setPreviewFileId(prevImageId);
  };

  const handleNext = () => {
    if (nextImageId) setPreviewFileId(nextImageId);
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      setPreviewFileId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-black">
      {/* ===== TOP BAR - Google Photos style ===== */}
      <div className="absolute top-0 left-0 right-0 z-50 flex items-start justify-between h-24 pt-3 sm:pt-4 px-2 sm:px-4 bg-gradient-to-b from-black/60 via-black/10 to-transparent pointer-events-none transition-opacity duration-300">
        
        {/* Left: Back Arrow */}
        <div className="flex items-center pointer-events-auto">
          <button
            onClick={() => setPreviewFileId(null)}
            className="p-2 sm:p-2.5 text-white bg-black/40 hover:bg-black/60 backdrop-blur-sm rounded-full transition-all flex-shrink-0 shadow-sm"
            title="Back"
          >
            <ArrowLeft className="h-6 w-6" />
          </button>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-0.5 sm:gap-1 pointer-events-auto">
          <button
            onClick={handleShare}
            className="p-2 sm:p-2.5 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-colors"
            title="Share"
          >
            <Share2 className="h-5 w-5" />
          </button>
          
          <button className="p-2 sm:p-2.5 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-colors hidden sm:block" title="Edit">
            <SlidersHorizontal className="h-5 w-5" />
          </button>
          
          <button className="p-2 sm:p-2.5 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-colors hidden sm:block" title="Zoom">
            <ZoomIn className="h-5 w-5" />
          </button>
          
          <button className="p-2 sm:p-2.5 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-colors hidden md:block" title="Info">
            <Info className="h-5 w-5" />
          </button>
          
          <button className="p-2 sm:p-2.5 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-colors hidden md:block" title="Star">
            <Star className="h-5 w-5" />
          </button>

          <button className="p-2 sm:p-2.5 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-colors hidden sm:block" title="Delete">
            <Trash2 className="h-5 w-5" />
          </button>
          
          {/* We keep Download prominently since it's a Cloud Drive */}
          <button
            onClick={handleDownload}
            className="p-2 sm:p-2.5 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-colors"
            title="Download"
          >
            <Download className="h-5 w-5" />
          </button>
          
          <button className="p-2 sm:p-2.5 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-colors" title="More options">
            <MoreVertical className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* ===== MAIN CONTENT AREA ===== */}
      <div
        className="flex-1 relative flex items-center justify-center overflow-hidden w-full h-full"
        onClick={handleOverlayClick}
      >
        {/* Left navigation arrow */}
        {isImage && !!prevImageId && (
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
                <div className="absolute inset-0 w-full h-full">
                  <PdfPreview src={fileUrl} />
                </div>
              )}
              {category === "video" && (
                <div className="absolute inset-0 w-full h-full">
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
              {/* Office documents (Word, Excel) — NOT PowerPoint */}
              {isOfficeFile(file.mime_type, file.name) && !isPptxFile(file.mime_type, file.name) && (
                <div className="absolute inset-0 w-full h-full">
                  <OfficePreview src={fileUrl} fileName={file.name} onDownload={handleDownload} />
                </div>
              )}
              {/* PowerPoint presentations (.pptx) */}
              {isPptxFile(file.mime_type, file.name) && (
                <div className="absolute inset-0 w-full h-full">
                  <PptxPreview src={fileUrl} fileName={file.name} onDownload={handleDownload} />
                </div>
              )}
              {/* Legacy PowerPoint (.ppt) — show friendly download prompt */}
              {isLegacyPptFile(file.mime_type, file.name) && (
                <div className="absolute inset-0 w-full h-full">
                  <PptxPreview src={fileUrl} fileName={file.name} onDownload={handleDownload} />
                </div>
              )}
              {/* CSV files */}
              {isCsvFile(file.mime_type, file.name) && (
                <div className="absolute inset-0 w-full h-full">
                  <CsvPreview src={fileUrl} fileName={file.name} onDownload={handleDownload} />
                </div>
              )}
              {/* JSON files */}
              {isJsonFile(file.mime_type, file.name) && (
                <div className="absolute inset-0 w-full h-full">
                  <JsonPreview src={fileUrl} fileName={file.name} onDownload={handleDownload} />
                </div>
              )}
              {/* Text / code files (.md, .sql, .html, .css, .js, .py, .txt, etc.) */}
              {isTextFile(file.mime_type, file.name) && (
                <div className="absolute inset-0 w-full h-full">
                  <TextPreview src={fileUrl} fileName={file.name} onDownload={handleDownload} />
                </div>
              )}
              {/* Other non-previewable files */}
              {!isImage && category !== "pdf" && category !== "video" && category !== "audio" &&
                !isPreviewableFile(file.mime_type, file.name) ? (
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
              ) : null}
            </>
          )}
        </div>

        {/* Right navigation arrow */}
        {isImage && !!nextImageId && (
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
