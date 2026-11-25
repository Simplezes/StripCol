import type { FlightPlan, ControllerMode } from '../types'
import { layoutFor } from './stripLayout'

export const CLEARANCE_FLAG_MARK = 'Ⓑ'

export function isTowerDeparture(mode: ControllerMode, type: string): boolean {
  return mode === 'aerodrome' && type === 'departure'
}

export function formatTime(time: unknown): string {
  if (time == null || time === '') return ''
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
  if (clearedAlt == 2) return 'VAP'
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

function procedureCell(flight: FlightPlan, type: string): string {
  const procedure = type === 'arrival' ? flight.star : type === 'departure' ? flight.sid : ''
  if (!procedure) return ''
  return flight.clearanceReceived ? `${procedure} ${CLEARANCE_FLAG_MARK}` : procedure
}

function speedCell(flight: FlightPlan): string {
  if (flight.assignedSpeed) return String(flight.assignedSpeed)
  return flight.assignedMach ? String(flight.assignedMach) : ''
}

export function dataValues(flight: FlightPlan, type: string, mode: ControllerMode): Record<string, string> {
  const towerDeparture = isTowerDeparture(mode, type)
  const status = extractStatus(flight.remarks)

  const candidates: Record<string, string | undefined> = {
    c1: flight.callsign,
    c2: flight.aircraftType,
    c3: flight.groundSpeed ? 'N' + String(flight.groundSpeed).padStart(4, '0') : '',
    c4: flight.departure,
    c5: flight.arrival,
    c6: flight.squawk ? 'A' + String(flight.squawk) : '',
    c7: formatTime(towerDeparture ? flight.estimatedDepartureTime : flight.atd),
    c8: procedureCell(flight, type),
    c9: speedCell(flight),
    c10: extractRegistration(flight.remarks),
    c11: status ? 'STS/' + status : '',
    c12: flight.directTo,
    c13: flight.finalAltitude != null ? formatAltitude(flight.finalAltitude) : '',
    c14: formatClearedAltitude(flight.clearedAltitude, flight.finalAltitude),
    c16: towerDeparture ? flight.departureRwy : flight.assignedHeading ? String(flight.assignedHeading) : '',
    c18: type === 'arrival' ? flight.arrivalRwy : flight.departureRwy,
    c32: flight.estimatedArrival,
  }

  const values: Record<string, string> = {}
  layoutFor(mode, type).data.forEach((key) => {
    const value = candidates[key]
    if (value) values[key] = value
  })
  return values
}
