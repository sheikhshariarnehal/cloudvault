"use client";

import { useState } from "react";
import { useAuth } from "@/app/providers/auth-provider";
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

const PRESET_COLORS = [
  "#EAB308",
  "#3B82F6",
  "#EF4444",
  "#22C55E",
  "#A855F7",
  "#F97316",
  "#06B6D4",
  "#EC4899",
];

export function NewFolderModal() {
  const { newFolderModalOpen, setNewFolderModalOpen } = useUIStore();
  const { addFolder, currentFolderId } = useFilesStore();
  const { user, guestSessionId } = useAuth();
  const [name, setName] = useState("");
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [isLoading, setIsLoading] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setIsLoading(true);

    try {
      const response = await fetch("/api/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          color,
          parent_id: currentFolderId,
          user_id: user?.id || null,
          guest_session_id: guestSessionId,
        }),
      });

      if (!response.ok) throw new Error("Failed to create folder");

      const data = await response.json();
      addFolder(data.folder);
      setName("");
      setColor(PRESET_COLORS[0]);
      setNewFolderModalOpen(false);
    } catch (error) {
      console.error("Failed to create folder:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={newFolderModalOpen} onOpenChange={setNewFolderModalOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create New Folder</DialogTitle>
          <DialogDescription>
            Create a new folder to organize your files.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="folder-name">Folder Name</Label>
            <Input
              id="folder-name"
              placeholder="Enter folder name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label>Color</Label>
            <div className="flex gap-2">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-8 h-8 rounded-full transition-transform ${
                    color === c
                      ? "scale-110 ring-2 ring-offset-2 ring-gray-400"
                      : "hover:scale-105"
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setNewFolderModalOpen(false)}
          >
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={isLoading || !name.trim()}>
            {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Create Folder
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
