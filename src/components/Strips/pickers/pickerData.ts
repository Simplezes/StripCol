import { useAssetsStore } from '../../../stores/assetsStore'
import type { ControllerMode, FlightPlan } from '../../../types'
import { hasRunwayInCell18 } from '../../../utils/stripValues'
import { buildLegs } from '../../ContextMenu/routeLegs'

export interface PointOption {
  name: string
  eta: string
}

const ANY_MODE_CELLS = ['c6', 'c7', 'c13', 'c14']
const RADAR_ONLY_CELLS = ['c9', 'c12']
const POINT_CELLS = ['c19', 'c20', 'c21', 'c22']

export function isPickableCell(key: string, mode: ControllerMode, type: string): boolean {
  const radar = mode !== 'aerodrome'
  if (RADAR_ONLY_CELLS.includes(key)) return radar
  if (key === 'c16') return radar || type === 'departure'
  if (key === 'c18') return hasRunwayInCell18(mode, type)
  if (key === 'c8') return type !== 'overfly'
  if (POINT_CELLS.includes(key)) return radar || type === 'arrival'
  return ANY_MODE_CELLS.includes(key)
}

export const PICKER_TITLES: Record<string, string> = {
  c6: 'Squawk',
  c7: 'Departure time',
  c8: 'Procedure',
  c9: 'Assigned speed',
  c12: 'Direct to',
  c13: 'Final altitude',
  c14: 'Cleared altitude',
  c16: 'Assigned heading',
  c18: 'Runway',
  c19: 'Notification point 1',
  c20: 'Notification point 2',
  c21: 'Notification point 3',
  c22: 'Notification point 4',
}

export const LEVELS = Array.from({ length: 46 }, (_, i) => String((i + 1) * 10).padStart(3, '0'))

export const KNOTS = ['160', '180', '190', '200', '210', '220', '230', '240', '250', '260', '270', '280', '290', '300', '310', '320']

export const MACH = ['.70', '.72', '.74', '.76', '.78', '.80', '.82', '.84', '.86', '.88']

export const SQUAWKS: Array<{ code: string; label: string }> = [
  { code: '2000', label: 'Conspicuity' },
  { code: '1200', label: 'VFR' },
  { code: '7000', label: 'VFR (ICAO)' },
  { code: '7500', label: 'Unlawful interference' },
  { code: '7600', label: 'Radio failure' },
  { code: '7700', label: 'Emergency' },
  { code: '0000', label: 'Reset' },
]

export function pointOptions(flight: FlightPlan | null): PointOption[] {
  if (!flight) return []

  const seen = new Set<string>()
  const options: PointOption[] = []
  const add = (name: string | undefined, eta = '') => {
    const key = (name ?? '').toUpperCase()
    if (!key || seen.has(key)) return
    seen.add(key)
    options.push({ name: key, eta })
  }

  ;(flight.departurePoints ?? []).forEach((p) => add(p.name, p.eta ?? ''))
  buildLegs(flight).forEach((leg) => add(leg.to, leg.eta))
  ;(flight.arrivalPoints ?? []).forEach((p) => add(p.name, p.eta ?? ''))
  return options
}

export function runwayOptions(flight: FlightPlan | null, type: string): string[] {
  if (!flight) return []

  const isArrival = type === 'arrival'
  const airport = (isArrival ? flight.arrival : flight.departure) ?? ''
  const procType = isArrival ? 'STAR' : 'SID'
  const procedures = useAssetsStore.getState().procedures as Record<string, Record<string, Record<string, unknown>>>
  const byProc = procedures[airport] ?? procedures[airport.toUpperCase()] ?? procedures[airport.toLowerCase()]
  return Object.keys(byProc?.[procType] ?? {}).sort()
}

export function utcTimeIn(minutes: number): string {
  const d = new Date(Date.now() + minutes * 60_000)
  return `${String(d.getUTCHours()).padStart(2, '0')}${String(d.getUTCMinutes()).padStart(2, '0')}`
}

export function applyCellValue(stripId: string, cell: string, value: string): void {
  const input = document.querySelector<HTMLInputElement>(`[data-strip-id="${stripId}"] input[data-cell="${cell}"]`)
  if (!input) return

  input.focus()
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  setter?.call(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
  setTimeout(() => input.blur(), 0)
}
