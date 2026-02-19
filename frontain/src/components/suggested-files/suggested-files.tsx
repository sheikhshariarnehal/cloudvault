"use client";

import { FileCard } from "@/components/file-grid/file-card";
import type { DbFile } from "@/types/file.types";

interface SuggestedFilesProps {
  files: DbFile[];
}

export function SuggestedFiles({ files }: SuggestedFilesProps) {
  if (files.length === 0) return null;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
      {files.map((file) => (
        <FileCard key={file.id} file={file} />
      ))}
    </div>
  );
}
