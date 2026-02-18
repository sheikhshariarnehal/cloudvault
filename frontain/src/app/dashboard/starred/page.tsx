"use client";

import { useFilesStore } from "@/store/files-store";
import { FileList } from "@/components/file-list/file-list";
import { FileCard } from "@/components/file-grid/file-card";
import { Star } from "lucide-react";

export default function StarredPage() {
  const { files, viewMode } = useFilesStore();
  const starredFiles = files.filter((f) => f.is_starred);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#202124]">Starred Files</h1>
        <p className="text-sm text-[#5f6368]">
          Files you&apos;ve marked as favorites
        </p>
      </div>

      {starredFiles.length > 0 ? (
        viewMode === "grid" ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
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
