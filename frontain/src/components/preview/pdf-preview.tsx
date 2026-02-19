"use client";

interface PdfPreviewProps {
  src: string;
}

export function PdfPreview({ src }: PdfPreviewProps) {
  return (
    <div className="w-full h-full min-h-[500px]">
      <iframe
        src={src}
        className="w-full h-full min-h-[500px] rounded border-0"
        title="PDF Preview"
      />
    </div>
  );
}
