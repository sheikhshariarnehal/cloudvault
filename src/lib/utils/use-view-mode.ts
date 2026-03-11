"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import { useFilesStore } from "@/store/files-store";
import type { ViewMode } from "@/types/file.types";

const MOBILE_BREAKPOINT = 768;

/**
 * Returns the effective view mode. Forces "grid" on mobile screens.
 *
 * The inline script in layout.tsx sets `data-view-mode` on &lt;html&gt; before
 * the first paint, so the correct CSS-toggled skeleton shows immediately.
 * This hook only syncs the Zustand store from localStorage.
 */
export function useEffectiveViewMode(): ViewMode {
  const storeMode = useFilesStore((s) => s.viewMode);
  const [isMobile, setIsMobile] = useState(false);

  // Sync Zustand store from localStorage before paint.
  // Only writes to the store (not DOM/localStorage — the inline script
  // in layout.tsx already set the data-view-mode attribute).
  useLayoutEffect(() => {
    const saved = localStorage.getItem("viewMode");
    if (saved === "grid" || saved === "list") {
      useFilesStore.setState({ viewMode: saved });
    }
  }, []);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  return isMobile ? "grid" : storeMode;
}
