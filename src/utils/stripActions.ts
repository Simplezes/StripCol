import type { FlightPlan, StripData, StripType } from '../types'
import { usePanelStore } from '../stores/panelStore'
import { useConnectionStore } from '../stores/connectionStore'
import { useSettingsStore } from '../stores/settingsStore'
import { useAssetsStore } from '../stores/assetsStore'
import { buildInitialValues } from './stripValues'

export function panelNameToStripType(panelName: string): StripType | null {
  const n = panelName.toLowerCase()
  if (n.includes('departure')) return 'departure'
  if (n.includes('arrival')) return 'arrival'
  if (n.includes('overfly')) return 'overfly'
  return null
}

export function resolveStripType(flight: FlightPlan): StripType {
  if (flight.transfer) return 'transfer'
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
  autoMoveClearance: boolean,
): string {
  if (flight.transfer) return 'Handover'

  const aerodromeFacilities = new Set(['del', 'ground', 'tower'])
  if (
    autoMoveClearance &&
    aerodromeFacilities.has(facilityType) &&
    (flight.clearedFlag as number) == 1
  ) {
    return 'Clearance'
  }

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
  const { autoMoveClearance } = useSettingsStore.getState().settings
  const targetPanel = resolveTargetPanel(flight, type, facilityType, controllerMode, autoMoveClearance)

  const strip: StripData = {
    id,
    type,
    values: buildInitialValues(flight, type, controllerMode),
    euroscope: true,
    flightPlan: flight,
    lastUpdate: Date.now(),
  }

  usePanelStore.getState().addStrip(targetPanel, strip, type === 'transfer')
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

export function autoMoveOnC12(
  stripId: string,
  currentPanelName: string,
  c12Value: string,
): void {
  const { facilityType } = useConnectionStore.getState()
  const aerodromeFacilities = new Set(['del', 'ground', 'tower'])
  if (!aerodromeFacilities.has(facilityType)) return

  const { autoMoveClearance, autoMoveRevert } = useSettingsStore.getState().settings
  if (!autoMoveClearance) return

  const isFilled = c12Value.trim() !== ''
  const store = usePanelStore.getState()

  if (isFilled && currentPanelName === 'Pending') {
    const clearancePanel = store.panels.find((p) => p.name === 'Clearance')
    if (clearancePanel) store.moveStrip(currentPanelName, 'Clearance', stripId)
  } else if (!isFilled && autoMoveRevert && currentPanelName === 'Clearance') {
    const pendingPanel = store.panels.find((p) => p.name === 'Pending')
    if (pendingPanel) store.moveStrip(currentPanelName, 'Pending', stripId)
  }
}
