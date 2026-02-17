"use client";

import { useUIStore } from "@/store/ui-store";
import { getFileCategory } from "@/types/file.types";
import { getFileUrl } from "@/lib/utils";
import {
  FileText,
  Image,
  Film,
  Music,
  Archive,
  FileIcon,
  FileSpreadsheet,
} from "lucide-react";
import type { DbFile } from "@/types/file.types";

interface FileRowProps {
  file: DbFile;
}

const iconMap = {
  image: { icon: Image, color: "text-green-600" },
  video: { icon: Film, color: "text-purple-600" },
  audio: { icon: Music, color: "text-pink-600" },
  document: { icon: FileText, color: "text-blue-600" },
  pdf: { icon: FileSpreadsheet, color: "text-red-600" },
  archive: { icon: Archive, color: "text-yellow-600" },
  other: { icon: FileIcon, color: "text-gray-600" },
};

export function FileRow({ file }: FileRowProps) {
  const { setPreviewFileId } = useUIStore();
  const category = getFileCategory(file.mime_type);
  const { icon: Icon, color } = iconMap[category];

  if (category === "pdf") {
    return (
      <a
        href={getFileUrl(file.id, file.name)}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-3 w-full text-left p-2 rounded-lg hover:bg-muted transition-colors"
      >
        <Icon className={`h-5 w-5 flex-shrink-0 ${color}`} />
        <span className="text-sm font-medium truncate">{file.name}</span>
      </a>
    );
  }

  return (
    <button
      onClick={() => setPreviewFileId(file.id)}
      className="flex items-center gap-3 w-full text-left p-2 rounded-lg hover:bg-muted transition-colors"
    >
      <Icon className={`h-5 w-5 flex-shrink-0 ${color}`} />
      <span className="text-sm font-medium truncate">{file.name}</span>
    </button>
  );
}
