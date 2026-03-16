"use client";

import { CheckCircle2, CloudOff, Download, Loader2, X } from "lucide-react";
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

  const isActive = state.phase === "starting" || state.phase === "downloading";
  const progressPercent =
    state.phase === "downloading" && state.totalBytes > 0
      ? Math.min(100, Math.round((state.receivedBytes / state.totalBytes) * 100))
      : 0;

  return (
    <div className="fixed bottom-5 right-5 z-[120] bg-[#2b2c2f] text-white border border-white/10 rounded-xl px-4 py-3 shadow-2xl w-[min(92vw,400px)]">
      {/* Header row */}
      <div className="flex items-center gap-2.5 mb-2.5">
        {state.phase === "starting" && (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[#8ab4f8]" />
        )}
        {state.phase === "downloading" && (
          <Download className="h-4 w-4 shrink-0 text-[#8ab4f8]" />
        )}
        {state.phase === "completed" && (
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
        )}
        {state.phase === "error" && (
          <CloudOff className="h-4 w-4 shrink-0 text-red-400" />
        )}
        <span className="truncate text-sm font-medium leading-tight flex-1">
          {state.fileName}
        </span>
        {isActive && (
          <button
            onClick={onCancel}
            aria-label="Cancel download"
            className="shrink-0 text-white/40 hover:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Starting (waiting for backend / Telegram download) */}
      {state.phase === "starting" && (
        <>
          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden mb-2">
            {/* Indeterminate sliding bar */}
            <div className="h-full w-1/3 bg-[#8ab4f8] rounded-full animate-[slide_1.4s_ease-in-out_infinite]" />
          </div>
          <p className="text-xs text-white/50">
            Preparing download — fetching from server...
          </p>
        </>
      )}

      {/* Downloading (bytes flowing in) */}
      {state.phase === "downloading" && (
        <>
          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden mb-2">
            <div
              className="h-full bg-[#8ab4f8] rounded-full transition-[width] duration-200"
              style={{ width: `${progressPercent || 1}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-xs text-white/60 gap-3">
            <span>
              {state.totalBytes > 0
                ? `${formatFileSize(state.receivedBytes)} / ${formatFileSize(state.totalBytes)} · ${progressPercent}%`
                : `${formatFileSize(state.receivedBytes)} received`}
            </span>
            <span className="shrink-0 tabular-nums">
              {state.speedBps > 0
                ? `${formatFileSize(state.speedBps)}/s`
                : "Calculating..."}
            </span>
          </div>
        </>
      )}

      {state.phase === "completed" && (
        <p className="text-xs text-emerald-400">Saved to your device.</p>
      )}

      {state.phase === "error" && (
        <p className="text-xs text-red-400">
          {state.errorMessage || "Download failed."}
        </p>
      )}

      <style>{`
        @keyframes slide {
          0%   { transform: translateX(-100%); }
          50%  { transform: translateX(250%); }
          100% { transform: translateX(250%); }
        }
      `}</style>
    </div>
  );
}
