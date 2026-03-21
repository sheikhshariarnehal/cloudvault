"use client";

import { useEffect, useState, use } from "react";
import { useAuth } from "@/app/providers/auth-provider";
import { useFilesStore } from "@/store/files-store";
import { useUIStore } from "@/store/ui-store";
import { createClient } from "@/lib/supabase/client";
import { FileList } from "@/components/file-list/file-list";
import { FileCard } from "@/components/file-grid/file-card";
import { FolderGrid } from "@/components/file-grid/folder-grid";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ChevronDown, ChevronRight, FolderOpen, Upload, LayoutGrid, List, Info } from "lucide-react";
import Link from "next/link";
import type { BreadcrumbItem, DbFile } from "@/types/file.types";
import { useEffectiveViewMode } from "@/lib/utils/use-view-mode";
import { GridViewSkeleton } from "@/components/skeletons/grid-view-skeleton";
import { ListViewSkeleton } from "@/components/skeletons/list-view-skeleton";

export default function FolderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { user, guestSessionId } = useAuth();
  const { files, folders, viewMode, setViewMode, setCurrentFolderId, mergeFiles, dataLoaded } = useFilesStore();
  const { openFilePicker } = useUIStore();
  const effectiveViewMode = useEffectiveViewMode();
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([]);

  const folderFiles = files.filter((f) => f.folder_id === id);
  const subFolders = folders.filter((f) => f.parent_id === id);
  const currentFolder = folders.find((f) => f.id === id);

  // ── Supplementary fetch: load files that belong to this folder ──
  // The layout pre-loads up to 1 000 most-recent files.  When a user has
  // many files, older folder contents may not be in the store yet.  This
  // effect guarantees all files for the *current* folder are present.
  useEffect(() => {
    const userId = user?.id;
    const filterColumn = userId ? "user_id" : "guest_session_id";
    const filterValue = userId || guestSessionId;
    if (!filterValue) return;

    const FILE_COLUMNS =
      "id,user_id,guest_session_id,folder_id,name,original_name," +
      "mime_type,size_bytes,telegram_file_id,telegram_message_id," +
      "file_hash,tdlib_file_id,is_starred,is_trashed,trashed_at," +
      "created_at,updated_at";

    const supabase = createClient();
    supabase
      .from("files")
      .select(FILE_COLUMNS)
      .eq(filterColumn, filterValue)
      .eq("folder_id", id)
      .eq("is_trashed", false)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (data && data.length > 0) {
          mergeFiles(data as unknown as DbFile[]);
        }
      });
  }, [id, user?.id, guestSessionId, mergeFiles]);

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

  if (!dataLoaded) {
    return (
      <div className="pt-2 sm:pt-4 space-y-4 sm:space-y-6">
        <div className="flex items-center gap-1">
          <div className="h-4 w-16 bg-[#f1f3f4] rounded animate-pulse" />
          <div className="h-4 w-4 bg-[#f1f3f4] rounded animate-pulse" />
          <div className="h-4 w-24 bg-[#f1f3f4] rounded animate-pulse" />
        </div>
        <div className="skeleton-grid"><GridViewSkeleton folderCount={1} fileCount={8} /></div>
        <div className="skeleton-list"><ListViewSkeleton rowCount={8} /></div>
      </div>
    );
  }

  return (
    <div className="pt-2 sm:pt-4 space-y-4 sm:space-y-6">
      {/* Breadcrumbs + view controls */}
      <div className="flex items-center h-11 sm:h-14 sticky top-0 z-20 bg-surface-white -mx-2.5 px-2.5 sm:-mx-4 sm:px-4 lg:-mx-5 lg:px-5">
        <nav className="flex items-center gap-1 text-[17px] sm:text-[22px] font-normal text-[#202124] min-w-0 flex-1 overflow-x-auto whitespace-nowrap scrollbar-none">
          {breadcrumbs.map((crumb, index) => (
            <div key={crumb.id ?? "root"} className="flex items-center gap-1 flex-shrink-0">
              {index > 0 && (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
              {index === breadcrumbs.length - 1 ? (
                <span className="inline-flex items-center gap-1.5 font-medium text-[17px] sm:text-[22px]">
                  {crumb.name}
                  <ChevronDown className="h-4 w-4 sm:h-5 sm:w-5 text-[#5f6368]" />
                </span>
              ) : (
                <Link
                  href={
                    crumb.id
                      ? `/drive/folder/${crumb.id}`
                      : "/drive"
                  }
                  className="text-muted-foreground hover:text-foreground text-[17px] sm:text-[22px]"
                >
                  {crumb.name}
                </Link>
              )}
            </div>
          ))}
        </nav>

        <TooltipProvider>
          <div className="hidden sm:flex items-center gap-2 flex-shrink-0 ml-3">
            <div className="flex items-center gap-0.5 p-0.5 rounded-full border border-[#9aa0a6] bg-[#f8f9fa]">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={`h-8 w-8 rounded-full ${
                      viewMode === "list"
                        ? "bg-[#e8f0fe] text-[#174ea6] hover:bg-[#d2e3fc]"
                        : "text-[#5f6368] hover:bg-[#f1f3f4]"
                    }`}
                    onClick={() => setViewMode("list")}
                  >
                    <List className="h-[18px] w-[18px]" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent><p>List view</p></TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={`h-8 w-8 rounded-full ${
                      viewMode === "grid"
                        ? "bg-[#e8f0fe] text-[#174ea6] hover:bg-[#d2e3fc]"
                        : "text-[#5f6368] hover:bg-[#f1f3f4]"
                    }`}
                    onClick={() => setViewMode("grid")}
                  >
                    <LayoutGrid className="h-[18px] w-[18px]" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent><p>Grid view</p></TooltipContent>
              </Tooltip>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-[#5f6368] hover:bg-[#f1f3f4]">
                  <Info className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent><p>View details</p></TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>
      </div>

      {/* List view — folders and files unified in a single FileList (mirrors dashboard behaviour) */}
      {effectiveViewMode === "list" ? (
        subFolders.length > 0 || folderFiles.length > 0 ? (
          <FileList files={folderFiles} folders={subFolders} />
        ) : (
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
      ) : (
        /* Grid view — keep separate Folders / Files sections */
        <>
          {subFolders.length > 0 && (
            <section>
              <h2 className="text-sm font-medium text-[#202124] mb-3">Folders</h2>
              <FolderGrid folders={subFolders} />
            </section>
          )}

          {folderFiles.length > 0 ? (
            <section>
              <h2 className="text-sm font-medium text-[#202124] mb-3">Files</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-3">
                {folderFiles.map((file) => (
                  <FileCard key={file.id} file={file} />
                ))}
              </div>
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
        </>
      )}
    </div>
  );
}
