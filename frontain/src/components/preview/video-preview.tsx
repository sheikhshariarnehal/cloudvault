"use client";

interface VideoPreviewProps {
  src: string;
}

export function VideoPreview({ src }: VideoPreviewProps) {
  return (
    <div className="w-full h-full flex items-center justify-center p-4">
      <video
        controls
        className="max-w-full max-h-[60vh] rounded"
        preload="metadata"
      >
        <source src={src} />
        Your browser does not support the video tag.
      </video>
    </div>
  );
}
