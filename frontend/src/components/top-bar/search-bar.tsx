"use client";

import { useState, useCallback } from "react";
import { useFilesStore } from "@/store/files-store";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

export function SearchBar() {
  const { setSearchQuery } = useFilesStore();
  const [localQuery, setLocalQuery] = useState("");
  const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(null);

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
    <div className="relative">
      <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-[18px] w-[18px] text-gray-400 pointer-events-none" />
      <Input
        type="text"
        placeholder="Search files and folders..."
        value={localQuery}
        onChange={(e) => handleSearch(e.target.value)}
        className="pl-11 h-11 bg-gray-50 border-gray-200 focus:bg-white rounded-xl text-sm font-medium placeholder:text-gray-400 shadow-sm"
      />
    </div>
  );
}
