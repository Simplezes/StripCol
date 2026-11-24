import type { FlightPlan, StripData, StripType } from '../types'
import { usePanelStore } from '../stores/panelStore'
import { useConnectionStore } from '../stores/connectionStore'
import { useSettingsStore } from '../stores/settingsStore'
import { useAssetsStore } from '../stores/assetsStore'
import { useFlightStore } from '../stores/flightStore'
import { apiFetch } from './api'
import { showToast } from './toast'
import { buildInitialValues, CUSTOM_BOX_KEYS } from './stripValues'

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

export function renderAircraftAsStrip(flight: FlightPlan): void {
  if (!flight?.callsign) return
  const id = `strip-${flight.callsign}`
  if (usePanelStore.getState().getStrip(id)) return

  const type = resolveStripType(flight)
  const { controllerMode, facilityType } = useConnectionStore.getState()
  const targetPanel = resolveTargetPanel(flight, type, facilityType, controllerMode)

  const strip: StripData = {
    id,
    type,
    values: buildInitialValues(flight, type, controllerMode),
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
    showToast(`Could not assume ${callsign}`, 'warning')
    return
  }

  setTimeout(() => {
    const strip = usePanelStore.getState().getStrip(`strip-${callsign}`)
    if (strip && !strip.euroscope) showToast(`Could not assume ${callsign}`, 'warning')
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

    const custom: Record<string, string> = {}
    CUSTOM_BOX_KEYS.forEach((key) => {
      if (old.values[key]) custom[key] = old.values[key]
    })
    if (Object.keys(custom).length === 0) return

    const current = usePanelStore.getState()
    const panel = current.panels.find((p) => p.strips.some((s) => s.id === old.id))
    const rebuilt = panel?.strips.find((s) => s.id === old.id)
    if (panel && rebuilt) current.updateStrip(panel.name, old.id, { values: { ...rebuilt.values, ...custom } })
  })
}
