import type { ControllerMode } from '../types'

export type StripEvent = 'clearance' | 'taxi' | 'takeoff' | 'landing' | 'assumed' | 'handoff' | 'approach'

export type PointSource =
  | { from: 'sid'; index: number }
  | { from: 'star'; index: number }
  | { from: 'entry' }
  | { from: 'afterEntry'; index: number }
  | { from: 'exit' }

export interface CellSpec {
  kind: 'free' | 'time' | 'point'
  title: string
  text?: string
  part?: 'hour' | 'minute'
  point?: PointSource
  eto?: string
  ato?: string
}

export interface StripLayout {
  data: string[]
  cells: Record<string, CellSpec>
  events: Partial<Record<StripEvent, string[]>>
  runway?: string
  frequency?: string
}

const COMMON_DATA = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c10', 'c11', 'c13']

const free = (title: string, text?: string): CellSpec => ({ kind: 'free', title, text })
const time = (title: string, text?: string, part?: 'hour' | 'minute'): CellSpec => ({ kind: 'time', title, text, part })
const point = (title: string, source: PointSource, eto?: string, ato?: string): CellSpec => ({
  kind: 'point',
  title,
  point: source,
  eto,
  ato,
})

const NOTE = free('Free box')
const FREE_TEXT = free('Free text', 'CNL IFR or ATC restrictions. Kept on the strip, not sent to EuroScope.')
const RESTRICTIONS = free('Restrictions', 'Speed, altitude or heading restrictions. Kept on the strip, not sent to EuroScope.')
const FIRST_CONTACT = time('First contact', 'Time of first radio contact. Filled in when you assume the aircraft.')
const TRANSFER_FREQUENCY = free('Transfer frequency', 'Frequency of the next controller. Filled in when you start the handoff.')
const TRANSFER_TIME = time('Transfer time', 'Time control is transferred. Filled in when you start the handoff.')

const ROUTE_POINTS: Record<string, CellSpec> = {
  c19: point('Entry point', { from: 'entry' }, 'c24', 'c29'),
  c20: point('Second point', { from: 'afterEntry', index: 0 }, 'c25', 'c30'),
  c21: point('Third point', { from: 'afterEntry', index: 1 }, 'c26', 'c31'),
  c22: point('Exit point', { from: 'exit' }, 'c27', 'c32'),
  c23: TRANSFER_FREQUENCY,
  c24: time('ETO entry point'),
  c25: time('ETO second point'),
  c26: time('ETO third point'),
  c27: time('ETO exit point'),
  c28: TRANSFER_TIME,
  c29: time('ATO entry point'),
  c30: time('ATO second point'),
  c31: time('ATO third point'),
  c32: time('ATO exit point'),
}

const TOWER_DEPARTURE: StripLayout = {
  data: [...COMMON_DATA, 'c8', 'c16'],
  runway: 'c16',
  cells: {
    c9: RESTRICTIONS,
    c12: FREE_TEXT,
    c14: NOTE,
    c15: free('Stand', 'Parking position.'),
    c17: NOTE,
    c18: free('Intersection', 'Taxiway letter for an intersection departure.'),
    c19: time('First contact', 'Time of first radio contact, normally when the clearance is issued. Filled in when the clearance is set.'),
    c20: time('COBT', 'Calculated off-block time.'),
    c21: time('Taxi time / revised COBT', 'Taxi time assigned by ATC, or the revised COBT.'),
    c22: NOTE,
    c23: time('Taxi', 'Time the aircraft starts taxiing. Filled in when the ground state changes to TAXI.'),
    c24: free('CTOT / restrictions', 'Calculated take-off time, or restrictions such as HRLS or VIFNO.'),
    c25: time('TOA', 'Time of a rejected take-off.'),
    c26: free('Delay code'),
    c27: NOTE,
    c28: NOTE,
    c29: time('Take-off hour', 'Hour of take-off. Filled in when the ground state changes to DEPA.', 'hour'),
    c30: time('Take-off minutes', 'Minutes of take-off. Filled in when the ground state changes to DEPA.', 'minute'),
    c31: NOTE,
    c32: NOTE,
  },
  events: { clearance: ['c19'], taxi: ['c23'], takeoff: ['c29', 'c30'] },
}

const TOWER_ARRIVAL: StripLayout = {
  data: [...COMMON_DATA, 'c8', 'c14', 'c18', 'c32'],
  runway: 'c18',
  cells: {
    c9: NOTE,
    c12: FREE_TEXT,
    c15: free('Stand', 'Parking position at destination.'),
    c16: NOTE,
    c17: NOTE,
    c19: point('Entry point', { from: 'star', index: 0 }, 'c24'),
    c20: point('Second point', { from: 'star', index: 1 }, 'c25'),
    c21: point('Third point', { from: 'star', index: 2 }),
    c22: NOTE,
    c23: NOTE,
    c24: time('Time over entry point'),
    c25: time('Time over second point'),
    c26: NOTE,
    c27: time('Time over IF'),
    c28: NOTE,
    c29: NOTE,
    c30: time('Landing hour', 'Hour of landing. Filled in when the ground state changes to ARR or TAXIIN.', 'hour'),
    c31: time('Landing minutes', 'Minutes of landing. Filled in when the ground state changes to ARR or TAXIIN.', 'minute'),
  },
  events: { landing: ['c30', 'c31'] },
}

const TOWER_OVERFLY: StripLayout = {
  data: [...COMMON_DATA, 'c14'],
  frequency: 'c23',
  cells: {
    c8: free('Route clearance'),
    c9: RESTRICTIONS,
    c12: FREE_TEXT,
    c15: NOTE,
    c16: NOTE,
    c17: NOTE,
    c18: NOTE,
    ...ROUTE_POINTS,
  },
  events: { handoff: ['c28'] },
}

const APPROACH_DEPARTURE: StripLayout = {
  data: [...COMMON_DATA, 'c8', 'c9', 'c12', 'c14', 'c16'],
  frequency: 'c23',
  cells: {
    c15: NOTE,
    c17: NOTE,
    c18: FIRST_CONTACT,
    ...ROUTE_POINTS,
    c19: point('First SID point', { from: 'sid', index: 0 }, 'c24', 'c29'),
    c20: point('Second point', { from: 'sid', index: 1 }, 'c25', 'c30'),
    c21: point('Third point', { from: 'sid', index: 2 }, 'c26', 'c31'),
    c24: time('ETO first SID point'),
    c29: time('ATO first SID point'),
  },
  events: { assumed: ['c18'], handoff: ['c28'] },
}

const APPROACH_ARRIVAL: StripLayout = {
  data: [...COMMON_DATA, 'c8', 'c9', 'c12', 'c14', 'c16', 'c18'],
  runway: 'c18',
  cells: {
    c15: NOTE,
    c17: NOTE,
    c19: point('Entry point', { from: 'entry' }, 'c24'),
    c20: free('IAF', 'Initial approach fix.'),
    c21: free('Secondary fix'),
    c22: free('IF', 'Intermediate approach fix.'),
    c23: time('EAT', 'Expected approach time, or the no-delay symbol.'),
    c24: time('Time over entry point'),
    c25: time('Time over IAF'),
    c26: time('Time over secondary fix'),
    c27: time('Time over IF'),
    c28: NOTE,
    c29: time('Approach clearance', 'Minutes the approach clearance was given. Filled in when the cleared level is set to CA or VAP.', 'minute'),
    c30: time('Transfer to tower', 'Time the aircraft was transferred to the tower. Filled in when you start the handoff.'),
    c31: free('Runway and approach type'),
    c32: time('On blocks'),
  },
  events: { approach: ['c29'], handoff: ['c30'] },
}

const RADAR_OVERFLY: StripLayout = {
  data: [...COMMON_DATA, 'c9', 'c12', 'c14', 'c16'],
  frequency: 'c23',
  cells: {
    c8: free('Route clearance'),
    c15: NOTE,
    c17: NOTE,
    c18: FIRST_CONTACT,
    ...ROUTE_POINTS,
  },
  events: { assumed: ['c18'], handoff: ['c28'] },
}

const CENTER_DEPARTURE: StripLayout = {
  data: [...COMMON_DATA, 'c8', 'c9', 'c12', 'c14', 'c32'],
  frequency: 'c23',
  cells: {
    c15: NOTE,
    c16: NOTE,
    c17: NOTE,
    c18: FIRST_CONTACT,
    c19: point('Entry point', { from: 'entry' }, 'c24'),
    c20: NOTE,
    c21: NOTE,
    c22: point('Exit point', { from: 'exit' }, 'c27'),
    c23: TRANSFER_FREQUENCY,
    c24: time('ETO entry point'),
    c25: NOTE,
    c26: NOTE,
    c27: time('ETO exit point'),
    c28: TRANSFER_TIME,
    c29: NOTE,
    c30: NOTE,
    c31: NOTE,
  },
  events: { assumed: ['c18'], handoff: ['c28'] },
}

const CENTER_ARRIVAL: StripLayout = {
  data: [...COMMON_DATA, 'c8', 'c9', 'c12', 'c14', 'c16', 'c32'],
  frequency: 'c23',
  cells: {
    c15: NOTE,
    c17: NOTE,
    c18: FIRST_CONTACT,
    c19: ROUTE_POINTS.c19,
    c20: ROUTE_POINTS.c20,
    c21: ROUTE_POINTS.c21,
    c22: point('Fourth point', { from: 'afterEntry', index: 2 }, 'c27'),
    c23: TRANSFER_FREQUENCY,
    c24: ROUTE_POINTS.c24,
    c25: ROUTE_POINTS.c25,
    c26: ROUTE_POINTS.c26,
    c27: time('ETO fourth point'),
    c28: TRANSFER_TIME,
    c29: ROUTE_POINTS.c29,
    c30: ROUTE_POINTS.c30,
    c31: ROUTE_POINTS.c31,
  },
  events: { assumed: ['c18'], handoff: ['c28'] },
}

const LAYOUTS: Record<Unit, Record<'departure' | 'arrival' | 'overfly', StripLayout>> = {
  aerodrome: { departure: TOWER_DEPARTURE, arrival: TOWER_ARRIVAL, overfly: TOWER_OVERFLY },
  approach: { departure: APPROACH_DEPARTURE, arrival: APPROACH_ARRIVAL, overfly: RADAR_OVERFLY },
  center: { departure: CENTER_DEPARTURE, arrival: CENTER_ARRIVAL, overfly: RADAR_OVERFLY },
}

export type Unit = 'aerodrome' | 'approach' | 'center'

export function unitOf(mode: ControllerMode): Unit {
  return mode === 'aerodrome' || mode === 'center' ? mode : 'approach'
}

export function layoutFor(mode: ControllerMode, type: string): StripLayout {
  const unit = unitOf(mode)
  const kind = type === 'departure' || type === 'arrival' ? type : 'overfly'
  return LAYOUTS[unit][kind]
}

export function freeCells(layout: StripLayout): string[] {
  return Object.keys(layout.cells)
}

export function timeStamp(spec: CellSpec | undefined, now: Date): string {
  const hours = String(now.getUTCHours()).padStart(2, '0')
  const minutes = String(now.getUTCMinutes()).padStart(2, '0')
  if (spec?.part === 'hour') return hours
  if (spec?.part === 'minute') return minutes
  return hours + minutes
}

export function pointCellsCleared(layout: StripLayout): Record<string, string> {
  const cleared: Record<string, string> = {}
  Object.entries(layout.cells).forEach(([key, spec]) => {
    if (spec.kind !== 'point') return
    cleared[key] = ''
    if (spec.eto) cleared[spec.eto] = ''
  })
  return cleared
}
