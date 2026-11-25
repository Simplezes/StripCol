import type { ProceduresData, TransferPoint } from '../stores/assetsStore'
import type { ControllerMode, FlightPlan } from '../types'
import { findProcedure, isMixedAlphanumeric } from './procedurePoints'
import { freeCells, layoutFor, timeStamp, unitOf, type PointSource, type StripEvent, type Unit } from './stripLayout'
import { dataValues } from './stripValues'

interface PointTimes {
  eta: string
  ato: string
}

export interface PreviousStrip {
  values: Record<string, string>
  autoCells?: string[]
  flightPlan: FlightPlan | null
}

export interface FillOptions {
  procedures: ProceduresData
  transfers: TransferPoint[]
  ownPositions: string[]
  euroscopeTransfers: boolean
  autoTimes: boolean
  assumed?: boolean
  now?: Date
}

export interface StripFill {
  values: Record<string, string>
  autoCells: string[]
  unit: Unit
}

function pointTimes(flight: FlightPlan): Map<string, PointTimes> {
  const times = new Map<string, PointTimes>()
  const add = (points: Array<{ name: string; eta?: string; ato?: string }> | undefined) => {
    ;(points ?? []).forEach((p) => {
      const name = p.name.toUpperCase()
      const known = times.get(name)
      times.set(name, { eta: p.eta || known?.eta || '', ato: p.ato || known?.ato || '' })
    })
  }
  add(flight.departurePoints)
  add(flight.arrivalPoints)
  add(flight.routePoints)
  return times
}

function isNamedFix(name: string, flight: FlightPlan): boolean {
  const upper = name.toUpperCase()
  return !isMixedAlphanumeric(upper) && upper !== flight.departure && upper !== flight.arrival
}

function sidFixes(flight: FlightPlan, procedures: ProceduresData): string[] {
  const fixes = findProcedure(flight, procedures).SID?.fixes ?? []
  const known = new Set((flight.departurePoints ?? []).map((p) => p.name.toUpperCase()))
  return [...new Set(fixes.map((f) => f.toUpperCase()))].filter((f) => known.has(f) && isNamedFix(f, flight))
}

function towerStarFixes(flight: FlightPlan, procedures: ProceduresData): string[] {
  const fixes = (findProcedure(flight, procedures).STAR?.fixes ?? []).map((f) => f.toUpperCase())
  const known = new Set((flight.arrivalPoints ?? []).map((p) => p.name.toUpperCase()))
  let last = -1
  fixes.forEach((f, i) => {
    if (known.has(f) && isNamedFix(f, flight)) last = i
  })
  return last < 0 ? [] : fixes.slice(Math.max(0, last - 2), last + 1)
}

function routeFixes(flight: FlightPlan): string[] {
  return (flight.routePoints ?? []).map((p) => p.name.toUpperCase()).filter((name) => isNamedFix(name, flight))
}

function matchesField(rule: string, value: string | undefined): boolean {
  return !rule || rule === '*' || rule.toUpperCase() === (value ?? '').toUpperCase()
}

function sectorTransferIndex(flight: FlightPlan, options: FillOptions, direction: 'entry' | 'exit', from = 0): number {
  const { ownPositions, transfers } = options
  if (ownPositions.length === 0) return -1
  const isOwn = (owners: string[]) => owners.some((owner) => ownPositions.includes(owner))

  const route = (flight.routePoints ?? []).map((p) => p.name.toUpperCase())
  for (let i = from; i < route.length; i++) {
    const found = transfers.some((t) => {
      if (t.fix.toUpperCase() !== route[i]) return false
      if (!matchesField(t.previous, route[i - 1]) || !matchesField(t.next, route[i + 1])) return false
      if (!matchesField(t.departureRunway, flight.departureRwy) || !matchesField(t.arrivalRunway, flight.arrivalRwy)) return false
      const mineBefore = isOwn(t.fromOwners)
      const mineAfter = isOwn(t.toOwners)
      return direction === 'entry' ? mineAfter && !mineBefore : mineBefore && !mineAfter
    })
    if (found) return i
  }
  return -1
}

function entryPoint(flight: FlightPlan, options: FillOptions): string {
  if (options.euroscopeTransfers && flight.entryPoint) return flight.entryPoint.toUpperCase()
  const index = sectorTransferIndex(flight, options, 'entry')
  return index < 0 ? '' : (flight.routePoints ?? [])[index].name.toUpperCase()
}

function exitPoint(flight: FlightPlan, options: FillOptions): string {
  if (options.euroscopeTransfers && flight.exitPoint) return flight.exitPoint.toUpperCase()
  const route = (flight.routePoints ?? []).map((p) => p.name.toUpperCase())
  const entry = route.indexOf(entryPoint(flight, options))
  const index = sectorTransferIndex(flight, options, 'exit', entry + 1)
  if (index >= 0) return route[index]
  return options.euroscopeTransfers ? (flight.nextCopxPoint ?? '').toUpperCase() : ''
}

function resolvePoint(source: PointSource, flight: FlightPlan, options: FillOptions): string {
  switch (source.from) {
    case 'sid':
      return sidFixes(flight, options.procedures)[source.index] ?? ''
    case 'star':
      return towerStarFixes(flight, options.procedures)[source.index] ?? ''
    case 'entry':
      return entryPoint(flight, options)
    case 'exit':
      return exitPoint(flight, options)
    case 'afterEntry': {
      const route = routeFixes(flight)
      const start = route.indexOf(entryPoint(flight, options))
      const candidate = start < 0 ? '' : route[start + 1 + source.index] ?? ''
      return candidate === exitPoint(flight, options) ? '' : candidate
    }
  }
}

const LANDED = ['ARR', 'TAXIIN']
const APPROACH_CLEARED = [1, 2]

function happened(event: StripEvent, previous: FlightPlan, next: FlightPlan): boolean {
  switch (event) {
    case 'clearance':
      return !!next.clearanceReceived && !previous.clearanceReceived
    case 'taxi':
      return next.groundState === 'TAXI' && previous.groundState !== 'TAXI'
    case 'takeoff':
      return next.groundState === 'DEPA' && previous.groundState !== 'DEPA'
    case 'landing':
      return LANDED.includes(next.groundState ?? '') && !LANDED.includes(previous.groundState ?? '')
    case 'approach':
      return APPROACH_CLEARED.includes(next.clearedAltitude ?? 0) && !APPROACH_CLEARED.includes(previous.clearedAltitude ?? 0)
    case 'handoff':
      return !!next.handoffTargetControllerId && !previous.handoffTargetControllerId
    case 'assumed':
      return false
  }
}

export function startedHandoff(previous: FlightPlan | null, next: FlightPlan): boolean {
  return !!previous && happened('handoff', previous, next)
}

export function buildStripValues(
  flight: FlightPlan,
  type: string,
  mode: ControllerMode,
  previous: PreviousStrip | null,
  options: FillOptions,
): StripFill {
  const layout = layoutFor(mode, type)
  const now = options.now ?? new Date()
  const auto = new Set(previous?.autoCells ?? [])

  const kept: Record<string, string> = {}
  freeCells(layout).forEach((key) => {
    const value = previous?.values[key]
    if (value && !auto.has(key)) kept[key] = value
  })

  const filled: Record<string, string> = {}
  const autoCells: string[] = []
  const fill = (key: string | undefined, value: string | undefined) => {
    if (!key || !value || kept[key]) return
    filled[key] = value
    autoCells.push(key)
  }
  const stamp = (key: string, value: string) => {
    if (!kept[key]) kept[key] = value
  }

  const times = pointTimes(flight)
  Object.entries(layout.cells).forEach(([key, spec]) => {
    if (spec.kind !== 'point' || !spec.point) return
    const name = kept[key] || resolvePoint(spec.point, flight, options)
    fill(key, name)
    const known = times.get(name.toUpperCase())
    fill(spec.eto, known?.eta)
    if (options.autoTimes && spec.ato && known?.ato) stamp(spec.ato, known.ato)
  })

  if (options.autoTimes) {
    const stampEvent = (cells: string[] | undefined) =>
      (cells ?? []).forEach((key) => stamp(key, timeStamp(layout.cells[key], now)))
    if (options.assumed) stampEvent(layout.events.assumed)
    if (previous?.flightPlan) {
      const before = previous.flightPlan
      ;(Object.keys(layout.events) as StripEvent[]).forEach((event) => {
        if (happened(event, before, flight)) stampEvent(layout.events[event])
      })
    }
  }

  return { values: { ...dataValues(flight, type, mode), ...filled, ...kept }, autoCells, unit: unitOf(mode) }
}
