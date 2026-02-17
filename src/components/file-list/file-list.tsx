"use client";

import { useFilesStore } from "@/store/files-store";
import { useUIStore } from "@/store/ui-store";
import { FileContextMenu } from "@/components/context-menu/file-context-menu";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  FileText,
  Image,
  Film,
  Music,
  Archive,
  FileIcon,
  FileSpreadsheet,
  FolderOpen,
} from "lucide-react";
import { formatFileSize, formatDate, getFileCategory } from "@/types/file.types";
import type { DbFile } from "@/types/file.types";

interface FileListProps {
  files: DbFile[];
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

export function FileList({ files }: FileListProps) {
  const { selectedFiles, toggleFileSelection, setSelectedFiles } =
    useFilesStore();
  const { setPreviewFileId } = useUIStore();

  const allSelected =
    files.length > 0 && files.every((f) => selectedFiles.includes(f.id));

  const handleSelectAll = () => {
    if (allSelected) {
      setSelectedFiles([]);
    } else {
      setSelectedFiles(files.map((f) => f.id));
    }
  };

  if (files.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <FolderOpen className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold">No files yet</h3>
        <p className="text-muted-foreground text-sm">
          Upload files or create a folder to get started
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <Checkbox
                checked={allSelected}
                onCheckedChange={handleSelectAll}
              />
            </TableHead>
            <TableHead>Name</TableHead>
            <TableHead className="hidden md:table-cell">Shared By</TableHead>
            <TableHead className="hidden sm:table-cell">File Size</TableHead>
            <TableHead>Modified</TableHead>
            <TableHead className="w-10">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {files.map((file) => {
            const category = getFileCategory(file.mime_type);
            const { icon: Icon, color } = iconMap[category];

            return (
              <TableRow key={file.id} className="cursor-pointer">
                <TableCell>
                  <Checkbox
                    checked={selectedFiles.includes(file.id)}
                    onCheckedChange={() => toggleFileSelection(file.id)}
                  />
                </TableCell>
                <TableCell>
                  <button
                    className="flex items-center gap-3 text-left"
                    onClick={() => setPreviewFileId(file.id)}
                  >
                    <Icon className={`h-5 w-5 flex-shrink-0 ${color}`} />
                    <span className="text-sm font-medium truncate max-w-[200px]">
                      {file.name}
                    </span>
                  </button>
                </TableCell>
                <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                  —
                </TableCell>
                <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                  {formatFileSize(file.size_bytes)}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatDate(file.updated_at)}
                </TableCell>
                <TableCell>
                  <FileContextMenu file={file} />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
