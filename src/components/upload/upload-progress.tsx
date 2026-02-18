"use client";

import { useFilesStore } from "@/store/files-store";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { X, Check, AlertCircle, Upload } from "lucide-react";

export function UploadProgress() {
  const { uploadQueue, removeFromUploadQueue, clearUploadQueue } =
    useFilesStore();

  const activeUploads = uploadQueue.filter(
    (item) => item.status !== "success" || Date.now() < Date.now() + 3000
  );

  if (uploadQueue.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 bg-white rounded-xl shadow-xl border overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b">
        <div className="flex items-center gap-2">
          <Upload className="h-4 w-4" />
          <span className="text-sm font-medium">
            Uploading ({uploadQueue.filter((i) => i.status === "uploading").length} active)
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={clearUploadQueue}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="max-h-64 overflow-y-auto">
        {uploadQueue.map((item) => (
          <div
            key={item.id}
            className="flex items-center gap-3 px-4 py-3 border-b last:border-b-0"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{item.file.name}</p>
              {item.status === "uploading" && (
                <>
                  <Progress value={item.progress} className="h-1.5 mt-1.5" />
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {item.progress < 50
                      ? "Uploading…"
                      : item.progress < 100
                      ? "Saving to Telegram…"
                      : "Finishing…"}
                  </p>
                </>
              )}
              {item.status === "error" && (
                <p className="text-xs text-destructive mt-1">{item.error}</p>
              )}
            </div>

            <div className="flex-shrink-0">
              {item.status === "success" && (
                <Check className="h-4 w-4 text-green-500" />
              )}
              {item.status === "error" && (
                <AlertCircle className="h-4 w-4 text-destructive" />
              )}
              {item.status === "uploading" && (
                <span className="text-xs text-muted-foreground">
                  {item.progress}%
                </span>
              )}
              {item.status === "pending" && (
                <span className="text-xs text-muted-foreground">Waiting</span>
              )}
            </div>

            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => removeFromUploadQueue(item.id)}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
