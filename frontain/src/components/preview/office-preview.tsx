"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { FileSpreadsheet, FileText, Loader2, AlertCircle, Download } from "lucide-react";

interface OfficePreviewProps {
  /** Relative file URL, e.g. /file/{token}/{name} */
  src: string;
  fileName: string;
  onDownload?: () => void;
}

/**
 * Client-side preview for Office documents:
 *  - Word (.doc/.docx) → rendered via docx-preview
 *  - Excel (.xls/.xlsx) → parsed via SheetJS, rendered as HTML table
 *
 * No external server required — everything runs in the browser.
 */
export function OfficePreview({ src, fileName, onDownload }: OfficePreviewProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [excelHtml, setExcelHtml] = useState<string | null>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [activeSheet, setActiveSheet] = useState<string>("");
  const [rendered, setRendered] = useState(false);
  // Store the fetched ArrayBuffer so we can retry rendering after mount
  const bufferRef = useRef<ArrayBuffer | null>(null);
  // Store the workbook for sheet switching
  const workbookRef = useRef<unknown>(null);

  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  const isSpreadsheet = ["xls", "xlsx"].includes(ext);
  const isWord = ["doc", "docx"].includes(ext);

  // Word rendering function - needs the container to be mounted
  const renderWordDoc = useCallback(async (arrayBuffer: ArrayBuffer) => {
    if (!containerRef.current) return false;
    try {
      const docxPreview = await import("docx-preview");
      containerRef.current.innerHTML = "";
      await docxPreview.renderAsync(arrayBuffer, containerRef.current, undefined, {
        className: "docx-preview-wrapper",
        inWrapper: true,
        ignoreWidth: false,
        ignoreHeight: false,
        ignoreFonts: false,
        breakPages: true,
        ignoreLastRenderedPageBreak: true,
        experimental: false,
      });
      return true;
    } catch (err) {
      console.error("[OfficePreview] renderAsync error:", err);
      throw err;
    }
  }, []);

  // Main effect: fetch file and render
  useEffect(() => {
    let cancelled = false;

    async function fetchAndRender() {
      try {
        setLoading(true);
        setError(null);
        setExcelHtml(null);
        setRendered(false);

        // Fetch the file as ArrayBuffer
        const res = await fetch(src);
        if (!res.ok) throw new Error(`Failed to fetch file (HTTP ${res.status})`);
        const arrayBuffer = await res.arrayBuffer();

        if (cancelled) return;

        bufferRef.current = arrayBuffer;

        if (isWord) {
          // Try rendering now — container may already be mounted
          const success = await renderWordDoc(arrayBuffer);
          if (!cancelled) {
            if (success) {
              setRendered(true);
            }
            // If container wasn't ready, the retry effect below will handle it
          }
        } else if (isSpreadsheet) {
          // --- Excel spreadsheet rendering ---
          const XLSX = await import("xlsx");
          const workbook = XLSX.read(arrayBuffer, { type: "array" });
          workbookRef.current = workbook;

          if (cancelled) return;

          const names = workbook.SheetNames;
          setSheetNames(names);

          const firstSheet = names[0];
          setActiveSheet(firstSheet);

          const worksheet = workbook.Sheets[firstSheet];
          const html = XLSX.utils.sheet_to_html(worksheet, { id: "excel-table" });
          setExcelHtml(html);
          setRendered(true);
        }
      } catch (err) {
        if (!cancelled) {
          console.error("[OfficePreview] Render error:", err);
          setError(err instanceof Error ? err.message : "Failed to render document");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchAndRender();
    return () => { cancelled = true; };
  }, [src, isWord, isSpreadsheet, renderWordDoc]);

  // Retry effect: if Word doc was fetched but container wasn't ready,
  // retry rendering once loading is done and container is mounted
  useEffect(() => {
    if (!isWord || loading || rendered || error || !bufferRef.current) return;

    let cancelled = false;

    async function retryRender() {
      try {
        const success = await renderWordDoc(bufferRef.current!);
        if (!cancelled && success) {
          setRendered(true);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to render document");
        }
      }
    }

    // Small delay to ensure DOM is ready
    const timer = setTimeout(retryRender, 50);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [isWord, loading, rendered, error, renderWordDoc]);

  // Handle sheet tab switching for Excel files
  const handleSheetChange = async (sheetName: string) => {
    if (!workbookRef.current) return;
    try {
      const XLSX = await import("xlsx");
      const workbook = workbookRef.current as import("xlsx").WorkBook;
      const worksheet = workbook.Sheets[sheetName];
      const html = XLSX.utils.sheet_to_html(worksheet, { id: "excel-table" });
      setActiveSheet(sheetName);
      setExcelHtml(html);
    } catch (err) {
      console.error("[OfficePreview] Sheet switch error:", err);
    }
  };

  // --- Word document preview ---
  // Always mount the container div so the ref is available for rendering
  if (isWord) {
    return (
      <div className="w-full h-full overflow-auto bg-[#525659] relative">
        <style jsx global>{`
          .docx-preview-wrapper {
            padding: 20px;
            display: flex;
            flex-direction: column;
            align-items: center;
            min-height: 100%;
          }
          .docx-preview-wrapper > section.docx {
            background: white;
            box-shadow: 0 2px 10px rgba(0,0,0,0.3);
            margin-bottom: 16px;
            padding: 40px 48px;
            max-width: 816px;
            width: 100%;
          }
          .docx-preview-wrapper table {
            border-collapse: collapse;
          }
          .docx-preview-wrapper td,
          .docx-preview-wrapper th {
            border: 1px solid #ddd;
            padding: 4px 8px;
          }
        `}</style>

        {/* Always-mounted container for docx-preview */}
        <div ref={containerRef} className="min-h-full" />

        {/* Loading overlay */}
        {loading && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#202124] gap-3">
            <Loader2 className="h-8 w-8 text-[#8ab4f8] animate-spin" />
            <p className="text-sm text-white/60">Loading document…</p>
          </div>
        )}

        {/* Error overlay */}
        {error && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#202124] gap-4 p-8 text-center">
            <FileText className="h-16 w-16 text-white/30" />
            <div>
              <p className="text-lg font-medium text-white mb-1">{fileName}</p>
              <p className="text-sm text-white/50 flex items-center gap-1.5 justify-center">
                <AlertCircle className="h-4 w-4" />
                {error}
              </p>
            </div>
            {onDownload && (
              <button
                onClick={onDownload}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#8ab4f8] text-[#202124] rounded-full text-sm font-medium hover:bg-[#aecbfa] transition-colors"
              >
                <Download className="h-4 w-4" />
                Download File
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  // --- Loading state for Excel ---
  if (loading) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-3 bg-[#202124]">
        <Loader2 className="h-8 w-8 text-[#8ab4f8] animate-spin" />
        <p className="text-sm text-white/60">Loading spreadsheet…</p>
      </div>
    );
  }

  // --- Error state for Excel ---
  if (error) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-4 p-8 text-center bg-[#202124]">
        <FileSpreadsheet className="h-16 w-16 text-white/30" />
        <div>
          <p className="text-lg font-medium text-white mb-1">{fileName}</p>
          <p className="text-sm text-white/50 flex items-center gap-1.5 justify-center">
            <AlertCircle className="h-4 w-4" />
            {error}
          </p>
        </div>
        {onDownload && (
          <button
            onClick={onDownload}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#8ab4f8] text-[#202124] rounded-full text-sm font-medium hover:bg-[#aecbfa] transition-colors"
          >
            <Download className="h-4 w-4" />
            Download File
          </button>
        )}
      </div>
    );
  }

  // --- Excel spreadsheet preview ---
  if (isSpreadsheet && excelHtml) {
    return (
      <div className="w-full h-full flex flex-col overflow-hidden">
        {/* Sheet tabs */}
        {sheetNames.length > 1 && (
          <div className="flex-shrink-0 flex items-center gap-0 bg-[#292a2d] border-b border-white/10 overflow-x-auto">
            {sheetNames.map((name) => (
              <button
                key={name}
                onClick={() => handleSheetChange(name)}
                className={`px-4 py-2 text-sm whitespace-nowrap border-r border-white/10 transition-colors ${
                  activeSheet === name
                    ? "bg-[#35363a] text-white font-medium"
                    : "text-white/50 hover:text-white/80 hover:bg-white/5"
                }`}
              >
                {name}
              </button>
            ))}
          </div>
        )}

        {/* Table content */}
        <div className="flex-1 overflow-auto bg-white">
          <style jsx global>{`
            #excel-table {
              border-collapse: collapse;
              width: 100%;
              font-size: 13px;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            }
            #excel-table td,
            #excel-table th {
              border: 1px solid #e0e0e0;
              padding: 4px 8px;
              white-space: nowrap;
              max-width: 300px;
              overflow: hidden;
              text-overflow: ellipsis;
            }
            #excel-table tr:first-child td,
            #excel-table tr:first-child th {
              background: #f5f5f5;
              font-weight: 600;
              position: sticky;
              top: 0;
              z-index: 1;
            }
            #excel-table tr:hover td {
              background: #f0f7ff;
            }
          `}</style>
          <div dangerouslySetInnerHTML={{ __html: excelHtml }} />
        </div>
      </div>
    );
  }

  return null;
}
