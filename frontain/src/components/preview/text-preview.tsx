"use client";

import { useEffect, useState } from "react";
import { FileText, Loader2, AlertCircle, Download } from "lucide-react";

interface TextPreviewProps {
  /** URL to fetch the file from */
  src: string;
  fileName: string;
  onDownload?: () => void;
}

/** Map file extensions to human-readable language names. */
function getLanguageLabel(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    js: "JavaScript", jsx: "JavaScript (JSX)", mjs: "JavaScript",
    ts: "TypeScript", tsx: "TypeScript (TSX)",
    py: "Python", rb: "Ruby", pl: "Perl", lua: "Lua", r: "R",
    java: "Java", c: "C", h: "C Header", cpp: "C++", cc: "C++", hpp: "C++ Header",
    cs: "C#", go: "Go", rs: "Rust", swift: "Swift", kt: "Kotlin",
    php: "PHP", sql: "SQL",
    html: "HTML", htm: "HTML", css: "CSS", scss: "SCSS", sass: "Sass", less: "Less",
    xml: "XML", svg: "SVG", yaml: "YAML", yml: "YAML", toml: "TOML",
    json: "JSON", md: "Markdown", markdown: "Markdown",
    sh: "Shell", bash: "Bash", zsh: "Zsh", bat: "Batch", cmd: "Batch", ps1: "PowerShell",
    txt: "Plain Text", log: "Log", cfg: "Config", conf: "Config", ini: "INI", env: "Environment",
    vue: "Vue", svelte: "Svelte", astro: "Astro",
    graphql: "GraphQL", gql: "GraphQL",
    dockerfile: "Dockerfile", makefile: "Makefile",
  };
  return map[ext] || "Text";
}

/** Very basic keyword-based syntax coloring for common languages. */
function highlightLine(line: string, ext: string): React.ReactNode {
  // If the ext isn't a "code" extension, return plain text.
  const codeExts = new Set([
    "js", "jsx", "mjs", "cjs", "ts", "tsx",
    "py", "rb", "lua", "java", "c", "h", "cpp", "cc", "hpp", "cs",
    "go", "rs", "swift", "kt", "kts", "php", "sql",
    "html", "htm", "css", "scss", "sass", "less",
    "xml", "svg", "yaml", "yml", "toml",
    "sh", "bash", "zsh", "bat", "cmd", "ps1",
    "vue", "svelte", "astro", "graphql", "gql",
  ]);
  if (!codeExts.has(ext)) return line;

  // Very lightweight: colour comments, strings, and keywords
  // This is intentionally simple – not a full parser.
  const parts: React.ReactNode[] = [];
  let remaining = line;
  let key = 0;

  // Simple regex-based tokeniser
  const tokenRegex = /(\/\/.*$|#.*$|\/\*.*?\*\/|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`|\b(?:import|export|from|const|let|var|function|class|return|if|else|for|while|do|switch|case|break|continue|try|catch|finally|throw|new|this|super|extends|implements|interface|type|enum|async|await|yield|def|self|print|lambda|with|as|in|not|and|or|is|True|False|None|public|private|protected|static|void|int|float|double|char|bool|string|null|undefined|true|false|package|struct|fn|pub|mod|use|mut|impl|trait|where|select|insert|update|delete|create|table|from|where|join|on|group|order|by|having|limit|offset)\b|\b\d+(?:\.\d+)?\b)/g;

  let match: RegExpExecArray | null;
  let lastIndex = 0;

  while ((match = tokenRegex.exec(remaining)) !== null) {
    // Plain text before the match
    if (match.index > lastIndex) {
      parts.push(<span key={key++}>{remaining.slice(lastIndex, match.index)}</span>);
    }

    const token = match[0];
    let className = "";

    if (token.startsWith("//") || token.startsWith("#") || token.startsWith("/*")) {
      className = "text-[#6a9955]"; // green - comments
    } else if (token.startsWith('"') || token.startsWith("'") || token.startsWith("`")) {
      className = "text-[#ce9178]"; // orange - strings
    } else if (/^\d/.test(token)) {
      className = "text-[#b5cea8]"; // light green - numbers
    } else {
      className = "text-[#569cd6]"; // blue - keywords
    }

    parts.push(
      <span key={key++} className={className}>
        {token}
      </span>
    );

    lastIndex = match.index + token.length;
  }

  // Remaining text
  if (lastIndex < remaining.length) {
    parts.push(<span key={key++}>{remaining.slice(lastIndex)}</span>);
  }

  return parts.length > 0 ? <>{parts}</> : line;
}

const MAX_LINES = 10000;
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB text preview limit

export function TextPreview({ src, fileName, onDownload }: TextPreviewProps) {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [truncated, setTruncated] = useState(false);

  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  const lang = getLanguageLabel(fileName);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(src);
        if (!res.ok) throw new Error(`Failed to fetch file (${res.status})`);

        const contentLength = Number(res.headers.get("content-length") || 0);
        if (contentLength > MAX_FILE_SIZE) {
          // Still load a portion
          const text = await res.text();
          if (cancelled) return;
          const sliced = text.slice(0, MAX_FILE_SIZE);
          setContent(sliced);
          setTruncated(true);
        } else {
          const text = await res.text();
          if (cancelled) return;
          setContent(text);
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
          <p className="text-sm text-white/50">Loading text file…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-center max-w-md">
          <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-3" />
          <p className="text-white font-medium mb-2">Cannot preview this file</p>
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

  const lines = (content ?? "").split("\n");
  const visibleLines = lines.slice(0, MAX_LINES);
  const linesTruncated = lines.length > MAX_LINES;

  return (
    <div className="w-full h-full flex flex-col overflow-hidden">
      {/* Status bar */}
      <div className="flex items-center gap-3 px-4 py-2 bg-[#1e1e1e] border-b border-white/10 flex-shrink-0">
        <FileText className="h-4 w-4 text-white/50" />
        <span className="text-xs text-white/60 font-medium">{lang}</span>
        <span className="text-xs text-white/40">
          {lines.length.toLocaleString()} lines
        </span>
        {(truncated || linesTruncated) && (
          <span className="text-xs text-yellow-400/80 ml-auto">
            Preview truncated — download for full file
          </span>
        )}
      </div>

      {/* Code content */}
      <div className="flex-1 overflow-auto bg-[#1e1e1e]">
        <table className="w-full border-collapse text-[13px] leading-[1.55] font-mono">
          <tbody>
            {visibleLines.map((line, i) => (
              <tr key={i} className="hover:bg-white/[0.03]">
                <td className="text-right pr-4 pl-4 select-none text-white/25 w-[1%] whitespace-nowrap sticky left-0 bg-[#1e1e1e]">
                  {i + 1}
                </td>
                <td className="pr-4 text-[#d4d4d4] whitespace-pre-wrap break-all">
                  {highlightLine(line, ext)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
