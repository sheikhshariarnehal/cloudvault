"use client";

import { CheckCircle2, CloudOff, Download, Loader2, X, Cloud, XCircle } from "lucide-react";
import { formatFileSize } from "@/types/file.types";
import type { DownloadItem } from "@/store/download-store";

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
  /** Multi-download mode: pass the full downloads map */
  downloads?: Map<string, DownloadItem>;
  onCancelItem?: (fileId: string) => void;
  onCancelAll?: () => void;
  onRetry?: (fileId: string) => void;
  /** Legacy single-download mode (share page) */
  state?: DownloadState | null;
  onCancel?: () => void;
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

function SingleDownloadRow({
  state,
  onCancel,
  onRetry,
  compact = false,
}: {
  state: DownloadState;
  onCancel?: () => void;
  onRetry?: () => void;
  compact?: boolean;
}) {
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
    <div className={compact ? "py-2 border-b border-white/5 last:border-b-0" : ""}>
      {/* Header row */}
      <div className="flex items-center gap-2 mb-1.5">
        {state.phase === "idle" && (
          <Loader2 className="h-3.5 w-3.5 shrink-0 text-white/30" />
        )}
        {state.phase === "starting" && (
          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-[#8ab4f8]" />
        )}
        {isFetching && (
          <Cloud className="h-3.5 w-3.5 shrink-0 text-amber-400" />
        )}
        {isDownloading && (
          <Download className="h-3.5 w-3.5 shrink-0 text-[#8ab4f8]" />
        )}
        {state.phase === "completed" && (
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
        )}
        {state.phase === "error" && (
          <CloudOff className="h-3.5 w-3.5 shrink-0 text-red-400" />
        )}
        <span className="truncate text-xs font-medium leading-tight flex-1">
          {state.fileName}
        </span>
        {state.phase === "error" && onRetry && (
          <button
            onClick={onRetry}
            className="shrink-0 text-[11px] text-[#8ab4f8] hover:text-white transition-colors"
          >
            Retry
          </button>
        )}
        {(isActive || state.phase === "idle") && onCancel && (
          <button
            onClick={onCancel}
            aria-label="Cancel download"
            className="shrink-0 text-white/40 hover:text-white transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Idle (queued) */}
      {state.phase === "idle" && (
        <p className="text-[11px] text-white/40">Queued...</p>
      )}

      {/* Starting */}
      {state.phase === "starting" && (
        <>
          <div className="h-1 bg-white/10 rounded-full overflow-hidden mb-1">
            <div className="h-full w-1/3 bg-[#8ab4f8] rounded-full animate-[slide_1.4s_ease-in-out_infinite]" />
          </div>
          <p className="text-[11px] text-white/50">Connecting to server...</p>
        </>
      )}

      {/* Fetching from Telegram */}
      {isFetching && (
        <>
          <div className="h-1 bg-white/10 rounded-full overflow-hidden mb-1">
            {progressPercent > 0 ? (
              <div
                className="h-full bg-amber-400 rounded-full transition-[width] duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            ) : (
              <div className="h-full w-1/3 bg-amber-400 rounded-full animate-[slide_1.4s_ease-in-out_infinite]" />
            )}
          </div>
          <div className="flex items-center justify-between text-[11px] text-white/60 gap-2">
            <span>
              {state.totalBytes > 0 && progressPercent > 0
                ? `Cloud: ${formatFileSize(state.receivedBytes)} / ${formatFileSize(state.totalBytes)} · ${progressPercent}%`
                : `Fetching from cloud${state.totalBytes > 0 ? ` · ${formatFileSize(state.totalBytes)}` : ""}...`}
            </span>
            <span className="shrink-0 tabular-nums">
              {state.speedBps > 0 ? `${formatFileSize(state.speedBps)}/s` : eta || ""}
            </span>
          </div>
        </>
      )}

      {/* Downloading */}
      {isDownloading && (
        <>
          <div className="h-1 bg-white/10 rounded-full overflow-hidden mb-1">
            <div
              className="h-full bg-[#8ab4f8] rounded-full transition-[width] duration-200"
              style={{ width: `${progressPercent || 1}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[11px] text-white/60 gap-2">
            <span>
              {state.totalBytes > 0
                ? `${formatFileSize(state.receivedBytes)} / ${formatFileSize(state.totalBytes)} · ${progressPercent}%`
                : `${formatFileSize(state.receivedBytes)} received`}
            </span>
            <span className="shrink-0 tabular-nums">
              {state.speedBps > 0 ? `${formatFileSize(state.speedBps)}/s` : ""}
            </span>
          </div>
          {eta && state.speedBps > 0 && (
            <p className="text-[10px] text-white/40 mt-0.5">{eta}</p>
          )}
        </>
      )}

      {state.phase === "completed" && (
        <p className="text-[11px] text-emerald-400">Saved to your device.</p>
      )}

      {state.phase === "error" && (
        <p className="text-[11px] text-red-400">
          {state.errorMessage || "Download failed."}
        </p>
      )}
    </div>
  );
}

export function DownloadSpeedometer({
  downloads,
  onCancelItem,
  onCancelAll,
  onRetry,
  state,
  onCancel,
}: DownloadSpeedometerProps) {
  // Legacy single-download mode
  if (!downloads && state) {
    return (
      <div className="fixed bottom-5 right-5 z-[120] bg-[#2b2c2f] text-white border border-white/10 rounded-xl px-4 py-3 shadow-2xl w-[min(92vw,400px)]">
        <SingleDownloadRow state={state} onCancel={onCancel} />
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

  // Multi-download mode
  if (!downloads || downloads.size === 0) return null;

  const items = Array.from(downloads.entries());
  const activeCount = items.filter(([, i]) => {
    const p = i.state.phase;
    return p === "starting" || p === "fetching" || p === "downloading" || p === "idle";
  }).length;

  return (
    <div className="fixed bottom-5 right-5 z-[120] bg-[#2b2c2f] text-white border border-white/10 rounded-xl shadow-2xl w-[min(92vw,400px)]">
      {/* Title bar when multiple items */}
      {items.length > 1 && (
        <div className="flex items-center justify-between px-4 pt-3 pb-1">
          <span className="text-xs font-medium text-white/70">
            {activeCount > 0 ? `${activeCount} download${activeCount > 1 ? "s" : ""} active` : "Downloads"}
          </span>
          {activeCount > 1 && onCancelAll && (
            <button
              onClick={onCancelAll}
              className="flex items-center gap-1 text-[11px] text-white/40 hover:text-red-400 transition-colors"
            >
              <XCircle className="h-3 w-3" />
              Cancel all
            </button>
          )}
        </div>
      )}

      {/* Download list */}
      <div className="px-4 py-2 max-h-[300px] overflow-y-auto">
        {items.map(([fileId, item]) => (
          <SingleDownloadRow
            key={fileId}
            state={item.state}
            compact={items.length > 1}
            onCancel={onCancelItem ? () => onCancelItem(fileId) : undefined}
            onRetry={onRetry ? () => onRetry(fileId) : undefined}
          />
        ))}
      </div>

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
