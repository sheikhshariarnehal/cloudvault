"use client";

import { useFilesStore } from "@/store/files-store";
import { FileList } from "@/components/file-list/file-list";
import { Star } from "lucide-react";

export default function StarredPage() {
  const { files } = useFilesStore();
  const starredFiles = files.filter((f) => f.is_starred);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Starred Files</h1>
        <p className="text-muted-foreground">
          Files you&apos;ve marked as favorites
        </p>
      </div>

      {starredFiles.length > 0 ? (
        <FileList files={starredFiles} />
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
