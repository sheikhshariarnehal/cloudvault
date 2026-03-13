"use client";

import Link from "next/link";
import NextImage from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import dynamic from "next/dynamic";
import { useAuth } from "@/app/providers/auth-provider";
import { useFilesStore } from "@/store/files-store";
import { useUIStore } from "@/store/ui-store";
import { FolderTree } from "@/components/sidebar/folder-tree";
import { NavItem } from "@/components/sidebar/nav-item";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { LucideIcon } from "lucide-react";
import {
  FolderOpen,
  Image,
  Star,
  Users,
  Trash2,
  Settings,
  Crown,
  Plus,
  FolderPlus,
  Upload,
  FolderUp,
} from "lucide-react";

const navItems: Array<{ href: string; label: string; icon: LucideIcon; badge?: string }> = [
  { href: "/drive", label: "My Drive", icon: FolderOpen },
  { href: "/drive/recent", label: "Recent", icon: Image },
  { href: "/drive/starred", label: "Starred", icon: Star },
  { href: "/drive/shared", label: "Shared with me", icon: Users },
  { href: "/drive/trash", label: "Bin", icon: Trash2 },
  { href: "/drive/settings", label: "Settings", icon: Settings },
];

const StorageMeter = dynamic(
  () => import("@/components/storage/storage-meter").then((m) => ({ default: m.StorageMeter })),
  { ssr: false }
);

export function Sidebar() {
  const [secondaryReady, setSecondaryReady] = useState(false);
  const pathname = usePathname();
  const { user, isGuest, isLoading } = useAuth();
  // Use granular selectors so Sidebar only re-renders when these specific values change.
  const folders = useFilesStore((s) => s.folders);
  const openFilePicker = useUIStore((s) => s.openFilePicker);
  const openFolderPicker = useUIStore((s) => s.openFolderPicker);
  const setNewFolderModalOpen = useUIStore((s) => s.setNewFolderModalOpen);
  const uploadFiles = useUIStore((s) => s.uploadFiles);
  const folderInputRef = useRef<HTMLInputElement>(null);

  // Memoize the root-level folder list to avoid a new array reference on every render.
  const rootFolders = useMemo(() => folders.filter((f) => !f.parent_id), [folders]);
  const childrenByParent = useMemo(() => {
    const map = new Map<string, typeof folders>();
    for (const folder of folders) {
      if (!folder.parent_id) continue;
      const list = map.get(folder.parent_id);
      if (list) {
        list.push(folder);
      } else {
        map.set(folder.parent_id, [folder]);
      }
    }
    return map;
  }, [folders]);

  const handleFolderUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) uploadFiles?.(files);
    e.target.value = "";
  }, [uploadFiles]);

  useEffect(() => {
    const timer = window.setTimeout(() => setSecondaryReady(true), 0);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="flex flex-col h-full w-full bg-transparent">
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-4 h-14 shrink-0">
        <NextImage
          src="/logo.webp"
          alt="NDrive"
          width={34}
          height={34}
          className="flex-shrink-0"
          priority
        />
        <span className="text-[30px] leading-none tracking-tight text-[#3c4043]" aria-label="NDrive">
          <span className="font-bold">N</span>
          <span className="font-normal">D</span>
          <span className="font-bold">rive</span>
        </span>
      </div>

      {/* + New Button */}
      <div className="px-4 py-2 shrink-0 mt-1">
        <input
          ref={folderInputRef}
          type="file"
          // @ts-ignore
          webkitdirectory=""
          multiple
          className="hidden"
          onChange={handleFolderUpload}
        />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className="w-fit h-12 px-6 rounded-2xl border border-[#dadce0] bg-white hover:bg-[#f8f9fa] text-[#202124] font-medium text-sm gap-2.5 transition-all"
            >
              <Plus className="h-5 w-5" />
              <span>New</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="w-[360px] p-0 rounded-[12px] border border-[#dadce0] bg-white text-[#202124] shadow-[0_1px_2px_rgba(60,64,67,0.3),0_1px_3px_1px_rgba(60,64,67,0.15)] overflow-hidden"
          >
            <DropdownMenuItem
              className="h-14 px-4 rounded-none flex items-center justify-between cursor-pointer focus:bg-[#f1f3f4]"
              onClick={() => setNewFolderModalOpen(true)}
            >
              <div className="flex items-center gap-4 min-w-0">
                <FolderPlus className="h-5 w-5 text-[#5f6368] flex-shrink-0" />
                <span className="text-base leading-none">New folder</span>
              </div>
              <span className="text-sm text-[#5f6368]">Alt+C then F</span>
            </DropdownMenuItem>

            <DropdownMenuSeparator className="my-0 bg-[#e0e3e7]" />

            <DropdownMenuItem
              className="h-14 px-4 rounded-none flex items-center justify-between cursor-pointer focus:bg-[#f1f3f4]"
              onClick={() => openFilePicker?.()}
            >
              <div className="flex items-center gap-4 min-w-0">
                <Upload className="h-5 w-5 text-[#5f6368] flex-shrink-0" />
                <span className="text-base leading-none">File upload</span>
              </div>
              <span className="text-sm text-[#5f6368]">Alt+C then U</span>
            </DropdownMenuItem>

            <DropdownMenuSeparator className="my-0 bg-[#e0e3e7]" />

            <DropdownMenuItem
              className="h-14 px-4 rounded-none flex items-center justify-between cursor-pointer focus:bg-[#f1f3f4]"
              onClick={() => openFolderPicker?.() || folderInputRef.current?.click()}
            >
              <div className="flex items-center gap-4 min-w-0">
                <FolderUp className="h-5 w-5 text-[#5f6368] flex-shrink-0" />
                <span className="text-base leading-none">Folder upload</span>
              </div>
              <span className="text-sm text-[#5f6368]">Alt+C then I</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Navigation — overflow-y-auto with GPU-composited scroll */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5 mt-2" style={{ contain: "layout style" }}>
        {navItems.map((item) => (
          <NavItem
            key={item.href}
            href={item.href}
            label={item.label}
            icon={item.icon}
            isActive={pathname === item.href}
            badge={item.badge}
          />
        ))}

        {/* Folder Tree */}
        <div className="px-1 mt-4">
          {secondaryReady ? (
            <FolderTree folders={rootFolders} childrenByParent={childrenByParent} />
          ) : (
            <p className="text-xs text-muted-foreground px-2 py-1">Loading folders...</p>
          )}
        </div>
      </nav>

      {/* Storage Meter */}
      <div className="px-4 pb-3">
        {secondaryReady ? <StorageMeter /> : null}
      </div>

      {/* Upgrade / Sign Up Button */}
      {!isLoading && (isGuest || !user) && (
        <div className="px-4 pb-4">
          <Link href="/auth/signup">
            <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm transition-all h-10 text-sm font-medium rounded-full">
              <Crown className="h-4 w-4 mr-2" />
              Sign Up for Full Access
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}
