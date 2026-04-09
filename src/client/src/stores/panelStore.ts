import { create } from 'zustand'
import type { PanelData, StripData } from '../types'

const STORAGE_KEY = 'panels'
const SAVE_DEBOUNCE_MS = 300

// ─── Pending-clear guard (prevents fpupdate race from re-filling user-cleared cells) ──

const pendingClears = new Map<string, number>()
const PENDING_CLEAR_TTL_MS = 3000

export function markFieldCleared(stripId: string, key: string): void {
  pendingClears.set(`${stripId}|${key}`, Date.now())
}

export function isFieldClearPending(stripId: string, key: string): boolean {
  const ts = pendingClears.get(`${stripId}|${key}`)
  if (!ts) return false
  if (Date.now() - ts > PENDING_CLEAR_TTL_MS) {
    pendingClears.delete(`${stripId}|${key}`)
    return false
  }
  return true
}

// ─── localStorage sanitiser (guards against stale/corrupt saved data) ─────────

const VALID_STRIP_TYPES = new Set(['departure', 'arrival', 'overfly', 'transfer'])

function sanitizeStrip(s: unknown): StripData | null {
  if (!s || typeof s !== 'object') return null
  const o = s as Record<string, unknown>
  const type = VALID_STRIP_TYPES.has(o.type as string)
    ? (o.type as StripData['type'])
    : 'overfly'
  return {
    id: typeof o.id === 'string' ? o.id : `strip-${Date.now()}`,
    type,
    values: typeof o.values === 'object' && o.values !== null ? (o.values as Record<string, string>) : {},
    euroscope: Boolean(o.euroscope),
    flightPlan: o.flightPlan && typeof o.flightPlan === 'object' ? (o.flightPlan as StripData['flightPlan']) : null,
    lastUpdate: typeof o.lastUpdate === 'number' ? o.lastUpdate : Date.now(),
  }
}

function sanitizePanels(raw: unknown): PanelData[] {
  if (!Array.isArray(raw)) return []
  return raw.map((p: unknown) => {
    if (!p || typeof p !== 'object') return { name: 'Panel', strips: [] }
    const o = p as Record<string, unknown>
    return {
      name: typeof o.name === 'string' ? o.name.trim() : 'Panel',
      strips: Array.isArray(o.strips)
        ? (o.strips.map(sanitizeStrip).filter(Boolean) as StripData[])
        : [],
    }
  })
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function loadFromStorage(): PanelData[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return sanitizePanels(parsed)
  } catch {
    return []
  }
}

function persistPanels(panels: PanelData[]): void {
  // Save all panels but strip out euroscope-injected strips and transfer/handover strips
  const toSave = panels.map((panel) => ({
    ...panel,
    strips: panel.strips.filter((s) => !s.euroscope && s.type !== 'transfer'),
  }))
  localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave))
}

// ─── Store ────────────────────────────────────────────────────────────────────

interface PanelState {
  panels: PanelData[]

  // Read — search across all panels by strip ID
  getPanel: (name: string) => PanelData | undefined
  getStrip: (stripId: string) => StripData | undefined

  // Panels
  addPanel: (name: string) => void
  updatePanel: (name: string, updates: Partial<PanelData>) => void
  removePanel: (name: string) => void
  reorderPanels: (ordered: string[]) => void
  resetToLayout: (names: string[]) => void

  // Strips
  addStrip: (panelName: string, strip: StripData, atTop?: boolean) => void
  removeStrip: (panelName: string, stripId: string) => void
  updateStrip: (panelName: string, stripId: string, updates: Partial<StripData>) => void
  moveStrip: (fromPanel: string, toPanel: string, stripId: string, toIndex?: number) => void
  reorderStrips: (panelName: string, stripIds: string[]) => void
  clearEuroscopeStrips: () => void
  clearAllStrips: () => void

  // Persistence
  saveImmediate: () => void
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null

function scheduleSave(panels: PanelData[]): void {
  if (debounceTimer !== null) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    persistPanels(panels)
    debounceTimer = null
  }, SAVE_DEBOUNCE_MS)
}

export const usePanelStore = create<PanelState>((set, get) => ({
  panels: loadFromStorage(),

  // ── Read ───────────────────────────────────────────────────────────────────

  getPanel: (name) => get().panels.find((p) => p.name === name),

  getStrip: (stripId) => {
    for (const panel of get().panels) {
      const strip = panel.strips.find((s) => s.id === stripId)
      if (strip) return strip
    }
    return undefined
  },

  // ── Panels ─────────────────────────────────────────────────────────────────

  addPanel: (name) => {
    set((state) => {
      if (state.panels.some((p) => p.name === name)) return state
      const panels = [...state.panels, { name, strips: [] }]
      scheduleSave(panels)
      return { panels }
    })
  },

  updatePanel: (name, updates) => {
    set((state) => {
      const panels = state.panels.map((p) =>
        p.name === name ? { ...p, ...updates } : p
      )
      scheduleSave(panels)
      return { panels }
    })
  },

  removePanel: (name) => {
    set((state) => {
      const panels = state.panels.filter((p) => p.name !== name)
      scheduleSave(panels)
      return { panels }
    })
  },

  reorderPanels: (ordered) => {
    set((state) => {
      const map = new Map(state.panels.map((p) => [p.name, p]))
      const panels = ordered.flatMap((name) => (map.has(name) ? [map.get(name)!] : []))
      scheduleSave(panels)
      return { panels }
    })
  },

  resetToLayout: (names) => {
    set((state) => {
      // Keep existing panels whose names are in the new layout (preserves manual strips)
      const kept = state.panels.filter((p) => names.includes(p.name))
      const keptNames = new Set(kept.map((p) => p.name))
      // Add new empty panels for any that are missing
      const added: PanelData[] = names
        .filter((n) => !keptNames.has(n))
        .map((n) => ({ name: n, strips: [] }))
      // Sort in the same order as the names array
      const all = [...kept, ...added]
      all.sort((a, b) => names.indexOf(a.name) - names.indexOf(b.name))
      scheduleSave(all)
      return { panels: all }
    })
  },

  // ── Strips ─────────────────────────────────────────────────────────────────

  addStrip: (panelName, strip, atTop = false) => {
    set((state) => {
      const panels = state.panels.map((p) =>
        p.name === panelName
          ? { ...p, strips: atTop ? [strip, ...p.strips] : [...p.strips, strip] }
          : p
      )
      scheduleSave(panels)
      return { panels }
    })
  },

  removeStrip: (panelName, stripId) => {
    set((state) => {
      const panels = state.panels.map((p) =>
        p.name === panelName
          ? { ...p, strips: p.strips.filter((s) => s.id !== stripId) }
          : p
      )
      scheduleSave(panels)
      return { panels }
    })
  },

  updateStrip: (panelName, stripId, updates) => {
    set((state) => {
      const panels = state.panels.map((p) =>
        p.name === panelName
          ? {
              ...p,
              strips: p.strips.map((s) =>
                s.id === stripId ? { ...s, ...updates } : s
              ),
            }
          : p
      )
      scheduleSave(panels)
      return { panels }
    })
  },

  moveStrip: (fromPanel, toPanel, stripId, toIndex) => {
    set((state) => {
      let strip: StripData | undefined
      const panels = state.panels.map((p) => {
        if (p.name === fromPanel) {
          strip = p.strips.find((s) => s.id === stripId)
          return { ...p, strips: p.strips.filter((s) => s.id !== stripId) }
        }
        return p
      })
      if (!strip) return state

      const movedStrip = strip
      const finalPanels = panels.map((p) => {
        if (p.name === toPanel) {
          const strips = [...p.strips]
          if (toIndex !== undefined) {
            strips.splice(toIndex, 0, movedStrip)
          } else {
            strips.push(movedStrip)
          }
          return { ...p, strips }
        }
        return p
      })

      scheduleSave(finalPanels)
      return { panels: finalPanels }
    })
  },

  reorderStrips: (panelName, stripIds) => {
    set((state) => {
      const panels = state.panels.map((p) => {
        if (p.name !== panelName) return p
        const map = new Map(p.strips.map((s) => [s.id, s]))
        const strips = stripIds.flatMap((id) => (map.has(id) ? [map.get(id)!] : []))
        return { ...p, strips }
      })
      scheduleSave(panels)
      return { panels }
    })
  },

  clearEuroscopeStrips: () => {
    set((state) => {
      const panels = state.panels.map((p) => ({
        ...p,
        strips: p.strips.filter((s) => !s.euroscope),
      }))
      persistPanels(panels) // immediate — no debounce
      return { panels }
    })
  },

  clearAllStrips: () => {
    set((state) => {
      const panels = state.panels.map((p) => ({ ...p, strips: [] }))
      persistPanels(panels) // immediate — no debounce
      return { panels }
    })
  },

  // ── Persistence ────────────────────────────────────────────────────────────

  saveImmediate: () => {
    if (debounceTimer !== null) {
      clearTimeout(debounceTimer)
      debounceTimer = null
    }
    persistPanels(get().panels)
  },
}))
