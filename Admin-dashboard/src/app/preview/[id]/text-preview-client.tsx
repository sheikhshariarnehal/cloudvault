"use client";

import { TextPreview } from "@/components/preview/text-preview";

interface TextPreviewClientProps {
  src: string;
  fileName: string;
  downloadUrl?: string;
}

export function TextPreviewClient({ src, fileName, downloadUrl }: TextPreviewClientProps) {
  const handleDownload = downloadUrl
    ? () => window.open(downloadUrl, "_blank")
    : undefined;

  return <TextPreview src={src} fileName={fileName} onDownload={handleDownload} />;
}
