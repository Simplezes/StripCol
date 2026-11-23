import { create } from 'zustand'

export interface OpenPicker {
  stripId: string
  panelName: string
  cell: string
  rect: DOMRect
}

interface CellPickerState {
  open: OpenPicker | null
  openPicker: (picker: OpenPicker) => void
  closePicker: () => void
}

export const useCellPickerStore = create<CellPickerState>((set) => ({
  open: null,
  openPicker: (picker) => set({ open: picker }),
  closePicker: () => set({ open: null }),
}))
