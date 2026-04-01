"use client";

import { useMemo } from "react";
import Image from "next/image";
import { useFilesStore } from "@/store/files-store";
import { useUIStore } from "@/store/ui-store";
import { ImageIcon } from "lucide-react";

type PhotoFile = {
  id: string;
  name: string;
  thumbnail_url: string | null;
  created_at: string;
  mime_type: string;
};

function formatDateHeader(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const photoDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (photoDate.getTime() === today.getTime()) return "Today";
  if (photoDate.getTime() === yesterday.getTime()) return "Yesterday";

  const isThisYear = date.getFullYear() === now.getFullYear();
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    ...(isThisYear ? {} : { year: "numeric" }),
  });
}

function groupPhotosByDate(photos: PhotoFile[]): Map<string, PhotoFile[]> {
  const groups = new Map<string, PhotoFile[]>();

  for (const photo of photos) {
    const dateKey = photo.created_at.split("T")[0];
    const existing = groups.get(dateKey);
    if (existing) {
      existing.push(photo);
    } else {
      groups.set(dateKey, [photo]);
    }
  }

  return groups;
}

function getThumbnailSrc(file: PhotoFile): string | null {
  if (!file.thumbnail_url) return null;
  if (file.thumbnail_url.includes("api.telegram.org")) return null;
  if (file.thumbnail_url.startsWith("https://") || file.thumbnail_url.startsWith("data:")) {
    return file.thumbnail_url;
  }
  return null;
}

function PhotoTile({ photo, onClick }: { photo: PhotoFile; onClick: () => void }) {
  const src = getThumbnailSrc(photo);

  return (
    <button
      onClick={onClick}
      className="relative aspect-square overflow-hidden bg-[#f1f3f4] hover:opacity-90 active:opacity-80 transition-opacity focus:outline-none focus:ring-1 focus:ring-blue-500 focus:ring-inset touch-manipulation"
      aria-label={`View ${photo.name}`}
    >
      {src ? (
        <Image
          src={src}
          alt={photo.name}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 768px) 25vw, (max-width: 1024px) 20vw, (max-width: 1280px) 16.6vw, (max-width: 1536px) 14.2vw, 12.5vw"
          className="object-cover"
          loading="lazy"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <ImageIcon className="h-6 w-6 sm:h-8 sm:w-8 text-[#5f6368]" />
        </div>
      )}
    </button>
  );
}

function PhotosGrid({ photos, onPhotoClick }: { photos: PhotoFile[]; onPhotoClick: (id: string) => void }) {
  const grouped = useMemo(() => groupPhotosByDate(photos), [photos]);
  const sortedDates = useMemo(
    () => Array.from(grouped.keys()).sort((a, b) => b.localeCompare(a)),
    [grouped]
  );

  return (
    <div className="space-y-1 sm:space-y-6 pb-20 sm:pb-0">
      {sortedDates.map((dateKey) => {
        const dayPhotos = grouped.get(dateKey)!;
        return (
          <section key={dateKey}>
            <h2 className="text-[13px] sm:text-sm font-medium text-[#444746] dark:text-[#c4c7c5] mb-2 px-4 sm:px-1 mt-4 sm:mt-0">
              {formatDateHeader(dateKey)}
            </h2>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 gap-[2px] sm:gap-1">
              {dayPhotos.map((photo) => (
                <PhotoTile key={photo.id} photo={photo} onClick={() => onPhotoClick(photo.id)} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] sm:min-h-[60vh] text-center px-4">
      <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full bg-[#f1f3f4] flex items-center justify-center mb-4 sm:mb-6">
        <ImageIcon className="h-12 w-12 sm:h-16 sm:w-16 text-[#5f6368]" />
      </div>
      <h2 className="text-lg sm:text-xl font-medium text-[#202124] mb-1.5 sm:mb-2">No photos yet</h2>
      <p className="text-xs sm:text-sm text-[#5f6368] max-w-sm px-2">
        Upload images to your drive and they will appear here automatically.
      </p>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <div className="h-4 sm:h-4 w-24 sm:w-24 bg-[#e8eaed] rounded animate-pulse mb-2 mx-4 sm:mx-1 mt-4 sm:mt-0" />
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 gap-[2px] sm:gap-1">
          {Array.from({ length: 18 }).map((_, i) => (
            <div key={i} className="aspect-square bg-[#e8eaed] animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function PhotosPage() {
  const files = useFilesStore((s) => s.files);
  const isLoading = useFilesStore((s) => s.isLoading);
  const dataLoaded = useFilesStore((s) => s.dataLoaded);
  const setPreviewFileId = useUIStore((s) => s.setPreviewFileId);

  const photos = useMemo(() => {
    return files
      .filter((f) => f.mime_type?.startsWith("image/") && !f.is_trashed)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [files]);

  const handlePhotoClick = (id: string) => {
    setPreviewFileId(id);
  };

  if (isLoading || !dataLoaded) {
    return (
      <div className="pt-2 sm:p-4 md:p-6 pb-20 sm:pb-6">
        <h1 className="text-xl sm:text-2xl font-medium text-[#202124] mb-4 sm:mb-6 px-4 sm:px-0 hidden sm:block">Photos</h1>
        <LoadingSkeleton />
      </div>
    );
  }

  return (
    <div className="pt-2 sm:p-4 md:p-6 pb-20 sm:pb-6">
      <h1 className="text-xl sm:text-2xl font-medium text-[#202124] mb-4 sm:mb-6 px-4 sm:px-0 hidden sm:block">Photos</h1>
      {photos.length === 0 ? (
        <EmptyState />
      ) : (
        <PhotosGrid photos={photos} onPhotoClick={handlePhotoClick} />
      )}
    </div>
  );
}
