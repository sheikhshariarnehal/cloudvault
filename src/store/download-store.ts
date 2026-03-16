import { create } from "zustand";
import type { DownloadState } from "@/components/share/download-speedometer";

const MAX_CONCURRENT_DOWNLOADS = 3;
const BLOB_FALLBACK_MAX_BYTES = 500 * 1024 * 1024; // 500 MB
const EMA_ALPHA = 0.3;
const SPEED_SAMPLE_INTERVAL_MS = 500; // Only re-render on this cadence during streaming

interface SignedUrlResponse {
  url: string;
  statusUrl: string;
  telegramFileId: string;
  expiresIn: number;
}

interface BackendStatus {
  is_downloading: boolean;
  is_complete: boolean;
  downloaded_size: number;
  size: number;
}

export interface DownloadItem {
  id: string;
  fileName: string;
  fileSize: number;
  state: DownloadState;
  abortController: AbortController;
  pollTimer: ReturnType<typeof setInterval> | null;
  fileHandle: FileSystemFileHandle | null;
  writtenBytes: number;
  telegramFileId: string | null;
  signedUrl: string | null;
  statusUrl: string | null;
  clearTimer: ReturnType<typeof setTimeout> | null;
}

interface DownloadStore {
  downloads: Map<string, DownloadItem>;
  startDownload: (fileId: string, fileName: string, fileSize?: number) => Promise<void>;
  cancelDownload: (fileId: string) => void;
  cancelAll: () => void;
  retryDownload: (fileId: string) => Promise<void>;
}

function emaSpeed(current: number, sample: number): number {
  if (current <= 0) return sample;
  return EMA_ALPHA * sample + (1 - EMA_ALPHA) * current;
}

function friendlyError(err: unknown): string {
  if (err instanceof DOMException) {
    if (err.name === "AbortError") return "Download canceled.";
    if (err.name === "QuotaExceededError") return "Not enough disk space.";
    if (err.name === "NotAllowedError") return "File access denied by browser.";
  }
  if (err instanceof TypeError && err.message.includes("fetch")) {
    return "Network connection lost.";
  }
  if (err instanceof Error) {
    if (err.message.includes("404")) return "File no longer available.";
    if (err.message.includes("500")) return "Server error — please try again.";
    return err.message;
  }
  return "Download failed.";
}

function getActiveCount(downloads: Map<string, DownloadItem>): number {
  let count = 0;
  for (const item of downloads.values()) {
    const p = item.state.phase;
    if (p === "starting" || p === "fetching" || p === "downloading") count++;
  }
  return count;
}

export const useDownloadStore = create<DownloadStore>((set, get) => {
  function updateItem(fileId: string, patch: Partial<DownloadItem>) {
    set((s) => {
      const item = s.downloads.get(fileId);
      if (!item) return s;
      const updated = new Map(s.downloads);
      updated.set(fileId, { ...item, ...patch });
      return { downloads: updated };
    });
  }

  function updateItemState(fileId: string, state: DownloadState) {
    updateItem(fileId, { state });
  }

  function removeItem(fileId: string) {
    set((s) => {
      const updated = new Map(s.downloads);
      updated.delete(fileId);
      return { downloads: updated };
    });
  }

  function promoteNext() {
    const { downloads } = get();
    if (getActiveCount(downloads) >= MAX_CONCURRENT_DOWNLOADS) return;
    for (const [fileId, item] of downloads) {
      if (item.state.phase === "idle") {
        executeDownload(fileId, item.fileName, item.fileSize, null, 0);
        break;
      }
    }
  }

  function cleanupItem(fileId: string, delayMs: number) {
    const timer = setTimeout(() => {
      removeItem(fileId);
      promoteNext();
    }, delayMs);
    updateItem(fileId, { clearTimer: timer });
  }

  // Best-effort: tell the backend to stop the TDLib download
  function cancelBackend(telegramFileId: string | null) {
    if (!telegramFileId) return;
    fetch(`/api/download/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ telegramFileId }),
    }).catch(() => {});
  }

  /**
   * Shared backend-polling loop used by both executeDownload and blobDownload.
   * Polls statusUrl every 800ms and updates the item's state with fetching progress.
   * Returns a `stop()` function to cleanly halt the interval.
   */
  function startBackendPoll(
    fileId: string,
    fileName: string,
    fileSize: number,
    statusUrl: string,
    abortController: AbortController,
  ): { stop: () => void } {
    let stopped = false;
    let smoothedSpeed = 0;
    let lastBytes = 0;
    let lastStamp = performance.now();

    const timer = setInterval(async () => {
      if (stopped || abortController.signal.aborted) {
        clearInterval(timer);
        return;
      }
      try {
        const res = await fetch(statusUrl, { signal: abortController.signal });
        if (!res.ok) return;
        const status = (await res.json()) as BackendStatus;

        const now = performance.now();
        const dtSec = (now - lastStamp) / 1000;
        if (dtSec >= 0.4 && status.downloaded_size > lastBytes) {
          const rawSpeed = (status.downloaded_size - lastBytes) / dtSec;
          smoothedSpeed = emaSpeed(smoothedSpeed, rawSpeed);
          lastStamp = now;
          lastBytes = status.downloaded_size;
        }

        if (!stopped) {
          updateItemState(fileId, {
            phase: "fetching",
            fileName,
            receivedBytes: status.downloaded_size,
            totalBytes: status.size || fileSize,
            speedBps: smoothedSpeed,
          });
        }
      } catch { /* ignore transient poll errors */ }
    }, 800);

    updateItem(fileId, { pollTimer: timer });

    return {
      stop: () => {
        stopped = true;
        clearInterval(timer);
        updateItem(fileId, { pollTimer: null });
      },
    };
  }

  async function executeDownload(
    fileId: string,
    fileName: string,
    fileSize: number,
    existingHandle: FileSystemFileHandle | null,
    resumeOffset: number,
  ) {
    const hasFilePicker =
      typeof window !== "undefined" && "showSaveFilePicker" in window;

    const abortController = new AbortController();
    updateItem(fileId, {
      abortController,
      state: { phase: "starting", fileName, receivedBytes: resumeOffset, totalBytes: fileSize, speedBps: 0 },
    });

    try {
      // ── Step 1: Open OS Save dialog (must be first async op to retain user gesture) ──
      let fileHandle = existingHandle;
      if (!fileHandle && hasFilePicker) {
        try {
          fileHandle = await (window as unknown as {
            showSaveFilePicker: (opts?: { suggestedName?: string }) => Promise<FileSystemFileHandle>;
          }).showSaveFilePicker({ suggestedName: fileName });
        } catch (err) {
          if (err instanceof DOMException && err.name === "AbortError") {
            removeItem(fileId);
            promoteNext();
            return;
          }
          throw err;
        }
      }
      updateItem(fileId, { fileHandle });

      // ── Step 2: Get a short-lived signed URL ──
      const sigRes = await fetch(`/api/signed-url/${fileId}?download=true`, {
        signal: abortController.signal,
      });
      if (!sigRes.ok) throw new Error(`Could not generate download link (${sigRes.status})`);
      const { url, statusUrl, telegramFileId } = (await sigRes.json()) as SignedUrlResponse;
      updateItem(fileId, { signedUrl: url, statusUrl, telegramFileId });

      // ── Step 3: Fallback — no File System Access API ──
      if (!fileHandle) {
        if (fileSize > BLOB_FALLBACK_MAX_BYTES) {
          // Too large for in-memory blob — blind <a> click
          const a = document.createElement("a");
          a.href = url;
          a.rel = "noopener";
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          updateItemState(fileId, { phase: "downloading", fileName, receivedBytes: 0, totalBytes: fileSize, speedBps: 0 });
          cleanupItem(fileId, 5000);
          return;
        }
        await blobDownload(fileId, fileName, fileSize, url, abortController, statusUrl);
        return;
      }

      // ── Step 4: Stream to disk via File System Access API ──
      const writable = await fileHandle.createWritable({ keepExistingData: resumeOffset > 0 });
      if (resumeOffset > 0) await writable.seek(resumeOffset);

      // Poll backend for Telegram-side progress while waiting for first bytes
      const poll = startBackendPoll(fileId, fileName, fileSize, statusUrl, abortController);

      // Fetch file — add Range header for resume
      const fetchHeaders: Record<string, string> = resumeOffset > 0
        ? { Range: `bytes=${resumeOffset}-` }
        : {};

      const response = await fetch(url, { signal: abortController.signal, headers: fetchHeaders });
      if (!response.ok || !response.body) {
        throw new Error(`Download failed with status ${response.status}`);
      }

      poll.stop();

      const headerLength = Number(response.headers.get("content-length") || 0);
      const totalBytes = headerLength > 0 ? headerLength + resumeOffset : fileSize;

      updateItemState(fileId, { phase: "downloading", fileName, receivedBytes: resumeOffset, totalBytes, speedBps: 0 });

      // ── Step 5: Stream to disk with throttled progress updates ──
      const reader = response.body.getReader();
      let receivedBytes = resumeOffset;
      let smoothedStreamSpeed = 0;
      let lastStamp = performance.now();
      let lastBytes = resumeOffset;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!value) continue;

        await writable.write(value);
        receivedBytes += value.byteLength;

        // Only update store (triggers re-render) at the speed-sample cadence
        const now = performance.now();
        const dtSec = (now - lastStamp) / 1000;
        if (dtSec >= SPEED_SAMPLE_INTERVAL_MS / 1000) {
          const rawSpeed = (receivedBytes - lastBytes) / dtSec;
          smoothedStreamSpeed = emaSpeed(smoothedStreamSpeed, rawSpeed);
          lastStamp = now;
          lastBytes = receivedBytes;

          updateItem(fileId, {
            writtenBytes: receivedBytes,
            state: { phase: "downloading", fileName, receivedBytes, totalBytes, speedBps: smoothedStreamSpeed },
          });
        }
      }

      await writable.close();
      updateItem(fileId, {
        pollTimer: null,
        writtenBytes: receivedBytes,
        state: { phase: "completed", fileName, receivedBytes, totalBytes, speedBps: 0 },
      });
      cleanupItem(fileId, 3500);

    } catch (err) {
      const item = get().downloads.get(fileId);
      if (item?.pollTimer) clearInterval(item.pollTimer);

      const aborted = err instanceof DOMException && err.name === "AbortError";
      if (aborted && !get().downloads.has(fileId)) return;

      cancelBackend(item?.telegramFileId ?? null);

      updateItem(fileId, {
        pollTimer: null,
        state: {
          phase: "error",
          fileName,
          receivedBytes: item?.writtenBytes ?? 0,
          totalBytes: fileSize,
          speedBps: 0,
          errorMessage: friendlyError(err),
        },
      });
      cleanupItem(fileId, 5000);
    }
  }

  async function blobDownload(
    fileId: string,
    fileName: string,
    fileSize: number,
    url: string,
    abortController: AbortController,
    statusUrl: string,
  ) {
    const poll = startBackendPoll(fileId, fileName, fileSize, statusUrl, abortController);

    try {
      const response = await fetch(url, { signal: abortController.signal });
      if (!response.ok || !response.body) {
        throw new Error(`Download failed with status ${response.status}`);
      }

      poll.stop();

      const headerLength = Number(response.headers.get("content-length") || 0);
      const totalBytes = headerLength > 0 ? headerLength : fileSize;

      updateItemState(fileId, { phase: "downloading", fileName, receivedBytes: 0, totalBytes, speedBps: 0 });

      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let receivedBytes = 0;
      let smoothedSpeed = 0;
      let lastStamp = performance.now();
      let lastBytes = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!value) continue;

        chunks.push(value);
        receivedBytes += value.byteLength;

        const now = performance.now();
        const dtSec = (now - lastStamp) / 1000;
        if (dtSec >= SPEED_SAMPLE_INTERVAL_MS / 1000) {
          const rawSpeed = (receivedBytes - lastBytes) / dtSec;
          smoothedSpeed = emaSpeed(smoothedSpeed, rawSpeed);
          lastStamp = now;
          lastBytes = receivedBytes;
          updateItemState(fileId, { phase: "downloading", fileName, receivedBytes, totalBytes, speedBps: smoothedSpeed });
        }
      }

      const contentType = response.headers.get("content-type") || "application/octet-stream";
      const blob = new Blob(chunks, { type: contentType });
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);

      updateItemState(fileId, { phase: "completed", fileName, receivedBytes, totalBytes, speedBps: 0 });
      cleanupItem(fileId, 3500);

    } catch (err) {
      poll.stop();
      const item = get().downloads.get(fileId);

      const aborted = err instanceof DOMException && err.name === "AbortError";
      if (aborted && !get().downloads.has(fileId)) return;

      cancelBackend(item?.telegramFileId ?? null);

      updateItem(fileId, {
        pollTimer: null,
        state: {
          phase: "error",
          fileName,
          receivedBytes: item?.writtenBytes ?? 0,
          totalBytes: fileSize,
          speedBps: 0,
          errorMessage: friendlyError(err),
        },
      });
      cleanupItem(fileId, 5000);
    }
  }

  return {
    downloads: new Map(),

    startDownload: async (fileId: string, fileName: string, fileSize = 0) => {
      const existing = get().downloads.get(fileId);
      if (existing) {
        const p = existing.state.phase;
        if (p === "starting" || p === "fetching" || p === "downloading") return;
        if (existing.clearTimer) clearTimeout(existing.clearTimer);
        removeItem(fileId);
      }

      const item: DownloadItem = {
        id: fileId,
        fileName,
        fileSize,
        state: { phase: "idle", fileName, receivedBytes: 0, totalBytes: fileSize, speedBps: 0 },
        abortController: new AbortController(),
        pollTimer: null,
        fileHandle: null,
        writtenBytes: 0,
        telegramFileId: null,
        signedUrl: null,
        statusUrl: null,
        clearTimer: null,
      };

      set((s) => {
        const updated = new Map(s.downloads);
        updated.set(fileId, item);
        return { downloads: updated };
      });

      if (getActiveCount(get().downloads) < MAX_CONCURRENT_DOWNLOADS) {
        executeDownload(fileId, fileName, fileSize, null, 0);
      }
    },

    cancelDownload: (fileId: string) => {
      const item = get().downloads.get(fileId);
      if (!item) return;
      item.abortController.abort();
      if (item.pollTimer) clearInterval(item.pollTimer);
      if (item.clearTimer) clearTimeout(item.clearTimer);
      cancelBackend(item.telegramFileId);
      removeItem(fileId);
      promoteNext();
    },

    cancelAll: () => {
      for (const item of get().downloads.values()) {
        item.abortController.abort();
        if (item.pollTimer) clearInterval(item.pollTimer);
        if (item.clearTimer) clearTimeout(item.clearTimer);
        cancelBackend(item.telegramFileId);
      }
      set({ downloads: new Map() });
    },

    retryDownload: async (fileId: string) => {
      const item = get().downloads.get(fileId);
      if (!item) return;
      if (item.clearTimer) clearTimeout(item.clearTimer);
      executeDownload(fileId, item.fileName, item.fileSize, item.fileHandle, item.writtenBytes);
    },
  };
});
