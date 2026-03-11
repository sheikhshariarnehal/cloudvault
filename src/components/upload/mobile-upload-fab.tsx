"use client";

import { useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { useUIStore } from "@/store/ui-store";

export function MobileUploadFab() {
  const openFilePicker = useUIStore((s) => s.openFilePicker);
  const [visible, setVisible] = useState(true);
  const lastScrollY = useRef(0);

  useEffect(() => {
    // The scrollable container is the overflow-y-auto div inside the drive layout
    const scroller = document.querySelector<HTMLElement>(
      "main .overflow-y-auto"
    );
    if (!scroller) return;

    const THRESHOLD = 8;

    const onScroll = () => {
      const y = scroller.scrollTop;
      if (y - lastScrollY.current > THRESHOLD) setVisible(false);
      else if (lastScrollY.current - y > THRESHOLD) setVisible(true);
      lastScrollY.current = y;
    };

    scroller.addEventListener("scroll", onScroll, { passive: true });
    return () => scroller.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <button
      onClick={() => openFilePicker?.()}
      className={`fixed bottom-[max(1.25rem,env(safe-area-inset-bottom,0.75rem))] right-4 z-40 sm:hidden flex items-center justify-center w-14 h-14 rounded-2xl bg-[#1a73e8] text-white shadow-[0_1px_3px_0_rgba(60,64,67,0.3),0_4px_8px_3px_rgba(60,64,67,0.15)] active:scale-95 transition-all duration-300 ${
        visible
          ? "translate-y-0 opacity-100"
          : "translate-y-20 opacity-0 pointer-events-none"
      }`}
      aria-label="Upload file"
    >
      <Plus className="h-6 w-6" strokeWidth={2.5} />
    </button>
  );
}
