import { create } from "zustand";
import type { DownloadState } from "@/components/share/download-speedometer";

interface DownloadStore {
  downloadState: DownloadState | null;
  _abortController: AbortController | null;
  startDownload: (fileId: string, fileName: string, fileSize?: number) => Promise<void>;
  cancelDownload: () => void;
}

export const useDownloadStore = create<DownloadStore>((set, get) => ({
  downloadState: null,
  _abortController: null,

  cancelDownload: () => {
    const ctrl = get()._abortController;
    if (ctrl) {
      ctrl.abort();
      set({ _abortController: null });
    }
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
          // User cancelled the picker — clean up
          if (err instanceof DOMException && err.name === "AbortError") {
            set({ downloadState: null });
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
      const { url } = (await sigRes.json()) as { url: string };

      // ── Step 3: Fallback — no File System Access API ──
      if (!fileHandle) {
        const a = document.createElement("a");
        a.href = url;
        a.rel = "noopener";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.setTimeout(() => set({ downloadState: null }), 5000);
        return;
      }

      // ── Step 4: Stream the file with real-time progress ──
      const writable = await fileHandle.createWritable();
      const abortController = new AbortController();
      set({ _abortController: abortController });

      const response = await fetch(url, { signal: abortController.signal });
      if (!response.ok || !response.body) {
        throw new Error(`Download failed with status ${response.status}`);
      }

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
      set({ _abortController: null });
      const aborted =
        err instanceof DOMException && err.name === "AbortError";
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
