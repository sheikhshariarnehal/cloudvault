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
    <div className="flex flex-col h-full w-full bg-white border-r">
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-5 h-[60px] shrink-0">
        <Cloud className="h-6 w-6 text-primary" />
        <span className="text-lg font-bold tracking-tight">CloudVault</span>
      </div>

      <Separator />

      {/* User Profile */}
      <div className="flex items-center gap-3 px-4 py-3">
        <Avatar className="h-9 w-9">
          <AvatarImage src={avatarUrl} />
          <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
            {displayName.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-medium truncate">{displayName}</p>
            {isGuest && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                Guest
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground truncate">{email}</p>
        </div>
      </div>

      <Separator />

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5">
        {navItems.map((item) => (
          <NavItem
            key={item.href}
            href={item.href}
            label={item.label}
            icon={item.icon}
            isActive={pathname === item.href}
          />
        ))}

        <Separator className="!my-3" />

        {/* Folder Tree */}
        <div className="px-1">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-2 px-2">
            Folders
          </p>
          <FolderTree folders={folders.filter((f) => !f.parent_id)} allFolders={folders} />
        </div>
      </nav>

      {/* Storage Meter */}
      <div className="px-3 pb-2">
        <StorageMeter />
      </div>

      {/* Upgrade Button */}
      {(isGuest || !user) && (
        <div className="px-3 pb-3">
          <Link href="/auth/signup">
            <Button className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-sm h-9 text-sm">
              <Crown className="h-3.5 w-3.5 mr-1.5" />
              Upgrade to Pro
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}
