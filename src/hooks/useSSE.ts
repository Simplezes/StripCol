import { useEffect, useRef } from 'react'
import { useSettingsStore } from '../stores/settingsStore'
import { useConnectionStore, registerReconnect } from '../stores/connectionStore'
import { useFlightStore } from '../stores/flightStore'
import { usePanelStore, isFieldClearPending } from '../stores/panelStore'
import { useAssetsStore } from '../stores/assetsStore'
import { apiFetch, getGatewayUrl } from '../utils/api'
import {
  renderAircraftAsStrip,
  deleteStripByCallsign,
  autoMoveOnClearance,
  acceptHandoff,
  fillTransferFrequency,
  resolveControllerCallsign,
  stripFillOptions,
} from '../utils/stripActions'
import { buildStripValues, startedHandoff } from '../utils/stripFill'
import { layoutFor } from '../utils/stripLayout'
import { playNotificationSound, type NotificationSound } from '../utils/sound'
import { showToast, type ToastKind } from '../utils/toast'
import type { FlightPlan } from '../types'
import { HANDED_OFF_PANEL } from '../components/Layout/panelDefs'

const INITIAL_RETRY_DELAY = 1000
const MAX_RETRY_DELAY = 10_000
const HUB_POLL_INTERVAL = 5000
const CONNECT_GRACE_MS = 3000

export function useSSE(): void {
  const reconnectRef = useRef<() => void>(() => {})

  const serverIp = useSettingsStore((s) => s.settings.serverIp)

  useEffect(() => {
    let evtSource: EventSource | null = null
    let pollingInterval: ReturnType<typeof setInterval> | null = null
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null
    let retryDelay = INITIAL_RETRY_DELAY
    let isConnecting = false
    let lastFetchTime = 0
    let currentSessionCode: string | null = null
    let connectedAt = 0
    const lastSoundByCallsign = new Map<string, NotificationSound>()

    function closeSource() {
      evtSource?.close()
      evtSource = null
    }

    function clearReconnectTimer() {
      if (reconnectTimer !== null) {
        clearTimeout(reconnectTimer)
        reconnectTimer = null
      }
    }

    function scheduleReconnect() {
      clearReconnectTimer()
      reconnectTimer = setTimeout(() => {
        retryDelay = Math.min(retryDelay * 1.5, MAX_RETRY_DELAY)
        startSSE()
      }, retryDelay)
    }

    function resetSession() {
      console.log('Resetting session state for new Link Code')
      useFlightStore.getState().clearAll()
      useConnectionStore.getState().setPaired(false)
      usePanelStore.getState().clearAllStrips()
      lastSoundByCallsign.clear()
    }

    function isLiveEvent() {
      return Date.now() - connectedAt > CONNECT_GRACE_MS
    }

    function notify(kind: NotificationSound, callsign: string) {
      if (kind !== 'cleared') {
        if (lastSoundByCallsign.get(callsign) === kind) return
        lastSoundByCallsign.set(callsign, kind)
      }
      const { audioEnabled, mutedSounds } = useSettingsStore.getState().settings
      if (!audioEnabled || mutedSounds.includes(kind) || !isLiveEvent()) return
      playNotificationSound(kind)
    }

    function notifyToast(message: string, kind: ToastKind) {
      if (useSettingsStore.getState().settings.toastsEnabled) showToast(message, kind)
    }

    function moveStripToHandedOff(callsign: string) {
      const id = `strip-${callsign}`
      const panels = usePanelStore.getState().panels
      let sourcePanelName: string | undefined

      panels.forEach((p) => {
        if (p.name !== HANDED_OFF_PANEL && p.strips.some((s) => s.id === id)) {
          sourcePanelName = p.name
        }
      })

      if (sourcePanelName) {
        usePanelStore.getState().moveStrip(sourcePanelName, HANDED_OFF_PANEL, id)
        usePanelStore.getState().updateStrip(HANDED_OFF_PANEL, id, { euroscope: false })
      }
    }

    function updateStripByCallsign(flight: FlightPlan) {
      const id = `strip-${flight.callsign}`
      const { controllerMode } = useConnectionStore.getState()

      usePanelStore.getState().panels.forEach((p) => {
        const strip = p.strips.find((s) => s.id === id)
        if (!strip) return

        const fill = buildStripValues(flight, strip.type, controllerMode, strip, stripFillOptions())
        if (isFieldClearPending(id, 'c12')) delete fill.values.c12

        usePanelStore.getState().updateStrip(p.name, id, { flightPlan: flight, ...fill })

        const frequencyCell = layoutFor(controllerMode, strip.type).frequency
        if (frequencyCell && useSettingsStore.getState().settings.autoFillTimes && startedHandoff(strip.flightPlan, flight)) {
          fillTransferFrequency(id, flight.handoffTargetControllerId ?? '', frequencyCell)
        }

        if (!!strip.flightPlan?.clearanceReceived !== !!flight.clearanceReceived) {
          autoMoveOnClearance(id, p.name, !!flight.clearanceReceived)
          if (flight.clearanceReceived) notify('cleared', flight.callsign)
        }
      })
    }

    async function checkHubStatus() {
      try {
        const r = await apiFetch('/api')
        useConnectionStore.getState().setConnected(r.ok)
        if (!r.ok) useConnectionStore.getState().setPaired(false)
      } catch {
        useConnectionStore.getState().setConnected(false)
        useConnectionStore.getState().setPaired(false)
      }
    }

    function startPolling() {
      if (pollingInterval) return
      checkHubStatus()
      pollingInterval = setInterval(() => {
        if (!isConnecting) checkHubStatus()
      }, HUB_POLL_INTERVAL)
    }

    function stopPolling() {
      if (pollingInterval) {
        clearInterval(pollingInterval)
        pollingInterval = null
      }
    }

    async function fetchAndSync() {
      const code = useSettingsStore.getState().settings.linkCode
      useConnectionStore.getState().setSyncing(true)
      try {
        const r = await apiFetch(`/api/assumed?code=${code}`)
        if (!r.ok) return
        const aircraft: FlightPlan[] = await r.json()
        aircraft.forEach((a) => {
          if (a.transfer) return
          useFlightStore.getState().addAircraft(a.callsign, a)
          const id = `strip-${a.callsign}`
          if (usePanelStore.getState().getStrip(id)) {
            updateStripByCallsign(a)
          } else {
            renderAircraftAsStrip(a)
          }
        })
      } catch (err) {
        console.error('Error fetching aircraft list:', err)
      } finally {
        useConnectionStore.getState().setSyncing(false)
      }
    }

    function startSSE() {
      if (isConnecting) return
      isConnecting = true
      closeSource()
      clearReconnectTimer()

      const code = useSettingsStore.getState().settings.linkCode
      if (!code) {
        isConnecting = false
        return
      }

      const gateway = getGatewayUrl()

      apiFetch('/api')
        .then((r) => {
          if (!r.ok) throw new Error('Hub offline')

          if (code !== currentSessionCode) {
            resetSession()
            currentSessionCode = code
          }

          const src = new EventSource(`${gateway}/api/events?code=${code}`)
          evtSource = src

          src.addEventListener('gateway_status', (e) => {
            const payload = JSON.parse((e as MessageEvent).data)
            const conn = useConnectionStore.getState()
            if (payload.status === 'plugin_connected') {
              conn.setPluginLinked(true)
              conn.setPaired(true)
              if (payload.controller) conn.setControllerInfo(payload.controller)
            } else {
              conn.setPluginLinked(false)
              conn.setPaired(false)
              useFlightStore.getState().clearAll()
              usePanelStore.getState().clearAllStrips()
            }
          })

          src.addEventListener('metar', (e) => {
            const { station, metar } = JSON.parse((e as MessageEvent).data)
            useConnectionStore.getState().setMetar(station, metar)
          })

          src.addEventListener('aircraft', (e) => {
            const flight: FlightPlan = JSON.parse((e as MessageEvent).data)
            flight.transfer = false
            const id = `strip-${flight.callsign}`
            const releasedIn = usePanelStore
              .getState()
              .panels.find((p) => p.strips.some((s) => s.id === id && !s.euroscope))?.name
            const wasTracked = !!useFlightStore.getState().aircraftMap[flight.callsign]
            useFlightStore.getState().addAircraft(flight.callsign, flight)

            if (releasedIn && releasedIn !== HANDED_OFF_PANEL) {
              usePanelStore.getState().updateStrip(releasedIn, id, { euroscope: true })
              updateStripByCallsign(flight)
            } else {
              if (releasedIn || wasTracked) {
                deleteStripByCallsign(flight.callsign)
              }
              renderAircraftAsStrip(flight, isLiveEvent())
            }
            notify('assumed', flight.callsign)
          })

          src.addEventListener('sector-data', (e) => {
            useAssetsStore.getState().applySectorData(JSON.parse(e.data))
          })

          src.addEventListener('release', (e) => {
            const { callsign } = JSON.parse((e as MessageEvent).data)
            useFlightStore.getState().removeAircraft(callsign)
            moveStripToHandedOff(callsign)
            notify('released', callsign)
          })

          src.addEventListener('transfer', async (e) => {
            const flight: FlightPlan = JSON.parse((e as MessageEvent).data)
            flight.transfer = true
            const live = isLiveEvent()
            flight.transferFrom = await resolveControllerCallsign(flight.trackingControllerId ?? '')
            const from = flight.transferFrom ? ` from ${flight.transferFrom}` : ''

            const offerHandover = () => {
              useFlightStore.getState().addAircraft(flight.callsign, flight)
              renderAircraftAsStrip(flight)
              if (!live) return
              notify('handover', flight.callsign)
              notifyToast(`Handover offered${from}: ${flight.callsign}`, 'handover-offered')
            }

            if (!useSettingsStore.getState().settings.autoAcceptTransfers) {
              offerHandover()
              return
            }

            const accepted = await acceptHandoff(flight)
            if (!accepted) offerHandover()
            else if (live) notifyToast(`Handover accepted${from}: ${flight.callsign}`, 'handover-accepted')
          })

          src.addEventListener('fpupdate', (e) => {
            const flight: FlightPlan = JSON.parse((e as MessageEvent).data)
            const alreadyTracked = !!useFlightStore.getState().aircraftMap[flight.callsign]
            if (alreadyTracked) {
              useFlightStore.getState().updateAircraft(flight.callsign, flight)
              updateStripByCallsign(flight)
            } else {
              flight.transfer = false
              useFlightStore.getState().addAircraft(flight.callsign, flight)
              renderAircraftAsStrip(flight)
              notify('flightplan', flight.callsign)
            }
          })

          src.addEventListener('nearby-aircraft', (e) => {
            const callsigns: string[] = JSON.parse((e as MessageEvent).data)
            useFlightStore.getState().setNearbyCallsigns(callsigns)
          })

          src.onopen = () => {
            console.log('Gateway Link: Established')
            useConnectionStore.getState().setConnected(true)
            isConnecting = false
            retryDelay = INITIAL_RETRY_DELAY
            connectedAt = Date.now()
            const now = Date.now()
            if (now - lastFetchTime > 10_000) {
              lastFetchTime = now
              fetchAndSync()
            }
          }

          src.onerror = () => {
            console.warn(`Gateway Link Error. Retrying in ${retryDelay / 1000}s...`)
            isConnecting = false
            useConnectionStore.getState().setPluginLinked(false)
            useConnectionStore.getState().setPaired(false)
            closeSource()

            scheduleReconnect()
          }
        })
        .catch(() => {
          console.warn('Hub unreachable. Retrying...')
          useConnectionStore.getState().setConnected(false)
          isConnecting = false
          scheduleReconnect()
        })
    }

    useAssetsStore.getState().load()
    startPolling()

    reconnectRef.current = () => {
      retryDelay = INITIAL_RETRY_DELAY
      startSSE()
    }
    registerReconnect(reconnectRef.current)
    startSSE()

    return () => {
      stopPolling()
      closeSource()
      clearReconnectTimer()
    }
  }, [serverIp])
}
