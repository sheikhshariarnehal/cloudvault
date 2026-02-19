"use client";

import { useFilesStore } from "@/store/files-store";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Bell, CheckCircle2, Upload, AlertCircle, Loader2, FileIcon } from "lucide-react";
import { useMemo, useState } from "react";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return date.toLocaleDateString();
}

interface Notification {
  id: string;
  type: "upload-success" | "upload-error" | "upload-progress" | "file-added";
  title: string;
  description: string;
  timestamp: Date;
  icon: "success" | "error" | "progress" | "file";
}

export function NotificationPopover() {
  const { uploadQueue, files } = useFilesStore();
  const [seen, setSeen] = useState<Set<string>>(new Set());

  const notifications = useMemo<Notification[]>(() => {
    const items: Notification[] = [];

    // Upload queue notifications
    for (const item of uploadQueue) {
      if (item.status === "uploading") {
        items.push({
          id: `upload-${item.id}`,
          type: "upload-progress",
          title: `Uploading ${item.file.name}`,
          description: `${item.progress}% • ${formatSize(item.file.size)}`,
          timestamp: new Date(),
          icon: "progress",
        });
      } else if (item.status === "success") {
        items.push({
          id: `upload-${item.id}`,
          type: "upload-success",
          title: `Uploaded ${item.file.name}`,
          description: formatSize(item.file.size),
          timestamp: new Date(),
          icon: "success",
        });
      } else if (item.status === "error") {
        items.push({
          id: `upload-${item.id}`,
          type: "upload-error",
          title: `Failed to upload ${item.file.name}`,
          description: item.error || "Upload failed",
          timestamp: new Date(),
          icon: "error",
        });
      }
    }

    // Recent files (last 5 added) as "file added" notifications
    const recentFiles = [...files]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 5);

    for (const file of recentFiles) {
      items.push({
        id: `file-${file.id}`,
        type: "file-added",
        title: file.name,
        description: `Added ${timeAgo(new Date(file.created_at))}`,
        timestamp: new Date(file.created_at),
        icon: "file",
      });
    }

    return items;
  }, [uploadQueue, files]);

  const unseenCount = notifications.filter((n) => !seen.has(n.id)).length;
  const activeUploads = uploadQueue.filter((i) => i.status === "uploading").length;
  const hasUnseen = unseenCount > 0;

  const handleOpen = (open: boolean) => {
    if (open) {
      // Mark all current notifications as seen
      setSeen(new Set(notifications.map((n) => n.id)));
    }
  };

  const iconMap = {
    success: <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />,
    error: <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />,
    progress: <Loader2 className="h-4 w-4 text-blue-500 animate-spin shrink-0" />,
    file: <FileIcon className="h-4 w-4 text-gray-400 shrink-0" />,
  };

  return (
    <DropdownMenu onOpenChange={handleOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-10 w-10 hover:bg-gray-100"
          aria-label="Notifications"
        >
          <Bell className="h-[19px] w-[19px]" />
          {(hasUnseen || activeUploads > 0) && (
            <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-80 p-0 overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">Notifications</h3>
          {activeUploads > 0 && (
            <span className="text-xs text-blue-600 font-medium">
              {activeUploads} uploading
            </span>
          )}
        </div>

        {/* Notification list */}
        <div className="max-h-80 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 px-4">
              <Bell className="h-10 w-10 text-gray-300 mb-3" />
              <p className="text-sm text-gray-500 font-medium">No notifications yet</p>
              <p className="text-xs text-gray-400 mt-1">
                Upload files to see activity here
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {notifications.map((notif) => (
                <div
                  key={notif.id}
                  className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
                >
                  <div className="mt-0.5">{iconMap[notif.icon]}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900 font-medium truncate">
                      {notif.title}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5 truncate">
                      {notif.description}
                    </p>
                    {notif.type === "upload-progress" && (
                      <div className="mt-1.5 h-1 w-full bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full transition-all duration-300"
                          style={{
                            width: `${uploadQueue.find((u) => notif.id === `upload-${u.id}`)?.progress ?? 0}%`,
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
