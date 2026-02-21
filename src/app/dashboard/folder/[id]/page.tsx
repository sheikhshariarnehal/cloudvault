"use client";

import { useEffect, useState, use } from "react";
import { useFilesStore } from "@/store/files-store";
import { useUIStore } from "@/store/ui-store";
import { FileList } from "@/components/file-list/file-list";
import { FileCard } from "@/components/file-grid/file-card";
import { FolderGrid } from "@/components/file-grid/folder-grid";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ChevronRight, FolderOpen, Upload, Plus, FolderPlus, FolderUp, LayoutGrid, List } from "lucide-react";
import Link from "next/link";
import type { BreadcrumbItem } from "@/types/file.types";

export default function FolderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { files, folders, viewMode, setViewMode, setCurrentFolderId } = useFilesStore();
  const { openFilePicker, openFolderPicker, setNewFolderModalOpen } = useUIStore();
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([]);

  const folderFiles = files.filter((f) => f.folder_id === id);
  const subFolders = folders.filter((f) => f.parent_id === id);
  const currentFolder = folders.find((f) => f.id === id);

  useEffect(() => {
    setCurrentFolderId(id);

    // Build breadcrumbs
    const crumbs: BreadcrumbItem[] = [];
    let current = currentFolder;
    while (current) {
      crumbs.unshift({ id: current.id, name: current.name });
      current = folders.find((f) => f.id === current?.parent_id);
    }
    crumbs.unshift({ id: null, name: "My Drive" });
    setBreadcrumbs(crumbs);

    return () => setCurrentFolderId(null);
  }, [id, currentFolder, folders, setCurrentFolderId]);

  return (
    <div className="space-y-6">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-1 text-sm flex-wrap">
        {breadcrumbs.map((crumb, index) => (
          <div key={crumb.id ?? "root"} className="flex items-center gap-1">
            {index > 0 && (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
            {index === breadcrumbs.length - 1 ? (
              <span className="font-medium">{crumb.name}</span>
            ) : (
              <Link
                href={
                  crumb.id
                    ? `/dashboard/folder/${crumb.id}`
                    : "/dashboard"
                }
                className="text-muted-foreground hover:text-foreground"
              >
                {crumb.name}
              </Link>
            )}
          </div>
        ))}
      </nav>

      {/* Action Toolbar */}
      <div className="flex items-center gap-2.5">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-10 text-sm font-medium shadow-sm hover:shadow">
              <Plus className="h-4 w-4 mr-2" />
              Create
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => setNewFolderModalOpen(true)}>
              <FolderPlus className="h-4 w-4 mr-2" />
              New Folder
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => openFilePicker?.()}>
              <Upload className="h-4 w-4 mr-2" />
              Upload File
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => openFolderPicker?.()}>
              <FolderUp className="h-4 w-4 mr-2" />
              Upload Folder
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          variant="outline"
          size="sm"
          className="h-10 text-sm font-medium shadow-sm hover:shadow"
          onClick={() => openFilePicker?.()}
        >
          <Upload className="h-4 w-4 mr-2" />
          <span className="hidden xs:inline">Upload</span>
        </Button>

        <TooltipProvider>
          <div className="flex items-center border rounded-lg overflow-hidden shadow-sm bg-white ml-auto">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={viewMode === "grid" ? "secondary" : "ghost"}
                  size="icon"
                  className="h-10 w-10 rounded-none"
                  onClick={() => setViewMode("grid")}
                >
                  <LayoutGrid className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent><p>Grid view</p></TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={viewMode === "list" ? "secondary" : "ghost"}
                  size="icon"
                  className="h-10 w-10 rounded-none"
                  onClick={() => setViewMode("list")}
                >
                  <List className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent><p>List view</p></TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>
      </div>

      {/* Subfolders */}
      {subFolders.length > 0 && (
        <section>
          <h2 className="text-sm font-medium text-[#202124] mb-3">Folders</h2>
          {viewMode === "grid" ? (
            <FolderGrid folders={subFolders} />
          ) : (
            <div className="bg-white rounded-lg border">
              {subFolders.map((folder) => (
                <Link
                  key={folder.id}
                  href={`/dashboard/folder/${folder.id}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors border-b last:border-b-0"
                >
                  <div
                    className="flex items-center justify-center w-10 h-10 rounded-lg"
                    style={{ backgroundColor: (folder.color || "#EAB308") + "20" }}
                  >
                    <FolderOpen
                      className="h-5 w-5"
                      style={{ color: folder.color || "#EAB308" }}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {folder.name}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
                </Link>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Files */}
      {folderFiles.length > 0 ? (
        <section>
          <h2 className="text-sm font-medium text-[#202124] mb-3">Files</h2>
          {viewMode === "grid" ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {folderFiles.map((file) => (
                <FileCard key={file.id} file={file} />
              ))}
            </div>
          ) : (
            <FileList files={folderFiles} folders={[]} />
          )}
        </section>
      ) : (
        subFolders.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center border-2 border-dashed border-gray-200 rounded-xl bg-gray-50/50">
            <FolderOpen className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold">This folder is empty</h3>
            <p className="text-muted-foreground text-sm mb-4">
              Drag & drop files here, or click Upload to add files
            </p>
            <Button onClick={() => openFilePicker?.()}>
              <Upload className="h-4 w-4 mr-2" />
              Upload Files
            </Button>
          </div>
        )
      )}
    </div>
  );
}
