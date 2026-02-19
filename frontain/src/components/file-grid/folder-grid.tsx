"use client";

import Link from "next/link";
import { Folder, MoreVertical } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useUIStore } from "@/store/ui-store";
import type { DbFolder } from "@/types/file.types";

interface FolderGridProps {
  folders: DbFolder[];
}

export function FolderGrid({ folders }: FolderGridProps) {
  const { setRenameTarget, setRenameModalOpen } = useUIStore();

  const handleRename = (folder: DbFolder) => {
    setRenameTarget({ id: folder.id, name: folder.name, type: "folder" });
    setRenameModalOpen(true);
  };

  const handleDelete = async (folderId: string) => {
    try {
      await fetch("/api/folders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: folderId, is_trashed: true, trashed_at: new Date().toISOString() }),
      });
    } catch (error) {
      console.error("Failed to delete folder:", error);
    }
  };

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

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="p-1 rounded-full opacity-0 group-hover:opacity-100 hover:bg-gray-100 transition-[opacity,background-color] duration-150">
                <MoreVertical className="h-4 w-4 text-[#5f6368]" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={`/dashboard/folder/${folder.id}`}>Open</Link>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleRename(folder)}>
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => handleDelete(folder.id)}
              >
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ))}
    </div>
  );
}
