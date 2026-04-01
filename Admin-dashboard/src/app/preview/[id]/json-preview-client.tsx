"use client";

import { JsonPreview } from "@/components/preview/json-preview";

interface JsonPreviewClientProps {
  src: string;
  fileName: string;
  downloadUrl?: string;
}

export function JsonPreviewClient({ src, fileName, downloadUrl }: JsonPreviewClientProps) {
  const handleDownload = downloadUrl
    ? () => window.open(downloadUrl, "_blank")
    : undefined;

  return <JsonPreview src={src} fileName={fileName} onDownload={handleDownload} />;
}
