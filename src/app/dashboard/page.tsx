"use client";

import { useAuth } from "@/app/providers/auth-provider";
import { useFilesStore } from "@/store/files-store";
import { useUIStore } from "@/store/ui-store";
import { FolderGrid } from "@/components/file-grid/folder-grid";
import { FileList } from "@/components/file-list/file-list";
import { SuggestedFiles } from "@/components/suggested-files/suggested-files";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  Upload,
  FolderPlus,
  LayoutGrid,
  List,
  FileText,
  Loader2,
} from "lucide-react";

export default function DashboardPage() {
  const { user } = useAuth();
  const { files, folders, viewMode, setViewMode, isLoading, searchQuery } =
    useFilesStore();
  const { setNewFolderModalOpen, openFilePicker } = useUIStore();

  const displayName =
    user?.user_metadata?.display_name ||
    user?.email?.split("@")[0] ||
    "Guest";

  // Filter files and folders for root level (no parent) and search
  const rootFolders = folders.filter((f) => !f.parent_id);
  const rootFiles = files.filter((f) => !f.folder_id);

  const filteredFiles = searchQuery
    ? files.filter((f) =>
        f.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : rootFiles;

  const filteredFolders = searchQuery
    ? folders.filter((f) =>
        f.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : rootFolders;

  const starredFiles = files.filter((f) => f.is_starred);
  const recentFiles = [...files]
    .sort(
      (a, b) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    )
    .slice(0, 10);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight truncate">Welcome back, {displayName}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Let&apos;s continue your activity on the dashboard.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 text-[13px]">
                <Plus className="h-4 w-4 mr-1.5" />
                Create
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setNewFolderModalOpen(true)}>
                <FolderPlus className="h-4 w-4 mr-2" />
                New Folder
              </DropdownMenuItem>
              <DropdownMenuItem>
                <FileText className="h-4 w-4 mr-2" />
                New Document
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="outline"
            size="sm"
            className="h-9 text-[13px]"
            onClick={() => openFilePicker?.()}
          >
            <Upload className="h-4 w-4 mr-1.5" />
            <span className="hidden xs:inline">Upload</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="h-9 text-[13px] hidden sm:flex"
            onClick={() => setNewFolderModalOpen(true)}
          >
            <FolderPlus className="h-4 w-4 mr-1.5" />
            Folder
          </Button>

          {/* View mode toggle */}
          <div className="flex items-center border rounded-lg overflow-hidden">
            <Button
              variant={viewMode === "grid" ? "secondary" : "ghost"}
              size="icon"
              className="h-9 w-9 rounded-none"
              onClick={() => setViewMode("grid")}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "list" ? "secondary" : "ghost"}
              size="icon"
              className="h-9 w-9 rounded-none"
              onClick={() => setViewMode("list")}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Folders Section */}
      {filteredFolders.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Folders</h2>
          <FolderGrid folders={filteredFolders} />
        </section>
      )}

      {/* Suggested from your activity */}
      {!searchQuery && files.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Suggested from your activity
          </h2>
          <SuggestedFiles files={recentFiles.slice(0, 4)} />
        </section>
      )}

      {/* File List with Tabs */}
      <section>
        <Tabs defaultValue="recent" className="w-full">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Your Files</h2>
            <TabsList className="h-8">
              <TabsTrigger value="recent" className="text-xs px-3 h-7">Recent</TabsTrigger>
              <TabsTrigger value="starred" className="text-xs px-3 h-7">Starred</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="recent">
            <FileList files={filteredFiles} />
          </TabsContent>

          <TabsContent value="starred">
            <FileList files={starredFiles} />
          </TabsContent>
        </Tabs>
      </section>
    </div>
  );
}
