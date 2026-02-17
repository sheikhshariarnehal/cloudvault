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
    <div className="flex flex-col h-full bg-white border-r">
      {/* Brand */}
      <div className="flex items-center gap-2 px-5 py-5">
        <Cloud className="h-7 w-7 text-primary" />
        <span className="text-xl font-bold">CloudVault</span>
      </div>

      <Separator />

      {/* User Profile */}
      <div className="flex items-center gap-3 px-5 py-4">
        <Avatar className="h-10 w-10">
          <AvatarImage src={avatarUrl} />
          <AvatarFallback className="bg-primary/10 text-primary font-semibold">
            {displayName.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold truncate">{displayName}</p>
            {isGuest && (
              <Badge variant="secondary" className="text-xs">
                Guest
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground truncate">{email}</p>
        </div>
      </div>

      <Separator />

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
        {navItems.map((item) => (
          <NavItem
            key={item.href}
            href={item.href}
            label={item.label}
            icon={item.icon}
            isActive={pathname === item.href}
          />
        ))}

        <Separator className="my-3" />

        {/* Folder Tree */}
        <div className="px-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
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
            <Button className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white">
              <Crown className="h-4 w-4 mr-2" />
              Upgrade Premium
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}
