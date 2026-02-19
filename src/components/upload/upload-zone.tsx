"use client";

import { useCallback, useEffect, type ReactNode } from "react";
import { useDropzone } from "react-dropzone";
import { useAuth } from "@/app/providers/auth-provider";
import { useFilesStore } from "@/store/files-store";
import { useUIStore } from "@/store/ui-store";
import { validateFile } from "@/types/file.types";
import { v4 as uuidv4 } from "uuid";
import { Upload } from "lucide-react";

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

    const formData = new FormData();
    formData.append("file", file);
    if (targetFolderId) formData.append("folder_id", targetFolderId);
    if (user?.id) formData.append("user_id", user.id);
    if (guestSessionId) formData.append("guest_session_id", guestSessionId);

    console.log("Starting upload:", {
      fileName: file.name,
      fileSize: file.size,
      hasUser: !!user?.id,
      hasGuestSession: !!guestSessionId,
    });

    // Carries Telegram rate-limit info through the error chain
    class RateLimitError extends Error {
      retryAfter: number;
      constructor(message: string, retryAfter: number) {
        super(message);
        this.retryAfter = retryAfter;
      }
    }

    const MAX_ATTEMPTS = 6; // allow enough retries to outlast a rate-limit window

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
          const xhr = new XMLHttpRequest();

          xhr.upload.addEventListener("progress", (e) => {
            if (e.lengthComputable) {
              const pct = Math.round((e.loaded / e.total) * 100);
              updateUploadProgress(queueId, pct);
            }
          });

          const response = await new Promise<string>((resolve, reject) => {
            xhr.open("POST", "/api/upload");
            xhr.responseType = "text";
            xhr.onload = () => {
              if (xhr.status >= 200 && xhr.status < 300) {
                resolve(xhr.responseText);
              } else {
                try {
                  const errorData = JSON.parse(xhr.responseText);
                  if (xhr.status === 429) {
                    const retryAfter = errorData.retry_after ??
                      parseInt(xhr.getResponseHeader("Retry-After") || "30", 10);
                    reject(new RateLimitError(
                      errorData.error || `Rate limited. Retry after ${retryAfter}s`,
                      retryAfter
                    ));
                  } else {
                    reject(new Error(errorData.error || `Upload failed with status ${xhr.status}`));
                  }
                } catch {
                  reject(new Error(`Upload failed with status ${xhr.status}`));
                }
              }
            };
            xhr.onerror = () => reject(new Error("Upload failed - network error"));
            xhr.send(uploadData);
          });

          const data = JSON.parse(response);
          addFile(data.file);
          updateUploadStatus(queueId, "success");
        } else {
          // Retry attempts: use fetch
          const response = await fetch("/api/upload", {
            method: "POST",
            body: uploadData,
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            if (response.status === 429) {
              const retryAfter = errorData.retry_after ??
                parseInt(response.headers.get("Retry-After") || "30", 10);
              throw new RateLimitError(
                errorData.error || `Rate limited. Retry after ${retryAfter}s`,
                retryAfter
              );
            }
            throw new Error(errorData.error || `Upload failed with status ${response.status}`);
          }

          const data = await response.json();
          addFile(data.file);
          updateUploadStatus(queueId, "success");
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Upload failed";

        if (attempt >= MAX_ATTEMPTS) {
          console.error("Upload error:", message, error);
          updateUploadStatus(queueId, "error", message);
          return;
        }

        let delay: number;
        if (error instanceof RateLimitError) {
          // Honour the server's Retry-After, plus a small jitter
          delay = (error.retryAfter + Math.random() * 2) * 1000;
          console.warn(`[Upload] Rate limited by Telegram – waiting ${error.retryAfter}s before retry (attempt ${attempt}/${MAX_ATTEMPTS})`);
        } else {
          // Exponential backoff for non-rate-limit errors
          delay = Math.pow(2, attempt) * 1000;
        }
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

  const { setOpenFilePicker, setUploadFiles } = useUIStore();

  useEffect(() => {
    setOpenFilePicker(open);
    return () => setOpenFilePicker(null);
  }, [open, setOpenFilePicker]);

  useEffect(() => {
    setUploadFiles(onDrop);
    return () => setUploadFiles(null);
  }, [onDrop, setUploadFiles]);

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
