import { create } from 'zustand'

interface ContextMenuState {
  visible: boolean
  x: number
  y: number
  stripId: string | null
  panelName: string | null

  show: (x: number, y: number, stripId: string, panelName: string) => void
  hide: () => void
}

export const useContextMenuStore = create<ContextMenuState>((set) => ({
  visible: false,
  x: 0,
  y: 0,
  stripId: null,
  panelName: null,

  show: (x, y, stripId, panelName) =>
    set({ visible: true, x, y, stripId, panelName }),

  hide: () => set({ visible: false, stripId: null, panelName: null }),
}))
