"use client";

import { useState, useEffect } from "react";
import { useFilesStore } from "@/store/files-store";
import { useUIStore } from "@/store/ui-store";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

export function RenameModal() {
  const { renameModalOpen, setRenameModalOpen, renameTarget, setRenameTarget } =
    useUIStore();
  const { updateFile, updateFolder } = useFilesStore();
  const [name, setName] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (renameTarget) {
      setName(renameTarget.name);
    }
  }, [renameTarget]);

  const handleRename = async () => {
    if (!renameTarget || !name.trim()) return;
    setIsLoading(true);

    try {
      const endpoint =
        renameTarget.type === "file" ? "/api/files" : "/api/folders";

      const response = await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: renameTarget.id, name: name.trim() }),
      });

      if (!response.ok) throw new Error("Failed to rename");

      if (renameTarget.type === "file") {
        updateFile(renameTarget.id, { name: name.trim() });
      } else {
        updateFolder(renameTarget.id, { name: name.trim() });
      }

      setRenameModalOpen(false);
      setRenameTarget(null);
    } catch (error) {
      console.error("Failed to rename:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog
      open={renameModalOpen}
      onOpenChange={(open) => {
        setRenameModalOpen(open);
        if (!open) setRenameTarget(null);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            Rename {renameTarget?.type === "file" ? "File" : "Folder"}
          </DialogTitle>
          <DialogDescription>
            Enter a new name for this {renameTarget?.type === "file" ? "file" : "folder"}.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <Label htmlFor="rename-input">Name</Label>
          <Input
            id="rename-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleRename()}
            autoFocus
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setRenameModalOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleRename} disabled={isLoading || !name.trim()}>
            {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Rename
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
