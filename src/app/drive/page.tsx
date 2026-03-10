"use client";

import { useEffect } from "react";
import { useAuth } from "@/app/providers/auth-provider";
import { useFilesStore } from "@/store/files-store";
import { useUIStore } from "@/store/ui-store";
import { createClient } from "@/lib/supabase/client";
import { FolderGrid } from "@/components/file-grid/folder-grid";
import { FileCard } from "@/components/file-grid/file-card";
import { FileList } from "@/components/file-list/file-list";
import { SuggestedFiles } from "@/components/suggested-files/suggested-files";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { LayoutGrid, List, Loader2, Upload } from "lucide-react";
import type { DbFile } from "@/types/file.types";
import { useEffectiveViewMode } from "@/lib/utils/use-view-mode";

export default function DashboardPage() {
  const { user, guestSessionId } = useAuth();
  const { files, folders, viewMode, setViewMode, isLoading, searchQuery, mergeFiles } =
    useFilesStore();
  const { openFilePicker } = useUIStore();
  const effectiveViewMode = useEffectiveViewMode();

  // ── Supplementary fetch: load root-level files that may have been
  // cut off by the layout's initial limit ──────────────────────────
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
      .is("folder_id", null)
      .eq("is_trashed", false)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (data && data.length > 0) {
          mergeFiles(data as unknown as DbFile[]);
        }
      });
  }, [user?.id, guestSessionId, mergeFiles]);

  // Filter files and folders for root level (no parent) and search
  const rootFolders = folders.filter((f) => !f.parent_id);
  const rootFiles = files.filter((f) => !f.folder_id);

  const filteredFiles = searchQuery
    ? files.filter((f) =>
        f.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : rootFiles;

  const filteredFolders = searchQuery
    ? folders.filter((f) =>
        f.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : rootFolders;

  const starredFiles = files.filter((f) => f.is_starred);
  const recentFiles = [...files]
    .sort(
      (a, b) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    )
    .slice(0, 10);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* Google Drive-style compact sticky header */}
      <div className="flex items-center h-12 sm:h-14 sticky top-0 z-20 bg-white -mx-3 px-3 sm:-mx-4 sm:px-4 lg:-mx-5 lg:px-5">
        <h1 className="text-lg sm:text-[22px] font-normal text-[#202124] flex-1 min-w-0 truncate">My Drive</h1>
        <TooltipProvider>
          <div className="flex items-center gap-0.5 flex-shrink-0">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 rounded-full text-[#444746] hover:bg-[#f1f3f4]"
                  onClick={() => openFilePicker?.()}
                >
                  <Upload className="h-[18px] w-[18px]" />
                </Button>
              </TooltipTrigger>
              <TooltipContent><p>Upload file</p></TooltipContent>
            </Tooltip>
            <div className="flex items-center gap-0.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={`h-9 w-9 rounded-full ${
                    viewMode === "list"
                      ? "bg-[#c2e7ff] text-[#001d35] hover:bg-[#c2e7ff]"
                      : "text-[#444746] hover:bg-[#f1f3f4]"
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
                  className={`h-9 w-9 rounded-full ${
                    viewMode === "grid"
                      ? "bg-[#c2e7ff] text-[#001d35] hover:bg-[#c2e7ff]"
                      : "text-[#444746] hover:bg-[#f1f3f4]"
                  }`}
                  onClick={() => setViewMode("grid")}
                >
                  <LayoutGrid className="h-[18px] w-[18px]" />
                </Button>
              </TooltipTrigger>
              <TooltipContent><p>Grid view</p></TooltipContent>
            </Tooltip>
            </div>
          </div>
        </TooltipProvider>
      </div>

      <div className="space-y-5 sm:space-y-6">
      {/* Folders Section (grid view only – in list view, folders are inlined in FileList) */}
      {effectiveViewMode === "grid" && filteredFolders.length > 0 && (
        <section>
          <FolderGrid folders={filteredFolders} />
        </section>
      )}

      {/* Suggested from your activity */}
      {!searchQuery && files.length > 0 && effectiveViewMode !== "list" && (
        <section>
          <h2 className="text-sm font-medium text-[#202124] mb-3">
            Suggested
          </h2>
          <SuggestedFiles files={recentFiles.slice(0, 6)} />
        </section>
      )}

      {/* File List with Tabs */}
      <section>
        <Tabs defaultValue="recent" className="w-full">
          {/* Tabs rendered inside FileList's filter bar row via topRightSlot;
              for grid view (no FileList) we still need them visible */}
          {effectiveViewMode === "grid" && (
            <div className="hidden sm:flex items-center justify-end mb-3">
              <TabsList className="h-8 bg-[#f1f3f4] rounded-full px-1">
                <TabsTrigger value="recent" className="text-xs px-3.5 h-6 rounded-full font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm">Recent</TabsTrigger>
                <TabsTrigger value="starred" className="text-xs px-3.5 h-6 rounded-full font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm">Starred</TabsTrigger>
              </TabsList>
            </div>
          )}

          <TabsContent value="recent">
            {effectiveViewMode === "grid" ? (
              filteredFiles.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                  {filteredFiles.map((file) => (
                    <FileCard key={file.id} file={file} />
                  ))}
                </div>
              ) : (
                <FileList files={filteredFiles} folders={filteredFolders} />
              )
            ) : (
              <FileList
                files={filteredFiles}
                folders={filteredFolders}
                stickyOffsetClass="top-12 sm:top-14"
                topRightSlot={
                  <TabsList className="h-8 bg-[#f1f3f4] rounded-full px-1">
                    <TabsTrigger value="recent" className="text-xs px-3.5 h-6 rounded-full font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm">Recent</TabsTrigger>
                    <TabsTrigger value="starred" className="text-xs px-3.5 h-6 rounded-full font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm">Starred</TabsTrigger>
                  </TabsList>
                }
              />
            )}
          </TabsContent>

          <TabsContent value="starred">
            {effectiveViewMode === "grid" ? (
              starredFiles.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                  {starredFiles.map((file) => (
                    <FileCard key={file.id} file={file} />
                  ))}
                </div>
              ) : (
                <FileList files={starredFiles} />
              )
            ) : (
              <FileList
                files={starredFiles}
                stickyOffsetClass="top-12 sm:top-14"
                topRightSlot={
                  <TabsList className="h-8 bg-[#f1f3f4] rounded-full px-1">
                    <TabsTrigger value="recent" className="text-xs px-3.5 h-6 rounded-full font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm">Recent</TabsTrigger>
                    <TabsTrigger value="starred" className="text-xs px-3.5 h-6 rounded-full font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm">Starred</TabsTrigger>
                  </TabsList>
                }
              />
            )}
          </TabsContent>
        </Tabs>
      </section>
      </div>
    </div>
  );
}
