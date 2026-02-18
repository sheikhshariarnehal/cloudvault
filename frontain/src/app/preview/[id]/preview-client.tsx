"use client";

import { ImagePreview } from "@/components/preview/image-preview";

interface PreviewClientProps {
  src: string;
  alt: string;
}

export function PreviewClient({ src, alt }: PreviewClientProps) {
  return (
    <div className="w-full h-[calc(100vh-64px)]">
      <ImagePreview src={src} alt={alt} />
    </div>
  );
}
