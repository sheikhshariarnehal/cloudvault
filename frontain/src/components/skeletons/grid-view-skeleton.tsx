"use client";

/**
 * Skeleton loading state for grid view — matches FileCard (aspect-square)
 * and FolderGrid layout exactly.
 *
 * Props:
 *  - folderCount: number of folder pill placeholders (default 2)
 *  - fileCount: number of file card placeholders (default 12)
 */

interface GridViewSkeletonProps {
  folderCount?: number;
  fileCount?: number;
}

/* Shared shimmer animation via Tailwind `animate-pulse` on parents. */

function FolderPillSkeleton() {
  return (
    <div className="flex items-center gap-2 sm:gap-3 rounded-xl border border-[#dadce0] bg-card px-2.5 sm:px-3 py-2.5 animate-pulse">
      {/* Folder icon */}
      <div className="h-4 w-4 sm:h-5 sm:w-5 rounded bg-[#e0e0e0] flex-shrink-0" />
      {/* Folder name */}
      <div className="h-2.5 sm:h-3 flex-1 max-w-[120px] rounded bg-[#e0e0e0]" />
    </div>
  );
}

function FileCardSkeleton() {
  return (
    <div className="rounded-lg border border-[#dadce0] bg-card overflow-hidden aspect-square flex flex-col">
      {/* Top bar — matches h-8 sm:h-10 with icon + name */}
      <div className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 h-8 sm:h-10 flex-shrink-0 animate-pulse">
        <div className="h-4 w-4 sm:h-[18px] sm:w-[18px] rounded bg-[#e0e0e0] flex-shrink-0" />
        <div className="h-2.5 sm:h-3 flex-1 rounded bg-[#e0e0e0]" />
        {/* Three-dot menu placeholder */}
        <div className="h-4 w-4 rounded-full bg-[#e8eaed] flex-shrink-0" />
      </div>
      {/* Thumbnail area */}
      <div className="flex-1 border-t border-[#e0e0e0] bg-[#f8f9fa] animate-pulse" />
    </div>
  );
}

export function GridViewSkeleton({
  folderCount = 2,
  fileCount = 12,
}: GridViewSkeletonProps) {
  return (
    <div className="space-y-4 sm:space-y-6 pt-3 sm:pt-4">
      {/* Folder pills row */}
      {folderCount > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-3">
          {Array.from({ length: folderCount }).map((_, i) => (
            <FolderPillSkeleton key={`f${i}`} />
          ))}
        </div>
      )}

      {/* File cards grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-3">
        {Array.from({ length: fileCount }).map((_, i) => (
          <FileCardSkeleton key={`c${i}`} />
        ))}
      </div>
    </div>
  );
}
