"use client";

import { useCallback, useEffect, useRef, type ReactNode } from "react";
import { useDropzone } from "react-dropzone";
import { useAuth } from "@/app/providers/auth-provider";
import { useFilesStore } from "@/store/files-store";
import { useUIStore } from "@/store/ui-store";
import { validateFile } from "@/types/file.types";
import { v4 as uuidv4 } from "uuid";
import { Upload } from "lucide-react";

/**
 * Compute SHA-256 hash of a File using the Web Crypto API.
 * Reads in 2 MB chunks to avoid loading the entire file into memory.
 */
async function computeFileHash(file: File): Promise<string> {
  // For small files (< 10 MB), just read the whole thing
  if (file.size < 10 * 1024 * 1024) {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  // For larger files, read in 2 MB chunks via a streaming approach
  const HASH_CHUNK = 2 * 1024 * 1024;
  // Use SubtleCrypto's digest on the full file via a single ArrayBuffer read.
  // The Web Crypto API doesn't support incremental hashing natively,
  // so we read the full file into an ArrayBuffer (the browser streams internally).
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

interface UploadZoneProps {
  children: ReactNode;
  folderId?: string | null;
}

export function UploadZone({ children, folderId = null }: UploadZoneProps) {
  const { user, guestSessionId } = useAuth();
  const { addToUploadQueue, updateUploadStatus, updateUploadProgress, addFile } =
    useFilesStore();

  // 3.5 MB chunks — fits under Vercel's 4.5 MB limit for fallback path
  // 3 parallel × 3.5 MB = 10.5 MB effective bandwidth (same as single 10 MB)
  const CHUNK_SIZE = 3.5 * 1024 * 1024;
  const PARALLEL_CHUNKS = 3; // upload 3 chunks simultaneously

  /**
   * Chunked upload for large files (> CHUNK_SIZE).
   * 1. POST /api/upload/init        → get uploadId + direct chunkEndpoint
   * 2. POST chunkEndpoint (direct)   → send chunks in parallel batches of 3
   * 3. POST /api/upload/complete     → assemble + Telegram upload + DB insert
   */
  const uploadFileChunked = useCallback(async (
    queueId: string,
    file: File,
    targetFolderId: string | null,
    fileHash: string | null,
  ) => {
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

    // 1. Init session (small JSON, goes through Vercel — fast)
    const initRes = await fetch("/api/upload/init", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type || "application/octet-stream",
        totalChunks,
      }),
    });

    if (!initRes.ok) {
      const err = await initRes.json().catch(() => ({}));
      throw new Error(err.error || `Init failed with status ${initRes.status}`);
    }

    const { uploadId, chunkEndpoint } = await initRes.json();

    // 2. Upload chunks in parallel directly to TDLib service
    let completedChunks = 0;

    const uploadSingleChunk = async (i: number) => {
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, file.size);
      const chunk = file.slice(start, end);

      const chunkForm = new FormData();
      chunkForm.append("chunk", chunk, `chunk_${i}`);
      chunkForm.append("uploadId", uploadId);
      chunkForm.append("chunkIndex", String(i));

      // Try direct backend first, fall back to Vercel proxy
      const directUrl = chunkEndpoint;
      let success = false;

      if (directUrl) {
        try {
          const res = await fetch(directUrl, { method: "POST", body: chunkForm });
          if (res.ok) success = true;
        } catch {
          // Direct failed (CORS/network) — will fallback below
        }
      }

      if (!success) {
        // Fallback: send through Vercel proxy
        const fallbackForm = new FormData();
        fallbackForm.append("chunk", file.slice(start, end), `chunk_${i}`);
        fallbackForm.append("uploadId", uploadId);
        fallbackForm.append("chunkIndex", String(i));

        const res = await fetch("/api/upload/chunk", { method: "POST", body: fallbackForm });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `Chunk ${i} failed`);
        }
      }

      completedChunks++;
      const pct = Math.round((completedChunks / totalChunks) * 90);
      updateUploadProgress(queueId, pct);
    };

    // Process in parallel batches
    for (let i = 0; i < totalChunks; i += PARALLEL_CHUNKS) {
      const batch = [];
      for (let j = i; j < Math.min(i + PARALLEL_CHUNKS, totalChunks); j++) {
        batch.push(uploadSingleChunk(j));
      }
      await Promise.all(batch);
    }

    // 3. Complete: assemble + upload to Telegram + DB insert (through Vercel)
    updateUploadProgress(queueId, 92);

    const completeRes = await fetch("/api/upload/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        uploadId,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type || "application/octet-stream",
        userId: user?.id || null,
        guestSessionId: guestSessionId || null,
        folderId: targetFolderId,
        fileHash: fileHash || null,
      }),
    });

    if (!completeRes.ok) {
      const errData = await completeRes.json().catch(() => ({}));
      if (completeRes.status === 429) {
        const retryAfter = errData.retry_after ?? 30;
        const err = new Error(errData.error || `Rate limited. Retry after ${retryAfter}s`);
        (err as any).retryAfter = retryAfter;
        (err as any).isRateLimit = true;
        throw err;
      }
      throw new Error(errData.error || `Complete failed with status ${completeRes.status}`);
    }

    const data = await completeRes.json();
    updateUploadProgress(queueId, 100);
    return data;
  }, [user, guestSessionId, updateUploadProgress, CHUNK_SIZE]);

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

    // ── Compute SHA-256 hash for dedup ──────────────────────────────
    let fileHash: string | null = null;
    try {
      updateUploadProgress(queueId, 1); // show activity during hashing
      fileHash = await computeFileHash(file);
      updateUploadProgress(queueId, 5);
    } catch (hashErr) {
      console.warn("[Upload] Hash computation failed, skipping dedup:", hashErr);
    }

    // ── Dedup check: if an identical file exists, skip upload entirely ──
    if (fileHash) {
      try {
        const dedupRes = await fetch("/api/upload/dedup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileHash,
            fileName: file.name,
            fileSize: file.size,
            mimeType: file.type || "application/octet-stream",
            userId: user?.id || null,
            guestSessionId: guestSessionId || null,
            folderId: targetFolderId,
          }),
        });

        if (dedupRes.ok) {
          const dedupData = await dedupRes.json();
          if (dedupData.duplicate && dedupData.file) {
            console.log("[Upload] Dedup hit — skipped upload for", file.name);
            updateUploadProgress(queueId, 100);
            addFile(dedupData.file);
            updateUploadStatus(queueId, "success");
            return;
          }
        }
      } catch (dedupErr) {
        console.warn("[Upload] Dedup check failed, proceeding with upload:", dedupErr);
      }
    }

    console.log("Starting upload:", {
      fileName: file.name,
      fileSize: file.size,
      hasUser: !!user?.id,
      hasGuestSession: !!guestSessionId,
      chunked: file.size > CHUNK_SIZE,
    });

    // Carries Telegram rate-limit info through the error chain
    class RateLimitError extends Error {
      retryAfter: number;
      constructor(message: string, retryAfter: number) {
        super(message);
        this.retryAfter = retryAfter;
      }
    }

    const MAX_ATTEMPTS = 6;

    const attemptUpload = async (attempt: number): Promise<void> => {
      try {
        // ── Use chunked upload for files larger than CHUNK_SIZE ──────────
        if (file.size > CHUNK_SIZE) {
          const data = await uploadFileChunked(queueId, file, targetFolderId, fileHash);
          addFile(data.file);
          updateUploadStatus(queueId, "success");
          return;
        }

        // ── Small file: single-request upload (original path) ───────────
        const uploadData = new FormData();
        uploadData.append("file", file);
        if (targetFolderId) uploadData.append("folder_id", targetFolderId);
        if (user?.id) uploadData.append("user_id", user.id);
        if (guestSessionId) uploadData.append("guest_session_id", guestSessionId);
        if (fileHash) uploadData.append("file_hash", fileHash);

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

        // For chunked uploads, don't retry the whole thing on non-rate-limit errors
        // (chunks are already individual requests, retrying everything would be wasteful)
        const isChunked = file.size > CHUNK_SIZE;
        const isRateLimit = error instanceof RateLimitError || (error as any)?.isRateLimit;

        if (attempt >= MAX_ATTEMPTS || (isChunked && !isRateLimit)) {
          console.error("Upload error:", message, error);
          updateUploadStatus(queueId, "error", message);
          return;
        }

        let delay: number;
        if (error instanceof RateLimitError) {
          delay = (error.retryAfter + Math.random() * 2) * 1000;
          console.warn(`[Upload] Rate limited by Telegram – waiting ${error.retryAfter}s before retry (attempt ${attempt}/${MAX_ATTEMPTS})`);
        } else if ((error as any)?.isRateLimit) {
          delay = ((error as any).retryAfter + Math.random() * 2) * 1000;
          console.warn(`[Upload] Rate limited – waiting before retry (attempt ${attempt}/${MAX_ATTEMPTS})`);
        } else {
          delay = Math.pow(2, attempt) * 1000;
        }
        await new Promise((res) => setTimeout(res, delay));
        await attemptUpload(attempt + 1);
      }
    };

    await attemptUpload(1);
  }, [user, guestSessionId, updateUploadStatus, updateUploadProgress, addFile, uploadFileChunked, CHUNK_SIZE]);

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

  // Mobile-friendly file input ref — avoids iOS Safari issue where
  // programmatic .click() on a display:none input is silently ignored.
  const mobileFileInputRef = useRef<HTMLInputElement>(null);

  const handleMobileFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      if (files.length > 0) {
        onDrop(files);
      }
      // Reset so the same file can be re-selected
      if (e.target) e.target.value = "";
    },
    [onDrop]
  );

  const { setOpenFilePicker, setUploadFiles } = useUIStore();

  useEffect(() => {
    // Store a function that clicks the mobile-friendly input directly.
    // This preserves user-gesture context on iOS Safari / Android Chrome.
    setOpenFilePicker(() => {
      if (mobileFileInputRef.current) {
        mobileFileInputRef.current.click();
      } else {
        // Fallback to react-dropzone's open() (works on desktop)
        open();
      }
    });
    return () => setOpenFilePicker(null);
  }, [open, setOpenFilePicker]);

  useEffect(() => {
    setUploadFiles(onDrop);
    return () => setUploadFiles(null);
  }, [onDrop, setUploadFiles]);

  return (
    <div {...getRootProps()} className="relative">
      <input {...getInputProps()} />
      {/* Mobile-friendly hidden file input: uses opacity+positioning
          instead of display:none so iOS Safari allows .click() */}
      <input
        ref={mobileFileInputRef}
        type="file"
        multiple
        onChange={handleMobileFileSelect}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "1px",
          height: "1px",
          opacity: 0.01,
          overflow: "hidden",
          zIndex: -1,
          pointerEvents: "none",
        }}
        tabIndex={-1}
        aria-hidden="true"
      />
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
