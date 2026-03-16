"use client";

import { CheckCircle2, CloudOff, Download, Loader2, X, Cloud } from "lucide-react";
import { formatFileSize } from "@/types/file.types";

export type DownloadPhase = "idle" | "starting" | "fetching" | "downloading" | "completed" | "error";

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

function formatEta(bytes: number, totalBytes: number, speedBps: number): string {
  if (speedBps <= 0 || totalBytes <= 0 || bytes >= totalBytes) return "";
  const remaining = totalBytes - bytes;
  const secs = Math.round(remaining / speedBps);
  if (secs < 5) return "a few seconds left";
  if (secs < 60) return `${secs}s left`;
  const mins = Math.floor(secs / 60);
  const remSecs = secs % 60;
  if (mins < 60) return remSecs > 0 ? `${mins}m ${remSecs}s left` : `${mins}m left`;
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  return remMins > 0 ? `${hrs}h ${remMins}m left` : `${hrs}h left`;
}

export function DownloadSpeedometer({ state, onCancel }: DownloadSpeedometerProps) {
  if (!state) return null;

  const isActive = state.phase === "starting" || state.phase === "fetching" || state.phase === "downloading";
  const isFetching = state.phase === "fetching";
  const isDownloading = state.phase === "downloading";

  const progressPercent =
    (isFetching || isDownloading) && state.totalBytes > 0
      ? Math.min(100, Math.round((state.receivedBytes / state.totalBytes) * 100))
      : 0;

  const eta = (isFetching || isDownloading)
    ? formatEta(state.receivedBytes, state.totalBytes, state.speedBps)
    : "";

  return (
    <div className="fixed bottom-5 right-5 z-[120] bg-[#2b2c2f] text-white border border-white/10 rounded-xl px-4 py-3 shadow-2xl w-[min(92vw,400px)]">
      {/* Header row */}
      <div className="flex items-center gap-2.5 mb-2.5">
        {state.phase === "starting" && (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[#8ab4f8]" />
        )}
        {isFetching && (
          <Cloud className="h-4 w-4 shrink-0 text-amber-400" />
        )}
        {isDownloading && (
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

      {/* Starting (before any progress is available) */}
      {state.phase === "starting" && (
        <>
          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden mb-2">
            <div className="h-full w-1/3 bg-[#8ab4f8] rounded-full animate-[slide_1.4s_ease-in-out_infinite]" />
          </div>
          <p className="text-xs text-white/50">
            Connecting to server...
          </p>
        </>
      )}

      {/* Fetching (backend downloading from Telegram — we show real progress) */}
      {isFetching && (
        <>
          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden mb-2">
            {progressPercent > 0 ? (
              <div
                className="h-full bg-amber-400 rounded-full transition-[width] duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            ) : (
              <div className="h-full w-1/3 bg-amber-400 rounded-full animate-[slide_1.4s_ease-in-out_infinite]" />
            )}
          </div>
          <div className="flex items-center justify-between text-xs text-white/60 gap-3">
            <span>
              {state.totalBytes > 0 && progressPercent > 0
                ? `Fetching from cloud: ${formatFileSize(state.receivedBytes)} / ${formatFileSize(state.totalBytes)} · ${progressPercent}%`
                : `Fetching from cloud${state.totalBytes > 0 ? ` · ${formatFileSize(state.totalBytes)}` : ""}...`}
            </span>
            <span className="shrink-0 tabular-nums">
              {state.speedBps > 0
                ? `${formatFileSize(state.speedBps)}/s`
                : eta || ""}
            </span>
          </div>
          {eta && state.speedBps > 0 && (
            <p className="text-[11px] text-white/40 mt-1">{eta}</p>
          )}
        </>
      )}

      {/* Downloading (bytes flowing to client) */}
      {isDownloading && (
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
          {eta && state.speedBps > 0 && (
            <p className="text-[11px] text-white/40 mt-1">{eta}</p>
          )}
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
