import { create } from "zustand";

interface UIState {
  sidebarOpen: boolean;
  uploadModalOpen: boolean;
  previewFileId: string | null;
  newFolderModalOpen: boolean;
  renameModalOpen: boolean;
  renameTarget: { id: string; name: string; type: "file" | "folder" } | null;
  shareModalOpen: boolean;
  shareFileId: string | null;
  shareFolderId: string | null;
  isOnline: boolean;
  openFilePicker: (() => void) | null;
  uploadFiles: ((files: File[]) => void) | null;

  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  setUploadModalOpen: (open: boolean) => void;
  setPreviewFileId: (id: string | null) => void;
  setNewFolderModalOpen: (open: boolean) => void;
  setRenameModalOpen: (open: boolean) => void;
  setRenameTarget: (target: { id: string; name: string; type: "file" | "folder" } | null) => void;
  setShareModalOpen: (open: boolean) => void;
  setShareFileId: (id: string | null) => void;
  setShareFolderId: (id: string | null) => void;
  setIsOnline: (online: boolean) => void;
  setOpenFilePicker: (fn: (() => void) | null) => void;
  setUploadFiles: (fn: ((files: File[]) => void) | null) => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: false,
  uploadModalOpen: false,
  previewFileId: null,
  newFolderModalOpen: false,
  renameModalOpen: false,
  renameTarget: null,
  shareModalOpen: false,
  shareFileId: null,
  shareFolderId: null,
  isOnline: true,
  openFilePicker: null,
  uploadFiles: null,

  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setUploadModalOpen: (open) => set({ uploadModalOpen: open }),
  setPreviewFileId: (id) => set({ previewFileId: id }),
  setNewFolderModalOpen: (open) => set({ newFolderModalOpen: open }),
  setRenameModalOpen: (open) => set({ renameModalOpen: open }),
  setRenameTarget: (target) => set({ renameTarget: target }),
  setShareModalOpen: (open) => set({ shareModalOpen: open }),
  setShareFileId: (id) => set({ shareFileId: id }),
  setShareFolderId: (id) => set({ shareFolderId: id }),
  setIsOnline: (online) => set({ isOnline: online }),
  setOpenFilePicker: (fn) => set({ openFilePicker: fn }),
  setUploadFiles: (fn) => set({ uploadFiles: fn }),
}));
