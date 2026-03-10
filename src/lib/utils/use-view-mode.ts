"use client";

import { useFilesStore } from "@/store/files-store";
import type { ViewMode } from "@/types/file.types";

/**
 * Returns the effective view mode. Respects the store value on all screen sizes.
 */
export function useEffectiveViewMode(): ViewMode {
  return useFilesStore((s) => s.viewMode);
}
