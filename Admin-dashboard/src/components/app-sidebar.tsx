"use client";

import {
  BarChart3,
  Cloud,
  DatabaseZap,
  Files,
  LayoutDashboard,
  LogOut,
  Settings,
  Share2,
  ShieldAlert,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";

const NAV_ITEMS = [
  { title: "Overview", url: "/", icon: LayoutDashboard },
  { title: "Users", url: "/users", icon: Users },
  { title: "Files", url: "/files", icon: Files },
  { title: "Storage", url: "/storage", icon: DatabaseZap },
  { title: "Shares", url: "/shares", icon: Share2 },
  { title: "Metrics", url: "/system", icon: BarChart3 },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="icon" className="border-r border-border/50 bg-card">
      <SidebarHeader className="flex items-center justify-center py-4">
        <div className="flex w-full items-center gap-2.5 px-2 font-bold text-base tracking-tight text-foreground group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
          <div className="flex items-center justify-center rounded-md bg-primary/10 p-1.5">
            <Cloud className="h-5 w-5 text-primary" />
          </div>
          <span className="truncate group-data-[collapsible=icon]:hidden">CloudVault</span>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2.5 group-data-[collapsible=icon]:px-0">
        <SidebarGroup>
          <SidebarGroupLabel className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Platform
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {NAV_ITEMS.map((item) => {
                const isActive = pathname === item.url;

                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      render={<Link href={item.url} />}
                      isActive={isActive}
                      tooltip={item.title}
                      className="h-9 gap-2.5 rounded-md px-3 transition-all"
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-3">
          <SidebarGroupLabel className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            System
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              <SidebarMenuItem>
                <SidebarMenuButton
                  render={<Link href="/settings" />}
                  tooltip="Access Control"
                  className="h-9 gap-2.5 rounded-md px-3 text-muted-foreground transition-all hover:bg-muted/80 hover:text-foreground"
                >
                  <ShieldAlert className="h-4 w-4 shrink-0" />
                  <span className="truncate flex-1">Access Control</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  render={<Link href="/settings" />}
                  tooltip="Configuration"
                  className="h-9 gap-2.5 rounded-md px-3 text-muted-foreground transition-all hover:bg-muted/80 hover:text-foreground"
                >
                  <Settings className="h-4 w-4 shrink-0" />
                  <span className="truncate flex-1">Configuration</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="mt-auto shrink-0 p-3 pt-2 pb-[calc(2rem+env(safe-area-inset-bottom))] md:pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              render={<Link href="/logout" />}
              tooltip="Logout"
              className="h-9 gap-2.5 rounded-md text-muted-foreground transition-all hover:bg-destructive/10 hover:text-destructive"
            >
              <LogOut className="h-4 w-4 shrink-0" />
              <span className="font-medium group-data-[collapsible=icon]:hidden">Sign Out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
