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
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, guestSessionId } = useAuth();
  const { setFiles, setFolders, setIsLoading } = useFilesStore();
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
    <UploadZone>
      <div className="flex h-screen bg-gray-50">
        {/* Desktop Sidebar */}
        <div className="hidden md:block w-[260px] flex-shrink-0">
          <Sidebar />
        </div>

        {/* Mobile Sidebar */}
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetContent side="left" className="p-0 w-[260px] md:hidden">
            <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
            <Sidebar />
          </SheetContent>
        </Sheet>

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Offline Banner */}
          {!isOnline && (
            <div className="bg-yellow-500 text-white text-center py-1 text-sm font-medium">
              You are offline. Changes will sync when you reconnect.
            </div>
          )}

          <TopBar />

          <main className="flex-1 overflow-y-auto p-4 md:p-6">
            {children}
          </main>
        </div>

        {/* Modals */}
        <UploadProgress />
        <PreviewModal />
        <NewFolderModal />
        <RenameModal />
      </div>
    </UploadZone>
  );
}
