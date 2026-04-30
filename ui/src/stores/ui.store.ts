import { create } from "zustand";

export interface UIState {
  sidebarOpen: boolean;
  modalStack: string[];
}

export interface UIActions {
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  pushModal: (id: string) => void;
  popModal: () => void;
  closeAllModals: () => void;
}

export const useUIStore = create<UIState & UIActions>((set) => ({
  sidebarOpen: true,
  modalStack: [],

  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  pushModal: (id) =>
    set((state) => ({ modalStack: [...state.modalStack, id] })),
  popModal: () =>
    set((state) => ({ modalStack: state.modalStack.slice(0, -1) })),
  closeAllModals: () => set({ modalStack: [] }),
}));
