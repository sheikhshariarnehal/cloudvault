"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MoreHorizontal, FileText, Image as ImageIcon, Video, FolderArchive } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatBytes, formatDate } from "@/lib/admin/format";

type FileRow = {
  id: string;
  name: string;
  owner: string;
  sizeBytes: number;
  mimeType: string;
  status: "Active" | "Trashed";
  uploadedAt: string;
};

const getFileIcon = (mimeType: string) => {
  if (mimeType.startsWith("image/")) return <ImageIcon className="h-4 w-4 text-blue-500" />;
  if (mimeType.startsWith("video/")) return <Video className="h-4 w-4 text-purple-500" />;
  if (mimeType.includes("zip") || mimeType.includes("rar") || mimeType.includes("tar")) {
    return <FolderArchive className="h-4 w-4 text-yellow-600" />;
  }
  switch (mimeType) {
    case "application/pdf":
    case "text/plain":
      return <FileText className="h-4 w-4 text-gray-500" />;
    default: return <FileText className="h-4 w-4 text-gray-500" />;
  }
};

type FilesTableProps = {
  files: FileRow[];
};

export function FilesTable({ files }: FilesTableProps) {
  return (
    <div className="rounded-md border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>File Name</TableHead>
            <TableHead>Owner</TableHead>
            <TableHead>Size</TableHead>
            <TableHead>Uploaded</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {files.map((file) => (
            <TableRow key={file.id}>
              <TableCell className="font-medium">
                <div className="flex items-center gap-2">
                  {getFileIcon(file.mimeType)}
                  <span>{file.name}</span>
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground text-sm">{file.owner}</TableCell>
              <TableCell>{formatBytes(file.sizeBytes)}</TableCell>
              <TableCell className="text-muted-foreground text-sm">{formatDate(file.uploadedAt)}</TableCell>
              <TableCell>
                {file.status === "Active" ? (
                  <Badge variant="outline" className="bg-green-50 text-green-700 hover:bg-green-100 border-green-200 dark:bg-green-900/30 dark:text-green-400">
                    Active
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="bg-red-50 text-red-700 hover:bg-red-100 border-red-200 dark:bg-red-900/30 dark:text-red-400">
                    Trashed
                  </Badge>
                )}
              </TableCell>
              <TableCell className="text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger render={<Button variant="ghost" className="h-8 w-8 p-0" />}>
                    <span className="sr-only">Open menu</span>
                    <MoreHorizontal className="h-4 w-4" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                    <DropdownMenuItem>View details</DropdownMenuItem>
                    <DropdownMenuItem>Download</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-destructive">Delete permanently</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
