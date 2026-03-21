"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
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
import type { DbFile, DbFolder } from "@/types/file.types";
import { getFileCategory } from "@/types/file.types";

const NewFolderModal = dynamic(
  () => import("@/components/modals/new-folder-modal").then((m) => ({ default: m.NewFolderModal })),
  { ssr: false }
);
const RenameModal = dynamic(
  () => import("@/components/modals/rename-modal").then((m) => ({ default: m.RenameModal })),
  { ssr: false }
);
const ShareModal = dynamic(
  () => import("@/components/modals/share-modal").then((m) => ({ default: m.ShareModal })),
  { ssr: false }
);
const ConnectTelegramModal = dynamic(
  () => import("@/components/modals/connect-telegram-modal").then((m) => ({ default: m.ConnectTelegramModal })),
  { ssr: false }
);
import { MobileUploadFab } from "@/components/upload/mobile-upload-fab";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import Telegram from "@/components/ui/Telegram";
import { DownloadSpeedometer } from "@/components/share/download-speedometer";
import { useDownloadStore } from "@/store/download-store";
import { usePathname } from "next/navigation";

// Lazy-load PreviewModal — it bundles 8 preview sub-components that are only
// needed when the user actually opens a file. Deferring saves ~60 KB on initial load.
const PreviewModal = dynamic(
  () => import("@/components/preview/preview-modal").then((m) => ({ default: m.PreviewModal })),
  { ssr: false }
);

const MediaPreviewModal = dynamic(
  () => import("@/components/preview/media-preview-modal").then((m) => ({ default: m.MediaPreviewModal })),
  { ssr: false }
);

import { GlobalContextMenu } from "@/components/context-menu/global-context-menu";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isPhotosPage = pathname === "/drive/photos";
  
  const { user, guestSessionId, isLoading: authLoading, isTelegramConnected, isTelegramStatusLoading } = useAuth();
  const isGuest = !user && !!guestSessionId;
  const downloads = useDownloadStore((s) => s.downloads);
  const cancelDownload = useDownloadStore((s) => s.cancelDownload);
  const cancelAll = useDownloadStore((s) => s.cancelAll);
  const retryDownload = useDownloadStore((s) => s.retryDownload);
  const [telegramBannerDismissed, setTelegramBannerDismissed] = useState(
    () => typeof window !== "undefined" && sessionStorage.getItem("telegram-banner-dismissed") === "true"
  );
  const { files, setFiles, mergeFiles, setFolders, setIsLoading, setDataLoaded, currentFolderId } = useFilesStore();
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const setSidebarOpen = useUIStore((s) => s.setSidebarOpen);
  const isOnline = useUIStore((s) => s.isOnline);
  const setIsOnline = useUIStore((s) => s.setIsOnline);
  const previewFileId = useUIStore((s) => s.previewFileId);
  const previewFile = previewFileId ? files.find((file) => file.id === previewFileId) : null;
  const isMediaPreviewFile =
    previewFile ? ["image", "video"].includes(getFileCategory(previewFile.mime_type)) : false;


  // Set up realtime subscriptions
  useRealtimeFiles(user?.id ?? null, guestSessionId);

  // Load initial data
  useEffect(() => {
    // Wait for auth to finish resolving before querying.
    // This prevents: (a) querying with wrong identity, (b) double-firing.
    if (authLoading) return;

    let cancelled = false;

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

        const INITIAL_FILES_PAGE_SIZE = 200;
        const FILES_BACKGROUND_PAGE_SIZE = 1000;

        const [filesRes, foldersRes] = await Promise.all([
          supabase
            .from("files")
            .select(FILE_COLUMNS)
            .eq(filterColumn, filterValue)
            .eq("is_trashed", false)
            .order("created_at", { ascending: false })
            .limit(INITIAL_FILES_PAGE_SIZE),
          supabase
            .from("folders")
            .select(FOLDER_COLUMNS)
            .eq(filterColumn, filterValue)
            .eq("is_trashed", false)
            .order("name", { ascending: true }),
        ]);

        if (cancelled) return;

        if (filesRes.data) setFiles(filesRes.data as unknown as DbFile[]);
        if (foldersRes.data) setFolders(foldersRes.data as unknown as DbFolder[]);

        // Keep hydrating older pages in the background so sidebar storage metrics
        // are computed from the full dataset across all drive routes.
        const loadRemainingFiles = async () => {
          let from = INITIAL_FILES_PAGE_SIZE;

          while (!cancelled) {
            const to = from + FILES_BACKGROUND_PAGE_SIZE - 1;
            const { data, error } = await supabase
              .from("files")
              .select(FILE_COLUMNS)
              .eq(filterColumn, filterValue)
              .eq("is_trashed", false)
              .order("created_at", { ascending: false })
              .range(from, to);

            if (error) {
              console.error("Failed to load remaining files:", error);
              return;
            }

            const page = (data ?? []) as unknown as DbFile[];
            if (page.length === 0) return;

            mergeFiles(page);

            if (page.length < FILES_BACKGROUND_PAGE_SIZE) return;

            from += FILES_BACKGROUND_PAGE_SIZE;
          }
        };

        void loadRemainingFiles();
      } catch (error) {
        console.error("Failed to load data:", error);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
          setDataLoaded(true);
        }
      }
    };

    loadData();

    return () => {
      cancelled = true;
    };
  }, [user?.id, guestSessionId, authLoading, setFiles, mergeFiles, setFolders, setIsLoading, setDataLoaded]);

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
      <div className="flex h-dvh bg-background text-foreground overflow-hidden">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:flex w-[240px] flex-shrink-0">
          <Sidebar />
        </aside>

        {/* Mobile / Tablet Sidebar */}
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetContent
            side="left"
            className="p-0 w-[240px] lg:hidden"
            showCloseButton={false}
            onOpenAutoFocus={(event) => event.preventDefault()}
          >
            <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
            {sidebarOpen ? <Sidebar /> : null}
          </SheetContent>
        </Sheet>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Offline Banner */}
          {!isOnline && (
            <div className="bg-accent text-accent-foreground text-center py-2 text-sm font-medium tracking-wide border-b border-border shadow-sm">
              You are offline — changes will sync when you reconnect.
            </div>
          )}

          {/* Telegram Connect Banner */}
          {user && !isGuest && !isTelegramStatusLoading && !isTelegramConnected && !telegramBannerDismissed && (
            <div className="px-3 pt-3 sm:px-4">
              <div className="flex flex-col gap-3 rounded-2xl border border-[#1a73e8] bg-[#d3e3fd] px-4 py-3 shadow-[0_1px_2px_rgba(26,115,232,0.08)] sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-5 sm:py-3.5">
                <div className="flex min-w-0 items-start gap-3 sm:items-center">
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center">
                    <Telegram className="h-6 w-6" />
                  </div>
                  <p className="min-w-0 text-sm leading-6 text-[#202124] sm:text-[15px]">
                    Connect your Telegram for <span className="font-semibold">unlimited personal storage</span>
                  </p>
                </div>
                <div className="flex items-center justify-end gap-2.5 sm:flex-shrink-0">
                  <button
                    onClick={() => useUIStore.getState().setConnectTelegramModalOpen(true)}
                    className="inline-flex h-9 items-center justify-center gap-1.5 rounded-full border border-[#dadce0] bg-white px-4 text-sm font-medium text-[#3c4043] shadow-none transition-all hover:bg-[#f8f9fa] hover:border-[#dadce0]"
                  >
                    Connect
                  </button>
                  <button
                    onClick={() => {
                      setTelegramBannerDismissed(true);
                      sessionStorage.setItem("telegram-banner-dismissed", "true");
                    }}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full text-[#5f6368] transition-colors hover:bg-white/50 hover:text-[#202124]"
                    aria-label="Dismiss"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

          <TopBar />

          <main className={`flex-1 overflow-hidden sm:pb-3 ${isPhotosPage ? "px-0 pb-0 sm:px-0" : "px-2 pb-2 sm:px-3"}`}>
            <div 
              style={{ "--radius": "0.625rem" } as React.CSSProperties}
              className={`bg-surface-white text-card-foreground h-full border border-transparent flex flex-col overflow-hidden ${isPhotosPage ? "rounded-none" : "rounded-[calc(var(--radius)+0.5rem)] sm:rounded-[calc(var(--radius)+0.75rem)]"}`}
            >
              <div className={`flex-1 overflow-y-auto w-full pb-20 sm:pb-4 ${isPhotosPage ? "px-0 sm:px-0 lg:px-0" : "px-2.5 sm:px-4 lg:px-5"}`}>
                <GlobalContextMenu>
                  {children}
                </GlobalContextMenu>
              </div>
            </div>
          </main>
        </div>

        {/* Mobile FAB */}
        <MobileUploadFab />

        {/* Modals */}
        <UploadProgress />
        {previewFileId ? (isMediaPreviewFile ? <MediaPreviewModal /> : <PreviewModal />) : null}
        <NewFolderModal />
        <RenameModal />
        <ShareModal />
        <ConnectTelegramModal />

        {/* Global download progress speedometer */}
        <DownloadSpeedometer
          downloads={downloads}
          onCancelItem={cancelDownload}
          onCancelAll={cancelAll}
          onRetry={retryDownload}
        />
      </div>
    </UploadZone>
  );
}
