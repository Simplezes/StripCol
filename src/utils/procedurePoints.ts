import type { FlightPlan } from '../types'
import type { ProceduresData } from '../stores/assetsStore'
import { apiFetch } from './api'
import { useSettingsStore } from '../stores/settingsStore'

export interface PointWithETA {
  name: string
  eta?: string
}

interface ProcedureResult {
  name: string
  runway: string
  fixes: string[]
}

export function isMixedAlphanumeric(name: string): boolean {
  return /[A-Za-z]/.test(name) && /\d/.test(name)
}

function getAirport(procedures: ProceduresData, code: string | undefined): Record<string, unknown> | null {
  if (!procedures || !code) return null
  return (
    (procedures[code] as Record<string, unknown>) ||
    (procedures[code.toUpperCase()] as Record<string, unknown>) ||
    (procedures[code.toLowerCase()] as Record<string, unknown>) ||
    null
  )
}

function getTypeObject(
  procedures: ProceduresData,
  airport: string | undefined,
  type: string,
): Record<string, unknown> | null {
  const airportObj = getAirport(procedures, airport)
  if (!airportObj) return null
  const key = Object.keys(airportObj).find(k => k.toLowerCase() === type.toLowerCase())
  return key ? (airportObj[key] as Record<string, unknown>) : null
}

export function findProcedure(
  flight: FlightPlan,
  procedures: ProceduresData,
): { SID: ProcedureResult | null; STAR: ProcedureResult | null } {
  const { departure, arrival, sid, star, departureRwy, arrivalRwy } = flight

  const find = (
    airport: string | undefined,
    type: string,
    procedureName: string | undefined,
    runway: string | undefined,
  ): ProcedureResult | null => {
    const typeObj = getTypeObject(procedures, airport, type)
    if (!typeObj || !procedureName) return null

    const runwaysToCheck =
      runway && typeObj[runway as string]
        ? [runway as string]
        : Object.keys(typeObj)

    for (const rw of runwaysToCheck) {
      const procs = typeObj[rw] as Record<string, unknown>
      if (!procs) continue
      for (const [name, fixes] of Object.entries(procs)) {
        const upper = name.toUpperCase()
        const wordNorm = (procedureName as string).toUpperCase()
        if (upper === wordNorm || upper.startsWith(wordNorm) || wordNorm.startsWith(upper)) {
          return { name, runway: rw, fixes: fixes as string[] }
        }
      }
    }
    return null
  }

  return {
    SID: find(departure, 'SID', sid as string, departureRwy as string),
    STAR: find(arrival, 'STAR', star as string, arrivalRwy as string),
  }
}

export async function fetchPointETAs(callsign: string, points: PointWithETA[]): Promise<PointWithETA[]> {
  const toFetch = points.filter(p => !p.eta)
  if (!toFetch.length) return points
  const code = useSettingsStore.getState().settings.linkCode
  try {
    const names = toFetch.map(p => p.name).join(',')
    const r = await apiFetch(
      `/api/point-time?code=${encodeURIComponent(code)}&callsign=${encodeURIComponent(callsign)}&points=${encodeURIComponent(names)}`,
    )
    if (r.ok) {
      const data: PointWithETA[] = await r.json()
      toFetch.forEach(p => {
        const found = data.find(d => d.name === p.name)
        p.eta = found ? (found.eta || 'N/A') : 'N/A'
      })
    } else {
      toFetch.forEach(p => (p.eta = 'N/A'))
    }
  } catch {
    toFetch.forEach(p => (p.eta = 'N/A'))
  }
  return points
}
