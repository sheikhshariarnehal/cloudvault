"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useFilesStore } from "@/store/files-store";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

export function SearchBar() {
  const { searchQuery, setSearchQuery } = useFilesStore();
  const [localQuery, setLocalQuery] = useState("");
  const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync local state when store is cleared externally (e.g. sidebar nav click)
  useEffect(() => {
    if (searchQuery === "" && localQuery !== "") {
      setLocalQuery("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  // Keyboard shortcut to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleSearch = useCallback(
    (value: string) => {
      setLocalQuery(value);

      if (debounceTimer) clearTimeout(debounceTimer);

      const timer = setTimeout(() => {
        setSearchQuery(value);
      }, 300);

      setDebounceTimer(timer);
    },
    [debounceTimer, setSearchQuery]
  );

  return (
    <div className="relative group w-full max-w-[720px]">
      {/* Search icon */}
      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10">
        <Search className="h-4 w-4 text-gray-500 group-focus-within:text-gray-800 transition-colors" />
      </div>

      <Input
        ref={inputRef}
        type="text"
        placeholder="Search in Drive"
        value={localQuery}
        onChange={(e) => handleSearch(e.target.value)}
        className="w-full pl-11 pr-10 h-9 bg-[#e9eef6] border-none outline-none ring-0 hover:bg-[#dde3ea] focus-visible:bg-white focus-visible:ring-0 focus-visible:shadow-[0_1px_3px_rgba(0,0,0,0.2)] rounded-full text-sm placeholder:text-gray-500 transition-all duration-150"
      />

      {/* Keyboard shortcut hint — desktop only */}
      <div className="absolute inset-y-0 right-0 pr-4 hidden sm:flex items-center pointer-events-none">
        <kbd className="inline-flex items-center gap-0.5 text-[11px] font-medium text-gray-400 bg-transparent">
          <span className="text-[13px] leading-none">⌘</span>K
        </kbd>
      </div>
    </div>
  );
}
