import type { StripData } from '../../types'

export type SortKey = 'EOBT' | 'ETOT' | 'SEQ' | 'TIME' | 'CALLSIGN' | 'MANUAL'

export const SORT_LABELS: Record<SortKey, string> = {
  EOBT: 'EOBT',
  ETOT: 'ETOT',
  SEQ: 'SEQ',
  TIME: 'TIME',
  CALLSIGN: 'Callsign',
  MANUAL: 'Manual',
}

interface SectionSortConfig {
  default: SortKey
  options: SortKey[]
}

const SECTION_SORTS: Record<string, SectionSortConfig> = {
  Pending: { default: 'EOBT', options: ['EOBT', 'CALLSIGN', 'MANUAL'] },
  Clearance: { default: 'EOBT', options: ['EOBT', 'CALLSIGN', 'MANUAL'] },
  Pushback: { default: 'ETOT', options: ['ETOT', 'CALLSIGN', 'MANUAL'] },
  'Ground Movement': { default: 'ETOT', options: ['ETOT', 'CALLSIGN', 'MANUAL'] },
  'Holding Point': { default: 'ETOT', options: ['ETOT', 'CALLSIGN', 'MANUAL'] },
  Sequence: { default: 'SEQ', options: ['SEQ', 'CALLSIGN'] },
  Handover: { default: 'TIME', options: ['TIME', 'CALLSIGN'] },
}

const FALLBACK: SectionSortConfig = { default: 'MANUAL', options: ['CALLSIGN', 'MANUAL'] }

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
    default:
      return sorted
  }
}
