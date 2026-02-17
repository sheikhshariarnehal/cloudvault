"use client";

import { useUIStore } from "@/store/ui-store";
import { getFileCategory } from "@/types/file.types";
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

interface FileCardProps {
  file: DbFile;
}

export function FileCard({ file }: FileCardProps) {
  const { setPreviewFileId } = useUIStore();
  const category = getFileCategory(file.mime_type);

  const iconMap = {
    image: { icon: Image, color: "text-green-600", bg: "bg-green-50" },
    video: { icon: Film, color: "text-purple-600", bg: "bg-purple-50" },
    audio: { icon: Music, color: "text-pink-600", bg: "bg-pink-50" },
    document: {
      icon: FileText,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    pdf: { icon: FileSpreadsheet, color: "text-red-600", bg: "bg-red-50" },
    archive: { icon: Archive, color: "text-yellow-600", bg: "bg-yellow-50" },
    other: { icon: FileIcon, color: "text-gray-600", bg: "bg-gray-50" },
  };

  const { icon: Icon, color, bg } = iconMap[category];

  return (
    <button
      onClick={() => setPreviewFileId(file.id)}
      className="flex flex-col items-center gap-2 p-4 rounded-xl border bg-white hover:shadow-md transition-shadow text-center w-full"
    >
      <div className={`p-4 rounded-xl ${bg}`}>
        <Icon className={`h-8 w-8 ${color}`} />
      </div>
      <p className="text-sm font-medium truncate w-full">{file.name}</p>
      <p className="text-xs text-muted-foreground uppercase">
        {file.mime_type.split("/")[1]?.split(".").pop() || "file"}
      </p>
    </button>
  );
}
