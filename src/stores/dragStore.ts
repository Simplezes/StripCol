import { create } from 'zustand'

interface DragState {
  activeId: string | null
  sourcePanel: string | null
  overPanel: string | null
  landedId: string | null

  start: (id: string, panel: string) => void
  setOver: (panel: string | null) => void
  end: () => void
  setLanded: (id: string | null) => void
}

export const useDragStore = create<DragState>((set, get) => ({
  activeId: null,
  sourcePanel: null,
  overPanel: null,
  landedId: null,

  start: (id, panel) => set({ activeId: id, sourcePanel: panel, overPanel: panel }),

  setOver: (panel) => {
    if (get().overPanel === panel) return
    set({ overPanel: panel })
  },

  end: () => set({ activeId: null, sourcePanel: null, overPanel: null }),

  setLanded: (id) => set({ landedId: id }),
}))
