"use client";

import { OfficePreview } from "@/components/preview/office-preview";

interface OfficePreviewClientProps {
  src: string;
  fileName: string;
}

export function OfficePreviewClient({ src, fileName }: OfficePreviewClientProps) {
  return <OfficePreview src={src} fileName={fileName} />;
}
