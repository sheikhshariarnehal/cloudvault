"use client";

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

export function NavItem({ href, label, icon: Icon, isActive, badge }: NavItemProps) {
  const { setSearchQuery } = useFilesStore();

  return (
    <Link
      href={href}
      onClick={() => setSearchQuery("")}
      className={cn(
        "flex items-center gap-4 px-4 py-2.5 rounded-full text-sm font-medium transition-[background-color,color,box-shadow] duration-200",
        isActive
          ? "bg-[#c2e7ff] text-[#001d35] font-semibold"
          : "text-gray-700 hover:bg-gray-200/50 hover:text-gray-900"
      )}
    >
      <Icon className={cn("h-5 w-5 flex-shrink-0", isActive ? "text-[#001d35]" : "text-gray-600")} />
      <span className="flex-1">{label}</span>
      {badge && (
        <span className="text-[10px] font-semibold uppercase tracking-wide bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full leading-none">
          {badge}
        </span>
      )}
    </Link>
  );
}
