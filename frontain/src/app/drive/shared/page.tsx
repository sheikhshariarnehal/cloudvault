"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/app/providers/auth-provider";
import { createClient } from "@/lib/supabase/client";
import { formatFileSize, formatDate } from "@/types/file.types";
import {
  Users,
  Link as LinkIcon,
  Folder,
  FileIcon,
  Trash2,
  Copy,
  CheckCircle2,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface SharedItem {
  id: string;
  token: string;
  is_active: boolean;
  created_at: string;
  file_id: string | null;
  folder_id: string | null;
  download_count: number;
  // Joined data
  file_name?: string;
  file_size?: number;
  folder_name?: string;
  folder_color?: string;
}

export default function SharedPage() {
  const { user, guestSessionId } = useAuth();
  const [sharedItems, setSharedItems] = useState<SharedItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  useEffect(() => {
    loadSharedLinks();
  }, [user, guestSessionId]);

  const loadSharedLinks = async () => {
    setIsLoading(true);
    try {
      const supabase = createClient();

      // Get shared links created by the current user
      const userId = user?.id;
      if (!userId && !guestSessionId) {
        setIsLoading(false);
        return;
      }

      // We need service-role access for guest users — use API route instead
      const res = await fetch("/api/share/list");
      if (!res.ok) throw new Error("Failed to load shared links");
      const data = await res.json();
      setSharedItems(data.items || []);
    } catch (error) {
      console.error("Failed to load shared links:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyLink = async (token: string) => {
    const url = `${window.location.origin}/share/${token}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedToken(token);
      setTimeout(() => setCopiedToken(null), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  const handleRevoke = async (linkId: string) => {
    try {
      const res = await fetch("/api/share/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ linkId }),
      });
      if (res.ok) {
        setSharedItems((prev) => prev.filter((item) => item.id !== linkId));
      }
    } catch (error) {
      console.error("Failed to revoke:", error);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Shared</h1>
          <p className="text-muted-foreground">Files and folders you&apos;ve shared</p>
        </div>
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Shared</h1>
        <p className="text-muted-foreground">
          Files and folders you&apos;ve shared &middot; {sharedItems.length} link{sharedItems.length !== 1 ? "s" : ""}
        </p>
      </div>

      {sharedItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Users className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold">No shared links yet</h3>
          <p className="text-muted-foreground text-sm">
            Right-click a file or folder and select &quot;Share&quot; to create a share link.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden divide-y">
          {sharedItems.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50 transition-colors group"
            >
              {/* Icon */}
              <div className="shrink-0">
                {item.folder_id ? (
                  <Folder
                    className="h-5 w-5"
                    style={{ color: item.folder_color || "#EAB308" }}
                    fill={item.folder_color || "#EAB308"}
                    fillOpacity={0.22}
                  />
                ) : (
                  <FileIcon className="h-5 w-5 text-blue-500" />
                )}
              </div>

              {/* Name & info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {item.folder_id ? item.folder_name : item.file_name}
                </p>
                <p className="text-xs text-muted-foreground">
                  Shared {formatDate(item.created_at)}
                  {item.file_size ? ` · ${formatFileSize(item.file_size)}` : ""}
                  {item.download_count > 0 ? ` · ${item.download_count} download${item.download_count !== 1 ? "s" : ""}` : ""}
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 shrink-0">
                <a
                  href={`/share/${item.token}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 text-muted-foreground hover:text-foreground hover:bg-gray-100 rounded-full transition-colors"
                  title="Open link"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
                <button
                  onClick={() => handleCopyLink(item.token)}
                  className="p-2 text-muted-foreground hover:text-foreground hover:bg-gray-100 rounded-full transition-colors"
                  title="Copy link"
                >
                  {copiedToken === item.token ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </button>
                <button
                  onClick={() => handleRevoke(item.id)}
                  className="p-2 text-muted-foreground hover:text-destructive hover:bg-red-50 rounded-full transition-colors"
                  title="Revoke link"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
