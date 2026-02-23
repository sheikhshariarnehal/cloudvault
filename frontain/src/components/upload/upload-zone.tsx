"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useAuth } from "@/app/providers/auth-provider";
import { useFilesStore } from "@/store/files-store";
import { useUIStore } from "@/store/ui-store";
import { validateFile } from "@/types/file.types";
import { v4 as uuidv4 } from "uuid";
import { Upload, FolderUp, CloudUpload } from "lucide-react";

// ─── Folder / Directory Handling Utilities ──────────────────────────────────

interface FileWithPath {
  file: File;
  /** Relative path segments from the dropped root, e.g. ["photos", "vacation"] */
  pathSegments: string[];
}

/**
 * Read a single FileSystemDirectoryEntry, returning an array of its entries.
 * Handles the batched readEntries() API — browsers return ~100 entries at a time.
 */
function readDirectoryEntries(
  dirReader: FileSystemDirectoryReader
): Promise<FileSystemEntry[]> {
  return new Promise((resolve, reject) => {
    const allEntries: FileSystemEntry[] = [];
    const readBatch = () => {
      try {
        dirReader.readEntries((entries) => {
          if (entries.length === 0) {
            resolve(allEntries);
          } else {
            allEntries.push(...entries);
            readBatch(); // readEntries returns batches of ~100
          }
        }, (err) => {
          // If partial entries were read, return what we have
          if (allEntries.length > 0) {
            console.warn("[Upload] readEntries partial error, returning collected entries:", err);
            resolve(allEntries);
          } else {
            reject(err);
          }
        });
      } catch (err) {
        if (allEntries.length > 0) resolve(allEntries);
        else reject(err);
      }
    };
    readBatch();
  });
}

/**
 * Convert a FileSystemFileEntry into a standard File object.
 */
function fileEntryToFile(entry: FileSystemFileEntry): Promise<File> {
  return new Promise((resolve, reject) => {
    entry.file(resolve, reject);
  });
}

/**
 * Recursively traverse a FileSystemEntry tree and collect all files
 * along with their path segments (folder hierarchy).
 * Gracefully handles errors per-file so one bad entry doesn't kill the whole tree.
 */
async function traverseEntry(
  entry: FileSystemEntry,
  pathSegments: string[] = []
): Promise<FileWithPath[]> {
  if (entry.isFile) {
    try {
      const file = await fileEntryToFile(entry as FileSystemFileEntry);
      return [{ file, pathSegments }];
    } catch (err) {
      console.warn("[Upload] Could not read file:", entry.fullPath, err);
      return [];
    }
  }

  if (entry.isDirectory) {
    const dirEntry = entry as FileSystemDirectoryEntry;
    let children: FileSystemEntry[];
    try {
      const reader = dirEntry.createReader();
      children = await readDirectoryEntries(reader);
    } catch (err) {
      console.warn("[Upload] Could not read directory:", entry.fullPath, err);
      return [];
    }

    const results: FileWithPath[] = [];
    const nextSegments = [...pathSegments, dirEntry.name];

    // Process children concurrently in batches for speed
    const BATCH = 10;
    for (let i = 0; i < children.length; i += BATCH) {
      const batch = children.slice(i, i + BATCH);
      const batchResults = await Promise.all(
        batch
          .filter((child) => !child.name.startsWith("."))
          .map((child) =>
            traverseEntry(child, nextSegments).catch((err) => {
              console.warn("[Upload] Skipping entry:", child.name, err);
              return [] as FileWithPath[];
            })
          )
      );
      for (const r of batchResults) results.push(...r);
    }
    return results;
  }

  return [];
}

/**
 * Process pre-collected FileSystemEntry objects into FileWithPath[].
 * Entries MUST be grabbed synchronously during the drop event — browsers
 * clear DataTransfer after the synchronous handler returns.
 */
async function processEntries(
  entries: FileSystemEntry[]
): Promise<FileWithPath[]> {
  const allFiles: FileWithPath[] = [];
  for (const entry of entries) {
    try {
      const results = await traverseEntry(entry);
      allFiles.push(...results);
    } catch (err) {
      console.warn("[Upload] Failed to traverse entry:", entry.name, err);
    }
  }
  return allFiles;
}

/**
 * Extract files with path info from a file input change event.
 * Supports both regular file selection and webkitdirectory selection.
 */
function getFilesFromInputEvent(
  files: FileList | null
): FileWithPath[] {
  if (!files) return [];
  const result: FileWithPath[] = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    // webkitRelativePath is set when using webkitdirectory attribute
    // e.g. "myFolder/subdir/image.png"
    const relativePath = (file as any).webkitRelativePath || "";
    const segments = relativePath
      ? relativePath.split("/").slice(0, -1) // remove the filename itself
      : [];
    result.push({ file, pathSegments: segments });
  }
  return result;
}

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
  const { addToUploadQueue, updateUploadStatus, updateUploadProgress, updateUploadBytes, addFile, addFolder } =
    useFilesStore();

  // ── Drag state — managed manually (no react-dropzone) ─────────────
  const [isDragOver, setIsDragOver] = useState(false);
  const [isDraggingFolder, setIsDraggingFolder] = useState(false);
  const dragCounterRef = useRef(0);

  // Route files > 4 MB through chunked upload → bypasses Vercel 4.5 MB body limit.
  // Actual chunk slices are 10 MB each, sent direct to TDLib service.
  const CHUNK_THRESHOLD = 4 * 1024 * 1024; // decision boundary
  const CHUNK_SIZE = 10 * 1024 * 1024;     // actual slice size per chunk
  const PARALLEL_CHUNKS = 5;

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
    // Track per-chunk byte progress for smooth UI updates
    const chunkBytesLoaded = new Array(totalChunks).fill(0);
    const chunkBytesTotal = new Array(totalChunks).fill(0);
    let completedChunks = 0;

    const updateChunkProgress = () => {
      const loaded = chunkBytesLoaded.reduce((a, b) => a + b, 0);
      const total = file.size;
      // Chunk upload phase = 0–80% of the bar
      const pct = Math.round((loaded / total) * 80);
      updateUploadProgress(queueId, pct);
      updateUploadBytes(queueId, loaded, total);
    };

    const uploadSingleChunk = async (i: number) => {
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, file.size);
      const chunk = file.slice(start, end);
      chunkBytesTotal[i] = end - start;

      const chunkForm = new FormData();
      chunkForm.append("chunk", chunk, `chunk_${i}`);
      chunkForm.append("uploadId", uploadId);
      chunkForm.append("chunkIndex", String(i));

      // Direct upload to TDLib service (bypasses Vercel 4.5MB limit)
      if (!chunkEndpoint) {
        throw new Error("No direct chunk endpoint available. Set NEXT_PUBLIC_TDLIB_CHUNK_URL.");
      }

      // Use XMLHttpRequest for byte-level progress within each chunk
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", chunkEndpoint);

        xhr.upload.addEventListener("progress", (e) => {
          if (e.lengthComputable) {
            chunkBytesLoaded[i] = e.loaded;
            updateChunkProgress();
          }
        });

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            chunkBytesLoaded[i] = chunkBytesTotal[i];
            completedChunks++;
            updateChunkProgress();
            resolve();
          } else {
            try {
              const err = JSON.parse(xhr.responseText);
              reject(new Error(err.error || `Chunk ${i} failed with status ${xhr.status}`));
            } catch {
              reject(new Error(`Chunk ${i} failed with status ${xhr.status}`));
            }
          }
        };

        xhr.onerror = () => reject(new Error(`Chunk ${i} network error`));
        xhr.send(chunkForm);
      });
    };

    // Process in parallel batches
    for (let i = 0; i < totalChunks; i += PARALLEL_CHUNKS) {
      const batch = [];
      for (let j = i; j < Math.min(i + PARALLEL_CHUNKS, totalChunks); j++) {
        batch.push(uploadSingleChunk(j));
      }
      await Promise.all(batch);
    }

    // 3. Complete: upload to Telegram + DB insert (through Vercel)
    // Poll TDLib for Telegram upload progress (80% → 98%)
    updateUploadProgress(queueId, 82);

    let pollTimer: ReturnType<typeof setInterval> | null = null;
    const pollProgress = async () => {
      try {
        const statusUrl = chunkEndpoint.replace("/chunk", `/status?uploadId=${uploadId}`);
        const statusRes = await fetch(statusUrl);
        if (statusRes.ok) {
          const status = await statusRes.json();
          if (status.telegramProgress != null) {
            // Telegram upload phase: 82% → 98%
            const pct = 82 + Math.round(status.telegramProgress * 16);
            updateUploadProgress(queueId, Math.min(pct, 98));
          }
        }
      } catch {
        // ignore poll errors
      }
    };
    pollTimer = setInterval(pollProgress, 2000);

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
      if (pollTimer) clearInterval(pollTimer);
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

    if (pollTimer) clearInterval(pollTimer);
    const data = await completeRes.json();
    updateUploadProgress(queueId, 100);
    return data;
  }, [user, guestSessionId, updateUploadProgress, updateUploadBytes, CHUNK_SIZE]);

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

    // ── Dedup check: skip upload if same-name file already exists in this folder ──
    try {
      const dedupRes = await fetch("/api/upload/dedup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          userId: user?.id || null,
          guestSessionId: guestSessionId || null,
          folderId: targetFolderId,
        }),
      });

      if (dedupRes.ok) {
        const dedupData = await dedupRes.json();
        if (dedupData.duplicate && dedupData.file) {
          console.log("[Upload] Duplicate name in folder — skipped upload for", file.name);
          updateUploadProgress(queueId, 100);
          addFile(dedupData.file);
          updateUploadStatus(queueId, "duplicate");
          return;
        }
      }
    } catch (dedupErr) {
      console.warn("[Upload] Dedup check failed, proceeding with upload:", dedupErr);
    }

    console.log("Starting upload:", {
      fileName: file.name,
      fileSize: file.size,
      hasUser: !!user?.id,
      hasGuestSession: !!guestSessionId,
      chunked: file.size > CHUNK_THRESHOLD,
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
        // ── Use chunked upload for files larger than 4 MB (bypasses Vercel) ──
        if (file.size > CHUNK_THRESHOLD) {
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
              updateUploadBytes(queueId, e.loaded, e.total);
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
        const isChunked = file.size > CHUNK_THRESHOLD;
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
  }, [user, guestSessionId, updateUploadStatus, updateUploadProgress, updateUploadBytes, addFile, uploadFileChunked, CHUNK_THRESHOLD]);

  // ── Folder creation helper ──────────────────────────────────────────
  /**
   * Given a list of FileWithPath entries, create the necessary folder hierarchy
   * and return a map from path string → folder ID.
   * e.g. "photos" → "uuid-1", "photos/vacation" → "uuid-2"
   */
  const createFolderHierarchy = useCallback(
    async (filesWithPaths: FileWithPath[], rootFolderId: string | null): Promise<Map<string, string>> => {
      const folderMap = new Map<string, string>(); // "path/string" → folderId
      const createdPaths = new Set<string>();

      // Collect all unique folder paths
      const allPaths = new Set<string>();
      for (const { pathSegments } of filesWithPaths) {
        for (let i = 1; i <= pathSegments.length; i++) {
          allPaths.add(pathSegments.slice(0, i).join("/"));
        }
      }

      // Sort by depth so parents are created before children
      const sortedPaths = Array.from(allPaths).sort(
        (a, b) => a.split("/").length - b.split("/").length
      );

      console.log(`[Upload] Creating ${sortedPaths.length} folder(s):`, sortedPaths);

      for (const pathStr of sortedPaths) {
        if (createdPaths.has(pathStr)) continue;

        const segments = pathStr.split("/");
        const folderName = segments[segments.length - 1];
        const parentPath = segments.slice(0, -1).join("/");
        const parentId = parentPath ? folderMap.get(parentPath) ?? rootFolderId : rootFolderId;

        try {
          const res = await fetch("/api/folders", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: folderName,
              parent_id: parentId,
              user_id: user?.id || null,
              guest_session_id: guestSessionId || null,
            }),
          });

          if (res.ok) {
            const data = await res.json();
            folderMap.set(pathStr, data.folder.id);
            addFolder(data.folder);
            createdPaths.add(pathStr);
          } else {
            console.error(`Failed to create folder "${pathStr}":`, await res.text());
            // Fall back to root/parent folder
            folderMap.set(pathStr, parentId ?? rootFolderId ?? "");
          }
        } catch (err) {
          console.error(`Error creating folder "${pathStr}":`, err);
          folderMap.set(pathStr, parentId ?? rootFolderId ?? "");
        }
      }

      return folderMap;
    },
    [user, guestSessionId, addFolder]
  );

  // ── Main drop handler: supports both files and folders ──────────────
  const onDropWithFolders = useCallback(
    async (filesWithPaths: FileWithPath[]) => {
      if (filesWithPaths.length === 0) {
        console.warn("[Upload] No files found in drop");
        return;
      }

      console.log(`[Upload] Processing ${filesWithPaths.length} file(s) from folder drop`);

      const STAGGER_MS = 1500;

      // Separate files that need folder creation from plain files
      const hasAnyFolders = filesWithPaths.some((f) => f.pathSegments.length > 0);

      // Create folder hierarchy first if needed
      let folderMap = new Map<string, string>();
      if (hasAnyFolders) {
        folderMap = await createFolderHierarchy(filesWithPaths, folderId);
      }

      // Queue all files for upload
      const fileEntries: { queueId: string; file: File; targetFolderId: string | null }[] = [];
      for (const { file, pathSegments } of filesWithPaths) {
        const validation = validateFile(file);
        if (!validation.valid) {
          console.error(validation.error);
          continue;
        }

        // Skip zero-byte files (some browsers create these for folder entries)
        if (file.size === 0 && file.type === "") continue;

        // Determine the target folder for this file
        let targetFolderId: string | null = folderId;
        if (pathSegments.length > 0) {
          const pathStr = pathSegments.join("/");
          targetFolderId = folderMap.get(pathStr) ?? folderId;
        }

        const queueId = uuidv4();
        addToUploadQueue({
          id: queueId,
          file,
          folderId: targetFolderId,
          progress: 0,
          bytesLoaded: 0,
          bytesTotal: file.size,
          status: "pending",
        });
        fileEntries.push({ queueId, file, targetFolderId });
      }

      // Fire each upload with a stagger delay to avoid Telegram 429
      for (let i = 0; i < fileEntries.length; i++) {
        const { queueId, file, targetFolderId } = fileEntries[i];
        if (i > 0) {
          await new Promise((r) => setTimeout(r, STAGGER_MS));
        }
        uploadFile(queueId, file, targetFolderId);
      }
    },
    [folderId, addToUploadQueue, uploadFile, createFolderHierarchy]
  );

  // Plain file drop (no folder info)
  const onDropFiles = useCallback(
    async (files: File[]) => {
      const filesWithPaths: FileWithPath[] = files.map((file) => ({
        file,
        pathSegments: [],
      }));
      await onDropWithFolders(filesWithPaths);
    },
    [onDropWithFolders]
  );

  // ── Unified native drag/drop handlers ─────────────────────────────
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;

    if (dragCounterRef.current === 1) {
      setIsDragOver(true);

      // Detect if any item might be a folder
      const items = e.dataTransfer?.items;
      if (items) {
        for (let i = 0; i < items.length; i++) {
          if (items[i].kind === "file" && items[i].type === "") {
            setIsDraggingFolder(true);
            return;
          }
        }
      }
      setIsDraggingFolder(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Required for drop to work
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = "copy";
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;

    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0;
      setIsDragOver(false);
      setIsDraggingFolder(false);
    }
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // Immediately clear drag state
      dragCounterRef.current = 0;
      setIsDragOver(false);
      setIsDraggingFolder(false);

      // ── CRITICAL: Grab ALL entries synchronously ──────────────────
      // Browsers clear DataTransfer.items after the synchronous portion
      // of the event handler returns. We must collect everything NOW,
      // before any await.
      const items = e.dataTransfer?.items;
      const entries: FileSystemEntry[] = [];
      const plainFiles: File[] = [];
      let hasDirectory = false;

      if (items && items.length > 0) {
        for (let i = 0; i < items.length; i++) {
          const entry = items[i].webkitGetAsEntry?.();
          if (entry) {
            entries.push(entry);
            if (entry.isDirectory) hasDirectory = true;
          }
        }
      }

      // Fallback: grab plain files synchronously too (in case entries failed)
      if (entries.length === 0 && e.dataTransfer?.files) {
        for (let i = 0; i < e.dataTransfer.files.length; i++) {
          plainFiles.push(e.dataTransfer.files[i]);
        }
      }

      console.log(`[Upload] Drop: ${entries.length} entries (${hasDirectory ? "has dirs" : "files only"}), ${plainFiles.length} plain fallback files`);

      // ── Now process async (safe — we already have the handles) ────
      if (entries.length > 0) {
        if (hasDirectory) {
          const filesWithPaths = await processEntries(entries);
          if (filesWithPaths.length > 0) {
            await onDropWithFolders(filesWithPaths);
          } else {
            console.warn("[Upload] Folder traversal returned 0 files");
          }
        } else {
          // All entries are files, convert them
          const filesWithPaths = await processEntries(entries);
          await onDropFiles(filesWithPaths.map((f) => f.file));
        }
      } else if (plainFiles.length > 0) {
        await onDropFiles(plainFiles);
      }
    },
    [onDropWithFolders, onDropFiles]
  );

  // ── File input handlers ──────────────────────────────────────────────
  const mobileFileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const handleMobileFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        const hasRelativePaths = Array.from(files).some(
          (f) => (f as any).webkitRelativePath
        );
        if (hasRelativePaths) {
          const filesWithPaths = getFilesFromInputEvent(files);
          onDropWithFolders(filesWithPaths);
        } else {
          onDropFiles(Array.from(files));
        }
      }
      if (e.target) e.target.value = "";
    },
    [onDropFiles, onDropWithFolders]
  );

  const handleFolderSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        const filesWithPaths = getFilesFromInputEvent(files);
        onDropWithFolders(filesWithPaths);
      }
      if (e.target) e.target.value = "";
    },
    [onDropWithFolders]
  );

  // ── Expose pickers to global UI store ────────────────────────────────
  const { setOpenFilePicker, setUploadFiles, setOpenFolderPicker } = useUIStore();

  useEffect(() => {
    setOpenFilePicker(() => {
      mobileFileInputRef.current?.click();
    });
    return () => setOpenFilePicker(null);
  }, [setOpenFilePicker]);

  useEffect(() => {
    setOpenFolderPicker(() => {
      folderInputRef.current?.click();
    });
    return () => setOpenFolderPicker(null);
  }, [setOpenFolderPicker]);

  useEffect(() => {
    setUploadFiles((files: File[]) => {
      const hasRelativePaths = files.some((f) => (f as any).webkitRelativePath);
      if (hasRelativePaths) {
        const filesWithPaths = getFilesFromInputEvent(files as unknown as FileList);
        onDropWithFolders(filesWithPaths);
      } else {
        onDropFiles(files);
      }
    });
    return () => setUploadFiles(null);
  }, [onDropFiles, onDropWithFolders, setUploadFiles]);

  return (
    <div
      className="relative"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Hidden file input */}
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
      {/* Hidden folder input */}
      <input
        ref={folderInputRef}
        type="file"
        // @ts-expect-error webkitdirectory is not in React types
        webkitdirectory=""
        directory=""
        multiple
        onChange={handleFolderSelect}
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

      {/* ── Drag overlay ─────────────────────────────────────────────── */}
      {isDragOver && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center transition-all duration-200"
          style={{ backgroundColor: "rgba(59, 130, 246, 0.06)", backdropFilter: "blur(4px)" }}
        >
          {/* Animated border ring */}
          <div className="relative">
            {/* Outer glow pulse */}
            <div className="absolute -inset-4 rounded-3xl bg-blue-400/20 animate-pulse" />

            <div
              className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-blue-200 dark:border-blue-800 px-16 py-12 text-center max-w-md"
              style={{
                animation: "dropZoneEntry 0.2s ease-out",
              }}
            >
              {/* Icon container */}
              <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/40 dark:to-blue-800/30 ring-1 ring-blue-200/60 dark:ring-blue-700/40">
                {isDraggingFolder ? (
                  <FolderUp className="h-10 w-10 text-blue-600 dark:text-blue-400" strokeWidth={1.5} />
                ) : (
                  <CloudUpload className="h-10 w-10 text-blue-600 dark:text-blue-400" strokeWidth={1.5} />
                )}
              </div>

              {/* Heading */}
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {isDraggingFolder ? "Drop folder to upload" : "Drop to upload"}
              </h3>

              {/* Subtext */}
              <p className="mt-1.5 text-sm text-gray-500 dark:text-gray-400">
                {isDraggingFolder
                  ? "All files and subfolders will be preserved"
                  : "Release to start uploading your files"}
              </p>

              {/* Dashed border accent inside */}
              <div className="absolute inset-3 rounded-xl border-2 border-dashed border-blue-300/50 dark:border-blue-700/40 pointer-events-none" />
            </div>
          </div>
        </div>
      )}

      {children}

      {/* Keyframe animation */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes dropZoneEntry {
          from {
            opacity: 0;
            transform: scale(0.95) translateY(8px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
      `}} />
    </div>
  );
}
