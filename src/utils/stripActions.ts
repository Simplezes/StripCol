import type { ControllerMode, FlightPlan, StripData, StripType } from '../types'
import { usePanelStore } from '../stores/panelStore'
import { modeOfBoard, useConnectionStore } from '../stores/connectionStore'
import { useSettingsStore } from '../stores/settingsStore'
import { useAssetsStore } from '../stores/assetsStore'
import { useFlightStore } from '../stores/flightStore'
import { apiFetch } from './api'
import { showToast } from './toast'
import { buildStripValues, type FillOptions, type StripFill } from './stripFill'
import { freeCells, layoutFor, unitOf, type Unit } from './stripLayout'

export function panelNameToStripType(panelName: string): StripType | null {
  const n = panelName.toLowerCase()
  if (n.includes('departure')) return 'departure'
  if (n.includes('arrival')) return 'arrival'
  if (n.includes('overfly')) return 'overfly'
  return null
}

export function resolveStripType(flight: FlightPlan): StripType {
  return flight.transfer ? 'transfer' : resolveTrafficType(flight)
}

function resolveTrafficType(flight: FlightPlan): StripType {
  const { controllerMode, positionId, localIcao } = useConnectionStore.getState()
  const dep = (flight.departure ?? '').toUpperCase()
  const arr = (flight.arrival ?? '').toUpperCase()
  const local = localIcao.toUpperCase()

  if (controllerMode === 'aerodrome') {
    if (dep === local) return 'departure'
    if (arr === local) return 'arrival'
    return 'overfly'
  }

  const { checkSector } = useAssetsStore.getState()
  if (checkSector(positionId, dep)) return 'departure'
  if (checkSector(positionId, arr)) return 'arrival'
  return 'overfly'
}

export function resolveTargetPanel(
  flight: FlightPlan,
  type: StripType,
  facilityType: string,
  controllerMode: string,
): string {
  if (type === 'transfer') type = resolveTrafficType(flight)

  if (controllerMode === 'approach' || controllerMode === 'center') {
    if (type === 'departure') return 'Departures'
    if (type === 'arrival') return 'Arrivals'
    return 'Overfly'
  }

  if (facilityType === 'ground') return type === 'arrival' ? 'Ground Movement' : 'Pending'
  if (facilityType === 'tower') return type === 'arrival' ? 'Sequence' : 'Pending'
  return 'Pending'
}

const SUFFIX_MODES: Record<string, ControllerMode> = {
  DEL: 'aerodrome',
  GND: 'aerodrome',
  TWR: 'aerodrome',
  APP: 'approach',
  DEP: 'approach',
  CTR: 'center',
  FSS: 'center',
}

function modeOfSuffix(suffix: string): ControllerMode {
  return SUFFIX_MODES[suffix.toUpperCase()] ?? ''
}

export function stripFillOptions(assumed = false): FillOptions {
  const { procedures, transfers, positions } = useAssetsStore.getState()
  const { controllerMode, detectedFacility, positionId } = useConnectionStore.getState()
  const boardUnit = unitOf(controllerMode)
  const ownBoard = unitOf(modeOfBoard(detectedFacility)) === boardUnit && !!positionId
  const unitPositions = positions
    .filter((position) => {
      const mode = modeOfSuffix(position.suffix)
      return mode !== '' && unitOf(mode) === boardUnit
    })
    .map((position) => position.id)
  return {
    procedures,
    transfers,
    ownPositions: ownBoard ? [positionId] : unitPositions,
    euroscopeTransfers: ownBoard,
    autoTimes: useSettingsStore.getState().settings.autoFillTimes,
    assumed,
  }
}

function ownValues(strip: StripData, unit: Unit): Record<string, string> {
  const own: Record<string, string> = {}
  freeCells(layoutFor(unit, strip.type)).forEach((key) => {
    if (strip.values[key] && !strip.autoCells?.includes(key)) own[key] = strip.values[key]
  })
  return own
}

function switchUnit(old: StripData, rebuilt: StripData, mode: ControllerMode): Partial<StripData> {
  const unit = unitOf(mode)
  const saved = { ...old.unitValues, [old.unit ?? unit]: ownValues(old, old.unit ?? unit) }
  const restored = saved[unit] ?? {}
  delete saved[unit]
  const fill = buildStripValues(rebuilt.flightPlan!, rebuilt.type, mode, { values: restored, autoCells: [], flightPlan: null }, stripFillOptions())
  return { ...fill, unitValues: saved }
}

export function freshStripValues(flight: FlightPlan, type: string): StripFill {
  return buildStripValues(flight, type, useConnectionStore.getState().controllerMode, null, stripFillOptions())
}

export function renderAircraftAsStrip(flight: FlightPlan, assumed = false): void {
  if (!flight?.callsign) return
  const id = `strip-${flight.callsign}`
  if (usePanelStore.getState().getStrip(id)) return

  const type = resolveStripType(flight)
  const { controllerMode, facilityType } = useConnectionStore.getState()
  const targetPanel = resolveTargetPanel(flight, type, facilityType, controllerMode)

  const strip: StripData = {
    id,
    type,
    ...buildStripValues(flight, type, controllerMode, null, stripFillOptions(assumed)),
    euroscope: true,
    flightPlan: flight,
    lastUpdate: Date.now(),
  }

  usePanelStore.getState().addStrip(targetPanel, strip, type === 'transfer')
  autoMoveOnClearance(id, targetPanel, !!flight.clearanceReceived)
}

export function deleteStripByCallsign(callsign: string): void {
  const store = usePanelStore.getState()
  const id = `strip-${callsign}`
  store.panels.forEach((p) => {
    if (p.strips.some((s) => s.id === id || (s.flightPlan?.callsign === callsign))) {
      const matchId = p.strips.find(
        (s) => s.id === id || s.flightPlan?.callsign === callsign,
      )?.id
      if (matchId) store.removeStrip(p.name, matchId)
    }
  })
}

interface ControllerEntry {
  callsign: string
  positionId: string
  frequency: string
}

async function findController(positionId: string): Promise<ControllerEntry | undefined> {
  if (!positionId) return undefined
  const { linkCode } = useSettingsStore.getState().settings
  try {
    const res = await apiFetch(`/api/ATC-list?code=${linkCode}`)
    const controllers: ControllerEntry[] = await res.json()
    return controllers.find((c) => c.positionId === positionId)
  } catch {
    return undefined
  }
}

export async function resolveControllerCallsign(positionId: string): Promise<string> {
  if (!positionId) return ''
  return (await findController(positionId))?.callsign ?? positionId
}

export async function fillTransferFrequency(stripId: string, positionId: string, cell: string): Promise<void> {
  const controller = await findController(positionId)
  const frequency = Number(controller?.frequency)
  if (!Number.isFinite(frequency) || frequency <= 0) return

  const store = usePanelStore.getState()
  const panel = store.panels.find((p) => p.strips.some((s) => s.id === stripId))
  const strip = panel?.strips.find((s) => s.id === stripId)
  if (!panel || !strip || strip.values[cell]) return
  store.updateStrip(panel.name, stripId, { values: { ...strip.values, [cell]: frequency.toFixed(3) } })
}

export async function acceptHandoff(flight: FlightPlan): Promise<boolean> {
  const { linkCode } = useSettingsStore.getState().settings
  try {
    const res = await apiFetch('/api/accept-handoff', {
      method: 'POST',
      body: JSON.stringify({ code: linkCode, callsign: flight.callsign }),
    })
    if (!res.ok) return false
  } catch (err) {
    console.error('Accept handoff failed:', err)
    return false
  }

  deleteStripByCallsign(flight.callsign)
  const accepted = { ...flight, transfer: false }
  useFlightStore.getState().addAircraft(flight.callsign, accepted)
  renderAircraftAsStrip(accepted)
  return true
}

const ASSUME_CONFIRM_MS = 5000

export async function assumeAircraft(callsign: string): Promise<void> {
  const { linkCode } = useSettingsStore.getState().settings
  try {
    const res = await apiFetch('/api/assume-aircraft', {
      method: 'POST',
      body: JSON.stringify({ code: linkCode, callsign }),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
  } catch (err) {
    console.error('Assume aircraft failed:', err)
    showToast(`Could not assume ${callsign}`, 'assume-failed')
    return
  }

  setTimeout(() => {
    const strip = usePanelStore.getState().getStrip(`strip-${callsign}`)
    if (strip && !strip.euroscope) showToast(`Could not assume ${callsign}`, 'assume-failed')
  }, ASSUME_CONFIRM_MS)
}

export async function toggleClearance(flight: FlightPlan): Promise<void> {
  const { linkCode } = useSettingsStore.getState().settings
  if (!linkCode) return

  try {
    await apiFetch('/api/set-clearance', {
      method: 'POST',
      body: JSON.stringify({ code: linkCode, callsign: flight.callsign, cleared: !flight.clearanceReceived }),
    })
  } catch (err) {
    console.error('Set clearance failed:', err)
  }
}

export function autoMoveOnClearance(
  stripId: string,
  currentPanelName: string,
  clearanceReceived: boolean,
): void {
  const { facilityType } = useConnectionStore.getState()
  const aerodromeFacilities = new Set(['del', 'ground', 'tower'])
  if (!aerodromeFacilities.has(facilityType)) return

  const { autoMoveClearance, autoMoveRevert } = useSettingsStore.getState().settings
  if (!autoMoveClearance) return

  const store = usePanelStore.getState()

  if (clearanceReceived && currentPanelName === 'Pending') {
    const clearancePanel = store.panels.find((p) => p.name === 'Clearance')
    if (clearancePanel) store.moveStrip(currentPanelName, 'Clearance', stripId)
  } else if (!clearanceReceived && autoMoveRevert && currentPanelName === 'Clearance') {
    const pendingPanel = store.panels.find((p) => p.name === 'Pending')
    if (pendingPanel) store.moveStrip(currentPanelName, 'Pending', stripId)
  }
}

export function applyClearanceAutoMoveToBoard(): void {
  usePanelStore.getState().panels.forEach((panel) => {
    panel.strips.forEach((strip) => {
      if (strip.flightPlan) autoMoveOnClearance(strip.id, panel.name, !!strip.flightPlan.clearanceReceived)
    })
  })
}

export function rebuildBoard(panelNames: string[]): void {
  const store = usePanelStore.getState()
  const previous = store.panels.flatMap((p) => p.strips)

  store.clearAllStrips()
  store.resetToLayout(panelNames)

  const { aircraftMap } = useFlightStore.getState()

  previous.forEach((old) => {
    const callsign = old.flightPlan?.callsign
    if (!old.euroscope || !callsign) {
      usePanelStore.getState().addStrip(panelNames[0], old)
      return
    }

    renderAircraftAsStrip(aircraftMap[callsign] ?? old.flightPlan!)

    const current = usePanelStore.getState()
    const panel = current.panels.find((p) => p.strips.some((s) => s.id === old.id))
    const rebuilt = panel?.strips.find((s) => s.id === old.id)
    if (panel && rebuilt?.flightPlan) {
      current.updateStrip(panel.name, old.id, switchUnit(old, rebuilt, useConnectionStore.getState().controllerMode))
    }
  })
}
