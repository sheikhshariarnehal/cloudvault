"use client";

import { usePathname } from "next/navigation";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
import React from "react";

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

  // Create breadcrumb segments
  const pathSegments = pathname.split("/").filter(Boolean);

  return (
    <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center justify-between gap-3 border-b border-border/50 bg-background/95 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/60 sm:gap-4 sm:px-5 lg:px-6">
      <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-4">
        <SidebarTrigger className="-ml-1 text-muted-foreground transition-colors hover:text-foreground sm:-ml-2" />
        <div className="hidden sm:flex h-4 w-px bg-border mx-1" />
        
        {/* Dynamic Breadcrumbs */}
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
        {/* Global Search */}
        <div className="relative hidden md:flex items-center">
          <Search className="absolute left-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search resources..." 
            className="h-9 w-[220px] pl-9 bg-muted/30 border-border/50 shadow-none focus-visible:bg-transparent lg:w-[280px] xl:w-[340px]" 
          />
          <div className="absolute right-2.5 flex items-center gap-1">
            <kbd className="inline-flex h-5 items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
              <span className="text-xs">⌘</span>K
            </kbd>
          </div>
        </div>

        <div className="flex items-center gap-2 border-l border-border pl-3 sm:gap-3 sm:pl-4">
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
