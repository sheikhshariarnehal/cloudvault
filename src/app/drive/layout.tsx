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
import dynamic from "next/dynamic";
import { NewFolderModal } from "@/components/modals/new-folder-modal";
import { RenameModal } from "@/components/modals/rename-modal";
import type { DbFile, DbFolder } from "@/types/file.types";
import { ShareModal } from "@/components/modals/share-modal";
import { MobileUploadFab } from "@/components/upload/mobile-upload-fab";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

// Lazy-load PreviewModal — it bundles 8 preview sub-components that are only
// needed when the user actually opens a file. Deferring saves ~60 KB on initial load.
const PreviewModal = dynamic(
  () => import("@/components/preview/preview-modal").then((m) => ({ default: m.PreviewModal })),
  { ssr: false }
);

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, guestSessionId, isLoading: authLoading } = useAuth();
  const { setFiles, setFolders, setIsLoading, setDataLoaded, currentFolderId } = useFilesStore();
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
        // thumbnail_url now stores short R2 URLs (~80 chars) instead
        // of large base64 blobs, so it's safe to include in list queries.
        const FILE_COLUMNS =
          "id,user_id,guest_session_id,folder_id,name,original_name," +
          "mime_type,size_bytes,telegram_file_id,telegram_message_id," +
          "file_hash,tdlib_file_id,is_starred,is_trashed,trashed_at," +
          "created_at,updated_at,thumbnail_url";
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
            .limit(1000), // increased from 200 — supplemented by per-folder fetches
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
        setDataLoaded(true);
      }
    };

    loadData();
  }, [user?.id, guestSessionId, authLoading, setFiles, setFolders, setIsLoading, setDataLoaded]);

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
      <div className="flex h-dvh bg-[#f8fafd] overflow-hidden">
        {/* Desktop Sidebar — fixed, full height */}
        <aside className="hidden lg:flex w-[240px] flex-shrink-0">
          <Sidebar />
        </aside>

        {/* Mobile / Tablet Sidebar */}
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetContent side="left" className="p-0 w-[240px] lg:hidden">
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

          <main className="flex-1 overflow-hidden px-1 pb-1 sm:px-2 sm:pb-2">
            <div className="bg-white rounded-xl sm:rounded-2xl h-full shadow-sm border border-gray-100 overflow-hidden flex flex-col">
              <div className="flex-1 overflow-y-auto w-full px-2.5 sm:px-4 lg:px-5 pb-20 sm:pb-4">
                {children}
              </div>
            </div>
          </main>
        </div>

        {/* Mobile FAB */}
        <MobileUploadFab />

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
