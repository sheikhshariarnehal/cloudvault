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
import { ShareModal } from "@/components/modals/share-modal";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, guestSessionId } = useAuth();
  const { setFiles, setFolders, setIsLoading, currentFolderId } = useFilesStore();
  const { sidebarOpen, setSidebarOpen, isOnline, setIsOnline } = useUIStore();

  // Set up realtime subscriptions
  useRealtimeFiles(user?.id ?? null, guestSessionId);

  // Load initial data
  useEffect(() => {
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

      const [filesRes, foldersRes] = await Promise.all([
        supabase
          .from("files")
          .select("*")
          .eq(filterColumn, filterValue)
          .eq("is_trashed", false)
          .order("created_at", { ascending: false }),
        supabase
          .from("folders")
          .select("*")
          .eq(filterColumn, filterValue)
          .eq("is_trashed", false)
          .order("name", { ascending: true }),
      ]);

      if (filesRes.data) setFiles(filesRes.data);
      if (foldersRes.data) setFolders(foldersRes.data);
      setIsLoading(false);
    };

    loadData();
  }, [user?.id, guestSessionId, setFiles, setFolders, setIsLoading]);

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

  return (
    <UploadZone folderId={currentFolderId}>
      <div className="flex h-dvh bg-gray-50/50 overflow-hidden">
        {/* Desktop Sidebar — fixed, full height */}
        <aside className="hidden lg:flex w-[260px] flex-shrink-0">
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
            <div className="bg-amber-500 text-white text-center py-1.5 text-xs font-medium tracking-wide">
              You are offline — changes will sync when you reconnect.
            </div>
          )}

          <TopBar />

          <main className="flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-[1600px] px-4 sm:px-6 lg:px-8 py-5 sm:py-6">
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
