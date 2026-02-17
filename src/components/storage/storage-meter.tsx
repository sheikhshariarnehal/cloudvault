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
    <div className="space-y-3 p-3 rounded-xl bg-gray-50">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Storage</span>
        <span className="text-xs text-muted-foreground">
          {formatFileSize(breakdown.total)} of {formatFileSize(storageLimit)}
        </span>
      </div>

      <Progress value={usedPercent} className="h-2" />

      <div className="grid grid-cols-2 gap-2">
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
          <div key={item.label} className="flex items-center gap-2">
            <div
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: item.color }}
            />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground truncate">
                {item.label}
              </p>
              <p className="text-xs font-medium">{formatFileSize(item.size)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
