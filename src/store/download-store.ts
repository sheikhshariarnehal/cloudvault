import { create } from "zustand";
import type { DownloadState } from "@/components/share/download-speedometer";

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

interface DownloadStore {
  downloadState: DownloadState | null;
  _abortController: AbortController | null;
  _pollTimer: ReturnType<typeof setInterval> | null;
  startDownload: (fileId: string, fileName: string, fileSize?: number) => Promise<void>;
  cancelDownload: () => void;
}

export const useDownloadStore = create<DownloadStore>((set, get) => ({
  downloadState: null,
  _abortController: null,
  _pollTimer: null,

  cancelDownload: () => {
    const ctrl = get()._abortController;
    const poll = get()._pollTimer;
    if (ctrl) ctrl.abort();
    if (poll) clearInterval(poll);
    set({ _abortController: null, _pollTimer: null, downloadState: null });
  },

  startDownload: async (fileId: string, fileName: string, fileSize = 0) => {
    const hasFilePicker =
      typeof window !== "undefined" && "showSaveFilePicker" in window;

    set({
      downloadState: {
        phase: "starting",
        fileName,
        receivedBytes: 0,
        totalBytes: fileSize,
        speedBps: 0,
      },
    });

    const abortController = new AbortController();
    set({ _abortController: abortController });

    try {
      // ── Step 1: Open OS Save dialog (must be first async op to retain user gesture) ──
      let fileHandle: FileSystemFileHandle | null = null;
      if (hasFilePicker) {
        try {
          fileHandle = await (window as unknown as {
              showSaveFilePicker: (opts?: {
                suggestedName?: string;
              }) => Promise<FileSystemFileHandle>;
            }).showSaveFilePicker({ suggestedName: fileName });
        } catch (err) {
          if (err instanceof DOMException && err.name === "AbortError") {
            set({ downloadState: null, _abortController: null });
            return;
          }
          throw err;
        }
      }

      // ── Step 2: Get a short-lived signed URL from Next.js ──
      const sigRes = await fetch(`/api/signed-url/${fileId}?download=true`);
      if (!sigRes.ok) {
        throw new Error(`Could not generate download link (${sigRes.status})`);
      }
      const { url, statusUrl } = (await sigRes.json()) as SignedUrlResponse;

      // ── Step 3: Fallback — no File System Access API ──
      if (!fileHandle) {
        const a = document.createElement("a");
        a.href = url;
        a.rel = "noopener";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.setTimeout(() => set({ downloadState: null, _abortController: null }), 5000);
        return;
      }

      // ── Step 4: Start the file fetch (backend begins Telegram download) ──
      const writable = await fileHandle.createWritable();

      // ── Step 4a: Poll backend for Telegram download progress ──
      // When the backend is fetching from Telegram, no bytes flow to us yet.
      // Poll the status endpoint so we can show real progress instead of a blind spinner.
      let pollStopped = false;
      let backendSpeedBps = 0;
      let backendLastBytes = 0;
      let backendLastStamp = performance.now();

      const pollTimer = setInterval(async () => {
        if (pollStopped || abortController.signal.aborted) {
          clearInterval(pollTimer);
          return;
        }
        try {
          const res = await fetch(statusUrl, { signal: abortController.signal });
          if (!res.ok) return;
          const status = (await res.json()) as BackendStatus;

          // Calculate backend download speed
          const now = performance.now();
          const dtSec = (now - backendLastStamp) / 1000;
          if (dtSec >= 0.4 && status.downloaded_size > backendLastBytes) {
            backendSpeedBps = (status.downloaded_size - backendLastBytes) / dtSec;
            backendLastStamp = now;
            backendLastBytes = status.downloaded_size;
          }

          const total = status.size || fileSize;

          if (!pollStopped) {
            set({
              downloadState: {
                phase: "fetching",
                fileName,
                receivedBytes: status.downloaded_size,
                totalBytes: total,
                speedBps: backendSpeedBps,
              },
            });
          }
        } catch {
          // Ignore poll errors (e.g. abort, network glitch)
        }
      }, 800);
      set({ _pollTimer: pollTimer });

      // ── Step 4b: Fetch the file — this blocks until backend starts streaming ──
      const response = await fetch(url, { signal: abortController.signal });
      if (!response.ok || !response.body) {
        throw new Error(`Download failed with status ${response.status}`);
      }

      // Backend started sending bytes → stop polling
      pollStopped = true;
      clearInterval(pollTimer);
      set({ _pollTimer: null });

      const headerLength = Number(
        response.headers.get("content-length") || 0,
      );
      const totalBytes = headerLength > 0 ? headerLength : fileSize;

      set({
        downloadState: {
          phase: "downloading",
          fileName,
          receivedBytes: 0,
          totalBytes,
          speedBps: 0,
        },
      });

      // ── Step 5: Stream to disk with progress ──
      const reader = response.body.getReader();
      let receivedBytes = 0;
      let lastStamp = performance.now();
      let lastBytes = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!value) continue;

        await writable.write(value);
        receivedBytes += value.byteLength;

        const now = performance.now();
        const dtSec = (now - lastStamp) / 1000;
        let speedBps = 0;
        if (dtSec >= 0.2) {
          speedBps = (receivedBytes - lastBytes) / dtSec;
          lastStamp = now;
          lastBytes = receivedBytes;
        }

        set((s) => ({
          downloadState: {
            phase: "downloading",
            fileName,
            receivedBytes,
            totalBytes,
            speedBps: speedBps > 0 ? speedBps : (s.downloadState?.speedBps ?? 0),
          },
        }));
      }

      await writable.close();
      set({
        _abortController: null,
        _pollTimer: null,
        downloadState: {
          phase: "completed",
          fileName,
          receivedBytes,
          totalBytes,
          speedBps: 0,
        },
      });
      window.setTimeout(() => set({ downloadState: null }), 3500);
    } catch (err) {
      const poll = get()._pollTimer;
      if (poll) clearInterval(poll);
      set({ _abortController: null, _pollTimer: null });
      const aborted =
        err instanceof DOMException && err.name === "AbortError";
      if (aborted && !get().downloadState) return; // Already cleared by cancelDownload
      set({
        downloadState: {
          phase: "error",
          fileName,
          receivedBytes: 0,
          totalBytes: fileSize,
          speedBps: 0,
          errorMessage: aborted
            ? "Download canceled."
            : err instanceof Error
              ? err.message
              : "Download failed.",
        },
      });
      window.setTimeout(() => set({ downloadState: null }), 5000);
    }
  },
}));
