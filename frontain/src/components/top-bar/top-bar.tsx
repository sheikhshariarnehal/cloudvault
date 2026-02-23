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
  const { toggleSidebar, openFilePicker } = useUIStore();
  const { isGuest, user, isLoading } = useAuth();
  const router = useRouter();

  const isAuthenticated = !isGuest && !!user;

  return (
    <header className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 h-16 bg-[#f8fafd] shrink-0 sticky top-0 z-40">
      {/* Mobile hamburger — hidden on desktop */}
      <Button
        variant="ghost"
        size="icon"
        className="flex-shrink-0 lg:hidden h-9 w-9 text-gray-600 hover:text-gray-900 hover:bg-gray-200/70 rounded-full"
        onClick={toggleSidebar}
        aria-label="Toggle sidebar"
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Search — grows to fill available space, centered within it */}
      <div className="flex-1 min-w-0 flex items-center justify-center">
        <SearchBar />
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-1 sm:gap-1.5 flex-shrink-0">
        {/* Mobile upload shortcut */}
        {isAuthenticated && (
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden h-9 w-9 text-gray-600 hover:text-gray-900 hover:bg-gray-200/70 rounded-full"
            onClick={() => openFilePicker?.()}
            aria-label="Upload file"
          >
            <Upload className="h-4.5 w-4.5" />
          </Button>
        )}

        {/* Notifications */}
        {isAuthenticated && <NotificationPopover />}

        {/* Auth state */}
        {isLoading ? (
          <div className="h-9 w-9 rounded-full bg-gray-200 animate-pulse" />
        ) : isAuthenticated ? (
          <UserMenu />
        ) : (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="hidden sm:flex h-9 px-5 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 hover:border-gray-400 rounded-full shadow-none transition-colors"
              onClick={() => router.push("/auth/login")}
            >
              Login
            </Button>
            <Button
              size="sm"
              className="h-9 px-5 text-sm font-medium bg-[#1a73e8] hover:bg-[#1558b0] text-white border-0 rounded-full shadow-none transition-colors"
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
