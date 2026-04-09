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

function isMixedAlphanumeric(name: string): boolean {
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

function findProcedure(
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

export function getProcedurePoint(
  procedures: ProceduresData,
  procedureType: string,
  airport: string | undefined,
  runway: string,
  procedureName: string | undefined,
): string[] {
  if (!procedures || !airport || !runway || !procedureName) return []
  const typeObj = getTypeObject(procedures, airport, procedureType)
  if (!typeObj || !typeObj[runway]) return []

  const procData = typeObj[runway] as Record<string, string[]>
  const procKey = Object.keys(procData).find(k => k.toLowerCase() === procedureName.toLowerCase())
  if (!procKey) return []

  const pointsArray = procData[procKey]
  const nameParts = procedureName.split(/x|4R|4L|4C|4/).filter(p => p.length > 0)
  if (!nameParts.length) return []

  let firstPart = nameParts[nameParts.length - 1].replace(/^x+/i, '')
  if (procedureType.toUpperCase() === 'STAR') {
    firstPart = nameParts[0].replace(/^x+/i, '')
  }

  for (const point of pointsArray) {
    if (point.toUpperCase() === firstPart.toUpperCase()) return [point]
  }
  return []
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

async function getMatchedPointsWithETA(
  flight: FlightPlan,
  procedures: ProceduresData,
  type: 'SID' | 'STAR',
  isTower = false,
): Promise<PointWithETA[]> {
  if (!flight || !procedures) return []

  const { SID, STAR } = findProcedure(flight, procedures)
  const proc = type === 'SID' ? SID : STAR
  const flightPoints = (type === 'SID' ? flight.departurePoints : flight.arrivalPoints) as
    | PointWithETA[]
    | undefined

  if (!proc || !Array.isArray(proc.fixes) || !Array.isArray(flightPoints)) return []

  const flightMap = new Map(
    flightPoints
      .filter(p => !isMixedAlphanumeric(p.name))
      .map(p => [p.name.toUpperCase(), p]),
  )

  if (type === 'STAR' && isTower) {
    let lastIndex = -1
    proc.fixes.forEach((fix, i) => {
      if (flightMap.has(fix.toUpperCase())) lastIndex = i
    })
    if (lastIndex === -1) return []

    const start = Math.max(0, lastIndex - 2)
    const fixesObj = proc.fixes
      .slice(start, lastIndex + 1)
      .map(fix => flightMap.get(fix.toUpperCase()) || { name: fix })
    return fetchPointETAs(flight.callsign, fixesObj)
  }

  const seen = new Set<string>()
  const uniqueFixes: string[] = []
  for (const fix of proc.fixes) {
    const upper = fix.toUpperCase()
    if (!seen.has(upper)) {
      uniqueFixes.push(fix)
      seen.add(upper)
    }
  }

  const matched = uniqueFixes
    .map(name => flightMap.get(name.toUpperCase()))
    .filter((p): p is PointWithETA => !!p)
  return fetchPointETAs(flight.callsign, matched)
}

function isPointInValues(values: Record<string, string>, pointName: string): boolean {
  if (!pointName) return false
  const upper = pointName.toUpperCase()
  for (let i = 19; i <= 23; i++) {
    if ((values[`c${i}`] || '').toUpperCase() === upper) return true
  }
  return false
}

export async function computeProcedurePoints(
  flight: FlightPlan,
  type: string,
  controllerMode: string,
  procedures: ProceduresData,
  currentValues: Record<string, string>,
): Promise<Record<string, string>> {
  const result: Record<string, string> = {}

  const merged = () => ({ ...currentValues, ...result })
  const set = (key: string, value: string | undefined | null) => {
    if ((currentValues[key] || '').trim()) return
    if (value) result[key] = value
  }

  if (controllerMode === 'aerodrome' && type === 'arrival') {
    const matched = await getMatchedPointsWithETA(flight, procedures, 'STAR', true)
    matched.slice(0, 3).forEach((point, i) => {
      if (!point || isPointInValues(merged(), point.name)) return
      set(`c${19 + i}`, point.name)
      set(`c${24 + i}`, point.eta)
    })
    return result
  }

  if (controllerMode === 'approach') {
    if (type === 'departure') {
      set('c18', flight.departureRwy as string)

      const nextCopx = flight.nextCopxPoint as string | undefined
      const departurePoints = (flight.departurePoints || []) as PointWithETA[]
      const finalAlt = (flight.finalAltitude as number) || 0

      if (nextCopx && !isPointInValues(merged(), nextCopx)) {
        const [pointKey, etaKey] = finalAlt > 24000 ? ['c21', 'c26'] : ['c22', 'c27']
        const nextPt = departurePoints.find(p => p.name === nextCopx)
        set(pointKey, nextCopx)
        if (nextPt?.eta) {
          set(etaKey, nextPt.eta)
        } else {
          const [fetched] = await fetchPointETAs(flight.callsign, [{ name: nextCopx }])
          set(etaKey, fetched.eta)
        }
      }

      const matched = await getMatchedPointsWithETA(flight, procedures, 'SID')
      matched.slice(0, 2).forEach((point, i) => {
        if (!point || isPointInValues(merged(), point.name)) return
        set(`c${19 + i}`, point.name)
        set(`c${24 + i}`, point.eta)
      })
    } else if (type === 'arrival') {
      set('c18', flight.arrivalRwy as string)
      set('c32', flight.estimatedArrival as string)

      const arrivalPoints = (flight.arrivalPoints || []) as PointWithETA[]
      const nextCopx = flight.nextCopxPoint as string | undefined

      if (nextCopx && !isPointInValues(merged(), nextCopx)) {
        set('c21', nextCopx)
        const pt = arrivalPoints.find(p => p.name === nextCopx)
        if (pt?.eta) {
          set('c26', pt.eta)
        } else {
          const [fetched] = await fetchPointETAs(flight.callsign, [{ name: nextCopx }])
          set('c26', fetched.eta)
        }
      }

      const { STAR } = findProcedure(flight, procedures)
      const entryFixName =
        Array.isArray(STAR?.fixes) && STAR!.fixes.length > 0 ? STAR!.fixes[0] : null
      if (entryFixName && !isPointInValues(merged(), entryFixName)) {
        const fromEuroscope = arrivalPoints.find(
          p => p.name.toUpperCase() === entryFixName.toUpperCase(),
        )
        const pt = fromEuroscope?.eta
          ? fromEuroscope
          : (await fetchPointETAs(flight.callsign, [{ name: entryFixName }]))[0]
        set('c19', pt.name)
        set('c24', pt.eta)
      }

      const matched = await getMatchedPointsWithETA(flight, procedures, 'STAR')
      if (matched.length > 1 && !isPointInValues(merged(), matched[1].name)) {
        set('c20', matched[1].name)
        set('c25', matched[1].eta)
      }
    }
    return result
  }

  if (controllerMode === 'center') {
    const isDepature = type === 'departure'
    set('c18', isDepature ? (flight.departureRwy as string) : (flight.arrivalRwy as string))

    const procType = isDepature ? 'SID' : 'STAR'
    const airport = isDepature ? flight.departure : flight.arrival
    const runway = String(isDepature ? (flight.departureRwy || '') : (flight.arrivalRwy || ''))
    const procName = isDepature ? (flight.sid as string) : (flight.star as string)

    const points = getProcedurePoint(procedures, procType, airport, runway, procName)
    if (points.length > 0 && !isPointInValues(merged(), points[0])) {
      set('c22', points[0])
      const [pt] = await fetchPointETAs(flight.callsign, [{ name: points[0] }])
      set('c27', pt.eta)
    }
    return result
  }

  return result
}
