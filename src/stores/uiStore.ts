import { create } from 'zustand'
import type { StripType } from '../types'

export type StatusPanel = 'stations' | 'nearby' | 'add' | 'filters' | 'link'

export type StatusItemKey = 'stations' | 'nearby' | 'add' | 'filters' | 'position' | 'link' | 'version'

export type StatusItems = Record<StatusItemKey, boolean>

const STATUS_KEY = 'statusBar'

const DEFAULT_STATUS_ITEMS: StatusItems = {
  stations: true,
  nearby: true,
  add: true,
  filters: true,
  position: true,
  link: true,
  version: true,
}

function loadStatusBar(): { items: StatusItems; hidden: boolean } {
  try {
    const saved = JSON.parse(localStorage.getItem(STATUS_KEY) || '{}')
    return { items: { ...DEFAULT_STATUS_ITEMS, ...saved.items }, hidden: saved.hidden === true }
  } catch {
    return { items: { ...DEFAULT_STATUS_ITEMS }, hidden: false }
  }
}

function saveStatusBar(items: StatusItems, hidden: boolean): void {
  try {
    localStorage.setItem(STATUS_KEY, JSON.stringify({ items, hidden }))
  } catch {
    return
  }
}

export const INSPECTOR_MIN_WIDTH = 300
export const INSPECTOR_MAX_WIDTH = 560
const INSPECTOR_DEFAULT_WIDTH = 372
const INSPECTOR_WIDTH_KEY = 'inspectorWidth'

function clampInspectorWidth(width: number): number {
  return Math.min(INSPECTOR_MAX_WIDTH, Math.max(INSPECTOR_MIN_WIDTH, Math.round(width)))
}

function loadInspectorWidth(): number {
  try {
    const saved = Number(localStorage.getItem(INSPECTOR_WIDTH_KEY))
    return saved ? clampInspectorWidth(saved) : INSPECTOR_DEFAULT_WIDTH
  } catch {
    return INSPECTOR_DEFAULT_WIDTH
  }
}

const SECTION_KEY = 'sectionView'

interface SectionView {
  sort: Record<string, string>
  collapsed: Record<string, boolean>
}

function loadSectionView(): SectionView {
  try {
    const saved = JSON.parse(localStorage.getItem(SECTION_KEY) || '{}')
    return { sort: saved.sort ?? {}, collapsed: saved.collapsed ?? {} }
  } catch {
    return { sort: {}, collapsed: {} }
  }
}

function saveSectionView(view: SectionView): void {
  try {
    localStorage.setItem(SECTION_KEY, JSON.stringify(view))
  } catch {
    return
  }
}

export type TrafficFilters = Record<Exclude<StripType, 'transfer'>, boolean>

interface UIState {
  searchQuery: string
  setSearchQuery: (q: string) => void

  isSettingsOpen: boolean
  openSettings: () => void
  closeSettings: () => void

  hasUpdate: boolean
  setHasUpdate: (v: boolean) => void

  selectedStripId: string | null
  selectStrip: (id: string | null) => void

  inspectorOpen: boolean
  toggleInspector: () => void
  inspectorWidth: number
  setInspectorWidth: (width: number) => void

  statusPanel: StatusPanel | null
  toggleStatusPanel: (panel: StatusPanel) => void
  closeStatusPanel: () => void

  statusItems: StatusItems
  statusHidden: boolean
  toggleStatusItem: (key: StatusItemKey) => void
  setStatusHidden: (hidden: boolean) => void

  sectionSort: Record<string, string>
  sectionCollapsed: Record<string, boolean>
  setSectionSort: (panel: string, key: string) => void
  toggleSectionCollapsed: (panel: string) => void

  trafficFilters: TrafficFilters
  toggleTraffic: (type: keyof TrafficFilters) => void
  resetTraffic: () => void
}

const ALL_TRAFFIC: TrafficFilters = { departure: true, arrival: true, overfly: true }

export const useUIStore = create<UIState>((set) => ({
  searchQuery: '',
  setSearchQuery: (q) => set({ searchQuery: q }),

  isSettingsOpen: false,
  openSettings: () => set({ isSettingsOpen: true }),
  closeSettings: () => set({ isSettingsOpen: false }),

  hasUpdate: false,
  setHasUpdate: (v) => set({ hasUpdate: v }),

  selectedStripId: null,
  selectStrip: (id) => set({ selectedStripId: id }),

  inspectorOpen: true,
  toggleInspector: () => set((s) => ({ inspectorOpen: !s.inspectorOpen })),
  inspectorWidth: loadInspectorWidth(),
  setInspectorWidth: (width) => {
    const clamped = clampInspectorWidth(width)
    try {
      localStorage.setItem(INSPECTOR_WIDTH_KEY, String(clamped))
    } catch {
      void 0
    }
    set({ inspectorWidth: clamped })
  },

  statusPanel: null,
  toggleStatusPanel: (panel) =>
    set((s) => ({ statusPanel: s.statusPanel === panel ? null : panel })),
  closeStatusPanel: () => set({ statusPanel: null }),

  statusItems: loadStatusBar().items,
  statusHidden: loadStatusBar().hidden,
  toggleStatusItem: (key) =>
    set((s) => {
      const items = { ...s.statusItems, [key]: !s.statusItems[key] }
      saveStatusBar(items, s.statusHidden)
      return { statusItems: items }
    }),
  setStatusHidden: (hidden) =>
    set((s) => {
      saveStatusBar(s.statusItems, hidden)
      return { statusHidden: hidden, statusPanel: null }
    }),

  sectionSort: loadSectionView().sort,
  sectionCollapsed: loadSectionView().collapsed,
  setSectionSort: (panel, key) =>
    set((s) => {
      const sort = { ...s.sectionSort, [panel]: key }
      saveSectionView({ sort, collapsed: s.sectionCollapsed })
      return { sectionSort: sort }
    }),
  toggleSectionCollapsed: (panel) =>
    set((s) => {
      const collapsed = { ...s.sectionCollapsed, [panel]: !s.sectionCollapsed[panel] }
      saveSectionView({ sort: s.sectionSort, collapsed })
      return { sectionCollapsed: collapsed }
    }),

  trafficFilters: { ...ALL_TRAFFIC },
  toggleTraffic: (type) =>
    set((s) => ({ trafficFilters: { ...s.trafficFilters, [type]: !s.trafficFilters[type] } })),
  resetTraffic: () => set({ trafficFilters: { ...ALL_TRAFFIC } }),
}))
