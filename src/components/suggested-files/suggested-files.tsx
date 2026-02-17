"use client";

import { FileCard } from "@/components/file-grid/file-card";
import type { DbFile } from "@/types/file.types";

interface SuggestedFilesProps {
  files: DbFile[];
}

export function SuggestedFiles({ files }: SuggestedFilesProps) {
  if (files.length === 0) return null;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      {files.map((file) => (
        <FileCard key={file.id} file={file} />
      ))}
    </div>
  );
}
