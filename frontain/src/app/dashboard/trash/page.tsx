"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/app/providers/auth-provider";
import { createClient } from "@/lib/supabase/client";
import { FileList } from "@/components/file-list/file-list";
import { Button } from "@/components/ui/button";
import { Trash2, Loader2 } from "lucide-react";
import type { DbFile } from "@/types/file.types";

export default function TrashPage() {
  const { user, guestSessionId } = useAuth();
  const [trashedFiles, setTrashedFiles] = useState<DbFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Trash</h1>
          <p className="text-muted-foreground">
            Files you&apos;ve deleted. Items in trash will be permanently deleted
            after 30 days.
          </p>
        </div>
        {trashedFiles.length > 0 && (
          <Button variant="destructive" size="sm" onClick={handleEmptyTrash}>
            <Trash2 className="h-4 w-4 mr-2" />
            Empty Trash
          </Button>
        )}
      </div>

      {trashedFiles.length > 0 ? (
        <FileList files={trashedFiles} />
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
