"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getFileCategory, formatFileSize } from "@/types/file.types";
import {
  Download,
  FileIcon,
  FileText,
  Image as ImageIcon,
  Video,
  Music,
  Archive,
  Loader2,
  AlertCircle,
  CloudOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface SharedFile {
  id: string;
  name: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
}

interface ShareData {
  file: SharedFile;
  shareLink: {
    token: string;
    created_at: string;
  };
}

function getCategoryIcon(category: string) {
  switch (category) {
    case "image":
      return <ImageIcon className="h-16 w-16 text-blue-500" />;
    case "video":
      return <Video className="h-16 w-16 text-purple-500" />;
    case "audio":
      return <Music className="h-16 w-16 text-green-500" />;
    case "pdf":
      return <FileText className="h-16 w-16 text-red-500" />;
    case "archive":
      return <Archive className="h-16 w-16 text-yellow-600" />;
    case "document":
      return <FileText className="h-16 w-16 text-blue-600" />;
    default:
      return <FileIcon className="h-16 w-16 text-gray-500" />;
  }
}

export default function SharePage() {
  const params = useParams();
  const token = params.token as string;

  const [data, setData] = useState<ShareData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchShareData = async () => {
      try {
        const response = await fetch(`/api/share/${token}`);
        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || "Share link not found");
        }
        const shareData = await response.json();
        setData(shareData);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load shared file"
        );
      } finally {
        setIsLoading(false);
      }
    };

    fetchShareData();
  }, [token]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">Loading shared file...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-6">
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <CloudOff className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h1 className="text-xl font-semibold text-gray-900 mb-2">
              Link Unavailable
            </h1>
            <p className="text-gray-500 mb-6">
              {error || "This share link is no longer available."}
            </p>
            <a
              href="/"
              className="inline-flex items-center px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors text-sm"
            >
              Go to CloudVault
            </a>
          </div>
        </div>
      </div>
    );
  }

  const { file, shareLink } = data;
  const category = getFileCategory(file.mime_type);
  const previewUrl = `/api/share/${token}?preview=true`;
  const downloadUrl = `/api/share/${token}?download=true`;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b shadow-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a href="/" className="flex items-center gap-2 text-gray-900">
              <svg
                className="h-7 w-7"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M20 16.2A4.5 4.5 0 0 0 17.5 8h-1.8A7 7 0 1 0 4 14.9" />
                <path d="M12 12v9" />
                <path d="m16 16-4-4-4 4" />
              </svg>
              <span className="font-bold text-lg">CloudVault</span>
            </a>
          </div>
          <Button asChild>
            <a href={downloadUrl}>
              <Download className="h-4 w-4 mr-2" />
              Download
            </a>
          </Button>
        </div>
      </header>

      {/* File Info Bar */}
      <div className="bg-white border-b">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3">
          <div className="flex items-center gap-3">
            <div className="shrink-0">
              {getCategoryIcon(category)}
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-semibold text-gray-900 truncate">
                {file.name}
              </h1>
              <p className="text-sm text-gray-500">
                {formatFileSize(file.size_bytes)} &middot;{" "}
                Shared via CloudVault
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Preview Content */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-8">
        {category === "image" && (
          <div className="bg-white rounded-xl shadow-lg overflow-hidden max-w-4xl w-full">
            <img
              src={previewUrl}
              alt={file.name}
              className="w-full max-h-[75vh] object-contain"
            />
          </div>
        )}

        {category === "video" && (
          <div className="bg-black rounded-xl shadow-lg overflow-hidden max-w-4xl w-full">
            <video
              controls
              className="w-full max-h-[75vh]"
            >
              <source src={previewUrl} type={file.mime_type} />
              Your browser does not support the video tag.
            </video>
          </div>
        )}

        {category === "pdf" && (
          <div className="bg-white rounded-xl shadow-lg overflow-hidden max-w-4xl w-full">
            <iframe
              src={previewUrl}
              className="w-full h-[75vh]"
              title={file.name}
            />
          </div>
        )}

        {category === "audio" && (
          <div className="bg-white rounded-xl shadow-lg p-10 text-center max-w-md w-full">
            {getCategoryIcon(category)}
            <p className="text-lg font-medium mt-4 mb-6">{file.name}</p>
            <audio controls src={previewUrl} className="w-full" />
          </div>
        )}

        {(category === "document" ||
          category === "archive" ||
          category === "other") && (
          <div className="bg-white rounded-xl shadow-lg p-10 text-center max-w-md w-full">
            {getCategoryIcon(category)}
            <p className="text-lg font-medium mt-4 mb-1">{file.name}</p>
            <p className="text-sm text-gray-500 mb-6">
              {formatFileSize(file.size_bytes)} &middot;{" "}
              Preview not available for this file type
            </p>
            <Button asChild size="lg">
              <a href={downloadUrl}>
                <Download className="h-4 w-4 mr-2" />
                Download File
              </a>
            </Button>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t py-4">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 text-center">
          <p className="text-sm text-gray-400">
            Shared via{" "}
            <a href="/" className="text-gray-600 hover:underline font-medium">
              CloudVault
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
