"use client";

import { useEffect, useState, use } from "react";
import { useFilesStore } from "@/store/files-store";
import { useUIStore } from "@/store/ui-store";
import { FileList } from "@/components/file-list/file-list";
import { FileCard } from "@/components/file-grid/file-card";
import { FolderGrid } from "@/components/file-grid/folder-grid";
import { Button } from "@/components/ui/button";
import { ChevronRight, FolderOpen, Upload } from "lucide-react";
import Link from "next/link";
import type { BreadcrumbItem } from "@/types/file.types";

export default function FolderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { files, folders, viewMode, setCurrentFolderId } = useFilesStore();
  const { openFilePicker } = useUIStore();
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

      {/* Subfolders */}
      {subFolders.length > 0 && (
        <section>
          <h2 className="text-sm font-medium text-[#202124] mb-3">Folders</h2>
          <FolderGrid folders={subFolders} />
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
            <FileList files={folderFiles} />
          )}
        </section>
      ) : (
        subFolders.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <FolderOpen className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold">This folder is empty</h3>
            <p className="text-muted-foreground text-sm mb-4">
              Upload files or create a subfolder to get started
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
