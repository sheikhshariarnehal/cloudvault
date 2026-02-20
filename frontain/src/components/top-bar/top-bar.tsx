"use client";

import { SearchBar } from "@/components/top-bar/search-bar";
import { UserMenu } from "@/components/top-bar/user-menu";
import { NotificationPopover } from "@/components/top-bar/notification-popover";
import { Button } from "@/components/ui/button";
import { useUIStore } from "@/store/ui-store";
import { useAuth } from "@/app/providers/auth-provider";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Menu, Upload, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";

export function TopBar() {
  const { toggleSidebar, openFilePicker } = useUIStore();
  const { isGuest, user } = useAuth();
  const router = useRouter();

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
        {/* Mobile upload button — visible only on small screens */}
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden h-10 w-10 hover:bg-gray-100"
          onClick={() => openFilePicker?.()}
        >
          <Upload className="h-5 w-5" />
        </Button>

        <NotificationPopover />

        {isGuest || !user ? (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="hidden sm:flex items-center gap-2 h-10 text-sm font-medium text-gray-400 border-gray-200 cursor-not-allowed"
                  onClick={() => router.push("/auth/signup")}
                >
                  <UserPlus className="h-4 w-4" />
                  <span className="hidden md:inline">Invite member</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Sign up to invite members</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          <Button
            variant="default"
            size="sm"
            className="hidden sm:flex items-center gap-2 bg-gray-900 hover:bg-gray-800 text-white h-10 text-sm font-semibold shadow-sm hover:shadow"
          >
            <UserPlus className="h-4 w-4" />
            <span className="hidden md:inline">Invite member</span>
          </Button>
        )}

        <UserMenu />
      </div>
    </header>
  );
}
