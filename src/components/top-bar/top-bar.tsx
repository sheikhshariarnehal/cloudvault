"use client";

import { SearchBar } from "@/components/top-bar/search-bar";
import { UserMenu } from "@/components/top-bar/user-menu";
import { NotificationPopover } from "@/components/top-bar/notification-popover";
import { Button } from "@/components/ui/button";
import { useUIStore } from "@/store/ui-store";
import { Menu, UserPlus } from "lucide-react";

export function TopBar() {
  const { toggleSidebar } = useUIStore();

  return (
    <header className="flex items-center gap-4 px-5 lg:px-8 h-[64px] bg-white border-b border-gray-200 shrink-0">
      {/* Mobile hamburger */}
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden h-10 w-10 hover:bg-gray-100"
        onClick={toggleSidebar}
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Search */}
      <div className="flex-1 max-w-2xl">
        <SearchBar />
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-2 ml-auto">
        <NotificationPopover />

        <Button
          variant="default"
          size="sm"
          className="hidden sm:flex items-center gap-2 bg-gray-900 hover:bg-gray-800 text-white h-10 text-sm font-semibold shadow-sm hover:shadow"
        >
          <UserPlus className="h-4 w-4" />
          <span className="hidden md:inline">Invite member</span>
        </Button>

        <UserMenu />
      </div>
    </header>
  );
}
