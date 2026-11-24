import type { StripData } from '../../types'

export type SortKey = 'EOBT' | 'ETOT' | 'SEQ' | 'TIME' | 'CALLSIGN' | 'CFL' | 'RFL' | 'ETA' | 'DEST' | 'TYPE' | 'MANUAL'

export const SORT_LABELS: Record<SortKey, string> = {
  EOBT: 'EOBT',
  ETOT: 'ETOT',
  SEQ: 'SEQ',
  TIME: 'Last update',
  CALLSIGN: 'Callsign',
  CFL: 'Cleared level',
  RFL: 'Final level',
  ETA: 'ETA',
  DEST: 'Destination',
  TYPE: 'Aircraft type',
  MANUAL: 'Manual',
}

interface SectionSortConfig {
  default: SortKey
  options: SortKey[]
}

const COMMON: SortKey[] = ['CALLSIGN', 'DEST', 'TYPE', 'TIME']

const SECTION_SORTS: Record<string, SectionSortConfig> = {
  Pending: { default: 'EOBT', options: ['EOBT', ...COMMON, 'MANUAL'] },
  Clearance: { default: 'EOBT', options: ['EOBT', ...COMMON, 'MANUAL'] },
  Pushback: { default: 'ETOT', options: ['ETOT', ...COMMON, 'MANUAL'] },
  'Ground Movement': { default: 'ETOT', options: ['ETOT', ...COMMON, 'MANUAL'] },
  'Holding Point': { default: 'ETOT', options: ['ETOT', ...COMMON, 'MANUAL'] },
  Sequence: { default: 'SEQ', options: ['SEQ', 'ETA', ...COMMON] },
  'Handed Off': { default: 'TIME', options: ['TIME', 'CALLSIGN', 'DEST', 'TYPE'] },
}

const FALLBACK: SectionSortConfig = { default: 'MANUAL', options: ['CFL', 'RFL', 'ETA', ...COMMON, 'MANUAL'] }

export function sortConfig(panelName: string): SectionSortConfig {
  return SECTION_SORTS[panelName] ?? FALLBACK
}

export function activeSort(panelName: string, saved: SortKey | undefined): SortKey {
  const config = sortConfig(panelName)
  return saved && config.options.includes(saved) ? saved : config.default
}

export function isOrdered(key: SortKey): boolean {
  return key !== 'MANUAL' && key !== 'SEQ'
}

function departureTime(strip: StripData): string {
  return (strip.values.c7 ?? '').replace(/\D/g, '')
}

function finalLevelOf(strip: StripData): number {
  const value = Number(strip.flightPlan?.finalAltitude)
  return Number.isFinite(value) && value > 0 ? value : -1
}

function clearedLevelOf(strip: StripData): number {
  const value = Number(strip.flightPlan?.clearedAltitude)
  if (!Number.isFinite(value) || value === 0) return finalLevelOf(strip)
  return value
}

function compareText(a: string, b: string): number {
  if (!a && !b) return 0
  if (!a) return 1
  if (!b) return -1
  return a.localeCompare(b)
}

export function sortStrips(strips: StripData[], key: SortKey): StripData[] {
  if (!isOrdered(key)) return strips
  const sorted = [...strips]
  switch (key) {
    case 'EOBT':
    case 'ETOT':
      return sorted.sort((a, b) => compareText(departureTime(a), departureTime(b)))
    case 'CALLSIGN':
      return sorted.sort((a, b) => compareText(a.values.c1 ?? '', b.values.c1 ?? ''))
    case 'TIME':
      return sorted.sort((a, b) => a.lastUpdate - b.lastUpdate)
    case 'DEST':
      return sorted.sort((a, b) => compareText(a.flightPlan?.arrival ?? '', b.flightPlan?.arrival ?? ''))
    case 'TYPE':
      return sorted.sort((a, b) => compareText(a.flightPlan?.aircraftType ?? '', b.flightPlan?.aircraftType ?? ''))
    case 'ETA':
      return sorted.sort((a, b) =>
        compareText((a.flightPlan?.estimatedArrival ?? '').replace(/\D/g, ''), (b.flightPlan?.estimatedArrival ?? '').replace(/\D/g, '')),
      )
    case 'RFL':
      return sorted.sort((a, b) => finalLevelOf(b) - finalLevelOf(a))
    case 'CFL':
      return sorted.sort((a, b) => clearedLevelOf(b) - clearedLevelOf(a))
    default:
      return sorted
  }
}
