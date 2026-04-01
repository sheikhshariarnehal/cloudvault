"use client";

export type DownloadPhase = "idle" | "starting" | "downloading" | "completed" | "error";

export interface DownloadState {
  phase: DownloadPhase;
  fileName: string;
  receivedBytes: number;
  totalBytes: number;
  speedBps: number;
  errorMessage?: string;
}

type Listener = (state: DownloadState | null) => void;

let currentState: DownloadState | null = null;
let abortController: AbortController | null = null;
const listeners = new Set<Listener>();

function emit(next: DownloadState | null) {
  currentState = next;
  for (const listener of listeners) {
    listener(currentState);
  }
}

export function subscribeDownloadState(listener: Listener) {
  listeners.add(listener);
  listener(currentState);
  return () => {
    listeners.delete(listener);
  };
}

export function getDownloadState() {
  return currentState;
}

export function cancelManagedDownload() {
  if (abortController) {
    abortController.abort();
    abortController = null;
  }
}

export async function startManagedDownload(url: string, fileName: string, fallbackSize = 0) {
  const pickerWindow = window as Window & {
    showSaveFilePicker?: (options?: { suggestedName?: string }) => Promise<{
      createWritable: () => Promise<{
        write: (chunk: Uint8Array) => Promise<void>;
        close: () => Promise<void>;
      }>;
    }>;
  };

  if (!pickerWindow.showSaveFilePicker) {
    emit({
      phase: "starting",
      fileName,
      receivedBytes: 0,
      totalBytes: fallbackSize,
      speedBps: 0,
      errorMessage: "Realtime progress is not supported in this browser.",
    });

    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.rel = "noopener";
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);

    window.setTimeout(() => emit(null), 5000);
    return;
  }

  try {
    emit({
      phase: "starting",
      fileName,
      receivedBytes: 0,
      totalBytes: fallbackSize,
      speedBps: 0,
    });

    abortController = new AbortController();

    const fileHandle = await pickerWindow.showSaveFilePicker({ suggestedName: fileName });
    const writable = await fileHandle.createWritable();

    const response = await fetch(url, { signal: abortController.signal });
    if (!response.ok || !response.body) {
      throw new Error(`Download failed with status ${response.status}`);
    }

    const headerLength = Number(response.headers.get("content-length") || 0);
    const totalBytes = headerLength > 0 ? headerLength : fallbackSize;
    const reader = response.body.getReader();

    let receivedBytes = 0;
    let lastStamp = performance.now();
    let lastBytes = 0;

    emit({
      phase: "downloading",
      fileName,
      receivedBytes,
      totalBytes,
      speedBps: 0,
    });

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;

      await writable.write(value);
      receivedBytes += value.byteLength;

      const now = performance.now();
      const dtSec = (now - lastStamp) / 1000;
      let speedBps = currentState?.speedBps || 0;
      if (dtSec >= 0.2) {
        speedBps = (receivedBytes - lastBytes) / dtSec;
        lastStamp = now;
        lastBytes = receivedBytes;
      }

      emit({
        phase: "downloading",
        fileName,
        receivedBytes,
        totalBytes,
        speedBps,
      });
    }

    await writable.close();
    abortController = null;

    emit({
      phase: "completed",
      fileName,
      receivedBytes,
      totalBytes,
      speedBps: currentState?.speedBps || 0,
    });

    window.setTimeout(() => emit(null), 3500);
  } catch (error) {
    abortController = null;
    const aborted = error instanceof DOMException && error.name === "AbortError";
    emit({
      phase: "error",
      fileName,
      receivedBytes: 0,
      totalBytes: fallbackSize,
      speedBps: 0,
      errorMessage: aborted
        ? "Download canceled."
        : error instanceof Error
        ? error.message
        : "Download failed",
    });
  }
}
