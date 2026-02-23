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
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  Copy,
  CheckCircle2,
  Link as LinkIcon,
  FolderOpen,
  FileIcon,
  AlertCircle,
  RefreshCw,
  LogIn,
  Globe,
  RotateCcw,
} from "lucide-react";
import Link from "next/link";

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
  const { user } = useAuth();
  const [shareLink, setShareLink] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const file = shareFileId ? files.find((f) => f.id === shareFileId) : null;
  const folder = shareFolderId ? folders.find((f) => f.id === shareFolderId) : null;
  const isFolder = !!shareFolderId;
  const targetName = isFolder ? folder?.name : file?.name;
  const isGuest = !user;

  useEffect(() => {
    if (shareModalOpen && (shareFileId || shareFolderId) && !isGuest) {
      generateShareLink();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shareModalOpen, shareFileId, shareFolderId, isGuest]);

  const generateShareLink = async (regenerate = false) => {
    if (!shareFileId && !shareFolderId) return;
    setIsLoading(true);
    setShareLink("");
    setError(null);

    try {
      const body: Record<string, unknown> = { userId: user?.id, regenerate };
      if (shareFileId) body.fileId = shareFileId;
      if (shareFolderId) body.folderId = shareFolderId;

      const response = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => null);
        throw new Error(errData?.error || `Server error (${response.status})`);
      }

      const data = await response.json();
      setShareLink(`${window.location.origin}/share/${data.token}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareLink);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2500);
    } catch {
      // fallback: select input text
    }
  };

  const handleClose = () => {
    setShareModalOpen(false);
    setShareFileId(null);
    setShareFolderId(null);
    setShareLink("");
    setIsCopied(false);
    setError(null);
  };

  return (
    <Dialog open={shareModalOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[420px] p-0 overflow-hidden gap-0">
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-4">
          <div className="flex items-center gap-3">
            <div
              className="flex items-center justify-center w-10 h-10 rounded-xl shrink-0"
              style={{
                background: isFolder
                  ? `${folder?.color || "#EAB308"}18`
                  : "rgb(239 246 255)",
              }}
            >
              {isFolder ? (
                <FolderOpen
                  className="h-5 w-5"
                  style={{ color: folder?.color || "#EAB308" }}
                />
              ) : (
                <FileIcon className="h-5 w-5 text-blue-600" />
              )}
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-base font-semibold leading-tight">
                Share {isFolder ? "Folder" : "File"}
              </DialogTitle>
              {targetName && (
                <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[280px]">
                  {targetName}
                </p>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="px-6 pb-6 space-y-4">
          {/* Guest state */}
          {isGuest ? (
            <div className="flex flex-col items-center gap-4 py-6">
              <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-50">
                <LogIn className="h-7 w-7 text-blue-600" />
              </div>
              <div className="text-center space-y-1.5">
                <p className="text-sm font-semibold">Sign in to share</p>
                <p className="text-xs text-muted-foreground max-w-[240px]">
                  Create a free account to generate shareable links for your files and folders.
                </p>
              </div>
              <Link href="/auth/login" onClick={handleClose}>
                <Button size="sm" className="gap-2 px-5">
                  <LogIn className="h-3.5 w-3.5" />
                  Sign In
                </Button>
              </Link>
            </div>

          /* Loading */
          ) : isLoading ? (
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">Generating link…</p>
            </div>

          /* Link ready */
          ) : shareLink ? (
            <>
              {/* Access notice */}
              <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-green-50 border border-green-100">
                <Globe className="h-4 w-4 text-green-600 shrink-0" />
                <p className="text-xs text-green-700 font-medium">
                  {isFolder
                    ? "Anyone with this link can browse and download this folder."
                    : "Anyone with this link can view and download this file."}
                </p>
              </div>

              {/* Link row */}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 p-1 pl-3 rounded-xl border border-gray-200 bg-gray-50 focus-within:border-gray-400 transition-colors">
                  <LinkIcon className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                  <input
                    type="text"
                    value={shareLink}
                    readOnly
                    className="flex-1 text-xs text-gray-600 font-mono min-w-0 bg-transparent border-none focus:outline-none focus:ring-0 p-0"
                    onClick={(e) => e.currentTarget.select()}
                  />
                  <Button
                    onClick={handleCopy}
                    size="sm"
                    variant={isCopied ? "default" : "outline"}
                    className={`shrink-0 h-8 px-3 text-xs font-medium rounded-lg transition-all ${
                      isCopied
                        ? "bg-green-600 hover:bg-green-700 text-white border-transparent"
                        : ""
                    }`}
                  >
                    {isCopied ? (
                      <>
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5 mr-1.5" />
                        Copy link
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Regenerate */}
              <div className="flex justify-end pt-1">
                <button
                  onClick={() => generateShareLink(true)}
                  className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-gray-700 transition-colors"
                >
                  <RotateCcw className="h-3 w-3" />
                  Regenerate link
                </button>
              </div>
            </>

          /* Error state */
          ) : error ? (
            <div className="flex flex-col items-center gap-3 py-6">
              <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-red-50">
                <AlertCircle className="h-6 w-6 text-red-500" />
              </div>
              <div className="text-center space-y-1">
                <p className="text-sm font-semibold text-gray-900">Failed to create link</p>
                <p className="text-xs text-muted-foreground max-w-[260px]">{error}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => generateShareLink()}
                className="gap-2"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Try again
              </Button>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
