"use client";

import { useAuth } from "@/app/providers/auth-provider";
import { useFilesStore } from "@/store/files-store";
import { useUIStore } from "@/store/ui-store";
import { FolderGrid } from "@/components/file-grid/folder-grid";
import { FileCard } from "@/components/file-grid/file-card";
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Plus,
  Upload,
  FolderPlus,
  LayoutGrid,
  List,
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
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight truncate bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">Welcome back, {displayName}</h1>
          <p className="text-sm text-muted-foreground mt-1.5">
            Manage and organize your files with ease
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5 flex-shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-10 text-sm font-medium shadow-sm hover:shadow">
                <Plus className="h-4 w-4 mr-2" />
                Create
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setNewFolderModalOpen(true)}>
                <FolderPlus className="h-4 w-4 mr-2" />
                New Folder
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => openFilePicker?.()}>
                <Upload className="h-4 w-4 mr-2" />
                Upload File
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="outline"
            size="sm"
            className="h-10 text-sm font-medium shadow-sm hover:shadow"
            onClick={() => openFilePicker?.()}
          >
            <Upload className="h-4 w-4 mr-2" />
            <span className="hidden xs:inline">Upload</span>
          </Button>

          {/* View mode toggle */}
          <TooltipProvider>
            <div className="flex items-center border rounded-lg overflow-hidden shadow-sm bg-white">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={viewMode === "grid" ? "secondary" : "ghost"}
                    size="icon"
                    className="h-10 w-10 rounded-none"
                    onClick={() => setViewMode("grid")}
                  >
                    <LayoutGrid className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent><p>Grid view</p></TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={viewMode === "list" ? "secondary" : "ghost"}
                    size="icon"
                    className="h-10 w-10 rounded-none"
                    onClick={() => setViewMode("list")}
                  >
                    <List className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent><p>List view</p></TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>
        </div>
      </div>

      {/* Folders Section */}
      {filteredFolders.length > 0 && (
        <section>
          <h2 className="text-sm font-medium text-[#202124] mb-3">Folders</h2>
          <FolderGrid folders={filteredFolders} />
        </section>
      )}

      {/* Suggested from your activity */}
      {!searchQuery && files.length > 0 && (
        <section>
          <h2 className="text-sm font-medium text-[#202124] mb-3">
            Suggested
          </h2>
          <SuggestedFiles files={recentFiles.slice(0, 6)} />
        </section>
      )}

      {/* File List with Tabs */}
      <section>
        <Tabs defaultValue="recent" className="w-full">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium text-[#202124]">Files</h2>
            <TabsList className="h-8 bg-[#f1f3f4] rounded-full px-1">
              <TabsTrigger value="recent" className="text-xs px-3.5 h-6 rounded-full font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm">Recent</TabsTrigger>
              <TabsTrigger value="starred" className="text-xs px-3.5 h-6 rounded-full font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm">Starred</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="recent">
            {viewMode === "grid" ? (
              filteredFiles.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                  {filteredFiles.map((file) => (
                    <FileCard key={file.id} file={file} />
                  ))}
                </div>
              ) : (
                <FileList files={filteredFiles} />
              )
            ) : (
              <FileList files={filteredFiles} />
            )}
          </TabsContent>

          <TabsContent value="starred">
            {viewMode === "grid" ? (
              starredFiles.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                  {starredFiles.map((file) => (
                    <FileCard key={file.id} file={file} />
                  ))}
                </div>
              ) : (
                <FileList files={starredFiles} />
              )
            ) : (
              <FileList files={starredFiles} />
            )}
          </TabsContent>
        </Tabs>
      </section>
    </div>
  );
}
