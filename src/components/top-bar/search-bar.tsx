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
      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
      <Input
        type="text"
        placeholder="Search files and folders..."
        value={localQuery}
        onChange={(e) => handleSearch(e.target.value)}
        className="pl-10 h-9 bg-gray-50/80 border-gray-200 focus:bg-white rounded-lg text-sm"
      />
    </div>
  );
}
