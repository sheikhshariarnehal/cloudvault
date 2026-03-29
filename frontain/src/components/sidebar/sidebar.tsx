"use client";
import { NewDropdownMenu } from "@/components/context-menu/global-context-menu";

import Link from "next/link";
import NextImage from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import dynamic from "next/dynamic";
import { useAuth } from "@/app/providers/auth-provider";
import { useFilesStore } from "@/store/files-store";
import { useUIStore } from "@/store/ui-store";
import { NavItem } from "@/components/sidebar/nav-item";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import type { LucideIcon } from "lucide-react";
import {
  FolderOpen,
  History,
  Star,
  Users,
  Trash2,
  Settings,
  Crown,
  Plus,
  FolderPlus,
  Upload,
  FolderUp,
  ImageIcon,
  FileText,
  Table,
  Presentation,
  PlaySquare,
  ListTodo,
  ChevronRight
} from "lucide-react";

const navItems: Array<{ href: string; label: string; icon: LucideIcon; badge?: string }> = [
  { href: "/drive", label: "My Drive", icon: FolderOpen },
  { href: "/drive/photos", label: "Photos", icon: ImageIcon },
  { href: "/drive/recent", label: "Recent", icon: History },
  { href: "/drive/starred", label: "Starred", icon: Star },
  { href: "/drive/shared", label: "Shared with me", icon: Users },
  { href: "/drive/trash", label: "Bin", icon: Trash2 },
  { href: "/drive/settings", label: "Settings", icon: Settings },
];

const StorageMeter = dynamic(
  () => import("@/components/storage/storage-meter").then((m) => ({ default: m.StorageMeter })),
  { ssr: false }
);

function SidebarLoadingSkeleton() {
  return (
    <>
      <div className="px-4 py-2 shrink-0 mt-1">
        <div className="h-14 w-28 rounded-2xl border border-[#dadce0] bg-white animate-pulse" />
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-1.5 mt-2" style={{ contain: "layout style" }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={`nav-${i}`} className="h-10 rounded-full bg-[#e8eaed] animate-pulse" />
        ))}
      </nav>

      <div className="px-4 pb-3">
        <div className="h-20 rounded-xl bg-[#f1f3f4] animate-pulse" />
      </div>
    </>
  );
}

export function Sidebar() {
  const [secondaryReady, setSecondaryReady] = useState(false);
  const pathname = usePathname();
  const { user, isGuest, isLoading: authLoading } = useAuth();
  const filesLoading = useFilesStore((s) => s.isLoading);
  const dataLoaded = useFilesStore((s) => s.dataLoaded);
  const openFilePicker = useUIStore((s) => s.openFilePicker);
  const openFolderPicker = useUIStore((s) => s.openFolderPicker);
  const setNewFolderModalOpen = useUIStore((s) => s.setNewFolderModalOpen);
  const uploadFiles = useUIStore((s) => s.uploadFiles);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const showLoadingSkeleton = authLoading || filesLoading || !dataLoaded;

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

      {showLoadingSkeleton ? (
        <SidebarLoadingSkeleton />
      ) : (
        <>
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
                  className="w-fit h-14 px-6 rounded-2xl border border-transparent bg-white shadow-[0_1px_3px_rgb(0_0_0/0.1),0_1px_2px_rgb(0_0_0/0.06)] hover:bg-[#f8f9fa] hover:shadow-[0_1px_3px_rgb(0_0_0/0.15),0_1px_2px_rgb(0_0_0/0.1)] text-[#202124] font-medium text-sm gap-3 transition-[background-color,box-shadow]"
                >
                  <Plus className="h-6 w-6 stroke-[2]" />
                  <span>New</span>
                </Button>
              </DropdownMenuTrigger>
              <NewDropdownMenu folderInputRef={folderInputRef} />
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
          </nav>

          {/* Storage Meter */}
          <div className="px-4 pb-3">
            {secondaryReady ? <StorageMeter /> : null}
          </div>

          {/* Upgrade / Sign Up Button */}
          {!authLoading && (isGuest || !user) && (
            <div className="px-4 pb-4">
              <Link href="/auth/signup">
                <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm transition-colors h-10 text-sm font-medium rounded-full">
                  <Crown className="h-4 w-4 mr-2" />
                  Sign Up for Full Access
                </Button>
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  );
}
