import { create } from 'zustand'

interface DragState {
  activeId: string | null
  sourcePanel: string | null
  overPanel: string | null
  overIndex: number
  slotHeight: number
  landedId: string | null

  start: (id: string, panel: string, height: number) => void
  setTarget: (panel: string | null, index: number) => void
  end: () => void
  setLanded: (id: string | null) => void
}

export const useDragStore = create<DragState>((set, get) => ({
  activeId: null,
  sourcePanel: null,
  overPanel: null,
  overIndex: -1,
  slotHeight: 92,
  landedId: null,

  start: (id, panel, height) =>
    set({ activeId: id, sourcePanel: panel, overPanel: panel, overIndex: -1, slotHeight: height }),

  setTarget: (panel, index) => {
    const { overPanel, overIndex } = get()
    if (overPanel === panel && overIndex === index) return
    set({ overPanel: panel, overIndex: index })
  },

  end: () => set({ activeId: null, sourcePanel: null, overPanel: null, overIndex: -1 }),

  setLanded: (id) => set({ landedId: id }),
}))
