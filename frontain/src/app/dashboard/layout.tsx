"use client";

import { useEffect } from "react";
import { useAuth } from "@/app/providers/auth-provider";
import { useRealtimeFiles } from "@/lib/realtime/use-realtime-files";
import { useFilesStore } from "@/store/files-store";
import { useUIStore } from "@/store/ui-store";
import { createClient } from "@/lib/supabase/client";
import { Sidebar } from "@/components/sidebar/sidebar";
import { TopBar } from "@/components/top-bar/top-bar";
import { UploadZone } from "@/components/upload/upload-zone";
import { UploadProgress } from "@/components/upload/upload-progress";
import { PreviewModal } from "@/components/preview/preview-modal";
import { NewFolderModal } from "@/components/modals/new-folder-modal";
import { RenameModal } from "@/components/modals/rename-modal";
import type { DbFile, DbFolder } from "@/types/file.types";
import { ShareModal } from "@/components/modals/share-modal";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, guestSessionId, isLoading: authLoading } = useAuth();
  const { setFiles, setFolders, setIsLoading, currentFolderId } = useFilesStore();
  const { sidebarOpen, setSidebarOpen, isOnline, setIsOnline } = useUIStore();

  // Set up realtime subscriptions
  useRealtimeFiles(user?.id ?? null, guestSessionId);

  // Load initial data
  useEffect(() => {
    // Wait for auth to finish resolving before querying.
    // This prevents: (a) querying with wrong identity, (b) double-firing.
    if (authLoading) return;

    const loadData = async () => {
      setIsLoading(true);
      const supabase = createClient();

      const userId = user?.id;
      const filterColumn = userId ? "user_id" : "guest_session_id";
      const filterValue = userId || guestSessionId;

      if (!filterValue) {
        setIsLoading(false);
        return;
      }

      try {
        // Select only the columns needed by the UI — intentionally
        // omitting thumbnail_url (large base64 blob stored in DB) from
        // list queries.  Thumbnails are rendered inline wherever they're
        // already in memory (after upload) or lazy-loaded on demand.
        const FILE_COLUMNS =
          "id,user_id,guest_session_id,folder_id,name,original_name," +
          "mime_type,size_bytes,telegram_file_id,telegram_message_id," +
          "file_hash,tdlib_file_id,is_starred,is_trashed,trashed_at," +
          "created_at,updated_at";
        const FOLDER_COLUMNS =
          "id,user_id,guest_session_id,parent_id,name,color," +
          "is_trashed,trashed_at,created_at,updated_at";

        const [filesRes, foldersRes] = await Promise.all([
          supabase
            .from("files")
            .select(FILE_COLUMNS)
            .eq(filterColumn, filterValue)
            .eq("is_trashed", false)
            .order("created_at", { ascending: false })
            .limit(200), // prevent unbounded payload growth
          supabase
            .from("folders")
            .select(FOLDER_COLUMNS)
            .eq(filterColumn, filterValue)
            .eq("is_trashed", false)
            .order("name", { ascending: true }),
        ]);

        if (filesRes.data) setFiles(filesRes.data as unknown as DbFile[]);
        if (foldersRes.data) setFolders(foldersRes.data as unknown as DbFolder[]);
      } catch (error) {
        console.error("Failed to load data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [user?.id, guestSessionId, authLoading, setFiles, setFolders, setIsLoading]);

  // Online/offline detection
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    setIsOnline(navigator.onLine);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [setIsOnline]);

  // Lock body scroll when mobile sidebar is open
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [sidebarOpen]);

  return (
    <UploadZone folderId={currentFolderId}>
      <div className="flex h-dvh bg-gray-50 overflow-hidden">
        {/* Desktop Sidebar — fixed, full height */}
        <aside className="hidden lg:flex w-[280px] flex-shrink-0">
          <Sidebar />
        </aside>

        {/* Mobile / Tablet Sidebar */}
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetContent side="left" className="p-0 w-[280px] lg:hidden">
            <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
            <Sidebar />
          </SheetContent>
        </Sheet>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Offline Banner */}
          {!isOnline && (
            <div className="bg-amber-500 text-white text-center py-2 text-sm font-medium tracking-wide shadow-sm">
              You are offline — changes will sync when you reconnect.
            </div>
          )}

          <TopBar />

          <main className="flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-[1600px] px-5 sm:px-8 lg:px-10 py-6 sm:py-8">
              {children}
            </div>
          </main>
        </div>

        {/* Modals */}
        <UploadProgress />
        <PreviewModal />
        <NewFolderModal />
        <RenameModal />
        <ShareModal />
      </div>
    </UploadZone>
  );
}
