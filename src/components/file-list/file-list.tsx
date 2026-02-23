"use client";

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { List as VirtualList } from "react-window";
import Link from "next/link";
import { useFilesStore } from "@/store/files-store";
import { useUIStore } from "@/store/ui-store";
import { FileContextMenu } from "@/components/context-menu/file-context-menu";
import { FolderContextMenu } from "@/components/context-menu/folder-context-menu";
import {
  FileText,
  Image as ImageIcon,
  Film,
  Music,
  Archive,
  FileIcon,
  FileSpreadsheet,
  FolderOpen,
  Folder,
  Presentation,
  ArrowUp,
  ArrowDown,
  X,
  Users,
  Download,
  FolderInput,
  Trash2,
  Link as LinkIcon,
  MoreVertical,
  Star,
  Pencil,
  ChevronDown,
  ListFilter,
  Check,
  Minus,
} from "lucide-react";
import { formatFileSize, getFileCategory } from "@/types/file.types";
import type { DbFile, DbFolder } from "@/types/file.types";
import { getFileUrl } from "@/lib/utils";

// ─── Google Drive Checkbox ────────────────────────────────────────────
function GDriveCheckbox({
  checked,
  indeterminate,
  onChange,
  className = "",
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: (e: React.MouseEvent) => void;
  className?: string;
}) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); e.preventDefault(); onChange(e); }}
      className={`w-[18px] h-[18px] rounded-sm border-2 flex items-center justify-center transition-colors duration-75 ${
        checked || indeterminate
          ? "bg-[#1a73e8] border-[#1a73e8]"
          : "border-[#80868b] hover:border-[#5f6368] bg-transparent"
      } ${className}`}
      data-no-preview
    >
      {checked && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
      {indeterminate && !checked && <Minus className="h-3 w-3 text-white" strokeWidth={3} />}
    </button>
  );
}

// ─── Types ────────────────────────────────────────────────────────────
type SortKey = "name" | "modified" | "size";
type SortDir = "asc" | "desc";

interface FileListProps {
  files: DbFile[];
  folders?: DbFolder[];
  topRightSlot?: React.ReactNode;
}

// ─── Google Drive icon + color config ─────────────────────────────────
const ICON_CONFIG: Record<string, { icon: typeof FileIcon; color: string }> = {
  image: { icon: ImageIcon, color: "#D93025" },
  video: { icon: Film, color: "#D93025" },
  audio: { icon: Music, color: "#E37400" },
  document: { icon: FileText, color: "#4285F4" },
  pdf: { icon: FileSpreadsheet, color: "#EA4335" },
  archive: { icon: Archive, color: "#5F6368" },
  other: { icon: FileIcon, color: "#5F6368" },
};

function getSmartIcon(mimeType: string, category: string) {
  const m = mimeType.toLowerCase();
  if (
    m.includes("spreadsheet") ||
    m.includes("excel") ||
    m.includes("csv") ||
    m.includes("sheet")
  )
    return { icon: FileSpreadsheet, color: "#0F9D58" };
  if (
    m.includes("presentation") ||
    m.includes("powerpoint") ||
    m.includes("pptx")
  )
    return { icon: Presentation, color: "#F4B400" };
  if (m.includes("pdf")) return ICON_CONFIG.pdf;
  return ICON_CONFIG[category] || ICON_CONFIG.other;
}

// ─── Google Drive date format: "22 Nov 2025" or "3 Feb" (current year) ─
function formatGDriveDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const sameYear = date.getFullYear() === now.getFullYear();
  if (sameYear) {
    return date.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
    });
  }
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// ─── Sorting helper ───────────────────────────────────────────────────
function sortFiles(files: DbFile[], key: SortKey, dir: SortDir): DbFile[] {
  const sorted = [...files].sort((a, b) => {
    switch (key) {
      case "name":
        return a.name.localeCompare(b.name, undefined, {
          sensitivity: "base",
        });
      case "modified":
        return (
          new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime()
        );
      case "size":
        return a.size_bytes - b.size_bytes;
      default:
        return 0;
    }
  });
  return dir === "desc" ? sorted.reverse() : sorted;
}

// ─── Constants ────────────────────────────────────────────────────────
const ROW_HEIGHT = 48;
const HEADER_HEIGHT = 40;
const FILTER_BAR_HEIGHT = 48;
const MAX_VISIBLE_ROWS = 20;

// ─── Filter Chip ─────────────────────────────────────────────────────
function FilterChip({ label }: { label: string }) {
  return (
    <button className="inline-flex items-center gap-1 sm:gap-1.5 h-7 sm:h-8 px-2.5 sm:px-3 rounded-lg border border-[#dadce0] text-[13px] sm:text-[14px] text-[#3c4043] hover:bg-[#f1f3f4] transition-colors duration-100">
      {label}
      <ChevronDown className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-[#5f6368]" />
    </button>
  );
}

// ─── Top Action Bar (2 states: filters / selection) ─────────────────
function TopActionBar({
  hasSelection,
  selectionCount,
  onClearSelection,
  onBulkShare,
  onBulkDownload,
  onBulkMove,
  onBulkDelete,
  onBulkCopyLink,
  topRightSlot,
}: {
  hasSelection: boolean;
  selectionCount: number;
  onClearSelection: () => void;
  onBulkShare: () => void;
  onBulkDownload: () => void;
  onBulkMove: () => void;
  onBulkDelete: () => void;
  onBulkCopyLink: () => void;
  topRightSlot?: React.ReactNode;
}) {
  // ─ Selection toolbar ──────────────────────────────────────────────
  if (hasSelection) {
    return (
      <div
        className="flex items-center gap-0.5 sm:gap-1 px-2 sm:px-3 bg-[#e8f0fe] rounded-t-xl border-b border-[#c2d9f5] overflow-x-auto scrollbar-none"
        style={{ height: FILTER_BAR_HEIGHT }}
      >
        <button
          onClick={onClearSelection}
          className="p-1.5 sm:p-2 rounded-full hover:bg-black/5 transition-colors flex-shrink-0"
        >
          <X className="h-5 w-5 text-[#1a73e8]" />
        </button>
        <span className="text-[13px] sm:text-[14px] font-medium text-[#1a73e8] ml-0.5 sm:ml-1 mr-2 sm:mr-4 whitespace-nowrap flex-shrink-0">
          {selectionCount} selected
        </span>
        <div className="flex items-center gap-0.5 flex-shrink-0">
          <button onClick={onBulkShare} title="Share" className="p-2 rounded-full hover:bg-black/5 transition-colors">
            <Users className="h-5 w-5 text-[#5f6368]" />
          </button>
          <button onClick={onBulkDownload} title="Download" className="p-2 rounded-full hover:bg-black/5 transition-colors">
            <Download className="h-5 w-5 text-[#5f6368]" />
          </button>
          <button onClick={onBulkMove} title="Move to" className="p-2 rounded-full hover:bg-black/5 transition-colors">
            <FolderInput className="h-5 w-5 text-[#5f6368]" />
          </button>
          <button onClick={onBulkDelete} title="Move to trash" className="p-2 rounded-full hover:bg-black/5 transition-colors">
            <Trash2 className="h-5 w-5 text-[#5f6368]" />
          </button>
          <button onClick={onBulkCopyLink} title="Copy link" className="p-2 rounded-full hover:bg-black/5 transition-colors">
            <LinkIcon className="h-5 w-5 text-[#5f6368]" />
          </button>
          <button title="More actions" className="p-2 rounded-full hover:bg-black/5 transition-colors">
            <MoreVertical className="h-5 w-5 text-[#5f6368]" />
          </button>
        </div>
      </div>
    );
  }

  // ─ Default filter chips ───────────────────────────────────────────
  return (
    <div
      className="flex items-center px-2 sm:px-3 border-b border-[#e8eaed] overflow-x-auto scrollbar-none hide-scrollbar"
      style={{ height: FILTER_BAR_HEIGHT }}
    >
      <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0 pb-1 sm:pb-0">
        <FilterChip label="Type" />
        <FilterChip label="People" />
        <FilterChip label="Modified" />
        <FilterChip label="Source" />
      </div>
      {topRightSlot && <div className="ml-auto flex-shrink-0 pl-2 hidden sm:flex items-center">{topRightSlot}</div>}
    </div>
  );
}

// ─── Column widths (Google Drive style) ──────────────────────────────
const COL = {
  icon: "w-12",
  name: "flex-1 min-w-0",
  owner: "w-[120px] xl:w-[140px]",
  date: "w-[140px] lg:w-[170px]",
  size: "w-[110px] lg:w-[130px]",
  actions: "w-14",
} as const;

// ─── Folder Row ──────────────────────────────────────────────────────
function FolderRow({ folder, isSelected, onToggle }: { folder: DbFolder; isSelected: boolean; onToggle: (id: string) => void }) {
  const handleRowClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest("[data-no-preview]")) return;

    if (e.ctrlKey || e.metaKey) {
      onToggle(folder.id);
      return;
    }

    window.location.href = `/dashboard/folder/${folder.id}`;
  };

  return (
    <div
      className={`group relative flex items-center h-12 border-b border-[#e8eaed] cursor-pointer select-none transition-colors duration-75 ${
        isSelected ? "bg-[#c2e7ff] hover:bg-[#b0d8f5]" : "hover:bg-[#f5f5f5]"
      }`}
      role="row"
      aria-selected={isSelected}
      onClick={handleRowClick}
    >
      {/* Checkbox / Icon area */}
      <div className={`${COL.icon} flex-shrink-0 flex items-center justify-center relative`}>
        <Folder
          className={`h-5 w-5 flex-shrink-0 transition-opacity duration-75 ${
            isSelected ? "opacity-0" : "group-hover:opacity-0"
          }`}
          style={{ color: folder.color || "#5f6368" }}
          fill={folder.color || "#5f6368"}
          fillOpacity={0.22}
        />
        <div className={`absolute inset-0 flex items-center justify-center transition-opacity duration-75 ${
          isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        }`}>
          <GDriveCheckbox checked={isSelected} onChange={() => onToggle(folder.id)} />
        </div>
      </div>

      {/* Name */}
      <div className={`${COL.name} flex items-center gap-3 pr-3`}>
        <span className={`text-[14px] truncate leading-5 ${
          isSelected ? "text-[#001d35] font-medium" : "text-[#202124]"
        }`}>
          {folder.name}
        </span>
      </div>

      {/* Owner */}
      <div className={`hidden md:flex items-center ${COL.owner} flex-shrink-0 pr-3`}>
        <img
          src="https://ui-avatars.com/api/?name=me&size=24&background=1a73e8&color=fff&bold=true&font-size=0.45"
          alt="me"
          className="w-6 h-6 rounded-full flex-shrink-0"
        />
        <span className={`ml-2 text-[14px] truncate ${
          isSelected ? "text-[#001d35]" : "text-[#5f6368]"
        }`}>me</span>
      </div>

      {/* Date modified */}
      <div className={`hidden sm:flex items-center ${COL.date} flex-shrink-0 pr-3`}>
        <span className={`text-[14px] truncate ${
          isSelected ? "text-[#001d35]" : "text-[#5f6368]"
        }`}>
          {formatGDriveDate(folder.updated_at)}
        </span>
      </div>

      {/* File size (dash for folders) */}
      <div className={`hidden lg:flex items-center ${COL.size} flex-shrink-0 pr-4`}>
        <span className={`text-[14px] ${
          isSelected ? "text-[#001d35]" : "text-[#5f6368]"
        }`}>&mdash;</span>
      </div>

      {/* Context menu - visible on hover */}
      <div
        className={`${COL.actions} flex-shrink-0 flex items-center justify-center transition-opacity duration-75 ${
          isSelected ? "opacity-100" : "opacity-100 lg:opacity-0 lg:group-hover:opacity-100"
        }`}
        data-no-preview
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <FolderContextMenu folder={folder} />
      </div>
    </div>
  );
}

// ─── File Row Component ──────────────────────────────────────────────
interface RowProps {
  files: DbFile[];
  selectedFiles: string[];
  toggleFileSelection: (id: string) => void;
  setPreviewFileId: (id: string) => void;
  handleShare: (file: DbFile) => void;
  handleDownload: (file: DbFile) => void;
  handleRename: (file: DbFile) => void;
  handleStar: (file: DbFile) => void;
}

function FileRow({
  index,
  style,
  files,
  selectedFiles,
  toggleFileSelection,
  setPreviewFileId,
  handleShare,
  handleDownload,
  handleRename,
  handleStar,
}: {
  ariaAttributes?: Record<string, unknown>;
  index: number;
  style: React.CSSProperties;
} & RowProps) {
  const file = files[index];
  if (!file) return null;

  const category = getFileCategory(file.mime_type);
  const config = getSmartIcon(file.mime_type, category);
  const Icon = config.icon;
  const isSelected = selectedFiles.includes(file.id);
  const isPdf = category === "pdf";

  const handleRowClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest("[data-no-preview]")) return;

    if (e.ctrlKey || e.metaKey) {
      toggleFileSelection(file.id);
      return;
    }

    if (isPdf) {
      window.open(getFileUrl(file.id, file.name), "_blank");
    } else {
      setPreviewFileId(file.id);
    }
  };

  return (
    <div
      style={style}
      className={`
        group relative flex items-center h-12 border-b border-[#e8eaed]
        cursor-pointer select-none transition-colors duration-75
        ${isSelected ? "bg-[#c2e7ff] hover:bg-[#b0d8f5]" : "hover:bg-[#f5f5f5]"}
      `}
      onClick={handleRowClick}
      role="row"
      aria-selected={isSelected}
    >
      {/* Checkbox / Icon area */}
      <div className={`${COL.icon} flex-shrink-0 flex items-center justify-center relative`}>
        <Icon
          className={`h-5 w-5 transition-opacity duration-75 ${
            isSelected ? "opacity-0" : "group-hover:opacity-0"
          }`}
          style={{ color: config.color }}
        />
        <div className={`absolute inset-0 flex items-center justify-center transition-opacity duration-75 ${
          isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        }`}>
          <GDriveCheckbox
            checked={isSelected}
            onChange={(e) => { e.stopPropagation(); toggleFileSelection(file.id); }}
          />
        </div>
      </div>

      {/* Name */}
      <div className={`${COL.name} flex items-center gap-2 pr-3`}>
        <span
          className={`text-[14px] truncate leading-5 ${
            isSelected ? "text-[#001d35] font-medium" : "text-[#202124]"
          }`}
        >
          {file.name}
        </span>
        {file.is_starred && (
          <Star className="h-3.5 w-3.5 text-[#5f6368] flex-shrink-0" fill="#5f6368" />
        )}
      </div>

      {/* Owner */}
      <div className={`hidden md:flex items-center ${COL.owner} flex-shrink-0 pr-3`}>
        <img
          src="https://ui-avatars.com/api/?name=me&size=24&background=1a73e8&color=fff&bold=true&font-size=0.45"
          alt="me"
          className="w-6 h-6 rounded-full flex-shrink-0"
        />
        <span
          className={`ml-2 text-[14px] truncate ${
            isSelected ? "text-[#001d35]" : "text-[#5f6368]"
          }`}
        >
          me
        </span>
      </div>

      {/* Date modified */}
      <div className={`hidden sm:flex items-center ${COL.date} flex-shrink-0 pr-3`}>
        <span
          className={`text-[14px] truncate ${
            isSelected ? "text-[#001d35]" : "text-[#5f6368]"
          }`}
        >
          {formatGDriveDate(file.updated_at)}
        </span>
      </div>

      {/* File size */}
      <div className={`hidden lg:flex items-center ${COL.size} flex-shrink-0 pr-4 transition-opacity duration-100 group-hover:opacity-0`}>
        <span
          className={`text-[14px] tabular-nums ${
            isSelected ? "text-[#001d35]" : "text-[#5f6368]"
          }`}
        >
          {formatFileSize(file.size_bytes)}
        </span>
      </div>

      {/* Three dots context menu — always at the end */}
      <div
        className={`${COL.actions} flex-shrink-0 flex items-center justify-center transition-opacity duration-75 ${
          isSelected ? "opacity-100" : "opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
        }`}
        data-no-preview
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <FileContextMenu file={file} />
      </div>

      {/* ── Hover actions — absolute overlay just before the three dots ── */}
      <div
        className={`absolute right-14 top-0 bottom-0 flex items-center gap-0.5 pl-3 pr-1
          opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto
          transition-opacity duration-100 ${
            isSelected ? "bg-[#c2e7ff]" : "bg-[#f5f5f5]"
          }`}
        data-no-preview
      >
        <button
          onClick={(e) => { e.stopPropagation(); handleShare(file); }}
          title="Share"
          className="p-1.5 rounded-full hover:bg-black/10 transition-colors"
        >
          <Users className="h-[18px] w-[18px] text-[#5f6368]" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); handleDownload(file); }}
          title="Download"
          className="p-1.5 rounded-full hover:bg-black/10 transition-colors"
        >
          <Download className="h-[18px] w-[18px] text-[#5f6368]" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); handleRename(file); }}
          title="Rename"
          className="p-1.5 rounded-full hover:bg-black/10 transition-colors"
        >
          <Pencil className="h-[18px] w-[18px] text-[#5f6368]" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); handleStar(file); }}
          title={file.is_starred ? "Remove from starred" : "Add to starred"}
          className="p-1.5 rounded-full hover:bg-black/10 transition-colors"
        >
          <Star
            className="h-[18px] w-[18px] text-[#5f6368]"
            fill={file.is_starred ? "#5f6368" : "none"}
          />
        </button>
      </div>
    </div>
  );
}

// ─── Sort Header Button ──────────────────────────────────────────────
function SortHeaderButton({
  label,
  sortKey,
  currentKey,
  currentDir,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  currentKey: SortKey;
  currentDir: SortDir;
  onSort: (key: SortKey) => void;
}) {
  const isActive = currentKey === sortKey;
  const ArrowIcon = currentDir === "asc" ? ArrowUp : ArrowDown;

  return (
    <button
      onClick={() => onSort(sortKey)}
      className="flex items-center gap-1 text-[14px] font-medium text-[#5f6368] hover:text-[#202124] transition-colors duration-100 whitespace-nowrap"
    >
      {label}
      {isActive && <ArrowIcon className="h-3.5 w-3.5 text-[#202124]" />}
    </button>
  );
}

// ─── Main FileList Component ─────────────────────────────────────────
export function FileList({ files, folders = [], topRightSlot }: FileListProps) {
  const {
    selectedFiles,
    toggleFileSelection,
    setSelectedFiles,
    updateFile,
    removeFile,
  } = useFilesStore();
  const {
    setPreviewFileId,
    setRenameTarget,
    setRenameModalOpen,
    setShareFileId,
    setShareModalOpen,
  } = useUIStore();

  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [lastClickedIndex, setLastClickedIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // ─── Escape to clear selection ────────────────────────────────────
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && selectedFiles.length > 0) {
        setSelectedFiles([]);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [selectedFiles.length, setSelectedFiles]);

  const handleSort = useCallback(
    (key: SortKey) => {
      if (key === sortKey) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortKey(key);
        setSortDir("asc");
      }
    },
    [sortKey]
  );

  const sortedFiles = useMemo(
    () => sortFiles(files, sortKey, sortDir),
    [files, sortKey, sortDir]
  );

  const hasSelection = selectedFiles.length > 0;

  // ─── File action handlers ─────────────────────────────────────────
  const handleStarFile = useCallback(
    async (file: DbFile) => {
      try {
        await fetch("/api/files", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: file.id, is_starred: !file.is_starred }),
        });
        updateFile(file.id, { is_starred: !file.is_starred });
      } catch (error) {
        console.error("Failed to star file:", error);
      }
    },
    [updateFile]
  );

  const handleDownloadFile = useCallback((file: DbFile) => {
    window.open(getFileUrl(file.id, file.name, true), "_blank");
  }, []);

  const handleShareFile = useCallback(
    (file: DbFile) => {
      setShareFileId(file.id);
      setShareModalOpen(true);
    },
    [setShareFileId, setShareModalOpen]
  );

  const handleRenameFile = useCallback(
    (file: DbFile) => {
      setRenameTarget({ id: file.id, name: file.name, type: "file" });
      setRenameModalOpen(true);
    },
    [setRenameTarget, setRenameModalOpen]
  );

  const handleDeleteFile = useCallback(
    async (file: DbFile) => {
      try {
        await fetch("/api/files", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: file.id,
            is_trashed: true,
            trashed_at: new Date().toISOString(),
          }),
        });
        removeFile(file.id);
      } catch (error) {
        console.error("Failed to delete file:", error);
      }
    },
    [removeFile]
  );

  const handleCopyLink = useCallback((file: DbFile) => {
    const url = `${window.location.origin}${getFileUrl(file.id, file.name)}`;
    navigator.clipboard.writeText(url).catch(() => {});
  }, []);

  // ─── Toolbar bulk actions ─────────────────────────────────────────
  const handleBulkDownload = useCallback(() => {
    selectedFiles.forEach((id) => {
      const file = files.find((f) => f.id === id);
      if (file) window.open(getFileUrl(file.id, file.name, true), "_blank");
    });
  }, [selectedFiles, files]);

  const handleBulkShare = useCallback(() => {
    if (selectedFiles.length === 1) {
      setShareFileId(selectedFiles[0]);
      setShareModalOpen(true);
    }
  }, [selectedFiles, setShareFileId, setShareModalOpen]);

  const handleBulkDelete = useCallback(async () => {
    try {
      for (const id of selectedFiles) {
        await fetch("/api/files", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id,
            is_trashed: true,
            trashed_at: new Date().toISOString(),
          }),
        });
        removeFile(id);
      }
      setSelectedFiles([]);
    } catch (error) {
      console.error("Failed to delete files:", error);
    }
  }, [selectedFiles, removeFile, setSelectedFiles]);

  const handleClearSelection = useCallback(() => {
    setSelectedFiles([]);
  }, [setSelectedFiles]);

  const allIds = useMemo(
    () => [...folders.map((f) => f.id), ...sortedFiles.map((f) => f.id)],
    [folders, sortedFiles]
  );
  const allSelected = allIds.length > 0 && allIds.every((id) => selectedFiles.includes(id));

  const handleSelectAll = useCallback(() => {
    if (allSelected) {
      setSelectedFiles([]);
    } else {
      setSelectedFiles(allIds);
    }
  }, [allSelected, allIds, setSelectedFiles]);

  const rowProps: RowProps = useMemo(
    () => ({
      files: sortedFiles,
      selectedFiles,
      toggleFileSelection,
      setPreviewFileId,
      handleShare: handleShareFile,
      handleDownload: handleDownloadFile,
      handleRename: handleRenameFile,
      handleStar: handleStarFile,
    }),
    [
      sortedFiles,
      selectedFiles,
      toggleFileSelection,
      setPreviewFileId,
      handleShareFile,
      handleDownloadFile,
      handleRenameFile,
      handleStarFile,
    ]
  );

  const listHeight = Math.min(
    sortedFiles.length * ROW_HEIGHT,
    MAX_VISIBLE_ROWS * ROW_HEIGHT
  );

  // ─── Empty state ──────────────────────────────────────────────────
  if (files.length === 0 && folders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 rounded-full bg-[#f1f3f4] flex items-center justify-center mb-5">
          <FolderOpen className="h-8 w-8 text-[#5f6368]" />
        </div>
        <h3 className="text-[15px] font-medium text-[#202124] mb-1">
          No files yet
        </h3>
        <p className="text-[13px] text-[#5f6368] max-w-xs">
          Drag & drop files here, or use the Upload button to get started
        </p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full mt-2 overflow-x-hidden">
      {/* ─── Top Action Bar (filters / selection) ─────────────────── */}
      <TopActionBar
        hasSelection={hasSelection}
        selectionCount={selectedFiles.length}
        onClearSelection={handleClearSelection}
        onBulkShare={handleBulkShare}
        onBulkDownload={handleBulkDownload}
        onBulkMove={() => {}}
        onBulkDelete={handleBulkDelete}
        onBulkCopyLink={() => {}}
        topRightSlot={topRightSlot}
      />

      {/* ─── Column Header (always visible) ───────────────────────── */}
      <div
        className="flex items-center border-b border-[#e8eaed]"
        style={{ height: HEADER_HEIGHT }}
        role="row"
      >
        {/* Select-all checkbox */}
        <div className={`${COL.icon} flex-shrink-0 flex items-center justify-center`}>
          {(hasSelection || sortedFiles.length > 0) && (
            <GDriveCheckbox
              checked={allSelected}
              indeterminate={hasSelection && !allSelected}
              onChange={handleSelectAll}
            />
          )}
        </div>

        {/* Name */}
        <div className={`${COL.name} pr-3`}>
          <SortHeaderButton
            label="Name"
            sortKey="name"
            currentKey={sortKey}
            currentDir={sortDir}
            onSort={handleSort}
          />
        </div>

        {/* Owner */}
        <div className={`hidden md:block ${COL.owner} flex-shrink-0 pr-3`}>
          <span className="text-[14px] font-medium text-[#5f6368]">
            Owner
          </span>
        </div>

        {/* Date modified */}
        <div className={`hidden sm:block ${COL.date} flex-shrink-0 pr-3`}>
          <SortHeaderButton
            label="Date modified"
            sortKey="modified"
            currentKey={sortKey}
            currentDir={sortDir}
            onSort={handleSort}
          />
        </div>

        {/* File size */}
        <div className={`hidden lg:flex items-center ${COL.size} flex-shrink-0 pr-4`}>
          <SortHeaderButton
            label="File size"
            sortKey="size"
            currentKey={sortKey}
            currentDir={sortDir}
            onSort={handleSort}
          />
        </div>

        {/* Sort button (Google Drive style) */}
        <div className={`${COL.actions} flex-shrink-0 flex items-center justify-center xl:justify-start xl:pl-1`}>
          <button
            onClick={() => handleSort(sortKey)}
            title="Sort"
            className="flex items-center gap-1.5 text-[14px] text-[#5f6368] hover:text-[#202124] transition-colors"
          >
            <ListFilter className="h-4 w-4" />
            <span className="hidden xl:inline">Sort</span>
          </button>
        </div>
      </div>

      {/* ─── Folder rows (always rendered directly, before files) ──── */}
      {folders.length > 0 && (
        <div role="rowgroup">
          {folders.map((folder) => (
            <FolderRow
              key={folder.id}
              folder={folder}
              isSelected={selectedFiles.includes(folder.id)}
              onToggle={toggleFileSelection}
            />
          ))}
        </div>
      )}

      {/* ─── File rows ────────────────────────────────────────────── */}
      {sortedFiles.length > 0 &&
        (sortedFiles.length <= 50 ? (
          <div role="rowgroup">
            {sortedFiles.map((file, i) => (
              <FileRow
                key={file.id}
                index={i}
                style={{ height: ROW_HEIGHT }}
                {...rowProps}
              />
            ))}
          </div>
        ) : (
          <VirtualList<RowProps>
            rowComponent={FileRow}
            rowCount={sortedFiles.length}
            rowHeight={ROW_HEIGHT}
            rowProps={rowProps}
            overscanCount={8}
            style={{ height: listHeight }}
          />
        ))}
    </div>
  );
}
