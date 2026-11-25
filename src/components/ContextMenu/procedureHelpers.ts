import { useConnectionStore } from '../../stores/connectionStore'
import { usePanelStore } from '../../stores/panelStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { apiFetch } from '../../utils/api'
import { layoutFor, pointCellsCleared } from '../../utils/stripLayout'

export type ProceduresJson = Record<string, Record<string, Record<string, unknown>>>

export const KNOWN_APPROACH_TYPES = ['ILS', 'RNAV', 'VORDME', 'LOC']

export interface ProcGroup {
  baseName: string
  base: string | null
  transitions: string[]
}

export function groupProcedures(procMap: Record<string, unknown>): ProcGroup[] {
  const groups: Record<string, ProcGroup> = {}
  for (const key of Object.keys(procMap).sort()) {
    const xIdx = key.indexOf('x')
    const baseName = xIdx === -1 ? key : key.slice(0, xIdx)
    if (!groups[baseName]) groups[baseName] = { baseName, base: null, transitions: [] }
    if (xIdx === -1) groups[baseName].base = key
    else groups[baseName].transitions.push(key)
  }
  return Object.values(groups).sort((a, b) => a.baseName.localeCompare(b.baseName))
}

export function detectApproachTypes(procMap: Record<string, unknown>): string[] {
  const found = new Set<string>()
  for (const name of Object.keys(procMap)) {
    const upper = name.toUpperCase()
    for (const t of KNOWN_APPROACH_TYPES) {
      if (new RegExp(`(?:^|x)${t}(?:x|$)`, 'i').test(upper)) found.add(t)
    }
  }
  return Array.from(found)
}

export async function applyProcedure(
  stripId: string,
  panelName: string,
  procType: 'SID' | 'STAR',
  runway: string,
  procName: string,
  onClose: () => void,
) {
  const strip = usePanelStore.getState().getStrip(stripId)
  if (!strip) { onClose(); return }

  const code = useSettingsStore.getState().settings.linkCode
  const callsign = strip.flightPlan?.callsign
  const { controllerMode } = useConnectionStore.getState()
  const normalizedRunway = runway.trim().toUpperCase()
  const normalizedProcName = procName.split('/')[0].trim().toUpperCase()

  const layout = layoutFor(controllerMode, strip.type)
  const runwayKey = layout.runway

  if (code && callsign) {
    const fieldName = procType === 'STAR' ? 'star' : 'sid'
    const endpoint = procType === 'STAR' ? '/api/set-star' : '/api/set-sid'
    try {
      const res = await apiFetch(endpoint, {
        method: 'POST',
        body: JSON.stringify({ code, callsign, runway: normalizedRunway, [fieldName]: normalizedProcName }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
    } catch (err) {
      console.error(`Failed to set ${procType}:`, err)
      return
    }
  }

  const clearedNotifPoints = pointCellsCleared(layout)

  usePanelStore.getState().updateStrip(panelName, stripId, {
    values: {
      ...strip.values,
      ...clearedNotifPoints,
      c8: normalizedProcName,
      ...(runwayKey ? { [runwayKey]: normalizedRunway } : {}),
    },
    ...(strip.flightPlan
      ? {
        flightPlan: {
          ...strip.flightPlan,
          ...(procType === 'STAR'
            ? { star: normalizedProcName, arrivalRwy: normalizedRunway }
            : { sid: normalizedProcName, departureRwy: normalizedRunway }),
        },
      }
      : {}),
  })
  onClose()
}

export const APPROACH_LABELS: Record<string, string> = {
  ILS: 'ILS',
  RNAV: 'RNAV',
  VORDME: 'VOR/DME',
  LOC: 'LOC',
}
