"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface NavItemProps {
  href: string;
  label: string;
  icon: LucideIcon;
  isActive?: boolean;
}

export function NavItem({ href, label, icon: Icon, isActive }: NavItemProps) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-[background-color,color,box-shadow] duration-200",
        isActive
          ? "bg-gradient-to-r from-blue-50 to-blue-100 text-blue-700 shadow-sm font-semibold"
          : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
      )}
    >
      <Icon className="h-[19px] w-[19px] flex-shrink-0" />
      <span>{label}</span>
    </Link>
  );
}
