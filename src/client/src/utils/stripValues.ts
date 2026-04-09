import type { FlightPlan, ControllerMode } from '../types'

export function formatTime(time: unknown): string {
  if (time == null) return ''
  return String(time).padStart(4, '0')
}

export function formatAltitude(alt: unknown): string {
  const n = parseInt(String(alt), 10)
  if (isNaN(n)) return ''
  return Math.round(n / 100).toString().padStart(3, '0')
}

export function formatClearedAltitude(clearedAlt: unknown, finalAlt: unknown): string {
  if (clearedAlt == 0) return ''
  if (parseInt(String(clearedAlt), 10) === parseInt(String(finalAlt), 10)) return ''
  if (clearedAlt == 1) return 'CA'
  if (clearedAlt == 2) return 'VA'
  return formatAltitude(clearedAlt) || ''
}

export function extractRegistration(remarks: unknown): string {
  if (!remarks) return ''
  const match = String(remarks).match(/REG\/([A-Z0-9]+)/i)
  return match ? match[1] : ''
}

export function extractStatus(remarks: unknown): string {
  if (!remarks) return ''
  const s = String(remarks)
  const match = s.match(/STATUS\/([A-Z]+)/i)
  const match2 = s.match(/STS\/([A-Z]+)/i)
  return match ? match[1] : match2 ? match2[1] : ''
}

export function buildInitialValues(
  flight: FlightPlan,
  type: string,
  controllerMode: ControllerMode,
): Record<string, string> {
  const v: Record<string, string> = {}

  const set = (key: string, value: string | undefined | null) => {
    if (value !== undefined && value !== null && value !== '') v[key] = value
  }

  set('c1', flight.callsign)
  set('c2', flight.aircraftType as string)
  set('c3', flight.groundSpeed != null ? 'N' + String(flight.groundSpeed) : '')
  set('c4', flight.departure)
  set('c5', flight.arrival)
  set('c6', flight.squawk ? 'A' + String(flight.squawk) : '')
  set('c7', formatTime(flight.atd))

  if (type === 'departure') set('c8', flight.sid as string)
  else if (type === 'arrival') set('c8', flight.star as string)

  set('c10', extractRegistration(flight.remarks))
  const statusStr = extractStatus(flight.remarks)
  if (statusStr) set('c11', 'STS/' + statusStr)

  if (flight.finalAltitude != null) set('c13', 'F' + formatAltitude(flight.finalAltitude))
  set('c14', formatClearedAltitude(flight.clearedAltitude, flight.finalAltitude))

  if (controllerMode === 'aerodrome') {
    if (type === 'departure') {
      set('c12', (flight.clearedFlag as number) == 1 ? 'Ⓑ' : '')
      set('c16', flight.departureRwy as string)
    } else if (type === 'arrival') {
      set('c18', flight.arrivalRwy as string)
      set('c32', flight.estimatedArrival as string)
    }
  } else {
    const spd =
      (flight.assignedSpeed as number) === 0
        ? (flight.assignedMach as number) === 0
          ? ''
          : String(flight.assignedMach)
        : String(flight.assignedSpeed ?? '')
    set('c9', spd)
    set('c12', flight.directTo as string)
    const hdg = (flight.assignedHeading as number) === 0 ? '' : String(flight.assignedHeading ?? '')
    set('c16', hdg)

    if (type === 'arrival') {
      set('c18', flight.arrivalRwy as string)
      set('c32', flight.estimatedArrival as string)
    } else if (type === 'departure' && controllerMode === 'approach') {
      set('c18', flight.departureRwy as string)
    }
  }

  return v
}

export const CUSTOM_BOX_INDICES = [18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31]

export const CUSTOM_BOX_KEYS = CUSTOM_BOX_INDICES.map((i) => `c${i + 1}`)
