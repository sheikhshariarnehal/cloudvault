"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/app/providers/auth-provider";
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
import { Input } from "@/components/ui/input";
import { Loader2, Copy, CheckCircle2, Link as LinkIcon, Folder } from "lucide-react";

export function ShareModal() {
  const {
    shareModalOpen,
    setShareModalOpen,
    shareFileId,
    setShareFileId,
    shareFolderId,
    setShareFolderId,
  } = useUIStore();
  const { files, folders } = useFilesStore();
  const { user, guestSessionId } = useAuth();
  const [shareLink, setShareLink] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  const file = shareFileId ? files.find((f) => f.id === shareFileId) : null;
  const folder = shareFolderId ? folders.find((f) => f.id === shareFolderId) : null;
  const isFolder = !!shareFolderId;
  const targetName = isFolder ? folder?.name : file?.name;

  useEffect(() => {
    if (shareModalOpen && (shareFileId || shareFolderId)) {
      generateShareLink();
    }
  }, [shareModalOpen, shareFileId, shareFolderId]);

  const generateShareLink = async () => {
    if (!shareFileId && !shareFolderId) return;
    setIsLoading(true);
    setShareLink("");

    try {
      const body: Record<string, unknown> = {
        userId: user?.id,
        guestSessionId,
      };
      if (shareFileId) body.fileId = shareFileId;
      if (shareFolderId) body.folderId = shareFolderId;

      const response = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) throw new Error("Failed to create share link");

      const data = await response.json();
      const origin = window.location.origin;
      setShareLink(`${origin}/share/${data.token}`);
    } catch (error) {
      console.error("Failed to generate share link:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareLink);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  const handleClose = () => {
    setShareModalOpen(false);
    setShareFileId(null);
    setShareFolderId(null);
    setShareLink("");
    setIsCopied(false);
  };

  return (
    <Dialog open={shareModalOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isFolder ? (
              <Folder className="h-5 w-5" style={{ color: folder?.color || "#EAB308" }} />
            ) : (
              <LinkIcon className="h-5 w-5" />
            )}
            Share {isFolder ? "Folder" : "File"}
          </DialogTitle>
          <DialogDescription>
            {targetName
              ? `Share "${targetName}" with anyone`
              : "Loading..."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : shareLink ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Input
                  value={shareLink}
                  readOnly
                  className="font-mono text-sm"
                />
                <Button
                  onClick={handleCopy}
                  variant={isCopied ? "default" : "outline"}
                  size="sm"
                  className="shrink-0"
                >
                  {isCopied ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-2" />
                      Copy
                    </>
                  )}
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                {isFolder
                  ? "Anyone with this link can browse and download files in the folder."
                  : "Anyone with this link can view and download the file."}
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              Failed to generate share link. Please try again.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
