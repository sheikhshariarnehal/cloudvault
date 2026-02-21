"use client";

import { useEffect, useState, useCallback } from "react";
import { Braces, Loader2, AlertCircle, Download, ChevronRight, ChevronDown } from "lucide-react";

interface JsonPreviewProps {
  src: string;
  fileName: string;
  onDownload?: () => void;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

/* ─── Recursive JSON Tree Renderer ─── */

interface JsonNodeProps {
  name?: string;
  value: unknown;
  depth: number;
  defaultExpanded?: boolean;
}

function JsonNode({ name, value, depth, defaultExpanded = true }: JsonNodeProps) {
  const [expanded, setExpanded] = useState(defaultExpanded && depth < 3);

  const toggle = useCallback(() => setExpanded((e) => !e), []);

  const indent = depth * 16;

  // Null
  if (value === null) {
    return (
      <div className="flex" style={{ paddingLeft: indent }}>
        {name !== undefined && (
          <span className="text-[#9cdcfe] mr-1">&quot;{name}&quot;: </span>
        )}
        <span className="text-[#569cd6]">null</span>
      </div>
    );
  }

  // Primitive types
  if (typeof value !== "object") {
    let colorClass = "text-[#d4d4d4]";
    let display = String(value);

    if (typeof value === "string") {
      colorClass = "text-[#ce9178]";
      // Truncate very long strings
      if (display.length > 500) display = display.slice(0, 500) + "…";
      display = `"${display}"`;
    } else if (typeof value === "number") {
      colorClass = "text-[#b5cea8]";
    } else if (typeof value === "boolean") {
      colorClass = "text-[#569cd6]";
    }

    return (
      <div className="flex flex-wrap" style={{ paddingLeft: indent }}>
        {name !== undefined && (
          <span className="text-[#9cdcfe] mr-1 flex-shrink-0">&quot;{name}&quot;: </span>
        )}
        <span className={`${colorClass} break-all`}>{display}</span>
      </div>
    );
  }

  // Array or Object
  const isArray = Array.isArray(value);
  const entries = isArray
    ? (value as unknown[]).map((v, i) => [String(i), v] as [string, unknown])
    : Object.entries(value as Record<string, unknown>);
  const count = entries.length;
  const bracket = isArray ? ["[", "]"] : ["{", "}"];
  const label = isArray ? `Array(${count})` : `Object(${count} keys)`;

  return (
    <div>
      <div
        className="flex items-center cursor-pointer hover:bg-white/[0.04] transition-colors group"
        style={{ paddingLeft: indent }}
        onClick={toggle}
      >
        <span className="mr-1 text-white/40 flex-shrink-0 w-4 h-4 flex items-center justify-center">
          {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </span>
        {name !== undefined && (
          <span className="text-[#9cdcfe] mr-1">&quot;{name}&quot;: </span>
        )}
        {expanded ? (
          <span className="text-white/50">{bracket[0]}</span>
        ) : (
          <span className="text-white/40">
            {bracket[0]} <span className="text-white/30 text-xs italic">{label}</span> {bracket[1]}
          </span>
        )}
      </div>

      {expanded && (
        <>
          {entries.map(([key, val], i) => (
            <div key={key + "-" + i}>
              <JsonNode
                name={isArray ? undefined : key}
                value={val}
                depth={depth + 1}
                defaultExpanded={depth < 2}
              />
            </div>
          ))}
          <div style={{ paddingLeft: indent }}>
            <span className="text-white/50 ml-5">{bracket[1]}</span>
          </div>
        </>
      )}
    </div>
  );
}

/* ─── Main Component ─── */

export function JsonPreview({ src, fileName, onDownload }: JsonPreviewProps) {
  const [parsed, setParsed] = useState<unknown>(null);
  const [rawText, setRawText] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"tree" | "raw">("tree");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(src);
        if (!res.ok) throw new Error(`Failed to fetch file (${res.status})`);

        const text = await res.text();
        if (cancelled) return;
        setRawText(text);

        try {
          const data = JSON.parse(text);
          setParsed(data);
        } catch {
          // Invalid JSON – fall back to raw view
          setViewMode("raw");
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load file");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [src]);

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-10 w-10 text-white/40 animate-spin mx-auto mb-3" />
          <p className="text-sm text-white/50">Loading JSON…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-center max-w-md">
          <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-3" />
          <p className="text-white font-medium mb-2">Cannot preview JSON</p>
          <p className="text-sm text-white/50 mb-4">{error}</p>
          {onDownload && (
            <button onClick={onDownload} className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#8ab4f8] text-[#202124] rounded-full text-sm font-medium hover:bg-[#aecbfa] transition-colors">
              <Download className="h-4 w-4" /> Download File
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-2 bg-[#1e1e1e] border-b border-white/10 flex-shrink-0">
        <Braces className="h-4 w-4 text-white/50" />
        <span className="text-xs text-white/60 font-medium">JSON</span>
        <span className="text-xs text-white/40">
          {(rawText.length / 1024).toFixed(1)} KB
        </span>

        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={() => setViewMode("tree")}
            className={`px-3 py-1 text-xs rounded-l-md border border-white/20 transition-colors ${
              viewMode === "tree"
                ? "bg-white/15 text-white"
                : "text-white/50 hover:text-white/70"
            }`}
          >
            Tree
          </button>
          <button
            onClick={() => setViewMode("raw")}
            className={`px-3 py-1 text-xs rounded-r-md border border-white/20 border-l-0 transition-colors ${
              viewMode === "raw"
                ? "bg-white/15 text-white"
                : "text-white/50 hover:text-white/70"
            }`}
          >
            Raw
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto bg-[#1e1e1e] p-4 font-mono text-[13px] leading-[1.6]">
        {viewMode === "tree" && parsed !== undefined ? (
          <JsonNode value={parsed} depth={0} defaultExpanded />
        ) : (
          <pre className="text-[#d4d4d4] whitespace-pre-wrap break-all">
            {parsed !== null
              ? JSON.stringify(parsed, null, 2)
              : rawText}
          </pre>
        )}
      </div>
    </div>
  );
}
