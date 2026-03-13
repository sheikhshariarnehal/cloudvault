"use client";

import { SearchBar } from "@/components/top-bar/search-bar";
import { UserMenu } from "@/components/top-bar/user-menu";
import { NotificationPopover } from "@/components/top-bar/notification-popover";
import { Button } from "@/components/ui/button";
import { useUIStore } from "@/store/ui-store";
import { useAuth } from "@/app/providers/auth-provider";
import { Menu, Upload } from "lucide-react";
import { useRouter } from "next/navigation";

export function TopBar() {
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const openFilePicker = useUIStore((s) => s.openFilePicker);
  const { isGuest, user, isLoading } = useAuth();
  const router = useRouter();

  const isAuthenticated = !isGuest && !!user;

  return (
    <header className="flex items-center gap-1.5 sm:gap-3 px-2 sm:px-4 h-14 sm:h-16 bg-background text-foreground shrink-0 sticky top-0 z-40">
      {/* Mobile hamburger — hidden on desktop */}
      <Button
        variant="ghost"
        size="icon"
        className="flex-shrink-0 lg:hidden h-9 w-9 text-muted-foreground hover:text-foreground hover:bg-accent rounded-full"
        onClick={toggleSidebar}
        aria-label="Toggle sidebar"
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Search — grows to fill available space, aligned to the start */}
      <div className="flex-1 min-w-0 flex items-center justify-start">
        <SearchBar />
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-1 sm:gap-1.5 flex-shrink-0">
        {/* Upload action (desktop/tablet only) */}
        {isAuthenticated && (
          <Button
            variant="outline"
            size="sm"
            className="hidden sm:inline-flex h-9 px-4 rounded-full border-[#dadce0] bg-white text-[#3c4043] hover:bg-[#f8f9fa] hover:border-[#dadce0] shadow-none"
            onClick={() => openFilePicker?.()}
            aria-label="Upload file"
          >
            <Upload className="h-4 w-4" />
            Upload
          </Button>
        )}

        {/* Notifications */}
        {isAuthenticated && <NotificationPopover />}

        {/* Auth state */}
        {isLoading ? (
          <div className="h-9 w-9 rounded-full bg-muted/80 animate-pulse" />
        ) : isAuthenticated ? (
          <UserMenu />
        ) : (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="hidden sm:flex h-9 px-5 text-sm font-medium border-border hover:bg-accent rounded-full shadow-none transition-colors"
              onClick={() => router.push("/auth/login")}
            >
              Login
            </Button>
            <Button
              size="sm"
              className="h-9 px-5 text-sm font-medium rounded-full shadow-none transition-colors"
              onClick={() => router.push("/auth/signup")}
            >
              Sign up
            </Button>
          </div>
        )}
      </div>
    </header>
  );
}
