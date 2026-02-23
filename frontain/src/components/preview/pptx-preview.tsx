"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  Loader2,
  AlertCircle,
  Download,
  RefreshCw,
  ExternalLink,
  Terminal,
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
   Helpers
   ═══════════════════════════════════════════════════════════════ */

function getPublicOrigin(): string {
  if (typeof window === "undefined") return "";
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    window.location.origin;
}

function isRunningOnLocalhost(): boolean {
  if (typeof window === "undefined") return false;
  const h = window.location.hostname;
  return h === "localhost" || h === "127.0.0.1" || h === "[::1]";
}

/* ═══════════════════════════════════════════════════════════════
   Main exported component
   ═══════════════════════════════════════════════════════════════ */

export function PptxPreview({ src, fileName, onDownload }: PptxPreviewProps) {
  const [publicOrigin, setPublicOrigin] = useState<string | null>(null);

  useEffect(() => { setPublicOrigin(getPublicOrigin()); }, []);

  if (publicOrigin === null) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[#1a1a1a]">
        <Loader2 className="h-8 w-8 text-white/30 animate-spin" />
      </div>
    );
  }

  if (isRunningOnLocalhost() && !process.env.NEXT_PUBLIC_APP_URL) {
    return <LocalhostSetupGuide fileName={fileName} onDownload={onDownload} />;
  }

  return (
    <IframeViewer
      fileUrl={publicOrigin + src}
      fileName={fileName}
      onDownload={onDownload}
    />
  );
}

/* ═══════════════════════════════════════════════════════════════
   Iframe viewer — full-view, auto-hiding switcher
   ═══════════════════════════════════════════════════════════════ */

function IframeViewer({
  fileUrl,
  fileName,
  onDownload,
}: {
  fileUrl: string;
  fileName: string;
  onDownload?: () => void;
}) {
  const [mode, setMode] = useState<ViewerMode>("office");
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [showSwitcher, setShowSwitcher] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout>>(null);

  // Office Online: wdAr=2 enables 16:9 widescreen, action=embedview for full embed
  const officeUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(fileUrl)}&wdAr=2`;
  const googleUrl = `https://docs.google.com/gview?url=${encodeURIComponent(fileUrl)}&embedded=true`;
  const viewerUrl = mode === "office" ? officeUrl : googleUrl;

  const currentViewer = mode === "office" ? "Microsoft Office Online" : "Google Docs Viewer";
  const otherViewer  = mode === "office" ? "Google Docs" : "Office Online";

  // Reset loading state on viewer/url change
  useEffect(() => {
    setLoading(true);
    setFailed(false);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => { setLoading(false); setFailed(true); }, 30_000);
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, [mode, fileUrl]);

  // Auto-hide switcher after 3s once loaded
  useEffect(() => {
    if (!loading && !failed) {
      hideTimerRef.current = setTimeout(() => setShowSwitcher(false), 3000);
    } else {
      setShowSwitcher(true);
    }
    return () => { if (hideTimerRef.current) clearTimeout(hideTimerRef.current); };
  }, [loading, failed]);

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
    timeoutRef.current = setTimeout(() => { setLoading(false); setFailed(true); }, 30_000);
  }, [viewerUrl]);

  const handleMouseMove = useCallback(() => {
    setShowSwitcher(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    if (!loading && !failed) {
      hideTimerRef.current = setTimeout(() => setShowSwitcher(false), 3000);
    }
  }, [loading, failed]);

  return (
    <div
      className="w-full h-full relative overflow-hidden bg-[#1a1a1a]"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => { if (!loading && !failed) setShowSwitcher(false); }}
    >
      {/* ── Floating viewer switcher — auto-hides ── */}
      <div
        className={`absolute top-2 right-2 z-30 flex items-center gap-0.5 rounded-lg bg-black/60 backdrop-blur-md p-0.5 shadow-xl transition-all duration-300 ${
          showSwitcher ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2 pointer-events-none"
        }`}
      >
        {(["office", "google"] as ViewerMode[]).map((v) => (
          <button
            key={v}
            onClick={() => setMode(v)}
            className={`px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all ${
              mode === v
                ? "bg-[#0078d4] text-white shadow-md"
                : "text-white/50 hover:text-white hover:bg-white/10"
            }`}
          >
            {v === "office" ? "Office" : "Google"}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && !failed && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-[#1a1a1a]">
          <Loader2 className="h-10 w-10 text-[#0078d4] animate-spin" />
          <p className="text-sm text-white/50">
            Loading <span className="text-white/70 font-medium">{currentViewer}</span>…
          </p>
        </div>
      )}

      {/* Error */}
      {failed && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#1a1a1a]">
          <div className="text-center max-w-md px-6">
            <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
            <p className="text-white font-semibold text-base mb-1">Preview failed</p>
            <p className="text-sm text-white/50 mb-6">
              {currentViewer} could not load this file. It may be too large or not publicly reachable.
            </p>
            <div className="flex items-center justify-center gap-3 flex-wrap">
              <button onClick={retry} className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 text-white/80 rounded-lg text-sm hover:bg-white/15 transition-colors">
                <RefreshCw className="h-4 w-4" /> Retry
              </button>
              <button onClick={() => setMode(mode === "office" ? "google" : "office")} className="inline-flex items-center gap-2 px-4 py-2 bg-[#0078d4]/80 text-white rounded-lg text-sm hover:bg-[#0078d4] transition-colors">
                <ExternalLink className="h-4 w-4" /> Try {otherViewer}
              </button>
              {onDownload && (
                <button onClick={onDownload} className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 text-white/80 rounded-lg text-sm hover:bg-white/15 transition-colors">
                  <Download className="h-4 w-4" /> Download
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Full-screen iframe — no wrappers, no padding, 100% of container */}
      <iframe
        ref={iframeRef}
        src={viewerUrl}
        onLoad={handleLoad}
        title={`PowerPoint: ${fileName}`}
        className="absolute inset-0 w-full h-full border-0"
        sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-popups-to-escape-sandbox"
        allowFullScreen
      />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Localhost setup guide — shown when NEXT_PUBLIC_APP_URL is not set
   ═══════════════════════════════════════════════════════════════ */

function LocalhostSetupGuide({
  fileName,
  onDownload,
}: {
  fileName: string;
  onDownload?: () => void;
}) {
  const isLegacy = fileName.toLowerCase().endsWith(".ppt") &&
    !fileName.toLowerCase().endsWith(".pptx");

  return (
    <div className="w-full h-full flex items-center justify-center bg-[#1a1a1a] p-6">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-[#0078d4]/20 flex items-center justify-center flex-shrink-0">
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none">
              <rect x="2" y="3" width="20" height="18" rx="2" fill="#0078d4" fillOpacity=".7"/>
              <path d="M7 8h10M7 12h8M7 16h6" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
          <div>
            <p className="text-white font-semibold text-sm">Microsoft Office Online Preview</p>
            <p className="text-white/40 text-xs">Requires a public URL to fetch your file</p>
          </div>
        </div>

        {isLegacy ? (
          <div className="rounded-xl bg-white/[0.04] border border-white/[0.08] p-5 mb-4">
            <p className="text-white/70 text-sm">
              Legacy <span className="font-mono text-white/90">.ppt</span> files (PowerPoint 97–2003)
              can be previewed via Office Online once the app is deployed.
              Convert to <span className="font-mono text-white/90">.pptx</span> for best results.
            </p>
          </div>
        ) : (
          <>
            {/* Step-by-step */}
            <div className="rounded-xl bg-white/[0.04] border border-white/[0.08] overflow-hidden mb-4">
              <div className="px-5 py-3 border-b border-white/[0.06]">
                <p className="text-white/60 text-xs font-medium uppercase tracking-wider">
                  Enable on localhost using ngrok
                </p>
              </div>
              <div className="divide-y divide-white/[0.05]">
                {[
                  {
                    n: "1",
                    label: "Install ngrok",
                    code: "winget install ngrok",
                  },
                  {
                    n: "2",
                    label: "Start a tunnel (while your app runs on :3000)",
                    code: "ngrok http 3000",
                  },
                  {
                    n: "3",
                    label: "Copy the https URL, add to .env.local, restart",
                    code: "NEXT_PUBLIC_APP_URL=https://xxxx.ngrok.io",
                  },
                ].map(({ n, label, code }) => (
                  <div key={n} className="flex gap-3 px-5 py-3.5">
                    <span className="w-5 h-5 rounded-full bg-[#0078d4]/30 text-[#0078d4] text-[11px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                      {n}
                    </span>
                    <div className="min-w-0">
                      <p className="text-white/60 text-xs mb-1.5">{label}</p>
                      <div className="flex items-center gap-2 bg-black/30 rounded-md px-3 py-1.5">
                        <Terminal className="h-3 w-3 text-white/30 flex-shrink-0" />
                        <code className="text-[11px] text-green-400 font-mono">{code}</code>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <p className="text-white/30 text-xs text-center mb-5">
              On production (Vercel / Railway) this works automatically — no env var needed.
            </p>
          </>
        )}

        {onDownload && (
          <div className="flex justify-center">
            <button
              onClick={onDownload}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#0078d4] text-white rounded-full text-sm font-medium hover:bg-[#106ebe] transition-colors"
            >
              <Download className="h-4 w-4" /> Download to view locally
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
