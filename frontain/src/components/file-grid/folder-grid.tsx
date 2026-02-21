"use client";

import Link from "next/link";
import { Folder } from "lucide-react";
import { FolderContextMenu } from "@/components/context-menu/folder-context-menu";
import type { DbFolder } from "@/types/file.types";

interface FolderGridProps {
  folders: DbFolder[];
}

export function FolderGrid({ folders }: FolderGridProps) {
  if (folders.length === 0) return null;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
      {folders.map((folder) => (
        <div
          key={folder.id}
          className="group relative flex items-center gap-3 rounded-xl border border-[#dadce0] bg-white px-3 py-2.5 hover:shadow-md transition-shadow duration-200 cursor-pointer"
        >
          <Link
            href={`/dashboard/folder/${folder.id}`}
            className="flex items-center gap-3 flex-1 min-w-0"
          >
            <Folder
              className="h-5 w-5 flex-shrink-0"
              style={{ color: folder.color || "#5f6368" }}
              fill={folder.color || "#5f6368"}
              fillOpacity={0.22}
            />
            <span className="text-[13px] font-medium text-[#202124] truncate">
              {folder.name}
            </span>
          </Link>

          <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-150">
            <FolderContextMenu folder={folder} />
          </div>
        </div>
      ))}
    </div>
  );
}
