"use client";

import { useState } from "react";
import Image from "next/image";

interface ImagePreviewProps {
  src: string;
  alt: string;
}

export function ImagePreview({ src, alt }: ImagePreviewProps) {
  const [zoom, setZoom] = useState(1);

  return (
    <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
      <div
        className="cursor-zoom-in transition-transform duration-200"
        onClick={() => setZoom(zoom === 1 ? 2 : 1)}
        style={{ transform: `scale(${zoom})` }}
      >
        <img
          src={src}
          alt={alt}
          className="max-w-full max-h-[60vh] object-contain rounded"
        />
      </div>
    </div>
  );
}
