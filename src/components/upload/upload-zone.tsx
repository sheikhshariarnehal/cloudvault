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

    try {
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) {
          const pct = Math.round((e.loaded / e.total) * 100);
          updateUploadProgress(queueId, pct);
        }
      });

      const result = await new Promise<Response>((resolve, reject) => {
        xhr.open("POST", "/api/upload");
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(new Response(xhr.response));
          } else {
            try {
              const errorData = JSON.parse(xhr.response);
              reject(new Error(errorData.error || `Upload failed with status ${xhr.status}`));
            } catch {
              reject(new Error(`Upload failed with status ${xhr.status}`));
            }
          }
        };
        xhr.onerror = () => reject(new Error("Upload failed"));
        xhr.send(formData);
      });

      const data = await result.json();
      addFile(data.file);
      updateUploadStatus(queueId, "success");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Upload failed";
      console.error("Upload error:", message, error);
      updateUploadStatus(queueId, "error", message);

      // Retry logic with exponential backoff
      let retries = 0;
      const maxRetries = 3;
      const retry = async () => {
        if (retries >= maxRetries) return;
        retries++;
        const delay = Math.pow(2, retries) * 1000;
        await new Promise((res) => setTimeout(res, delay));

        try {
          const retryResponse = await fetch("/api/upload", {
            method: "POST",
            body: formData,
          });

          if (retryResponse.ok) {
            const data = await retryResponse.json();
            addFile(data.file);
            updateUploadStatus(queueId, "success");
          } else {
            retry();
          }
        } catch {
          retry();
        }
      };

      retry();
    }
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
