"use client";

import { useMemo } from "react";
import { useFilesStore } from "@/store/files-store";
import { useAuth } from "@/app/providers/auth-provider";
import { Progress } from "@/components/ui/progress";
import { formatFileSize, getFileCategory } from "@/types/file.types";

const STORAGE_COLORS = {
  photo: "#22C55E",
  video: "#3B82F6",
  document: "#EAB308",
  other: "#A855F7",
  free: "#E5E7EB",
};

const DEFAULT_STORAGE_LIMIT =
  Number(process.env.NEXT_PUBLIC_MAX_GUEST_STORAGE_BYTES) || 107374182400; // 100 GB

export function StorageMeter() {
  const { files } = useFilesStore();
  const { isGuest } = useAuth();

  const breakdown = useMemo(() => {
    const result = { photo: 0, video: 0, document: 0, other: 0, total: 0 };

    for (const file of files) {
      const category = getFileCategory(file.mime_type);
      const size = file.size_bytes;
      result.total += size;

      if (category === "image") result.photo += size;
      else if (category === "video") result.video += size;
      else if (category === "document" || category === "pdf")
        result.document += size;
      else result.other += size;
    }

    return result;
  }, [files]);

  const storageLimit = DEFAULT_STORAGE_LIMIT;
  const usedPercent = Math.min(
    (breakdown.total / storageLimit) * 100,
    100
  );

  return (
    <div className="space-y-2.5 p-3 rounded-xl bg-gray-50/80 border border-gray-100">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold">Storage</span>
        <span className="text-[11px] text-muted-foreground font-medium">
          {formatFileSize(breakdown.total)} of {formatFileSize(storageLimit)}
        </span>
      </div>

      <Progress value={usedPercent} className="h-1.5" />

      <div className="grid grid-cols-2 gap-1.5">
        {[
          { label: "Photo", size: breakdown.photo, color: STORAGE_COLORS.photo },
          { label: "Video", size: breakdown.video, color: STORAGE_COLORS.video },
          {
            label: "Document",
            size: breakdown.document,
            color: STORAGE_COLORS.document,
          },
          {
            label: "Free Storage",
            size: storageLimit - breakdown.total,
            color: STORAGE_COLORS.free,
          },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-1.5">
            <div
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: item.color }}
            />
            <div className="min-w-0">
              <p className="text-[10px] text-muted-foreground truncate leading-tight">
                {item.label}
              </p>
              <p className="text-[11px] font-medium leading-tight">{formatFileSize(item.size)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
