"use client";

import Link from "next/link";
import NextImage from "next/image";
import { useCallback, useMemo, useRef } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/app/providers/auth-provider";
import { useFilesStore } from "@/store/files-store";
import { useUIStore } from "@/store/ui-store";
import { StorageMeter } from "@/components/storage/storage-meter";
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
  { href: "/drive", label: "All Files", icon: FolderOpen },
  { href: "/drive/recent", label: "Recent", icon: Image },
  { href: "/drive/starred", label: "Starred", icon: Star },
  { href: "/drive/shared", label: "Shared Files", icon: Users },
  { href: "/drive/trash", label: "Trash", icon: Trash2 },
  { href: "/drive/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, isGuest } = useAuth();
  // Use granular selectors so Sidebar only re-renders when these specific values change.
  const folders = useFilesStore((s) => s.folders);
  const openFilePicker = useUIStore((s) => s.openFilePicker);
  const openFolderPicker = useUIStore((s) => s.openFolderPicker);
  const setNewFolderModalOpen = useUIStore((s) => s.setNewFolderModalOpen);
  const uploadFiles = useUIStore((s) => s.uploadFiles);
  const folderInputRef = useRef<HTMLInputElement>(null);

  // Memoize the root-level folder list to avoid a new array reference on every render.
  const rootFolders = useMemo(() => folders.filter((f) => !f.parent_id), [folders]);

  const handleFolderUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) uploadFiles?.(files);
    e.target.value = "";
  }, [uploadFiles]);

  return (
    <div className="flex flex-col h-full w-full bg-transparent">
      {/* Brand */}
      <div className="flex items-center gap-2 px-4 h-14 shrink-0">
        <NextImage
          src="/logo.webp"
          alt="CloudVault"
          width={30}
          height={30}
          className="flex-shrink-0"
          priority
        />
        <span className="text-[17px] font-normal tracking-tight text-gray-600">CloudVault</span>
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
              className="w-fit h-10 px-4 rounded-2xl shadow-sm hover:shadow-md border-none bg-white text-gray-700 font-medium text-sm gap-2 transition-shadow"
            >
              <Plus className="h-5 w-5" />
              New
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56 py-1">
            <DropdownMenuItem
              className="gap-3 py-2.5 px-3 cursor-pointer"
              onClick={() => setNewFolderModalOpen(true)}
            >
              <div className="flex items-center justify-center w-8 h-8 rounded bg-gray-100">
                <FolderPlus className="h-4 w-4 text-gray-600" />
              </div>
              <span className="text-sm">New folder</span>
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              className="gap-3 py-2.5 px-3 cursor-pointer"
              onClick={() => openFilePicker?.()}
            >
              <div className="flex items-center justify-center w-8 h-8 rounded bg-gray-100">
                <Upload className="h-4 w-4 text-gray-600" />
              </div>
              <span className="text-sm">File upload</span>
            </DropdownMenuItem>

            <DropdownMenuItem
              className="gap-3 py-2.5 px-3 cursor-pointer"
              onClick={() => openFolderPicker?.() || folderInputRef.current?.click()}
            >
              <div className="flex items-center justify-center w-8 h-8 rounded bg-gray-100">
                <FolderUp className="h-4 w-4 text-gray-600" />
              </div>
              <span className="text-sm">Folder upload</span>
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
          <FolderTree folders={rootFolders} allFolders={folders} />
        </div>
      </nav>

      {/* Storage Meter */}
      <div className="px-4 pb-3">
        <StorageMeter />
      </div>

      {/* Upgrade / Sign Up Button */}
      {(isGuest || !user) && (
        <div className="px-4 pb-4">
          <Link href="/auth/signup">
            <Button className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-md hover:shadow-lg transition-all h-10 text-sm font-medium rounded-full">
              <Crown className="h-4 w-4 mr-2" />
              Sign Up for Full Access
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}
