"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  Loader2,
  AlertCircle,
  Download,
  RefreshCw,
  ExternalLink,
} from "lucide-react";

/* ═══════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════ */

interface PptxPreviewProps {
  src: string;
  fileName: string;
  onDownload?: () => void;
}

type ViewerMode = "office" | "google";

/* ═══════════════════════════════════════════════════════════════
   Main exported component
   Uses Microsoft Office Online → Google Docs Viewer as fallback.
   On localhost, shows download prompt (external viewers need a
   publicly-reachable URL).
   ═══════════════════════════════════════════════════════════════ */

export function PptxPreview({ src, fileName, onDownload }: PptxPreviewProps) {
  const isLocalhost =
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1" ||
      window.location.hostname === "[::1]");

  if (isLocalhost) {
    return <LocalhostFallback fileName={fileName} onDownload={onDownload} />;
  }

  return (
    <IframeViewer src={src} fileName={fileName} onDownload={onDownload} />
  );
}

/* ═══════════════════════════════════════════════════════════════
   Iframe viewer — Office Online + Google Docs
   ═══════════════════════════════════════════════════════════════ */

function IframeViewer({
  src,
  fileName,
  onDownload,
}: PptxPreviewProps) {
  const [mode, setMode] = useState<ViewerMode>("office");
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(null);

  const origin =
    typeof window !== "undefined" ? window.location.origin : "";
  const fileUrl = origin + src;

  const officeUrl = `https://view.officeapps.live.com/op/embed.ashx?src=${encodeURIComponent(fileUrl)}`;
  const googleUrl = `https://docs.google.com/gview?url=${encodeURIComponent(fileUrl)}&embedded=true`;
  const viewerUrl = mode === "office" ? officeUrl : googleUrl;

  /* Reset state when mode or src changes */
  useEffect(() => {
    setLoading(true);
    setFailed(false);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setLoading(false);
      setFailed(true);
    }, 20_000);
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [mode, src]);

  const handleLoad = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setLoading(false);
    setFailed(false);
  }, []);

  const retry = useCallback(() => {
    setLoading(true);
    setFailed(false);
    if (iframeRef.current) {
      const u = new URL(viewerUrl);
      u.searchParams.set("_t", Date.now().toString());
      iframeRef.current.src = u.toString();
    }
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setLoading(false);
      setFailed(true);
    }, 20_000);
  }, [viewerUrl]);

  const switchViewer = useCallback(() => {
    setMode((m) => (m === "office" ? "google" : "office"));
  }, []);

  const otherViewer = mode === "office" ? "Google Docs" : "Office Online";
  const currentViewer =
    mode === "office" ? "Microsoft Office Online" : "Google Docs Viewer";

  return (
    <div className="w-full h-full flex flex-col overflow-hidden bg-[#1a1a1a]">
      {/* Iframe area */}
      <div className="flex-1 relative">
        {/* Loading overlay */}
        {loading && !failed && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#1a1a1a]">
            <div className="text-center">
              <Loader2 className="h-10 w-10 text-white/40 animate-spin mx-auto mb-3" />
              <p className="text-sm text-white/50">
                Loading via {currentViewer}…
              </p>
            </div>
          </div>
        )}

        {/* Error overlay */}
        {failed && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#1a1a1a]">
            <div className="text-center max-w-md px-6">
              <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-3" />
              <p className="text-white font-medium mb-2">
                {currentViewer} didn&apos;t respond
              </p>
              <p className="text-sm text-white/50 mb-5">
                The viewer may be unavailable or the file URL may not be
                publicly reachable.
              </p>
              <div className="flex items-center justify-center gap-3 flex-wrap">
                <button
                  onClick={retry}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 text-white/80 rounded-lg text-sm hover:bg-white/15 transition-colors"
                >
                  <RefreshCw className="h-4 w-4" /> Retry
                </button>
                <button
                  onClick={switchViewer}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 text-white/80 rounded-lg text-sm hover:bg-white/15 transition-colors"
                >
                  Try {otherViewer}
                </button>
                {onDownload && (
                  <button
                    onClick={onDownload}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-[#8ab4f8] text-[#202124] rounded-lg text-sm font-medium hover:bg-[#aecbfa] transition-colors"
                  >
                    <Download className="h-4 w-4" /> Download
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        <iframe
          ref={iframeRef}
          src={viewerUrl}
          onLoad={handleLoad}
          title={`PowerPoint: ${fileName}`}
          className="w-full h-full border-0"
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
          allowFullScreen
        />
      </div>

      {/* Bottom bar */}
      <div className="flex items-center justify-between h-10 px-4 bg-[#252526] border-t border-white/[0.08] flex-shrink-0">
        <span className="text-xs text-white/50 truncate max-w-[200px]">
          {fileName}
        </span>
        <span className="text-[11px] text-white/30">
          Powered by {currentViewer}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={switchViewer}
            className="px-2.5 py-1 text-[11px] text-white/40 hover:text-white/60 rounded transition-colors"
          >
            Switch to {otherViewer}
          </button>
          {onDownload && (
            <button
              onClick={onDownload}
              className="px-2.5 py-1 text-[11px] text-white/40 hover:text-white/60 rounded transition-colors"
            >
              Download
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Localhost fallback — external viewers can't reach localhost,
   so we show a friendly message + download button.
   ═══════════════════════════════════════════════════════════════ */

function LocalhostFallback({
  fileName,
  onDownload,
}: {
  fileName: string;
  onDownload?: () => void;
}) {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  const isLegacy = ext === "ppt";

  return (
    <div className="w-full h-full flex items-center justify-center bg-[#1a1a1a]">
      <div className="text-center max-w-lg px-6">
        {/* Icon */}
        <div className="w-20 h-20 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-orange-500/20 to-red-500/20 flex items-center justify-center">
          <svg
            viewBox="0 0 48 48"
            className="w-10 h-10"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <rect
              x="6"
              y="10"
              width="36"
              height="28"
              rx="3"
              fill="#D35230"
              fillOpacity="0.8"
            />
            <path
              d="M16 20h16M16 26h12M16 32h8"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </div>

        <h2 className="text-white font-semibold text-lg mb-2">
          PowerPoint Preview
        </h2>
        <p className="text-sm text-white/50 mb-1">
          {isLegacy ? (
            <>
              Legacy <span className="font-mono text-white/60">.ppt</span>{" "}
              files are not supported for preview. Please convert to{" "}
              <span className="font-mono text-white/60">.pptx</span> or
              download.
            </>
          ) : (
            <>
              PowerPoint preview uses{" "}
              <span className="text-white/70">Microsoft Office Online</span>{" "}
              and requires the app to be deployed to a public URL.
            </>
          )}
        </p>
        <p className="text-xs text-white/30 mb-6">
          On <span className="font-mono">localhost</span>, external viewers
          cannot access your files.
        </p>

        <div className="flex items-center justify-center gap-3 flex-wrap">
          {onDownload && (
            <button
              onClick={onDownload}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#8ab4f8] text-[#202124] rounded-full text-sm font-medium hover:bg-[#aecbfa] transition-colors"
            >
              <Download className="h-4 w-4" /> Download File
            </button>
          )}
          {!isLegacy && (
            <a
              href="https://www.microsoft.com/en-us/microsoft-365/free-office-online-for-the-web"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-white/10 text-white/70 rounded-full text-sm hover:bg-white/15 transition-colors"
            >
              <ExternalLink className="h-4 w-4" /> Open in Office Online
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
