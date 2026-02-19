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
import { Loader2, Copy, CheckCircle2, Link as LinkIcon } from "lucide-react";

export function ShareModal() {
  const { shareModalOpen, setShareModalOpen, shareFileId, setShareFileId } =
    useUIStore();
  const { files } = useFilesStore();
  const { user, guestSessionId } = useAuth();
  const [shareLink, setShareLink] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  const file = files.find((f) => f.id === shareFileId);

  useEffect(() => {
    if (shareModalOpen && shareFileId) {
      generateShareLink();
    }
  }, [shareModalOpen, shareFileId]);

  const generateShareLink = async () => {
    if (!shareFileId) return;
    setIsLoading(true);
    setShareLink("");

    try {
      const response = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileId: shareFileId,
          userId: user?.id,
          guestSessionId,
        }),
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
    setShareLink("");
    setIsCopied(false);
  };

  return (
    <Dialog open={shareModalOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LinkIcon className="h-5 w-5" />
            Share File
          </DialogTitle>
          <DialogDescription>
            {file ? `Share "${file.name}" with anyone` : "Loading..."}
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
                Anyone with this link can view and download the file.
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
