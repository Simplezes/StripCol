import { create } from 'zustand'

interface UIState {
  searchQuery: string
  setSearchQuery: (q: string) => void

  isSettingsOpen: boolean
  openSettings: () => void
  closeSettings: () => void

  hasUpdate: boolean
  setHasUpdate: (v: boolean) => void
}

export const useUIStore = create<UIState>((set) => ({
  searchQuery: '',
  setSearchQuery: (q) => set({ searchQuery: q }),

  isSettingsOpen: false,
  openSettings: () => set({ isSettingsOpen: true }),
  closeSettings: () => set({ isSettingsOpen: false }),

  hasUpdate: false,
  setHasUpdate: (v) => set({ hasUpdate: v }),
}))
