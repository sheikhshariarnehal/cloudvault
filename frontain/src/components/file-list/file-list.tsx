"use client";

import { useState } from "react";
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
  Image as ImageIcon,
  Film,
  Music,
  Archive,
  FileIcon,
  FileSpreadsheet,
  FolderOpen,
} from "lucide-react";
import { formatFileSize, formatDate, getFileCategory } from "@/types/file.types";
import type { DbFile } from "@/types/file.types";
import { getFileUrl } from "@/lib/utils";

interface FileListProps {
  files: DbFile[];
}

const iconMap = {
  image: { icon: ImageIcon, color: "text-green-600", bg: "bg-green-50" },
  video: { icon: Film, color: "text-purple-600", bg: "bg-purple-50" },
  audio: { icon: Music, color: "text-pink-600", bg: "bg-pink-50" },
  document: { icon: FileText, color: "text-blue-600", bg: "bg-blue-50" },
  pdf: { icon: FileSpreadsheet, color: "text-red-600", bg: "bg-red-50" },
  archive: { icon: Archive, color: "text-yellow-600", bg: "bg-yellow-50" },
  other: { icon: FileIcon, color: "text-gray-600", bg: "bg-gray-50" },
};

function FileThumbnail({ file }: { file: DbFile }) {
  const category = getFileCategory(file.mime_type);
  const { icon: Icon, color, bg } = iconMap[category];
  const [imgError, setImgError] = useState(false);

  const thumbnailSrc = file.thumbnail_url || (category === "image" ? getFileUrl(file.id, file.name) : null);
  const showThumbnail = (category === "image" || (category === "video" && file.thumbnail_url)) && !imgError;

  if (showThumbnail && thumbnailSrc) {
    return (
      <div className="h-9 w-9 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
        <img
          src={thumbnailSrc}
          alt={file.name}
          className="w-full h-full object-cover"
          onError={() => setImgError(true)}
          loading="lazy"
        />
      </div>
    );
  }

  return (
    <div className={`h-9 w-9 rounded-lg ${bg} flex items-center justify-center flex-shrink-0`}>
      <Icon className={`h-4 w-4 ${color}`} />
    </div>
  );
}

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
      <div className="flex flex-col items-center justify-center py-16 text-center border-2 border-dashed border-gray-200 rounded-xl bg-gray-50/50">
        <FolderOpen className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold">No files yet</h3>
        <p className="text-muted-foreground text-sm">
          Drag & drop files here, or use the Upload button to get started
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-10">
              <Checkbox
                checked={allSelected}
                onCheckedChange={handleSelectAll}
              />
            </TableHead>
            <TableHead className="text-xs font-semibold">Name</TableHead>
            <TableHead className="hidden lg:table-cell text-xs font-semibold">Shared By</TableHead>
            <TableHead className="hidden sm:table-cell text-xs font-semibold">Size</TableHead>
            <TableHead className="hidden sm:table-cell text-xs font-semibold">Modified</TableHead>
            <TableHead className="w-10 text-xs font-semibold"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {files.map((file) => {
            return (
              <TableRow key={file.id} className="cursor-pointer group">
                <TableCell className="py-2.5">
                  <Checkbox
                    checked={selectedFiles.includes(file.id)}
                    onCheckedChange={() => toggleFileSelection(file.id)}
                  />
                </TableCell>
                <TableCell className="py-2.5">
                  {getFileCategory(file.mime_type) === "pdf" ? (
                    <a
                      href={getFileUrl(file.id, file.name)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 text-left group-hover:text-foreground transition-colors"
                    >
                      <FileThumbnail file={file} />
                      <span className="text-sm font-medium truncate max-w-[300px]">
                        {file.name}
                      </span>
                    </a>
                  ) : (
                    <button
                      className="flex items-center gap-3 text-left group-hover:text-foreground transition-colors"
                      onClick={() => setPreviewFileId(file.id)}
                    >
                      <FileThumbnail file={file} />
                      <span className="text-sm font-medium truncate max-w-[300px]">
                        {file.name}
                      </span>
                    </button>
                  )}
                </TableCell>
                <TableCell className="hidden lg:table-cell text-[13px] text-muted-foreground">
                  —
                </TableCell>
                <TableCell className="hidden sm:table-cell text-[13px] text-muted-foreground">
                  {formatFileSize(file.size_bytes)}
                </TableCell>
                <TableCell className="hidden sm:table-cell text-[13px] text-muted-foreground">
                  {formatDate(file.updated_at)}
                </TableCell>
                <TableCell className="py-2.5">
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
