"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/app/providers/auth-provider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Settings, LogOut } from "lucide-react";

export function UserMenu() {
  const { user, signOut } = useAuth();
  const router = useRouter();

  const displayName =
    user?.user_metadata?.display_name ||
    user?.user_metadata?.full_name ||
    user?.email?.split("@")[0] ||
    "User";
  const avatarUrl = user?.user_metadata?.avatar_url;
  const email = user?.email ?? "";

  // Compute initials (up to 2 chars)
  const initials = displayName
    .split(" ")
    .slice(0, 2)
    .map((w: string) => w[0])
    .join("")
    .toUpperCase();

  const handleSignOut = async () => {
    await signOut();
    router.push("/auth/login");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="flex items-center justify-center h-10 w-10 md:h-12 md:w-12 rounded-full hover:bg-[#f1f3f4] dark:hover:bg-gray-800 focus:outline-none transition-colors"
          aria-label="Open user menu"
        >
          <Avatar className="h-8 w-8 md:h-10 md:w-10 ring-2 ring-transparent ring-offset-0">
            <AvatarImage src={avatarUrl} alt={displayName} />
            <AvatarFallback className="bg-[#ba68c8] hover:bg-[#ab47bc] transition-colors text-white text-[14px] md:text-[16px] font-medium transition-colors">
              {initials}
            </AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent 
        align="end" 
        sideOffset={8} 
        className="w-[calc(100vw-1rem)] max-w-[360px] p-0 rounded-3xl border border-[#dadce0] bg-[#eef0f4] dark:bg-gray-900 shadow-md overflow-hidden font-sans"
      >
        {/* User info header card */}
        <div className="bg-white dark:bg-gray-800 m-1.5 sm:m-2 rounded-[20px] p-4 flex flex-col items-center justify-center pt-8 pb-6">
          <Avatar className="h-[72px] w-[72px] mb-3 ring-2 ring-border flex-shrink-0 bg-transparent">
            <AvatarImage src={avatarUrl} alt={displayName} />
            <AvatarFallback className="bg-[#ab47bc] text-white text-[28px] font-medium">
              {initials}
            </AvatarFallback>
          </Avatar>
          <p className="text-[#202124] dark:text-gray-100 text-[16px] mb-0.5 font-medium">Hi, {displayName}!</p>
          <p className="text-[#5f6368] dark:text-gray-400 text-[14px] mb-4">{email}</p>
          
          <button 
            className="w-auto px-6 py-2 rounded-full border border-[#dadce0] dark:border-gray-700 text-[#0b57d0] dark:text-blue-400 text-[14px] font-medium hover:bg-[#f8f9fa] dark:hover:bg-gray-700 transition-colors"
            onClick={() => router.push("/drive/settings")}
          >
            Manage your NDrive Account
          </button>
        </div>

        {/* Lower actions section bg-[#eef0f4] */}
        <div className="flex bg-white dark:bg-gray-800 m-1.5 sm:m-2 mt-0.5 rounded-[20px] border border-transparent overflow-hidden h-[54px]">
          <button 
            className="flex-1 flex items-center justify-center gap-2 hover:bg-[#f8f9fa] dark:hover:bg-gray-700 text-[#202124] dark:text-gray-200 text-[14px] font-medium transition-colors"
            onClick={() => router.push("/drive/settings")}
          >
            <Settings className="h-[20px] w-[20px] text-[#5f6368] dark:text-gray-400" strokeWidth={1.5} />
            Settings
          </button>
          
          <div className="w-[1px] h-full bg-[#dadce0] dark:bg-gray-700 my-auto"></div>
          
          <button 
            className="flex-1 flex items-center justify-center gap-2 hover:bg-[#f8f9fa] dark:hover:bg-gray-700 text-[#202124] dark:text-gray-200 text-[14px] font-medium transition-colors"
            onClick={handleSignOut}
          >
            <LogOut className="h-[20px] w-[20px] text-[#5f6368] dark:text-gray-400" strokeWidth={1.5} />
            Sign out
          </button>
        </div>

        <div className="flex justify-center items-center gap-3 sm:gap-4 pt-1 pb-3 text-[11px] sm:text-[12px] text-[#5f6368] dark:text-gray-400 bg-[#eef0f4] dark:bg-gray-900 border-t-0 border-[#eef0f4] dark:border-gray-800">
           <a href="#" className="hover:text-[#202124] hover:bg-[#f1f3f4] px-1.5 py-0.5 rounded transition-colors">Privacy Policy</a>
           <span>•</span>
           <a href="#" className="hover:text-[#202124] hover:bg-[#f1f3f4] px-1.5 py-0.5 rounded transition-colors">Terms of Service</a>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
