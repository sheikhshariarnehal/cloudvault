"use client";

import { memo, useState, useCallback } from "react";
import Link from "next/link";
import { ChevronRight, Folder } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DbFolder } from "@/types/file.types";

interface FolderTreeProps {
  folders: DbFolder[];
  childrenByParent: Map<string, DbFolder[]>;
  level?: number;
}

export const FolderTree = memo(function FolderTree({ folders, childrenByParent, level = 0 }: FolderTreeProps) {
  if (folders.length === 0) {
    return (
      <p className="text-xs text-muted-foreground px-2 py-1">No folders yet</p>
    );
  }

  return (
    <div className="space-y-0.5">
      {folders.map((folder) => (
        <FolderTreeItem
          key={folder.id}
          folder={folder}
          childrenByParent={childrenByParent}
          level={level}
        />
      ))}
    </div>
  );
});

const FolderTreeItem = memo(function FolderTreeItem({
  folder,
  childrenByParent,
  level,
}: {
  folder: DbFolder;
  childrenByParent: Map<string, DbFolder[]>;
  level: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const toggleExpanded = useCallback(() => setExpanded((v) => !v), []);

  const children = childrenByParent.get(folder.id) || [];
  const hasChildren = children.length > 0;

  return (
    <div>
      <div
        className="flex items-center gap-1 py-1.5 rounded-full hover:bg-accent/60 cursor-pointer"
        style={{ paddingLeft: `${level * 16 + 4}px` }}
      >
        {hasChildren ? (
          <button
            onClick={toggleExpanded}
            className="p-0.5 rounded hover:bg-accent"
            aria-label={expanded ? "Collapse" : "Expand"}
          >
            <ChevronRight
              className={cn(
                "h-3.5 w-3.5 text-muted-foreground transition-transform duration-150",
                expanded && "rotate-90"
              )}
            />
          </button>
        ) : (
          <span className="w-4" />
        )}
        <Link
          href={`/drive/folder/${folder.id}`}
          prefetch={false}
          className="flex items-center gap-3 flex-1 min-w-0 pr-1"
        >
          <Folder
            className="h-5 w-5 flex-shrink-0"
            style={{ color: folder.color || "var(--muted-foreground)" }}
            fill={folder.color || "var(--muted-foreground)"}
          />
          <span className="text-sm truncate text-foreground font-medium">{folder.name}</span>
        </Link>
      </div>
      {expanded && hasChildren && (
        <FolderTree
          folders={children}
          childrenByParent={childrenByParent}
          level={level + 1}
        />
      )}
    </div>
  );
});
