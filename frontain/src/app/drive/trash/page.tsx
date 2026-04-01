"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/app/providers/auth-provider";
import { createClient } from "@/lib/supabase/client";
import { FileList } from "@/components/file-list/file-list";
import { Button } from "@/components/ui/button";
import { Trash2, Loader2, RotateCcw, FileIcon } from "lucide-react";
import { formatDate, formatFileSize, type DbFile } from "@/types/file.types";

export default function TrashPage() {
  const { user, guestSessionId } = useAuth();
  const [trashedFiles, setTrashedFiles] = useState<DbFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    const fetchTrashed = async () => {
      const supabase = createClient();
      const filterColumn = user?.id ? "user_id" : "guest_session_id";
      const filterValue = user?.id || guestSessionId;

      if (!filterValue) {
        setIsLoading(false);
        return;
      }

      const FILE_COLUMNS =
        "id,user_id,guest_session_id,folder_id,name,original_name," +
        "mime_type,size_bytes,telegram_file_id,telegram_message_id," +
        "file_hash,tdlib_file_id,is_starred,is_trashed,trashed_at," +
        "created_at,updated_at";

      const { data } = await supabase
        .from("files")
        .select(FILE_COLUMNS)
        .eq(filterColumn, filterValue)
        .eq("is_trashed", true)
        .order("trashed_at", { ascending: false });

      setTrashedFiles((data as unknown as DbFile[]) || []);
      setIsLoading(false);
    };

    fetchTrashed();
  }, [user?.id, guestSessionId]);

  const handleEmptyTrash = async () => {
    const supabase = createClient();
    const filterColumn = user?.id ? "user_id" : "guest_session_id";
    const filterValue = user?.id || guestSessionId;

    if (!filterValue) return;

    await supabase
      .from("files")
      .delete()
      .eq(filterColumn, filterValue)
      .eq("is_trashed", true);

    setTrashedFiles([]);
  };

  const handleRestore = async (fileId: string) => {
    try {
      const response = await fetch("/api/files", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: fileId,
          is_trashed: false,
          trashed_at: null,
        }),
      });

      if (!response.ok) {
        console.error("Failed to restore file");
        return;
      }

      // Remove from local state
      setTrashedFiles((prev) => prev.filter((f) => f.id !== fileId));
      setStatusMessage("Restored");
      window.setTimeout(() => setStatusMessage(null), 3000);
    } catch (error) {
      console.error("Error restoring file:", error);
    }
  };

  const handleDeletePermanently = async (fileId: string) => {
    try {
      const supabase = createClient();
      await supabase.from("files").delete().eq("id", fileId);

      // Remove from local state
      setTrashedFiles((prev) => prev.filter((f) => f.id !== fileId));
    } catch (error) {
      console.error("Error deleting file permanently:", error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="pt-3 sm:pt-4 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Trash</h1>
          <p className="text-muted-foreground">
            Files you&apos;ve deleted. Items in trash will be permanently deleted
            after 30 days.
          </p>
          {statusMessage && (
            <p className="text-sm text-green-600 mt-1">{statusMessage}</p>
          )}
        </div>
        {trashedFiles.length > 0 && (
          <Button variant="destructive" size="sm" onClick={handleEmptyTrash}>
            <Trash2 className="h-4 w-4 mr-2" />
            Empty Trash
          </Button>
        )}
      </div>

      {trashedFiles.length > 0 ? (
        <div className="border rounded-lg overflow-hidden bg-white">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Size
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Deleted
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {trashedFiles.map((file) => {
                  return (
                    <tr key={file.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <FileIcon className="h-5 w-5 text-gray-400 shrink-0" />
                          <span className="text-sm text-gray-900 truncate max-w-xs">
                            {file.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {formatFileSize(file.size_bytes)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {file.trashed_at ? formatDate(file.trashed_at) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleRestore(file.id)}
                            className="text-green-600 hover:text-green-700 hover:bg-green-50"
                          >
                            <RotateCcw className="h-4 w-4 mr-1.5" />
                            Restore
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeletePermanently(file.id)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4 mr-1.5" />
                            Delete Forever
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Trash2 className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold">Trash is empty</h3>
          <p className="text-muted-foreground text-sm">
            Deleted files will appear here
          </p>
        </div>
      )}
    </div>
  );
}
