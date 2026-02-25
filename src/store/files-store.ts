import { create } from "zustand";
import type { DbFile, DbFolder, UploadQueueItem, ViewMode } from "@/types/file.types";

interface FilesState {
  files: DbFile[];
  folders: DbFolder[];
  uploadQueue: UploadQueueItem[];
  viewMode: ViewMode;
  selectedFiles: string[];
  currentFolderId: string | null;
  isLoading: boolean;
  searchQuery: string;

  // File actions
  setFiles: (files: DbFile[]) => void;
  mergeFiles: (files: DbFile[]) => void;
  addFile: (file: DbFile) => void;
  updateFile: (id: string, updates: Partial<DbFile>) => void;
  removeFile: (id: string) => void;

  // Folder actions
  setFolders: (folders: DbFolder[]) => void;
  addFolder: (folder: DbFolder) => void;
  updateFolder: (id: string, updates: Partial<DbFolder>) => void;
  removeFolder: (id: string) => void;

  // Upload Queue actions
  addToUploadQueue: (item: UploadQueueItem) => void;
  updateUploadProgress: (id: string, progress: number) => void;
  updateUploadBytes: (id: string, bytesLoaded: number, bytesTotal: number) => void;
  updateUploadStatus: (id: string, status: UploadQueueItem["status"], error?: string) => void;
  removeFromUploadQueue: (id: string) => void;
  clearUploadQueue: () => void;
  cancelAllUploads: () => void;

  // UI actions
  setViewMode: (mode: ViewMode) => void;
  setSelectedFiles: (ids: string[]) => void;
  toggleFileSelection: (id: string) => void;
  clearSelection: () => void;
  setCurrentFolderId: (id: string | null) => void;
  setIsLoading: (loading: boolean) => void;
  setSearchQuery: (query: string) => void;
}

export const useFilesStore = create<FilesState>((set) => ({
  files: [],
  folders: [],
  uploadQueue: [],
  viewMode: "list",
  selectedFiles: [],
  currentFolderId: null,
  isLoading: false,
  searchQuery: "",

  // File actions
  setFiles: (files) => set({ files }),
  mergeFiles: (incoming) =>
    set((state) => {
      const existingIds = new Set(state.files.map((f) => f.id));
      const newFiles = incoming.filter((f) => !existingIds.has(f.id));
      if (newFiles.length === 0) return state;
      return { files: [...state.files, ...newFiles] };
    }),
  addFile: (file) =>
    set((state) => {
      // Check if file already exists to prevent duplicates
      const existingIndex = state.files.findIndex((f) => f.id === file.id);
      if (existingIndex !== -1) {
        // Update existing file
        return {
          files: state.files.map((f) => (f.id === file.id ? file : f)),
        };
      }
      // Add new file
      return { files: [file, ...state.files] };
    }),
  updateFile: (id, updates) =>
    set((state) => ({
      files: state.files.map((f) => (f.id === id ? { ...f, ...updates } : f)),
    })),
  removeFile: (id) =>
    set((state) => ({
      files: state.files.filter((f) => f.id !== id),
      selectedFiles: state.selectedFiles.filter((fid) => fid !== id),
    })),

  // Folder actions
  setFolders: (folders) => set({ folders }),
  addFolder: (folder) =>
    set((state) => {
      // Check if folder already exists to prevent duplicates
      const existingIndex = state.folders.findIndex((f) => f.id === folder.id);
      if (existingIndex !== -1) {
        // Update existing folder
        return {
          folders: state.folders.map((f) => (f.id === folder.id ? folder : f)),
        };
      }
      // Add new folder
      return { folders: [folder, ...state.folders] };
    }),
  updateFolder: (id, updates) =>
    set((state) => ({
      folders: state.folders.map((f) =>
        f.id === id ? { ...f, ...updates } : f
      ),
    })),
  removeFolder: (id) =>
    set((state) => ({
      folders: state.folders.filter((f) => f.id !== id),
    })),

  // Upload Queue actions
  addToUploadQueue: (item) =>
    set((state) => ({ uploadQueue: [...state.uploadQueue, item] })),
  updateUploadProgress: (id, progress) =>
    set((state) => ({
      uploadQueue: state.uploadQueue.map((item) =>
        item.id === id ? { ...item, progress } : item
      ),
    })),
  updateUploadBytes: (id, bytesLoaded, bytesTotal) =>
    set((state) => ({
      uploadQueue: state.uploadQueue.map((item) =>
        item.id === id ? { ...item, bytesLoaded, bytesTotal } : item
      ),
    })),
  updateUploadStatus: (id, status, error) =>
    set((state) => ({
      uploadQueue: state.uploadQueue.map((item) =>
        item.id === id ? { ...item, status, error } : item
      ),
    })),
  removeFromUploadQueue: (id) =>
    set((state) => ({
      uploadQueue: state.uploadQueue.filter((item) => item.id !== id),
    })),
  clearUploadQueue: () => set({ uploadQueue: [] }),
  cancelAllUploads: () =>
    set((state) => ({
      uploadQueue: state.uploadQueue.filter(
        (item) => item.status === "success" || item.status === "duplicate"
      ),
    })),

  // UI actions
  setViewMode: (mode) => set({ viewMode: mode }),
  setSelectedFiles: (ids) => set({ selectedFiles: ids }),
  toggleFileSelection: (id) =>
    set((state) => ({
      selectedFiles: state.selectedFiles.includes(id)
        ? state.selectedFiles.filter((fid) => fid !== id)
        : [...state.selectedFiles, id],
    })),
  clearSelection: () => set({ selectedFiles: [] }),
  setCurrentFolderId: (id) => set({ currentFolderId: id }),
  setIsLoading: (loading) => set({ isLoading: loading }),
  setSearchQuery: (query) => set({ searchQuery: query }),
}));
