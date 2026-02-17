"use client";

import { SearchBar } from "@/components/top-bar/search-bar";
import { UserMenu } from "@/components/top-bar/user-menu";
import { Button } from "@/components/ui/button";
import { useUIStore } from "@/store/ui-store";
import { Bell, Menu, UserPlus } from "lucide-react";

export function TopBar() {
  const { toggleSidebar } = useUIStore();

  return (
    <header className="flex items-center gap-4 px-4 md:px-6 py-3 bg-white border-b">
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        onClick={toggleSidebar}
      >
        <Menu className="h-5 w-5" />
      </Button>

      <div className="flex-1 max-w-xl">
        <SearchBar />
      </div>

      <div className="flex items-center gap-2 ml-auto">
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
        </Button>

        <Button
          variant="default"
          size="sm"
          className="hidden md:flex items-center gap-2 bg-gray-900 hover:bg-gray-800 text-white"
        >
          <UserPlus className="h-4 w-4" />
          Invite member
        </Button>

        <UserMenu />
      </div>
    </header>
  );
}
