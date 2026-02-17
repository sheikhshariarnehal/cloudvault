import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import { getFileCategory, formatFileSize } from "@/types/file.types";
import { Download, FileIcon, ArrowLeft } from "lucide-react";
import { PreviewClient } from "./preview-client";

export default async function PreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: file, error } = await supabase
    .from("files")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !file) {
    notFound();
  }

  const category = getFileCategory(file.mime_type);
  const downloadUrl = `/api/download/${file.id}`;
  const directDownloadUrl = `/api/download/${file.id}?download=true`;

  // PDF files redirect to Chrome's built-in PDF viewer
  if (category === "pdf") {
    redirect(downloadUrl);
  }

  return (
    <div className="min-h-screen bg-[#202124] flex flex-col">
      {/* Header - Google Drive style */}
      <header className="bg-[#202124] h-16 px-4 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <a
            href="/dashboard"
            className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </a>
          <div className="min-w-0">
            <h1 className="text-[15px] font-medium text-white truncate">
              {file.name}
            </h1>
            <p className="text-xs text-white/50">
              {formatFileSize(file.size_bytes)}
            </p>
          </div>
        </div>
        <a
          href={directDownloadUrl}
          className="p-2.5 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-colors"
          title="Download"
        >
          <Download className="h-5 w-5" />
        </a>
      </header>

      {/* Preview Content */}
      <main className="flex-1 flex items-center justify-center relative overflow-hidden">
        {category === "image" && (
          <PreviewClient src={downloadUrl} alt={file.name} />
        )}
        {category === "video" && (
          <div className="max-w-5xl w-full px-8">
            <video
              controls
              className="max-w-full max-h-[80vh] rounded-lg shadow-lg mx-auto"
            >
              <source src={downloadUrl} type={file.mime_type} />
            </video>
          </div>
        )}
        {category === "audio" && (
          <div className="text-center">
            <FileIcon className="h-20 w-20 text-white/30 mx-auto mb-6" />
            <p className="text-xl font-medium mb-6 text-white">{file.name}</p>
            <audio controls src={downloadUrl} className="w-full max-w-md" />
          </div>
        )}
        {(category === "document" ||
          category === "archive" ||
          category === "other") && (
          <div className="text-center">
            <FileIcon className="h-20 w-20 text-white/30 mx-auto mb-6" />
            <p className="text-xl font-medium mb-2 text-white">{file.name}</p>
            <p className="text-white/50 mb-6">
              Preview not available for this file type
            </p>
            <a
              href={directDownloadUrl}
              className="inline-flex items-center gap-2 px-6 py-3 bg-[#8ab4f8] text-[#202124] rounded-full font-medium hover:bg-[#aecbfa] transition-colors"
            >
              <Download className="h-4 w-4" />
              Download File
            </a>
          </div>
        )}
      </main>
    </div>
  );
}
