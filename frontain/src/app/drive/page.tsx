"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/app/providers/auth-provider";
import { useFilesStore } from "@/store/files-store";
import { useUIStore } from "@/store/ui-store";
import { createClient } from "@/lib/supabase/client";
import dynamic from "next/dynamic";
import { FileCard } from "@/components/file-grid/file-card";

const FolderGrid = dynamic(() => import("@/components/file-grid/folder-grid").then(m => m.FolderGrid));
const FileList = dynamic(() => import("@/components/file-list/file-list").then(m => m.FileList));
const SuggestedFiles = dynamic(() => import("@/components/suggested-files/suggested-files").then(m => m.SuggestedFiles));

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ChevronDown } from "lucide-react";
import type { DbFile } from "@/types/file.types";
import { useEffectiveViewMode } from "@/lib/utils/use-view-mode";
import { GridViewSkeleton } from "@/components/skeletons/grid-view-skeleton";
import { ListViewSkeleton } from "@/components/skeletons/list-view-skeleton";
import { ViewModeToggle } from "@/components/file-view/view-mode-toggle";

export default function DashboardPage() {
  // Performance optimization: Start with fewer items for faster First Paint
  // Then load more as user scrolls (Intersection Observer)
  const INITIAL_BATCH_SIZE = 12; // Above-the-fold items (2 rows on most screens)
  const GRID_BATCH_SIZE = 24;    // Smaller increments for smoother loading
  const { user, guestSessionId } = useAuth();
  const [recentVisibleCount, setRecentVisibleCount] = useState(INITIAL_BATCH_SIZE);
  const [starredVisibleCount, setStarredVisibleCount] = useState(INITIAL_BATCH_SIZE);
  const recentLoadMoreRef = useRef<HTMLDivElement>(null);
  const starredLoadMoreRef = useRef<HTMLDivElement>(null);
  
  // Narrow selectors to avoid rerenders from unrelated store updates
  const files = useFilesStore((s) => s.files);
  const folders = useFilesStore((s) => s.folders);
  const viewMode = useFilesStore((s) => s.viewMode);
  const setViewMode = useFilesStore((s) => s.setViewMode);
  const isLoading = useFilesStore((s) => s.isLoading);
  const searchQuery = useFilesStore((s) => s.searchQuery);
  const dataLoaded = useFilesStore((s) => s.dataLoaded);
  
  const openFilePicker = useUIStore((s) => s.openFilePicker);
  const effectiveViewMode = useEffectiveViewMode();

  // (Supplementary fetch for root files was removed as layout.tsx now handles full background hydration of all files)

  // Filter files and folders for root level (no parent) and search
  const rootFolders = useMemo(() => folders.filter((f) => !f.parent_id), [folders]);
  const rootFiles = useMemo(() => files.filter((f) => !f.folder_id), [files]);

  const filteredFiles = useMemo(() => searchQuery
    ? files.filter((f) =>
        f.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : rootFiles, [searchQuery, files, rootFiles]);

  const filteredFolders = useMemo(() => searchQuery
    ? folders.filter((f) =>
        f.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : rootFolders, [searchQuery, folders, rootFolders]);

  const starredFiles = useMemo(() => files.filter((f) => f.is_starred), [files]);
  const visibleRecentFiles = useMemo(
    () => filteredFiles.slice(0, recentVisibleCount),
    [filteredFiles, recentVisibleCount]
  );
  const visibleStarredFiles = useMemo(
    () => starredFiles.slice(0, starredVisibleCount),
    [starredFiles, starredVisibleCount]
  );
  const canLoadMoreRecent = visibleRecentFiles.length < filteredFiles.length;
  const canLoadMoreStarred = visibleStarredFiles.length < starredFiles.length;
  
  const recentFiles = useMemo(() => [...files]
    .sort(
      (a, b) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    )
    .slice(0, 10), [files]);

  useEffect(() => {
    setRecentVisibleCount(INITIAL_BATCH_SIZE);
    setStarredVisibleCount(INITIAL_BATCH_SIZE);
  }, [searchQuery, effectiveViewMode]);

  useEffect(() => {
    if (effectiveViewMode !== "grid" || !canLoadMoreRecent) return;
    const target = recentLoadMoreRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setRecentVisibleCount((count) => Math.min(count + GRID_BATCH_SIZE, filteredFiles.length));
      },
      { rootMargin: "500px 0px" }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [effectiveViewMode, canLoadMoreRecent, filteredFiles.length]);

  useEffect(() => {
    if (effectiveViewMode !== "grid" || !canLoadMoreStarred) return;
    const target = starredLoadMoreRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setStarredVisibleCount((count) => Math.min(count + GRID_BATCH_SIZE, starredFiles.length));
      },
      { rootMargin: "500px 0px" }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [effectiveViewMode, canLoadMoreStarred, starredFiles.length]);

  if (isLoading || !dataLoaded) {
    return (
      <div className="flex flex-col">
        {/* Skeleton sticky header mirrors the real Drive title and view toggle */}
        <div className="flex items-center h-11 sm:h-14 sticky top-0 z-20 bg-surface-white -mx-2.5 px-2.5 sm:-mx-4 sm:px-4 lg:-mx-5 lg:px-5">
          <div className="flex items-center gap-1.5 animate-pulse">
            <div className="h-5 sm:h-6 w-24 sm:w-32 rounded bg-[#e8eaed]" />
            <div className="h-4 w-4 rounded bg-[#e8eaed]" />
          </div>
          <div className="ml-auto flex items-center">
            <div className="flex items-center gap-0 p-[1px] rounded-full bg-[#f1f3f4] animate-pulse">
              <div className="h-7 w-7 rounded-full bg-[#e8eaed]" />
              <div className="h-7 w-7 rounded-full bg-[#e8eaed]" />
            </div>
          </div>
        </div>
        <div className="space-y-4 sm:space-y-6 pt-3 sm:pt-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-3 animate-pulse">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={`folder-${i}`} className="h-[42px] sm:h-[42px] rounded-xl border border-[#dadce0] bg-[#f1f3f4]" />
            ))}
          </div>
          <div className="hidden sm:block space-y-2 animate-pulse">
            <div className="h-4 w-20 rounded bg-[#e8eaed]" />
            <div className="grid grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={`suggested-${i}`} className="rounded-lg border border-[#dadce0] bg-card overflow-hidden aspect-square">
                  <div className="h-10 border-b border-[#e8eaed] px-3 flex items-center gap-2">
                    <div className="h-4 w-4 rounded bg-[#e0e0e0]" />
                    <div className="h-2.5 flex-1 rounded bg-[#e0e0e0]" />
                    <div className="h-4 w-4 rounded-full bg-[#e8eaed]" />
                  </div>
                  <div className="h-[calc(100%-2.5rem)] bg-[#f8f9fa]" />
                </div>
              ))}
            </div>
          </div>
          <div className="hidden sm:flex items-center justify-end animate-pulse">
            <div className="h-8 rounded-full bg-[#f1f3f4] p-1 flex items-center gap-1">
              <div className="h-6 w-[56px] rounded-full bg-white" />
              <div className="h-6 w-[56px] rounded-full bg-[#e8eaed]" />
            </div>
          </div>
        </div>
        <div className="skeleton-grid"><GridViewSkeleton folderCount={0} /></div>
        <div className="skeleton-list"><ListViewSkeleton /></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* Google Drive-style compact sticky header */}
      <div className="flex items-center h-11 sm:h-14 sticky top-0 z-20 bg-surface-white -mx-2.5 px-2.5 sm:-mx-4 sm:px-4 lg:-mx-5 lg:px-5">
        <h1 className="text-[17px] sm:text-[22px] font-normal text-[#202124] flex-1 min-w-0 truncate flex items-center gap-1.5">My Drive <ChevronDown className="h-4 w-4 text-[#5f6368]" /></h1>
        <TooltipProvider>
          <div className="flex items-center gap-2 flex-shrink-0">
            <ViewModeToggle viewMode={viewMode} onChange={setViewMode} />
          </div>
        </TooltipProvider>
      </div>

      <div className="space-y-4 sm:space-y-6 pt-3 sm:pt-4">
      {/* Folders Section (grid view only – in list view, folders are inlined in FileList) */}
      {effectiveViewMode === "grid" && filteredFolders.length > 0 && (
        <section className="space-y-2">
          <FolderGrid folders={filteredFolders} />
        </section>
      )}

      {/* Suggested from your activity */}
      {!searchQuery && files.length > 0 && effectiveViewMode !== "list" && (
        <section className="hidden sm:block">
          <h2 className="text-xs sm:text-sm font-medium text-foreground mb-2 sm:mb-3">
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
                <>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-3">
                  {visibleRecentFiles.map((file, index) => (
                    <FileCard key={file.id} file={file} priority={index < 12} />
                  ))}
                </div>
                {canLoadMoreRecent && (
                  <div ref={recentLoadMoreRef} className="mt-4 h-10 flex items-center justify-center text-xs text-[#5f6368]">
                    Loading more files...
                  </div>
                )}
                </>
              ) : (
                filteredFolders.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <h3 className="text-lg font-semibold">No files yet</h3>
                    <p className="text-muted-foreground text-sm">
                      Upload files to see them in grid view
                    </p>
                  </div>
                ) : null
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
                <>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-3">
                  {visibleStarredFiles.map((file, index) => (
                    <FileCard key={file.id} file={file} priority={index < 12} />
                  ))}
                </div>
                {canLoadMoreStarred && (
                  <div ref={starredLoadMoreRef} className="mt-4 h-10 flex items-center justify-center text-xs text-[#5f6368]">
                    Loading more starred files...
                  </div>
                )}
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <h3 className="text-lg font-semibold">No starred files</h3>
                  <p className="text-muted-foreground text-sm">
                    Star files to keep them here in grid view
                  </p>
                </div>
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
