"use client";

import { useFilesStore } from "@/store/files-store";
import { FileList } from "@/components/file-list/file-list";
import { FileCard } from "@/components/file-grid/file-card";
import { Star } from "lucide-react";
import { useEffectiveViewMode } from "@/lib/utils/use-view-mode";
import { GridViewSkeleton } from "@/components/skeletons/grid-view-skeleton";
import { ListViewSkeleton } from "@/components/skeletons/list-view-skeleton";

export default function StarredPage() {
  const { files, dataLoaded } = useFilesStore();
  const viewMode = useEffectiveViewMode();
  const starredFiles = files.filter((f) => f.is_starred);

  if (!dataLoaded) {
    return (
      <div className="pt-2 sm:pt-4 space-y-4 sm:space-y-6">
        <div>
          <div className="h-6 w-32 bg-[#f1f3f4] rounded animate-pulse" />
          <div className="h-3 w-56 bg-[#f1f3f4] rounded animate-pulse mt-2" />
        </div>
        <div className="skeleton-grid"><GridViewSkeleton folderCount={0} fileCount={6} /></div>
        <div className="skeleton-list"><ListViewSkeleton rowCount={6} /></div>
      </div>
    );
  }

  return (
    <div className="pt-2 sm:pt-4 space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-[#202124]">Starred Files</h1>
        <p className="text-xs sm:text-sm text-[#5f6368]">
          Files you&apos;ve marked as favorites
        </p>
      </div>

      {starredFiles.length > 0 ? (
        viewMode === "grid" ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-3">
            {starredFiles.map((file) => (
              <FileCard key={file.id} file={file} />
            ))}
          </div>
        ) : (
          <FileList files={starredFiles} />
        )
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Star className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold">No starred files</h3>
          <p className="text-muted-foreground text-sm">
            Star files to quickly find them later
          </p>
        </div>
      )}
    </div>
  );
}
