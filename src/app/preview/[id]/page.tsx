import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { getFileCategory, formatFileSize } from "@/types/file.types";
import { Download, FileIcon } from "lucide-react";

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

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">{file.name}</h1>
          <p className="text-sm text-gray-500">{formatFileSize(file.size_bytes)}</p>
        </div>
        <a
          href={directDownloadUrl}
          className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
        >
          <Download className="h-4 w-4" />
          Download
        </a>
      </header>

      {/* Preview Content */}
      <main className="flex-1 flex items-center justify-center p-8">
        {category === "image" && (
          <img
            src={downloadUrl}
            alt={file.name}
            className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-lg"
          />
        )}
        {category === "video" && (
          <video
            controls
            className="max-w-full max-h-[80vh] rounded-lg shadow-lg"
          >
            <source src={downloadUrl} type={file.mime_type} />
          </video>
        )}
        {category === "pdf" && (
          <iframe
            src={downloadUrl}
            className="w-full max-w-4xl h-[80vh] rounded-lg shadow-lg"
            title={file.name}
          />
        )}
        {category === "audio" && (
          <div className="text-center">
            <FileIcon className="h-20 w-20 text-gray-400 mx-auto mb-6" />
            <p className="text-xl font-medium mb-6">{file.name}</p>
            <audio controls src={downloadUrl} className="w-full max-w-md" />
          </div>
        )}
        {(category === "document" ||
          category === "archive" ||
          category === "other") && (
          <div className="text-center">
            <FileIcon className="h-20 w-20 text-gray-400 mx-auto mb-6" />
            <p className="text-xl font-medium mb-2">{file.name}</p>
            <p className="text-gray-500 mb-6">
              Preview not available for this file type
            </p>
            <a
              href={directDownloadUrl}
              className="inline-flex items-center gap-2 px-6 py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800"
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
