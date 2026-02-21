"use client";

import { CsvPreview } from "@/components/preview/csv-preview";

interface CsvPreviewClientProps {
  src: string;
  fileName: string;
  downloadUrl: string;
}

export function CsvPreviewClient({ src, fileName, downloadUrl }: CsvPreviewClientProps) {
  const handleDownload = () => {
    window.open(downloadUrl, "_blank");
  };

  return <CsvPreview src={src} fileName={fileName} onDownload={handleDownload} />;
}
