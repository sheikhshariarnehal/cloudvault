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
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {folders.map((folder) => (
        <div
          key={folder.id}
          className="group bg-white rounded-xl border p-4 hover:shadow-md transition-shadow"
        >
          <div className="flex items-start justify-between">
            <Link
              href={`/dashboard/folder/${folder.id}`}
              className="flex items-center gap-3 flex-1 min-w-0"
            >
              <div
                className="p-2 rounded-lg"
                style={{
                  backgroundColor: `${folder.color || "#EAB308"}20`,
                }}
              >
                <Folder
                  className="h-6 w-6"
                  style={{ color: folder.color || "#EAB308" }}
                  fill={folder.color || "#EAB308"}
                />
              </div>
              <span className="text-sm font-medium truncate">
                {folder.name}
              </span>
            </Link>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-muted transition-opacity">
                  <MoreVertical className="h-4 w-4 text-muted-foreground" />
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
        </div>
      ))}
    </div>
  );
}
