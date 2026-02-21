"use client";

import { useEffect, useState } from "react";
import { FileSpreadsheet, Loader2, AlertCircle, Download } from "lucide-react";

interface CsvPreviewProps {
  /** Relative file URL, e.g. /file/{token}/{name} */
  src: string;
  fileName: string;
  onDownload?: () => void;
}

interface CsvData {
  headers: string[];
  rows: string[][];
  totalRows: number;
}

const MAX_PREVIEW_ROWS = 500;

/**
 * Client-side CSV preview that fetches the file, parses it,
 * and renders an interactive, styled HTML table.
 */
export function CsvPreview({ src, fileName, onDownload }: CsvPreviewProps) {
  const [data, setData] = useState<CsvData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchAndParse() {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(src);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const text = await res.text();
        const parsed = parseCsv(text);

        if (!cancelled) {
          setData(parsed);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load CSV");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchAndParse();
    return () => {
      cancelled = true;
    };
  }, [src]);

  if (loading) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 text-[#8ab4f8] animate-spin" />
        <p className="text-sm text-white/60">Loading spreadsheet…</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-4 p-8 text-center">
        <FileSpreadsheet className="h-16 w-16 text-white/30" />
        <div>
          <p className="text-lg font-medium text-white mb-1">{fileName}</p>
          <p className="text-sm text-white/50 flex items-center gap-1.5 justify-center">
            <AlertCircle className="h-4 w-4" />
            {error || "Could not parse CSV"}
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

  return (
    <div className="w-full h-full flex flex-col overflow-hidden">
      {/* Info bar */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-2 bg-[#292a2d] border-b border-white/10">
        <div className="flex items-center gap-2 text-sm text-white/60">
          <FileSpreadsheet className="h-4 w-4 text-green-400" />
          <span>{fileName}</span>
          <span className="text-white/30">•</span>
          <span>
            {data.totalRows.toLocaleString()} rows × {data.headers.length} columns
          </span>
          {data.totalRows > MAX_PREVIEW_ROWS && (
            <span className="text-yellow-400/70 text-xs ml-1">
              (showing first {MAX_PREVIEW_ROWS})
            </span>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10">
            <tr>
              <th className="bg-[#35363a] text-white/40 text-xs px-3 py-2 border-b border-r border-white/10 text-center w-12 font-medium">
                #
              </th>
              {data.headers.map((header, i) => (
                <th
                  key={i}
                  className="bg-[#35363a] text-white/80 text-left px-3 py-2 border-b border-r border-white/10 font-medium whitespace-nowrap"
                >
                  {header || `Column ${i + 1}`}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row, rowIndex) => (
              <tr
                key={rowIndex}
                className="hover:bg-white/5 transition-colors"
              >
                <td className="text-white/30 text-xs px-3 py-1.5 border-b border-r border-white/5 text-center tabular-nums">
                  {rowIndex + 1}
                </td>
                {data.headers.map((_, colIndex) => (
                  <td
                    key={colIndex}
                    className="text-white/70 px-3 py-1.5 border-b border-r border-white/5 whitespace-nowrap max-w-[300px] truncate"
                    title={row[colIndex] || ""}
                  >
                    {row[colIndex] || ""}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * Simple CSV parser that handles quoted fields with commas and newlines.
 */
function parseCsv(text: string): CsvData {
  const rows: string[][] = [];
  let current: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"';
        i++; // skip escaped quote
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        current.push(field.trim());
        field = "";
      } else if (ch === "\n" || (ch === "\r" && next === "\n")) {
        current.push(field.trim());
        if (current.some((c) => c !== "")) {
          rows.push(current);
        }
        current = [];
        field = "";
        if (ch === "\r") i++; // skip \n in \r\n
      } else {
        field += ch;
      }
    }
  }

  // Push last field/row
  if (field || current.length > 0) {
    current.push(field.trim());
    if (current.some((c) => c !== "")) {
      rows.push(current);
    }
  }

  if (rows.length === 0) {
    return { headers: [], rows: [], totalRows: 0 };
  }

  // First row as headers
  const headers = rows[0];
  const dataRows = rows.slice(1);
  const totalRows = dataRows.length;

  // Normalize row widths & limit rows
  const limited = dataRows.slice(0, MAX_PREVIEW_ROWS).map((row) => {
    while (row.length < headers.length) row.push("");
    return row.slice(0, headers.length);
  });

  return { headers, rows: limited, totalRows };
}
