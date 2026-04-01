"use client";

import type { ReactNode } from "react";
import { startManagedDownload } from "@/lib/download-manager";

interface PreviewDownloadButtonProps {
  downloadUrl: string;
  fileName: string;
  fileSize?: number;
  className: string;
  title?: string;
  children: ReactNode;
}

export function PreviewDownloadButton({
  downloadUrl,
  fileName,
  fileSize,
  className,
  title,
  children,
}: PreviewDownloadButtonProps) {
  const handleClick = () => {
    void startManagedDownload(downloadUrl, fileName, fileSize ?? 0);
  };

  return (
    <button type="button" onClick={handleClick} className={className} title={title}>
      {children}
    </button>
  );
}
