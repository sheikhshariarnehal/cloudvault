"use client";

import { useSyncExternalStore } from "react";
import { subscribeToViewMode } from "@/store/files-store";
import type { ViewMode } from "@/types/file.types";

const STORAGE_KEY = "viewMode";
const DEFAULT_MODE: ViewMode = "grid";

function getSnapshot(): ViewMode {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "grid" || saved === "list") return saved;
  } catch {
    // localStorage not available
  }
  return DEFAULT_MODE;
}

function getServerSnapshot(): ViewMode {
  return DEFAULT_MODE;
}

/**
 * Returns the view mode directly from localStorage using useSyncExternalStore.
 * This ensures the client always reads the correct value from localStorage
 * without hydration mismatches causing a flash.
 * 
 * Uses the shared subscriber system from files-store.ts so that when
 * setViewMode is called, this hook re-renders with the new value.
 */
export function useEffectiveViewMode(): ViewMode {
  return useSyncExternalStore(subscribeToViewMode, getSnapshot, getServerSnapshot);
}
