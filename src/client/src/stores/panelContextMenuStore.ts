import { create } from 'zustand'

// ─── Store ────────────────────────────────────────────────────────────────────

interface PanelContextMenuState {
  visible: boolean
  x: number
  y: number
  panelName: string | null
  show: (x: number, y: number, panelName: string) => void
  hide: () => void
}

export const usePanelContextMenuStore = create<PanelContextMenuState>((set) => ({
  visible: false,
  x: 0,
  y: 0,
  panelName: null,
  show: (x, y, panelName) => set({ visible: true, x, y, panelName }),
  hide: () => set({ visible: false }),
}))
