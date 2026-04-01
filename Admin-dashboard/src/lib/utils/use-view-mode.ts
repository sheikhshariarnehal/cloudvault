"use client";

import { useLayoutEffect } from "react";
import { useFilesStore } from "@/store/files-store";
import type { ViewMode } from "@/types/file.types";

/**
 * Returns the effective view mode from the store.
 * The default state is now "grid" for both desktop and mobile.
 */
export function useEffectiveViewMode(): ViewMode {
  const storeMode = useFilesStore((s) => s.viewMode);

  useLayoutEffect(() => {
    const saved = localStorage.getItem("viewMode");
    if (saved === "grid" || saved === "list") {
      useFilesStore.setState({ viewMode: saved });
    }
  }, []);

  return storeMode;
}
