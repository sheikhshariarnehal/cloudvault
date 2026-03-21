"use client";

import { usePathname } from "next/navigation";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/app/providers/auth-provider";
import { Search, Bell } from "lucide-react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { ThemeToggle } from "@/components/dashboard/theme-toggle";
import { CommandPalette, useCommandPalette } from "@/components/dashboard/command-palette";
import React from "react";

function HeaderSearchButton() {
  const { open, setOpen } = useCommandPalette();

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="hidden md:flex items-center gap-2 h-9 px-3 bg-muted/30 border border-border/50 rounded-lg hover:bg-muted/50 transition-colors"
      >
        <Search className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Search...</span>
        <kbd className="pointer-events-none flex items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>
      <CommandPalette open={open} onOpenChange={setOpen} />
    </>
  );
}

export function AppHeader() {
  const pathname = usePathname();
  const { user } = useAuth();

  const displayName =
    user?.user_metadata?.display_name ||
    user?.user_metadata?.full_name ||
    user?.email?.split("@")[0] ||
    "Admin";

  const avatarUrl = user?.user_metadata?.avatar_url;
  const initials = displayName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((word: string) => word[0])
    .join("")
    .toUpperCase();

  const pathSegments = pathname.split("/").filter(Boolean);

  return (
    <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center justify-between gap-3 border-b border-border/50 bg-background/95 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/60 sm:gap-4 sm:px-5 lg:px-6">
      <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-4">
        <SidebarTrigger className="-ml-1 text-muted-foreground transition-colors hover:text-foreground sm:-ml-2" />
        <div className="hidden sm:flex h-4 w-px bg-border mx-1" />
        
        <Breadcrumb className="hidden sm:flex">
          <BreadcrumbList className="text-sm">
            <BreadcrumbItem>
              <BreadcrumbLink href="/" className="transition-colors hover:text-foreground">App</BreadcrumbLink>
            </BreadcrumbItem>
            {pathSegments.length > 0 ? (
              <>
                <BreadcrumbSeparator />
                {pathSegments.map((segment, index) => {
                  const isLast = index === pathSegments.length - 1;
                  const title = segment.charAt(0).toUpperCase() + segment.slice(1);
                  const href = "/" + pathSegments.slice(0, index + 1).join("/");
                  
                  return (
                    <React.Fragment key={href}>
                      <BreadcrumbItem>
                        {isLast ? (
                          <BreadcrumbPage className="font-medium text-foreground tracking-tight">{title}</BreadcrumbPage>
                        ) : (
                          <BreadcrumbLink href={href} className="transition-colors hover:text-foreground">{title}</BreadcrumbLink>
                        )}
                      </BreadcrumbItem>
                      {!isLast && <BreadcrumbSeparator />}
                    </React.Fragment>
                  );
                })}
              </>
            ) : (
              <>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage className="font-medium text-foreground tracking-tight">Overview</BreadcrumbPage>
                </BreadcrumbItem>
              </>
            )}
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      <div className="flex items-center gap-2 sm:gap-3 lg:gap-4">
        <HeaderSearchButton />

        <div className="flex items-center gap-2 border-l border-border pl-3 sm:gap-3 sm:pl-4">
          <ThemeToggle />
          
          <button 
            aria-label="Notifications"
            className="relative w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            <Bell className="h-[18px] w-[18px]" />
            <span className="absolute top-1 right-1.5 w-2 h-2 rounded-full bg-blue-500 border-2 border-background" />
          </button>
          
          <Badge variant="outline" className="hidden sm:inline-flex bg-primary/10 text-primary border-primary/20 text-xs shadow-none">
            Admin
          </Badge>
          
          <Avatar className="h-8 w-8 cursor-pointer ring-1 ring-border/50 transition-all hover:ring-primary/50">
            <AvatarImage src={avatarUrl} alt={displayName} />
            <AvatarFallback className="bg-primary/5 text-primary text-xs">{initials}</AvatarFallback>
          </Avatar>
        </div>
      </div>
    </header>
  );
}
