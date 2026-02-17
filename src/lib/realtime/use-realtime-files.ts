"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useFilesStore } from "@/store/files-store";
import type { DbFile, DbFolder } from "@/types/file.types";

export function useRealtimeFiles(
  userId: string | null,
  guestSessionId: string | null
) {
  const { addFile, updateFile, removeFile, addFolder, updateFolder, removeFolder } =
    useFilesStore();

  useEffect(() => {
    if (!userId && !guestSessionId) return;

    const supabase = createClient();

    const filterColumn = userId ? "user_id" : "guest_session_id";
    const filterValue = (userId || guestSessionId)!;

    const filesChannel = supabase
      .channel("files-changes")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "files",
          filter: `${filterColumn}=eq.${filterValue}`,
        },
        (payload) => {
          addFile(payload.new as DbFile);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "files",
          filter: `${filterColumn}=eq.${filterValue}`,
        },
        (payload) => {
          const updated = payload.new as DbFile;
          if (updated.is_trashed) {
            removeFile(updated.id);
          } else {
            updateFile(updated.id, updated);
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "files",
          filter: `${filterColumn}=eq.${filterValue}`,
        },
        (payload) => {
          removeFile((payload.old as DbFile).id);
        }
      )
      .subscribe();

    const foldersChannel = supabase
      .channel("folders-changes")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "folders",
          filter: `${filterColumn}=eq.${filterValue}`,
        },
        (payload) => {
          addFolder(payload.new as DbFolder);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "folders",
          filter: `${filterColumn}=eq.${filterValue}`,
        },
        (payload) => {
          const updated = payload.new as DbFolder;
          if (updated.is_trashed) {
            removeFolder(updated.id);
          } else {
            updateFolder(updated.id, updated);
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "folders",
          filter: `${filterColumn}=eq.${filterValue}`,
        },
        (payload) => {
          removeFolder((payload.old as DbFolder).id);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(filesChannel);
      supabase.removeChannel(foldersChannel);
    };
  }, [userId, guestSessionId, addFile, updateFile, removeFile, addFolder, updateFolder, removeFolder]);
}
