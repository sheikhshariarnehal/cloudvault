"use client";

import { useCallback, useEffect, type ReactNode } from "react";
import { useDropzone } from "react-dropzone";
import { useAuth } from "@/app/providers/auth-provider";
import { useFilesStore } from "@/store/files-store";
import { useUIStore } from "@/store/ui-store";
import { validateFile } from "@/types/file.types";
import { v4 as uuidv4 } from "uuid";
import { Upload } from "lucide-react";

const BACKEND_URL = process.env.NEXT_PUBLIC_MTPROTO_BACKEND_URL!;
const API_KEY = process.env.NEXT_PUBLIC_MTPROTO_API_KEY!;

interface UploadZoneProps {
  children: ReactNode;
  folderId?: string | null;
}

export function UploadZone({ children, folderId = null }: UploadZoneProps) {
  const { user, guestSessionId } = useAuth();
  const { addToUploadQueue, updateUploadStatus, updateUploadProgress, addFile } =
    useFilesStore();

  const uploadFile = useCallback(async (
    queueId: string,
    file: File,
    targetFolderId: string | null
  ) => {
    // Validate authentication before upload
    if (!user?.id && !guestSessionId) {
      const errorMsg = "User ID or Guest Session ID required. Please wait for authentication to complete.";
      console.error("Upload error:", errorMsg);
      updateUploadStatus(queueId, "error", errorMsg);
      return;
    }

    updateUploadStatus(queueId, "uploading");

    console.log("Starting upload:", {
      fileName: file.name,
      fileSize: file.size,
      hasUser: !!user?.id,
      hasGuestSession: !!guestSessionId,
    });

    const attemptUpload = async (attempt: number): Promise<void> => {
      try {
        // Rebuild FormData for each attempt to avoid consumed body issues
        const uploadData = new FormData();
        uploadData.append("file", file);
        if (targetFolderId) uploadData.append("folder_id", targetFolderId);
        if (user?.id) uploadData.append("user_id", user.id);
        if (guestSessionId) uploadData.append("guest_session_id", guestSessionId);

        if (attempt === 1) {
          // First attempt: use XHR for progress tracking
          // Progress is split into two phases:
          //   Phase 1 (0–50%): bytes travelling browser → Express  (XHR upload events)
          //   Phase 2 (50–95%): Express uploading to Telegram        (smooth animation)
          //   Done  (100%):    response received, Supabase row saved
          const xhr = new XMLHttpRequest();
          let telegramProgressInterval: ReturnType<typeof setInterval> | null = null;

          // Phase 1 – track actual byte transfer, mapped to 0–50
          xhr.upload.addEventListener("progress", (e) => {
            if (e.lengthComputable) {
              const transferPct = Math.round((e.loaded / e.total) * 50);
              updateUploadProgress(queueId, transferPct);
            }
          });

          // Phase 2 – once all bytes are sent, animate 50→95 slowly
          xhr.upload.addEventListener("load", () => {
            updateUploadProgress(queueId, 50);
            let current = 50;
            telegramProgressInterval = setInterval(() => {
              // Slow logarithmic crawl: approaches 95 but never reaches it
              const remaining = 95 - current;
              current += Math.max(0.5, remaining * 0.04);
              updateUploadProgress(queueId, Math.min(95, Math.round(current)));
            }, 300);
          });

          const response = await new Promise<string>((resolve, reject) => {
            xhr.open("POST", `${BACKEND_URL}/upload`);
            xhr.setRequestHeader("X-API-Key", API_KEY);
            xhr.responseType = "text";
            xhr.onload = () => {
              if (telegramProgressInterval) clearInterval(telegramProgressInterval);
              if (xhr.status >= 200 && xhr.status < 300) {
                updateUploadProgress(queueId, 100);
                resolve(xhr.responseText);
              } else {
                try {
                  const errorData = JSON.parse(xhr.responseText);
                  reject(new Error(errorData.error || `Upload failed with status ${xhr.status}`));
                } catch {
                  reject(new Error(`Upload failed with status ${xhr.status}`));
                }
              }
            };
            xhr.onerror = () => {
              if (telegramProgressInterval) clearInterval(telegramProgressInterval);
              reject(new Error("Upload failed - network error"));
            };
            xhr.send(uploadData);
          });

          const data = JSON.parse(response);
          addFile(data.file);
          updateUploadStatus(queueId, "success");
        } else {
          // Retry attempts: use fetch with animated progress
          updateUploadProgress(queueId, 10);
          let current = 10;
          const retryInterval = setInterval(() => {
            const remaining = 95 - current;
            current += Math.max(0.5, remaining * 0.04);
            updateUploadProgress(queueId, Math.min(95, Math.round(current)));
          }, 300);

          try {
            const response = await fetch(`${BACKEND_URL}/upload`, {
              method: "POST",
              headers: { "X-API-Key": API_KEY },
              body: uploadData,
            });
            clearInterval(retryInterval);

            if (!response.ok) {
              const errorData = await response.json().catch(() => ({}));
              throw new Error(errorData.error || `Upload failed with status ${response.status}`);
            }

            updateUploadProgress(queueId, 100);
            const data = await response.json();
            addFile(data.file);
            updateUploadStatus(queueId, "success");
          } catch (err) {
            clearInterval(retryInterval);
            throw err;
          }
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Upload failed";

        if (attempt >= 4) {
          console.error("Upload error:", message, error);
          updateUploadStatus(queueId, "error", message);
          return;
        }

        // Exponential backoff before retry
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise((res) => setTimeout(res, delay));
        await attemptUpload(attempt + 1);
      }
    };

    await attemptUpload(1);
  }, [user, guestSessionId, updateUploadStatus, updateUploadProgress, addFile]);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      for (const file of acceptedFiles) {
        const validation = validateFile(file);
        if (!validation.valid) {
          console.error(validation.error);
          continue;
        }

        const queueId = uuidv4();
        addToUploadQueue({
          id: queueId,
          file,
          folderId,
          progress: 0,
          status: "pending",
        });

        // Start upload
        uploadFile(queueId, file, folderId);
      }
    },
    [folderId, addToUploadQueue, uploadFile]
  );

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    noClick: true,
    noKeyboard: true,
  });

  const { setOpenFilePicker } = useUIStore();

  useEffect(() => {
    setOpenFilePicker(open);
    return () => setOpenFilePicker(null);
  }, [open, setOpenFilePicker]);

  return (
    <div {...getRootProps()} className="relative">
      <input {...getInputProps()} />
      {isDragActive && (
        <div className="fixed inset-0 z-50 bg-primary/10 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-white rounded-2xl shadow-xl p-12 text-center border-2 border-dashed border-primary">
            <Upload className="h-16 w-16 text-primary mx-auto mb-4" />
            <h3 className="text-xl font-semibold">Drop files to upload</h3>
            <p className="text-muted-foreground mt-2">
              Release to start uploading
            </p>
          </div>
        </div>
      )}
      {children}
    </div>
  );
}
