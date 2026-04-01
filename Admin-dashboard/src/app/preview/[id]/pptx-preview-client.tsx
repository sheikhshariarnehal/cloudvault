"use client";

import { PptxPreview } from "@/components/preview/pptx-preview";

interface PptxPreviewClientProps {
  src: string;
  fileName: string;
  downloadUrl?: string;
}

export function PptxPreviewClient({ src, fileName, downloadUrl }: PptxPreviewClientProps) {
  const handleDownload = downloadUrl
    ? () => window.open(downloadUrl, "_blank")
    : undefined;

  return <PptxPreview src={src} fileName={fileName} onDownload={handleDownload} />;
}
