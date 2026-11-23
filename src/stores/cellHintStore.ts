import { create } from 'zustand'
import type { CellHelp } from '../components/Strips/cellHelp'

export interface CellHint extends CellHelp {
  rect: DOMRect
}

interface CellHintState {
  hint: CellHint | null
  show: (hint: CellHint) => void
  hide: () => void
}

export const useCellHintStore = create<CellHintState>((set) => ({
  hint: null,
  show: (hint) => set({ hint }),
  hide: () => set((s) => (s.hint ? { hint: null } : s)),
}))
