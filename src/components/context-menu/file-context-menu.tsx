"use client";

import { useFilesStore } from "@/store/files-store";
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
  Eye,
  Download,
  Pencil,
  FolderInput,
  Star,
  Copy,
  Link,
  Trash2,
} from "lucide-react";
import type { DbFile } from "@/types/file.types";

interface FileContextMenuProps {
  file: DbFile;
}

export function FileContextMenu({ file }: FileContextMenuProps) {
  const { updateFile, removeFile } = useFilesStore();
  const { setPreviewFileId, setRenameTarget, setRenameModalOpen, setShareFileId, setShareModalOpen } = useUIStore();

  const handlePreview = () => setPreviewFileId(file.id);

  const handleDownload = () => {
    window.open(`/api/download/${file.id}`, "_blank");
  };

  const handleRename = () => {
    setRenameTarget({ id: file.id, name: file.name, type: "file" });
    setRenameModalOpen(true);
  };

  const handleStar = async () => {
    try {
      await fetch("/api/files", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: file.id, is_starred: !file.is_starred }),
      });
      updateFile(file.id, { is_starred: !file.is_starred });
    } catch (error) {
      console.error("Failed to star file:", error);
    }
  };

  const handleShare = () => {
    setShareFileId(file.id);
    setShareModalOpen(true);
  };

  const handleCopy = async () => {
    try {
      await fetch("/api/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "copy", fileId: file.id }),
      });
    } catch (error) {
      console.error("Failed to copy file:", error);
    }
  };

  const handleDelete = async () => {
    try {
      await fetch("/api/files", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: file.id,
          is_trashed: true,
          trashed_at: new Date().toISOString(),
        }),
      });
      removeFile(file.id);
    } catch (error) {
      console.error("Failed to delete file:", error);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="p-1 rounded-md hover:bg-muted">
          <MoreVertical className="h-4 w-4 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={handlePreview}>
          <Eye className="h-4 w-4 mr-2" /> Open / Preview
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleDownload}>
          <Download className="h-4 w-4 mr-2" /> Download
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleRename}>
          <Pencil className="h-4 w-4 mr-2" /> Rename
        </DropdownMenuItem>
        <DropdownMenuItem>
          <FolderInput className="h-4 w-4 mr-2" /> Move to folder
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleStar}>
          <Star
            className="h-4 w-4 mr-2"
            fill={file.is_starred ? "currentColor" : "none"}
          />
          {file.is_starred ? "Unstar" : "Star"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleShare}>
          <Link className="h-4 w-4 mr-2" /> Share
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleCopy}>
          <Copy className="h-4 w-4 mr-2" /> Make a Copy
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
