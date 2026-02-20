"use client";

import { SearchBar } from "@/components/top-bar/search-bar";
import { UserMenu } from "@/components/top-bar/user-menu";
import { NotificationPopover } from "@/components/top-bar/notification-popover";
import { Button } from "@/components/ui/button";
import { useUIStore } from "@/store/ui-store";
import { useAuth } from "@/app/providers/auth-provider";
import { Menu, Upload, LogIn, UserRoundPlus } from "lucide-react";
import { useRouter } from "next/navigation";

export function TopBar() {
  const { toggleSidebar, openFilePicker } = useUIStore();
  const { isGuest, user, isLoading } = useAuth();
  const router = useRouter();

  const isAuthenticated = !isGuest && !!user;

  return (
    <header className="flex items-center gap-2 sm:gap-4 px-4 sm:px-6 lg:px-8 h-16 bg-white border-b border-gray-100 shrink-0 shadow-sm">
      {/* Mobile hamburger */}
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden h-9 w-9 flex-shrink-0 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
        onClick={toggleSidebar}
        aria-label="Toggle sidebar"
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Search */}
      <div className="flex-1 min-w-0 max-w-xl">
        <SearchBar />
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-1 sm:gap-2 ml-auto flex-shrink-0">
        {/* Mobile upload shortcut */}
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden h-9 w-9 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
          onClick={() => openFilePicker?.()}
          aria-label="Upload file"
        >
          <Upload className="h-5 w-5" />
        </Button>

        {/* Notifications — only for authenticated users */}
        {isAuthenticated && <NotificationPopover />}

        {/* Auth state: guest → login + signup buttons; loading → skeleton; logged in → user menu */}
        {isLoading ? (
          <div className="h-8 w-8 rounded-full bg-gray-100 animate-pulse" />
        ) : isAuthenticated ? (
          <UserMenu />
        ) : (
          <div className="flex items-center gap-1.5 sm:gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-9 px-3 sm:px-4 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
              onClick={() => router.push("/auth/login")}
            >
              <LogIn className="h-4 w-4 sm:mr-1.5 shrink-0" />
              <span className="hidden sm:inline">Log in</span>
            </Button>
            <Button
              variant="default"
              size="sm"
              className="h-9 px-3 sm:px-4 text-sm font-semibold bg-gray-900 hover:bg-gray-800 text-white rounded-lg shadow-sm"
              onClick={() => router.push("/auth/signup")}
            >
              <UserRoundPlus className="h-4 w-4 sm:mr-1.5 shrink-0" />
              <span className="hidden sm:inline">Sign up</span>
            </Button>
          </div>
        )}
      </div>
    </header>
  );
}
