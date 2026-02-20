"use client";

import Link from "next/link";
import { useRef } from "react";
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
import {
  Cloud,
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

const navItems = [
  { href: "/dashboard", label: "All Files", icon: FolderOpen },
  { href: "/dashboard/recent", label: "Recent", icon: Image },
  { href: "/dashboard/starred", label: "Starred", icon: Star },
  { href: "/dashboard/shared", label: "Shared Files", icon: Users, badge: "Soon" },
  { href: "/dashboard/trash", label: "Trash", icon: Trash2 },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, isGuest } = useAuth();
  const { folders } = useFilesStore();
  const { openFilePicker, setNewFolderModalOpen, uploadFiles } = useUIStore();
  const folderInputRef = useRef<HTMLInputElement>(null);

  const handleFolderUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) uploadFiles?.(files);
    e.target.value = "";
  };

  return (
    <div className="flex flex-col h-full w-full bg-white border-r border-gray-200">
      {/* Brand */}
      <div className="flex items-center gap-3 px-6 h-[64px] shrink-0">
        <div className="p-1.5 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600">
          <Cloud className="h-5 w-5 text-white" />
        </div>
        <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">CloudVault</span>
      </div>

      <Separator />

      {/* + New Button */}
      <div className="px-4 py-3 shrink-0">
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
              className="w-fit h-10 px-5 rounded-2xl shadow-md hover:shadow-lg border border-gray-200 bg-white text-gray-700 font-medium text-sm gap-2 transition-shadow"
            >
              <Plus className="h-4 w-4" />
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
              onClick={() => folderInputRef.current?.click()}
            >
              <div className="flex items-center justify-center w-8 h-8 rounded bg-gray-100">
                <FolderUp className="h-4 w-4 text-gray-600" />
              </div>
              <span className="text-sm">Folder upload</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Separator />

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-4 py-3 space-y-1">
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

        <Separator className="!my-4" />

        {/* Folder Tree */}
        <div className="px-1 mt-2">
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 px-2">
            Folders
          </p>
          <FolderTree folders={folders.filter((f) => !f.parent_id)} allFolders={folders} />
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
            <Button className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-md hover:shadow-lg transition-all h-10 text-sm font-semibold">
              <Crown className="h-4 w-4 mr-2" />
              Sign Up for Full Access
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}
