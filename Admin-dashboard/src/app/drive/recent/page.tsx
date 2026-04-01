"use client";

import { useEffect, useMemo } from "react";
import { useAuth } from "@/app/providers/auth-provider";
import { createClient } from "@/lib/supabase/client";
import { useFilesStore } from "@/store/files-store";
import { FileList } from "@/components/file-list/file-list";
import { FileCard } from "@/components/file-grid/file-card";
import { Clock } from "lucide-react";
import { useEffectiveViewMode } from "@/lib/utils/use-view-mode";
import { GridViewSkeleton } from "@/components/skeletons/grid-view-skeleton";
import { ListViewSkeleton } from "@/components/skeletons/list-view-skeleton";
import type { DbFile } from "@/types/file.types";

export default function RecentPage() {
  const { user, guestSessionId } = useAuth();
  const { files, dataLoaded, mergeFiles } = useFilesStore();
  const viewMode = useEffectiveViewMode();

  useEffect(() => {
    // The layout preloads a capped set. On the Recent page, fetch remaining
    // pages so older files are also available.
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

    const PAGE_SIZE = 1000;
    const supabase = createClient();
    let cancelled = false;

    const loadOlderPages = async () => {
      // Start after the first page loaded in layout (200 rows).
      let from = 200;

      while (!cancelled) {
        const to = from + PAGE_SIZE - 1;
        const { data, error } = await supabase
          .from("files")
          .select(FILE_COLUMNS)
          .eq(filterColumn, filterValue)
          .eq("is_trashed", false)
          .order("created_at", { ascending: false })
          .range(from, to);

        if (error) {
          console.error("Failed to load older recent files:", error);
          return;
        }

        const page = (data ?? []) as unknown as DbFile[];
        if (page.length === 0) {
          return;
        }

        mergeFiles(page);

        if (page.length < PAGE_SIZE) {
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
  }, [user?.id, guestSessionId, dataLoaded, mergeFiles]);

  const recentFiles = useMemo(
    () =>
      [...files].sort(
        (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      ),
    [files]
  );

  if (!dataLoaded) {
    return (
      <div className="pt-2 sm:pt-4 space-y-4 sm:space-y-6">
        <div>
          <div className="h-6 w-32 bg-[#f1f3f4] rounded animate-pulse" />
          <div className="h-3 w-56 bg-[#f1f3f4] rounded animate-pulse mt-2" />
        </div>
        <div className="skeleton-grid"><GridViewSkeleton folderCount={0} fileCount={8} /></div>
        <div className="skeleton-list"><ListViewSkeleton rowCount={8} /></div>
      </div>
    );
  }

  return (
    <div className="pt-2 sm:pt-4 space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-[#202124]">Recent Files</h1>
        <p className="text-xs sm:text-sm text-[#5f6368]">
          Your most recently modified files
        </p>
      </div>

      {recentFiles.length > 0 ? (
        viewMode === "grid" ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-3">
            {recentFiles.map((file) => (
              <FileCard key={file.id} file={file} />
            ))}
          </div>
        ) : (
          <FileList files={recentFiles} />
        )
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Clock className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold">No recent files</h3>
          <p className="text-muted-foreground text-sm">
            Your recently accessed files will appear here
          </p>
        </div>
      )}
    </div>
  );
}
