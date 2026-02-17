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
        "flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-150",
        isActive
          ? "bg-primary/8 text-primary shadow-sm"
          : "text-muted-foreground hover:bg-gray-100 hover:text-foreground"
      )}
    >
      <Icon className="h-[18px] w-[18px] flex-shrink-0" />
      <span>{label}</span>
    </Link>
  );
}
