"use client";

import { useState, useMemo, useCallback } from "react";
import { useFilesStore } from "@/store/files-store";
import { X, ChevronDown, ChevronUp, Check, AlertCircle, Share2 } from "lucide-react";

/* ── helpers ─────────────────────────────────────────────────────── */

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 bytes";
  const units = ["bytes", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, i);
  return `${i === 0 ? value : value.toFixed(value < 10 ? 1 : 0)} ${units[i]}`;
}

/** Circular indeterminate spinner – pure SVG, no extra deps */
function Spinner({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`animate-spin ${className}`}
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
    >
      <circle
        cx="10"
        cy="10"
        r="8"
        stroke="#e5e7eb"
        strokeWidth="2.5"
      />
      <path
        d="M10 2a8 8 0 0 1 8 8"
        stroke="#6b7280"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

/* ── component ───────────────────────────────────────────────────── */

export function UploadProgress() {
  const {
    uploadQueue,
    clearUploadQueue,
    cancelAllUploads,
  } = useFilesStore();

  const [collapsed, setCollapsed] = useState(false);

  /* derived state */
  const successCount = useMemo(
    () => uploadQueue.filter((i) => i.status === "success").length,
    [uploadQueue],
  );
  const activeCount = useMemo(
    () => uploadQueue.filter((i) => i.status === "uploading" || i.status === "pending").length,
    [uploadQueue],
  );
  const errorCount = useMemo(
    () => uploadQueue.filter((i) => i.status === "error").length,
    [uploadQueue],
  );
  const allDone = activeCount === 0 && uploadQueue.length > 0;
  const totalCount = uploadQueue.length;

  /* overall progress (byte-weighted) */
  const overallPercent = useMemo(() => {
    let totalBytes = 0;
    let loadedBytes = 0;
    for (const item of uploadQueue) {
      totalBytes += item.bytesTotal || item.file.size;
      if (item.status === "success") {
        loadedBytes += item.bytesTotal || item.file.size;
      } else {
        loadedBytes += item.bytesLoaded || 0;
      }
    }
    return totalBytes > 0 ? Math.round((loadedBytes / totalBytes) * 100) : 0;
  }, [uploadQueue]);

  const handleShare = useCallback((fileName: string) => {
    // TODO: hook into share modal / link
    console.log("Share:", fileName);
  }, []);

  if (uploadQueue.length === 0) return null;

  const barColor = allDone ? "bg-emerald-500" : "bg-teal-500";
  const headerColor = allDone ? "text-gray-900" : "text-teal-600";

  return (
    <div className="fixed bottom-4 right-4 left-4 sm:left-auto z-50 w-auto sm:w-[420px] bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden pb-[env(safe-area-inset-bottom)]">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="px-4 pt-3.5 pb-2">
        <div className="flex items-start justify-between">
          <div className="min-w-0">
            <h3 className={`text-[15px] font-semibold leading-tight ${headerColor}`}>
              {allDone ? "Done" : "In progress"}
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {allDone
                ? `${successCount} of ${totalCount} transfers completed`
                : `${overallPercent}% completed`}
            </p>
          </div>

          <div className="flex items-center gap-1 -mt-0.5">
            {!allDone && activeCount > 0 && (
              <button
                onClick={cancelAllUploads}
                className="text-xs font-medium text-gray-700 border border-gray-300 rounded-md px-3 py-1 hover:bg-gray-50 transition-colors"
              >
                Cancel all
              </button>
            )}
            <button
              onClick={() => setCollapsed((c) => !c)}
              className="p-1.5 rounded-md hover:bg-gray-100 transition-colors text-gray-500"
            >
              {collapsed ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>
            {allDone && (
              <button
                onClick={clearUploadQueue}
                className="p-1.5 rounded-md hover:bg-gray-100 transition-colors text-gray-500"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* ── Overall progress bar ───────────────────────────── */}
        <div className="mt-2.5 h-1.5 w-full rounded-full bg-gray-200 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ease-out ${barColor}`}
            style={{ width: `${overallPercent}%` }}
          />
        </div>
      </div>

      {/* ── File list (collapsible) ──────────────────────────── */}
      {!collapsed && (
        <div className="max-h-72 overflow-y-auto border-t border-gray-100 mt-1">
          {uploadQueue.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-b-0"
            >
              {/* Status icon */}
              <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
                {item.status === "success" && (
                  <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
                    <Check className="h-3 w-3 text-white" strokeWidth={3} />
                  </div>
                )}
                {item.status === "error" && (
                  <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center">
                    <AlertCircle className="h-3 w-3 text-white" strokeWidth={3} />
                  </div>
                )}
                {(item.status === "uploading" || item.status === "pending") && (
                  <Spinner />
                )}
              </div>

              {/* File info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate leading-tight">
                  {item.file.name}
                </p>
                <p className="text-xs text-gray-500 mt-0.5 leading-tight">
                  {item.status === "success" && "Uploaded"}
                  {item.status === "error" && (
                    <span className="text-red-500">{item.error || "Upload failed"}</span>
                  )}
                  {item.status === "uploading" && (
                    <>Uploading &middot; {formatBytes(item.bytesLoaded)} / {formatBytes(item.bytesTotal)}</>
                  )}
                  {item.status === "pending" && (
                    <>Waiting &middot; 0 bytes / {formatBytes(item.bytesTotal || item.file.size)}</>
                  )}
                </p>
              </div>

              {/* Action */}
              <div className="flex-shrink-0">
                {item.status === "success" && (
                  <button
                    onClick={() => handleShare(item.file.name)}
                    className="text-sm font-medium text-gray-600 border border-gray-200 rounded-lg px-4 py-1.5 hover:bg-gray-50 transition-colors"
                  >
                    Share
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
