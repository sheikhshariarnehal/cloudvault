"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/app/providers/auth-provider";
import { useFilesStore } from "@/store/files-store";
import { StorageMeter } from "@/components/storage/storage-meter";
import { FolderTree } from "@/components/sidebar/folder-tree";
import { NavItem } from "@/components/sidebar/nav-item";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Cloud,
  FolderOpen,
  Image,
  Star,
  Users,
  Trash2,
  Settings,
  Crown,
} from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "All Files", icon: FolderOpen },
  { href: "/dashboard/recent", label: "Photo", icon: Image },
  { href: "/dashboard/starred", label: "Favorite", icon: Star },
  { href: "/dashboard/shared", label: "Shared Files", icon: Users },
  { href: "/dashboard/trash", label: "Delete Files", icon: Trash2 },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, isGuest } = useAuth();
  const { folders } = useFilesStore();

  const displayName = user?.user_metadata?.display_name || user?.email?.split("@")[0] || "Guest";
  const email = user?.email || "Guest mode";
  const avatarUrl = user?.user_metadata?.avatar_url;

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

      {/* User Profile */}
      <div className="flex items-center gap-3 px-5 py-4 hover:bg-gray-50 transition-colors cursor-pointer">
        <Avatar className="h-10 w-10 ring-2 ring-gray-100">
          <AvatarImage src={avatarUrl} />
          <AvatarFallback className="bg-gradient-to-br from-blue-500 to-blue-600 text-white text-sm font-bold">
            {displayName.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold truncate text-gray-900">{displayName}</p>
            {isGuest && (
              <Badge variant="secondary" className="text-[10px] px-2 py-0.5 font-medium">
                Guest
              </Badge>
            )}
          </div>
          <p className="text-xs text-gray-500 truncate">{email}</p>
        </div>
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

      {/* Upgrade Button */}
      {(isGuest || !user) && (
        <div className="px-4 pb-4">
          <Link href="/auth/signup">
            <Button className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-md hover:shadow-lg transition-all h-10 text-sm font-semibold">
              <Crown className="h-4 w-4 mr-2" />
              Upgrade to Pro
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}
