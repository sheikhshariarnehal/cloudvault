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
        "flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-[background-color,color,box-shadow] duration-200",
        isActive
          ? "bg-gradient-to-r from-blue-50 to-blue-100 text-blue-700 shadow-sm font-semibold"
          : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
      )}
    >
      <Icon className="h-[19px] w-[19px] flex-shrink-0" />
      <span className="flex-1">{label}</span>
      {badge && (
        <span className="text-[10px] font-semibold uppercase tracking-wide bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full leading-none">
          {badge}
        </span>
      )}
    </Link>
  );
}
