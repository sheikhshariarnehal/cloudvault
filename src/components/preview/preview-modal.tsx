"use client";

import { useEffect, useState } from "react";
import { useFilesStore } from "@/store/files-store";
import { useUIStore } from "@/store/ui-store";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ImagePreview } from "@/components/preview/image-preview";
import { VideoPreview } from "@/components/preview/video-preview";
import { PdfPreview } from "@/components/preview/pdf-preview";
import { Download, X, FileIcon } from "lucide-react";
import { getFileCategory, formatFileSize } from "@/types/file.types";

export function PreviewModal() {
  const { files } = useFilesStore();
  const { previewFileId, setPreviewFileId } = useUIStore();
  const [fileUrl, setFileUrl] = useState<string | null>(null);

  const file = files.find((f) => f.id === previewFileId);

  useEffect(() => {
    if (!previewFileId) {
      setFileUrl(null);
      return;
    }

    setFileUrl(`/api/download/${previewFileId}`);
  }, [previewFileId]);

  if (!file) return null;

  const category = getFileCategory(file.mime_type);

  const handleDownload = () => {
    window.open(`/api/download/${file.id}?download=true`, "_blank");
  };

  return (
    <Dialog
      open={!!previewFileId}
      onOpenChange={(open) => !open && setPreviewFileId(null)}
    >
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader className="flex flex-row items-center justify-between">
          <div>
            <DialogTitle className="text-lg">{file.name}</DialogTitle>
            <DialogDescription className="sr-only">
              File preview - {formatFileSize(file.size_bytes)}
            </DialogDescription>
            <p className="text-sm text-muted-foreground">
              {formatFileSize(file.size_bytes)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleDownload}>
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-auto flex items-center justify-center min-h-[300px] bg-gray-50 rounded-lg">
          {fileUrl && (
            <>
              {category === "image" && (
                <ImagePreview src={fileUrl} alt={file.name} />
              )}
              {category === "video" && <VideoPreview src={fileUrl} />}
              {category === "pdf" && <PdfPreview src={fileUrl} />}
              {category === "audio" && (
                <div className="p-8 text-center">
                  <FileIcon className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                  <p className="text-lg font-medium mb-4">{file.name}</p>
                  <audio controls src={fileUrl} className="w-full max-w-md" />
                </div>
              )}
              {(category === "document" ||
                category === "archive" ||
                category === "other") && (
                <div className="p-8 text-center">
                  <FileIcon className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                  <p className="text-lg font-medium mb-2">{file.name}</p>
                  <p className="text-sm text-muted-foreground mb-4">
                    Preview not available for this file type
                  </p>
                  <Button onClick={handleDownload}>
                    <Download className="h-4 w-4 mr-2" />
                    Download File
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
