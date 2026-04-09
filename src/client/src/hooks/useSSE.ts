import { useEffect, useRef } from 'react'
import { useSettingsStore } from '../stores/settingsStore'
import { useConnectionStore, registerReconnect } from '../stores/connectionStore'
import { useFlightStore } from '../stores/flightStore'
import { usePanelStore, isFieldClearPending } from '../stores/panelStore'
import { useAssetsStore } from '../stores/assetsStore'
import { apiFetch, getGatewayUrl } from '../utils/api'
import { CUSTOM_BOX_KEYS } from '../utils/stripValues'
import {
  renderAircraftAsStrip,
  deleteStripByCallsign,
} from '../utils/stripActions'
import { buildInitialValues } from '../utils/stripValues'
import { playNotificationSound } from '../utils/sound'
import type { FlightPlan } from '../types'

const INITIAL_RETRY_DELAY = 1000
const MAX_RETRY_DELAY = 10_000
const HUB_POLL_INTERVAL = 1000

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
    }

    function moveStripToHandover(callsign: string) {
      const id = `strip-${callsign}`
      const panels = usePanelStore.getState().panels
      let sourcePanelName: string | undefined

      panels.forEach((p) => {
        if (p.name !== 'Handover' && p.strips.some((s) => s.id === id)) {
          sourcePanelName = p.name
        }
      })

      if (sourcePanelName) {
        usePanelStore.getState().moveStrip(sourcePanelName, 'Handover', id)
        usePanelStore.getState().updateStrip('Handover', id, { euroscope: false })
      }
    }

    function updateStripByCallsign(flight: FlightPlan) {
      const id = `strip-${flight.callsign}`
      const { controllerMode } = useConnectionStore.getState()

      usePanelStore.getState().panels.forEach((p) => {
        const strip = p.strips.find((s) => s.id === id)
        if (!strip) return

        const newVals = buildInitialValues(flight, strip.type, controllerMode)

        const preserved: Record<string, string> = {}
        CUSTOM_BOX_KEYS.forEach((k) => {
          if (strip.values[k]) preserved[k] = strip.values[k]
        })

        ;(['c12'] as const).forEach((k) => {
          if (isFieldClearPending(id, k)) delete newVals[k]
        })

        usePanelStore.getState().updateStrip(p.name, id, {
          flightPlan: flight,
          values: { ...newVals, ...preserved },
        })
      })
    }

    function updateStripSquawk(callsign: string, squawkCode: string) {
      const id = `strip-${callsign}`
      usePanelStore.getState().panels.forEach((p) => {
        const strip = p.strips.find((s) => s.id === id)
        if (strip) {
          const updatedFp = strip.flightPlan
            ? { ...strip.flightPlan, squawk: squawkCode }
            : strip.flightPlan
          usePanelStore.getState().updateStrip(p.name, id, {
            ...(updatedFp ? { flightPlan: updatedFp } : {}),
            values: { ...strip.values, c6: 'A' + squawkCode },
          })
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
      try {
        const r = await apiFetch(`/api/assumed?code=${code}`)
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

          src.addEventListener('aircraft', (e) => {
            const flight: FlightPlan = JSON.parse((e as MessageEvent).data)
            flight.transfer = false
            if (useFlightStore.getState().aircraftMap[flight.callsign]) {
              deleteStripByCallsign(flight.callsign)
            }
            useFlightStore.getState().addAircraft(flight.callsign, flight)
            renderAircraftAsStrip(flight)
            if (
              useSettingsStore.getState().settings.audioEnabled &&
              Date.now() - connectedAt > 3000
            ) {
              playNotificationSound()
            }
          })

          src.addEventListener('release', (e) => {
            const { callsign } = JSON.parse((e as MessageEvent).data)
            useFlightStore.getState().removeAircraft(callsign)
            moveStripToHandover(callsign)
          })

          src.addEventListener('transfer', (e) => {
            const flight: FlightPlan = JSON.parse((e as MessageEvent).data)
            flight.transfer = true
            useFlightStore.getState().addAircraft(flight.callsign, flight)
            renderAircraftAsStrip(flight)
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
            }
          })

          src.addEventListener('nearby-aircraft', (e) => {
            const callsigns: string[] = JSON.parse((e as MessageEvent).data)
            useFlightStore.getState().setNearbyCallsigns(callsigns)
          })

          src.addEventListener('squawk-assigned', (e) => {
            const { callsign, code: sq } = JSON.parse((e as MessageEvent).data)
            if (!callsign || !sq) return
            useFlightStore.getState().updateAircraft(callsign, { squawk: sq })
            updateStripSquawk(callsign, sq)
          })

          src.onopen = () => {
            console.log('Gateway Link: Established')
            useConnectionStore.getState().setConnected(true)
            useConnectionStore.getState().setPaired(true)
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
            useFlightStore.getState().clearAll()
            usePanelStore.getState().clearAllStrips()
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

    return () => {
      stopPolling()
      closeSource()
      clearReconnectTimer()
    }
  }, [serverIp])
}
