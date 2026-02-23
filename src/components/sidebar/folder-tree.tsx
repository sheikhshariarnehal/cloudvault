"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, Folder } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DbFolder } from "@/types/file.types";

interface FolderTreeProps {
  folders: DbFolder[];
  allFolders: DbFolder[];
  level?: number;
}

export function FolderTree({ folders, allFolders, level = 0 }: FolderTreeProps) {
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
          allFolders={allFolders}
          level={level}
        />
      ))}
    </div>
  );
}

function FolderTreeItem({
  folder,
  allFolders,
  level,
}: {
  folder: DbFolder;
  allFolders: DbFolder[];
  level: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const children = allFolders.filter((f) => f.parent_id === folder.id);
  const hasChildren = children.length > 0;

  return (
    <div>
      <div
        className="flex items-center gap-1 py-1.5 px-1 rounded-full hover:bg-gray-200/50 cursor-pointer group"
        style={{ paddingLeft: `${level * 16 + 4}px` }}
      >
        {hasChildren ? (
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-0.5 hover:bg-muted-foreground/10 rounded"
          >
            <ChevronRight
              className={cn(
                "h-3.5 w-3.5 text-muted-foreground transition-transform",
                expanded && "rotate-90"
              )}
            />
          </button>
        ) : (
          <span className="w-4" />
        )}
        <Link
          href={`/drive/folder/${folder.id}`}
          className="flex items-center gap-3 flex-1 min-w-0"
        >
          <Folder
            className="h-5 w-5 flex-shrink-0"
            style={{ color: folder.color || "#5f6368" }}
            fill={folder.color || "#5f6368"}
          />
          <span className="text-sm truncate text-gray-700 font-medium">{folder.name}</span>
        </Link>
      </div>
      {expanded && hasChildren && (
        <FolderTree
          folders={children}
          allFolders={allFolders}
          level={level + 1}
        />
      )}
    </div>
  );
}
