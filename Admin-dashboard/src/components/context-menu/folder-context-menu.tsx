"use client";

import { useUIStore } from "@/store/ui-store";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  MoreVertical,
  FolderOpen,
  Pencil,
  Palette,
  FolderInput,
  Trash2,
  Link,
} from "lucide-react";
import type { DbFolder } from "@/types/file.types";
import { useRouter } from "next/navigation";

interface FolderContextMenuProps {
  folder: DbFolder;
}

export function FolderContextMenu({ folder }: FolderContextMenuProps) {
  const router = useRouter();
  const { setRenameTarget, setRenameModalOpen, setShareFolderId, setShareModalOpen } = useUIStore();

  const handleRename = () => {
    setRenameTarget({ id: folder.id, name: folder.name, type: "folder" });
    setRenameModalOpen(true);
  };

  const handleShare = () => {
    setShareFolderId(folder.id);
    setShareModalOpen(true);
  };

  const handleDelete = async () => {
    try {
      await fetch("/api/folders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: folder.id,
          is_trashed: true,
          trashed_at: new Date().toISOString(),
        }),
      });
    } catch (error) {
      console.error("Failed to delete folder:", error);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={(
          <button className="p-1 rounded-md hover:bg-muted">
            <MoreVertical className="h-4 w-4 text-muted-foreground" />
          </button>
        )}
      />
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem onClick={() => router.push(`/drive/folder/${folder.id}`)}>
          <FolderOpen className="h-4 w-4 mr-2" /> Open
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleShare}>
          <Link className="h-4 w-4 mr-2" /> Share
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleRename}>
          <Pencil className="h-4 w-4 mr-2" /> Rename
        </DropdownMenuItem>
        <DropdownMenuItem>
          <Palette className="h-4 w-4 mr-2" /> Change Color
        </DropdownMenuItem>
        <DropdownMenuItem>
          <FolderInput className="h-4 w-4 mr-2" /> Move
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-destructive"
          onClick={handleDelete}
        >
          <Trash2 className="h-4 w-4 mr-2" /> Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
