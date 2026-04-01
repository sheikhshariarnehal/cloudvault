"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/app/providers/auth-provider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Settings, LogOut, ChevronDown, UserRound, ShieldCheck } from "lucide-react";

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
      <DropdownMenuTrigger
        render={(
          <button
            className="flex items-center gap-2 px-1.5 py-1 rounded-xl hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
            aria-label="Open user menu"
          >
            <Avatar className="h-8 w-8 ring-2 ring-border ring-offset-1 ring-offset-background">
              <AvatarImage src={avatarUrl} alt={displayName} />
              <AvatarFallback className="bg-primary text-primary-foreground text-xs font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
            {/* Name label — desktop only */}
            <span className="hidden md:block text-sm font-medium text-foreground max-w-[120px] truncate">
              {displayName}
            </span>
            <ChevronDown className="hidden md:block h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
          </button>
        )}
      />

      <DropdownMenuContent align="end" sideOffset={8} className="w-60 p-1.5 rounded-xl shadow-lg border border-border bg-popover text-popover-foreground">
        {/* User info header */}
        <div className="flex items-center gap-3 px-2.5 py-2.5 mb-1">
          <Avatar className="h-10 w-10 ring-2 ring-border flex-shrink-0">
            <AvatarImage src={avatarUrl} alt={displayName} />
            <AvatarFallback className="bg-primary text-primary-foreground text-sm font-bold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{displayName}</p>
            <p className="text-xs text-muted-foreground truncate">{email}</p>
          </div>
        </div>

        {/* Account badge */}
        <div className="px-2.5 pb-2">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent text-accent-foreground text-[11px] font-medium border border-border">
            <ShieldCheck className="h-3 w-3" />
            Free plan
          </span>
        </div>

        <DropdownMenuSeparator className="my-1 bg-border" />

        <DropdownMenuItem
          className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm text-foreground hover:text-foreground hover:bg-accent cursor-pointer"
          onClick={() => router.push("/drive/settings")}
        >
          <UserRound className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          Profile
        </DropdownMenuItem>

        <DropdownMenuItem
          className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm text-foreground hover:text-foreground hover:bg-accent cursor-pointer"
          onClick={() => router.push("/drive/settings")}
        >
          <Settings className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          Settings
        </DropdownMenuItem>

        <DropdownMenuSeparator className="my-1 bg-border" />

        <DropdownMenuItem
          className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm text-red-600 hover:text-red-700 hover:bg-red-50 cursor-pointer focus:text-red-700 focus:bg-red-50"
          onClick={handleSignOut}
        >
          <LogOut className="h-4 w-4 flex-shrink-0" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

