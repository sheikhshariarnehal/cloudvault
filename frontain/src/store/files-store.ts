import { create } from "zustand";
import type { DbFile, DbFolder, UploadQueueItem, ViewMode } from "@/types/file.types";

// Subscribers for view mode changes - shared with use-view-mode.ts
let viewModeListeners: Array<() => void> = [];

export function subscribeToViewMode(listener: () => void): () => void {
  viewModeListeners.push(listener);
  return () => {
    viewModeListeners = viewModeListeners.filter((l) => l !== listener);
  };
}

export function notifyViewModeListeners(): void {
  viewModeListeners.forEach((listener) => listener());
}

// Initialize viewMode from localStorage to prevent flash of wrong layout on hydration.
// Falls back to "grid" (default) if nothing is stored or if running on server.
function getInitialViewMode(): ViewMode {
  if (typeof window === "undefined") return "grid";
  try {
    const saved = localStorage.getItem("viewMode");
    if (saved === "grid" || saved === "list") return saved;
  } catch {
    // localStorage not available
  }
  return "grid";
}

// ============================================================================
// Persistent cache for instant file loading
// ============================================================================
const FILES_CACHE_KEY = "ndrive_files_cache";
const FOLDERS_CACHE_KEY = "ndrive_folders_cache";
const CACHE_VERSION_KEY = "ndrive_cache_version";
const CACHE_USER_KEY = "ndrive_cache_user";
const CURRENT_CACHE_VERSION = 1;
// Cache expires after 5 minutes - we show cached data instantly but refresh in background
const CACHE_TTL_MS = 5 * 60 * 1000;

interface CacheData<T> {
  data: T[];
  timestamp: number;
  version: number;
}

function getCachedData<T>(key: string, userId: string | null): T[] | null {
  if (typeof window === "undefined") return null;
  try {
    // Check if cache belongs to current user
    const cachedUser = localStorage.getItem(CACHE_USER_KEY);
    if (cachedUser !== userId) {
      // Clear stale cache from different user
      localStorage.removeItem(FILES_CACHE_KEY);
      localStorage.removeItem(FOLDERS_CACHE_KEY);
      return null;
    }

    const raw = localStorage.getItem(key);
    if (!raw) return null;

    const parsed: CacheData<T> = JSON.parse(raw);
    
    // Validate cache version
    if (parsed.version !== CURRENT_CACHE_VERSION) return null;
    
    // Check TTL - return data but mark as stale if expired
    // We still return cached data for instant display, layout will refresh
    return parsed.data;
  } catch {
    return null;
  }
}

function setCachedData<T>(key: string, data: T[], userId: string | null): void {
  if (typeof window === "undefined") return;
  try {
    const cacheData: CacheData<T> = {
      data,
      timestamp: Date.now(),
      version: CURRENT_CACHE_VERSION,
    };
    localStorage.setItem(key, JSON.stringify(cacheData));
    localStorage.setItem(CACHE_USER_KEY, userId || "guest");
  } catch {
    // localStorage quota exceeded or not available - gracefully ignore
  }
}

function isCacheStale(key: string): boolean {
  if (typeof window === "undefined") return true;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return true;
    const parsed = JSON.parse(raw) as CacheData<unknown>;
    return Date.now() - parsed.timestamp > CACHE_TTL_MS;
  } catch {
    return true;
  }
}

// Get cached files/folders for instant hydration
function getInitialFiles(userId: string | null): DbFile[] {
  return getCachedData<DbFile>(FILES_CACHE_KEY, userId) ?? [];
}

function getInitialFolders(userId: string | null): DbFolder[] {
  return getCachedData<DbFolder>(FOLDERS_CACHE_KEY, userId) ?? [];
}

// Export for use in layout
export function cacheFiles(files: DbFile[], userId: string | null): void {
  setCachedData(FILES_CACHE_KEY, files, userId);
}

export function cacheFolders(folders: DbFolder[], userId: string | null): void {
  setCachedData(FOLDERS_CACHE_KEY, folders, userId);
}

export function isCacheAvailable(userId: string | null): boolean {
  if (typeof window === "undefined") return false;
  const cachedUser = localStorage.getItem(CACHE_USER_KEY);
  if (cachedUser !== (userId || "guest")) return false;
  return getCachedData(FILES_CACHE_KEY, userId) !== null;
}

export function isFileCacheStale(): boolean {
  return isCacheStale(FILES_CACHE_KEY);
}

export function clearFileCache(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(FILES_CACHE_KEY);
    localStorage.removeItem(FOLDERS_CACHE_KEY);
    localStorage.removeItem(CACHE_USER_KEY);
  } catch {}
}

// Hydrate store from cache - call this once auth resolves to load cached data instantly
export function hydrateFromCache(userId: string | null): { files: DbFile[]; folders: DbFolder[] } | null {
  const cacheUserId = userId || "guest";
  const cachedUser = typeof window !== "undefined" ? localStorage.getItem(CACHE_USER_KEY) : null;
  
  // Only hydrate if cache belongs to current user
  if (cachedUser !== cacheUserId) return null;
  
  const files = getCachedData<DbFile>(FILES_CACHE_KEY, cacheUserId);
  const folders = getCachedData<DbFolder>(FOLDERS_CACHE_KEY, cacheUserId);
  
  if (files && files.length > 0) {
    return { files, folders: folders ?? [] };
  }
  return null;
}

interface FilesState {
  files: DbFile[];
  folders: DbFolder[];
  uploadQueue: UploadQueueItem[];
  viewMode: ViewMode;
  selectedFiles: string[];
  currentFolderId: string | null;
  isLoading: boolean;
  searchQuery: string;
  /** True after the layout's initial Supabase fetch completes. Pages use this
   *  to skip their supplementary fetch when data is already in the store. */
  dataLoaded: boolean;

  // File actions
  setFiles: (files: DbFile[]) => void;
  mergeFiles: (files: DbFile[]) => void;
  addFile: (file: DbFile) => void;
  updateFile: (id: string, updates: Partial<DbFile>) => void;
  removeFile: (id: string) => void;

  // Folder actions
  setFolders: (folders: DbFolder[]) => void;
  mergeFolders: (folders: DbFolder[]) => void;
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
  setDataLoaded: (loaded: boolean) => void;
}

export const useFilesStore = create<FilesState>((set) => ({
  files: [],
  folders: [],
  uploadQueue: [],
  viewMode: getInitialViewMode(),
  selectedFiles: [],
  currentFolderId: null,
  isLoading: false,
  searchQuery: "",
  dataLoaded: false,

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
  mergeFolders: (incoming) =>
    set((state) => {
      const existingIds = new Set(state.folders.map((f) => f.id));
      const newFolders = incoming.filter((f) => !existingIds.has(f.id));
      if (newFolders.length === 0) return state;
      return { folders: [...state.folders, ...newFolders] };
    }),
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
  setViewMode: (mode) => {
    try {
      localStorage.setItem("viewMode", mode);
      // Always set the attribute (grid is default, list is explicit)
      document.documentElement.setAttribute("data-view-mode", mode);
    } catch {}
    set({ viewMode: mode });
    // Notify external subscribers (used by useSyncExternalStore in use-view-mode.ts)
    notifyViewModeListeners();
  },
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
  setDataLoaded: (loaded) => set({ dataLoaded: loaded }),
}));
