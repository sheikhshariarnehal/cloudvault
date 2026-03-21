"use client";

import { memo, useCallback } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useFilesStore } from "@/store/files-store";
import type { LucideIcon } from "lucide-react";

interface NavItemProps {
  href: string;
  label: string;
  icon: LucideIcon;
  isActive?: boolean;
  badge?: string;
}

export const NavItem = memo(function NavItem({ href, label, icon: Icon, isActive, badge }: NavItemProps) {
  // Use a selector so this component only re-renders when setSearchQuery itself changes (never).
  const setSearchQuery = useFilesStore((s) => s.setSearchQuery);
  const clearSearch = useCallback(() => setSearchQuery(""), [setSearchQuery]);

  return (
    <Link
      href={href}
      onClick={clearSearch}
      className={cn(
        "flex items-center gap-4 px-4 py-2.5 rounded-full text-sm font-medium transition-colors duration-150",
        isActive
          ? "bg-[#c2e7ff] text-[#001d35] font-semibold"
          : "text-[#3c4043] hover:bg-[#e8eaed] hover:text-[#202124]"
      )}
    >
      <Icon className={cn("h-5 w-5 flex-shrink-0", isActive ? "text-[#001d35]" : "text-[#5f6368]")} />
      <span className="flex-1 truncate">{label}</span>
      {badge && (
        <span className="text-[10px] font-semibold uppercase tracking-wide bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full leading-none shrink-0">
          {badge}
        </span>
      )}
    </Link>
  );
});
