"use client";

import { useFilesStore } from "@/store/files-store";
import { FileList } from "@/components/file-list/file-list";
import { Clock } from "lucide-react";

export default function RecentPage() {
  const { files } = useFilesStore();

  const recentFiles = [...files]
    .sort(
      (a, b) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    )
    .slice(0, 50);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Recent Files</h1>
        <p className="text-muted-foreground">
          Your most recently modified files
        </p>
      </div>

      {recentFiles.length > 0 ? (
        <FileList files={recentFiles} />
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Clock className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold">No recent files</h3>
          <p className="text-muted-foreground text-sm">
            Your recently accessed files will appear here
          </p>
        </div>
      )}
    </div>
  );
}
