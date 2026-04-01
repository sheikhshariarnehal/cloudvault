"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { useAuth } from "@/app/providers/auth-provider";
import { createClient } from "@/lib/supabase/client";
import { useFilesStore } from "@/store/files-store";
import { FileList } from "@/components/file-list/file-list";
import { FileCard } from "@/components/file-grid/file-card";
import { FolderGrid } from "@/components/file-grid/folder-grid";
import { Clock } from "lucide-react";
import { useEffectiveViewMode } from "@/lib/utils/use-view-mode";
import { GridViewSkeleton } from "@/components/skeletons/grid-view-skeleton";
import { ListViewSkeleton } from "@/components/skeletons/list-view-skeleton";
import type { DbFile, DbFolder } from "@/types/file.types";
import { ViewModeToggle } from "@/components/file-view/view-mode-toggle";

export default function RecentPage() {
  const INITIAL_BATCH_SIZE = 24;
  const GRID_BATCH_SIZE = 24;
  
  const { user, guestSessionId } = useAuth();
  const { files, folders, dataLoaded, mergeFiles, mergeFolders, viewMode, setViewMode } = useFilesStore();
  const effectiveViewMode = useEffectiveViewMode();
  const [visibleCount, setVisibleCount] = useState(INITIAL_BATCH_SIZE);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // The layout preloads a capped set. On the Recent page, fetch remaining
    // pages so older files and folders are also available.
    if (!dataLoaded) return;

    const userId = user?.id;
    const filterColumn = userId ? "user_id" : "guest_session_id";
    const filterValue = userId || guestSessionId;
    if (!filterValue) return;

    const FILE_COLUMNS =
      "id,user_id,guest_session_id,folder_id,name,original_name," +
      "mime_type,size_bytes,telegram_file_id,telegram_message_id," +
      "file_hash,tdlib_file_id,is_starred,is_trashed,trashed_at," +
      "created_at,updated_at,thumbnail_url";

    const FOLDER_COLUMNS =
      "id,user_id,guest_session_id,parent_id,name,color,is_trashed," +
      "trashed_at,created_at,updated_at";

    const PAGE_SIZE = 1000;
    const supabase = createClient();
    let cancelled = false;

    const loadOlderPages = async () => {
      // Start after the first page loaded in layout (200 rows).
      let from = 200;

      while (!cancelled) {
        const to = from + PAGE_SIZE - 1;

        // Fetch files
        const { data: filesData, error: filesError } = await supabase
          .from("files")
          .select(FILE_COLUMNS)
          .eq(filterColumn, filterValue)
          .eq("is_trashed", false)
          .order("created_at", { ascending: false })
          .range(from, to);

        if (filesError) {
          console.error("Failed to load older recent files:", filesError);
        } else {
          const page = (filesData ?? []) as unknown as DbFile[];
          if (page.length > 0) {
            mergeFiles(page);
          }
        }

        // Fetch folders
        const { data: foldersData, error: foldersError } = await supabase
          .from("folders")
          .select(FOLDER_COLUMNS)
          .eq(filterColumn, filterValue)
          .eq("is_trashed", false)
          .order("created_at", { ascending: false })
          .range(from, to);

        if (foldersError) {
          console.error("Failed to load older recent folders:", foldersError);
        } else {
          const folderPage = (foldersData ?? []) as unknown as DbFolder[];
          if (folderPage.length > 0) {
            mergeFolders(folderPage);
          }
        }

        const filesPage = (filesData ?? []) as unknown as DbFile[];
        if (filesPage.length === 0 && ((foldersData ?? []) as unknown as DbFolder[]).length === 0) {
          return;
        }

        if (filesPage.length < PAGE_SIZE && ((foldersData ?? []) as unknown as DbFolder[]).length < PAGE_SIZE) {
          return;
        }

        from += PAGE_SIZE;
      }
    };

    // Yield to the browser so the initial 200 files render before fetching older pages.
    const handle = setTimeout(() => { loadOlderPages(); });

    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [user?.id, guestSessionId, dataLoaded, mergeFiles, mergeFolders]);

  const recentFiles = useMemo(
    () =>
      [...files].sort(
        (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      ),
    [files]
  );

  const recentFolders = useMemo(
    () =>
      [...folders].sort(
        (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      ),
    [folders]
  );

  const visibleFiles = useMemo(
    () => recentFiles.slice(0, visibleCount),
    [recentFiles, visibleCount]
  );

  const canLoadMore = visibleFiles.length < recentFiles.length;

  useEffect(() => {
    setVisibleCount(INITIAL_BATCH_SIZE);
  }, [effectiveViewMode]);

  useEffect(() => {
    if (effectiveViewMode !== "grid" || !canLoadMore) return;
    const target = loadMoreRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setVisibleCount((count) => Math.min(count + GRID_BATCH_SIZE, recentFiles.length));
      },
      { rootMargin: "500px 0px" }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [effectiveViewMode, canLoadMore, recentFiles.length]);

  if (!dataLoaded) {
    return (
      <div className="pt-2 sm:pt-4 space-y-4 sm:space-y-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="h-7 sm:h-8 w-32 bg-[#f1f3f4] rounded animate-pulse" />
            <div className="h-4 sm:h-5 w-56 bg-[#f1f3f4] rounded animate-pulse mt-1" />
          </div>
          <div className="mt-0.5 flex items-center gap-0 p-[1px] rounded-full bg-[#f1f3f4] animate-pulse">
            <div className="h-7 w-7 rounded-full bg-[#e8eaed]" />
            <div className="h-7 w-7 rounded-full bg-[#e8eaed]" />
          </div>
        </div>
        <div className="skeleton-grid"><GridViewSkeleton folderCount={0} fileCount={8} /></div>
        <div className="skeleton-list"><ListViewSkeleton rowCount={8} /></div>
      </div>
    );
  }

  return (
    <div className="pt-2 sm:pt-4 space-y-4 sm:space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#202124]">Recent</h1>
          <p className="text-xs sm:text-sm text-[#5f6368]">
            Your most recently modified files and folders
          </p>
        </div>
        <ViewModeToggle viewMode={viewMode} onChange={setViewMode} className="mt-0.5" />
      </div>

      {recentFiles.length > 0 || recentFolders.length > 0 ? (
        effectiveViewMode === "grid" ? (
          <div className="space-y-6">
            {recentFolders.length > 0 && (
              <div>
                <FolderGrid folders={recentFolders} />
              </div>
            )}
            {recentFiles.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-3">
                {visibleFiles.map((file, index) => (
                  <FileCard 
                    key={file.id} 
                    file={file} 
                    priority={index < 6} // Only first 6 (top row) load eagerly with high priority
                  />
                ))}
              </div>
            )}
            {/* Observer target for infinite scrolling */}
            {canLoadMore && effectiveViewMode === "grid" && (
              <div ref={loadMoreRef} className="h-20 w-full" aria-hidden="true" />
            )}
          </div>
        ) : (
          <FileList files={recentFiles} folders={recentFolders} />
        )
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Clock className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold">No recent items</h3>
          <p className="text-muted-foreground text-sm">
            Your recently modified files and folders will appear here
          </p>
        </div>
      )}
    </div>
  );
}
