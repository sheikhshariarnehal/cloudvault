"use client";

import { CloudOff, Download, Loader2 } from "lucide-react";
import { formatFileSize } from "@/types/file.types";

export type DownloadPhase = "idle" | "starting" | "downloading" | "completed" | "error";

export interface DownloadState {
  phase: DownloadPhase;
  fileName: string;
  receivedBytes: number;
  totalBytes: number;
  speedBps: number;
  errorMessage?: string;
}

interface DownloadSpeedometerProps {
  state: DownloadState | null;
  onCancel: () => void;
}

export function DownloadSpeedometer({ state, onCancel }: DownloadSpeedometerProps) {
  if (!state) return null;

  const progressPercent =
    state.totalBytes > 0
      ? Math.min(100, Math.round((state.receivedBytes / state.totalBytes) * 100))
      : 0;

  return (
    <div className="fixed bottom-5 right-5 z-[120] bg-[#2b2c2f] text-white border border-white/10 rounded-lg px-4 py-3 shadow-2xl w-[min(92vw,420px)]">
      <div className="flex items-center gap-2 text-sm mb-2">
        {state.phase === "starting" && (
          <Loader2 className="h-4 w-4 animate-spin text-[#8ab4f8]" />
        )}
        {state.phase === "downloading" && (
          <Download className="h-4 w-4 text-[#8ab4f8]" />
        )}
        {state.phase === "completed" && (
          <Download className="h-4 w-4 text-emerald-400" />
        )}
        {state.phase === "error" && (
          <CloudOff className="h-4 w-4 text-red-400" />
        )}
        <span className="truncate font-medium">{state.fileName}</span>
      </div>

      {(state.phase === "starting" || state.phase === "downloading") && (
        <>
          <div className="h-2 bg-white/10 rounded-full overflow-hidden mb-2">
            <div
              className="h-full bg-[#8ab4f8] transition-all duration-200"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-xs text-white/70 gap-3">
            <span>
              {state.totalBytes > 0
                ? `${formatFileSize(state.receivedBytes)} / ${formatFileSize(state.totalBytes)} (${progressPercent}%)`
                : `${formatFileSize(state.receivedBytes)} downloaded`}
            </span>
            <span className="shrink-0">
              {state.speedBps > 0 ? `${formatFileSize(state.speedBps)}/s` : "Calculating speed..."}
            </span>
          </div>
          <div className="mt-2 flex justify-end">
            <button
              onClick={onCancel}
              className="text-xs px-2.5 py-1 rounded-md bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-colors"
            >
              Cancel
            </button>
          </div>
        </>
      )}

      {state.phase === "completed" && (
        <p className="text-xs text-emerald-300">Download completed.</p>
      )}

      {state.phase === "error" && (
        <p className="text-xs text-red-300">
          {state.errorMessage || "Download failed."}
        </p>
      )}
    </div>
  );
}
