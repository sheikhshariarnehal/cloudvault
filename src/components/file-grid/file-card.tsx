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
      className="flex flex-col items-center gap-2.5 p-4 rounded-xl border bg-white hover:shadow-md hover:border-gray-300 transition-all duration-150 text-center w-full group"
    >
      <div className={`p-3.5 rounded-xl ${bg} transition-transform group-hover:scale-105`}>
        <Icon className={`h-7 w-7 ${color}`} />
      </div>
      <p className="text-[13px] font-medium truncate w-full leading-tight">{file.name}</p>
      <p className="text-[11px] text-muted-foreground uppercase font-medium tracking-wider">
        {file.mime_type.split("/")[1]?.split(".").pop() || "file"}
      </p>
    </button>
  );
}
