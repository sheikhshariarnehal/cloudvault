"use client";

import { LayoutGrid, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ViewMode } from "@/types/file.types";

interface ViewModeToggleProps {
  viewMode: ViewMode;
  onChange: (mode: ViewMode) => void;
  className?: string;
}

export function ViewModeToggle({ viewMode, onChange, className }: ViewModeToggleProps) {
  const isListActive = viewMode === "list";
  const isGridActive = viewMode === "grid";

  return (
    <div
      role="group"
      aria-label="View mode"
      className={cn("flex items-center gap-0 p-[1px] rounded-full bg-[#f1f3f4]", className)}
    >
      <Button
        variant="ghost"
        size="icon"
        aria-label="List view"
        aria-pressed={isListActive}
        className={cn(
          "h-7 w-7 rounded-full",
          isListActive
            ? "bg-white text-[#202124] shadow-sm hover:bg-white"
            : "text-[#5f6368] hover:bg-white/70"
        )}
        onClick={() => onChange("list")}
      >
        <List className="h-4 w-4" aria-hidden="true" />
      </Button>

      <Button
        variant="ghost"
        size="icon"
        aria-label="Grid view"
        aria-pressed={isGridActive}
        className={cn(
          "h-7 w-7 rounded-full",
          isGridActive
            ? "bg-white text-[#202124] shadow-sm hover:bg-white"
            : "text-[#5f6368] hover:bg-white/70"
        )}
        onClick={() => onChange("grid")}
      >
        <LayoutGrid className="h-4 w-4" aria-hidden="true" />
      </Button>
    </div>
  );
}
