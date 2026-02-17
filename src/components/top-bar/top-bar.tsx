"use client";

import { SearchBar } from "@/components/top-bar/search-bar";
import { UserMenu } from "@/components/top-bar/user-menu";
import { Button } from "@/components/ui/button";
import { useUIStore } from "@/store/ui-store";
import { Bell, Menu, UserPlus } from "lucide-react";

export function TopBar() {
  const { toggleSidebar } = useUIStore();

  return (
    <header className="flex items-center gap-3 px-4 lg:px-6 h-[60px] bg-white border-b shrink-0">
      {/* Mobile hamburger */}
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden h-9 w-9"
        onClick={toggleSidebar}
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Search */}
      <div className="flex-1 max-w-xl">
        <SearchBar />
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-1.5 ml-auto">
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9"
          aria-label="Notifications"
        >
          <Bell className="h-[18px] w-[18px]" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white" />
        </Button>

        <Button
          variant="default"
          size="sm"
          className="hidden sm:flex items-center gap-1.5 bg-gray-900 hover:bg-gray-800 text-white h-9 text-[13px]"
        >
          <UserPlus className="h-3.5 w-3.5" />
          <span className="hidden md:inline">Invite member</span>
        </Button>

        <UserMenu />
      </div>
    </header>
  );
}
