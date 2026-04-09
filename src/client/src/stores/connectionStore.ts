import { create } from 'zustand'
import type { ControllerMode, FacilityType, ControllerData } from '../types'

// ─── Facility map (mirrors websocket.js) ─────────────────────────────────────

interface FacilityInfo {
  mode: ControllerMode
  name: string
  facilityType: FacilityType
}

const FACILITY_MAP: Record<number, FacilityInfo> = {
  1: { mode: 'aerodrome', name: 'Flight Service Station',  facilityType: 'tower'   },
  2: { mode: 'aerodrome', name: 'Clearance Delivery',     facilityType: 'del'     },
  3: { mode: 'aerodrome', name: 'Ground',                 facilityType: 'ground'  },
  4: { mode: 'aerodrome', name: 'Tower',                  facilityType: 'tower'   },
  5: { mode: 'approach',  name: 'Approach / Departure',  facilityType: 'approach'},
  6: { mode: 'center',    name: 'Area Control Center',   facilityType: 'center'  },
}

// ─── Reconnect registry (module-level, not Zustand state) ────────────────────

let _reconnectFn: (() => void) | null = null

export function registerReconnect(fn: () => void): void {
  _reconnectFn = fn
}

export function triggerReconnect(): void {
  _reconnectFn?.()
}

// ─── Store ────────────────────────────────────────────────────────────────────

interface ConnectionState {
  isConnected: boolean
  isPaired: boolean
  isPluginLinked: boolean
  controllerMode: ControllerMode
  facilityType: FacilityType
  positionId: string
  localIcao: string
  controllerCallsign: string

  setConnected: (value: boolean) => void
  setPaired: (value: boolean) => void
  setPluginLinked: (value: boolean) => void
  setControllerInfo: (data: ControllerData) => void
  resetConnection: () => void
}

const DEFAULT_STATE = {
  isConnected: false,
  isPaired: false,
  isPluginLinked: false,
  controllerMode: 'aerodrome' as ControllerMode,
  facilityType: 'tower' as FacilityType,
  positionId: '',
  localIcao: '',
  controllerCallsign: '',
}

export const useConnectionStore = create<ConnectionState>((set) => ({
  ...DEFAULT_STATE,

  setConnected: (value) => set({ isConnected: value }),

  setPaired: (value) => set({ isPaired: value }),

  setPluginLinked: (value) => set({ isPluginLinked: value }),

  setControllerInfo: (data) => {
    const facilityNum =
      typeof data.facility === 'number'
        ? data.facility
        : parseInt(String(data.facility), 10)

    const info = FACILITY_MAP[facilityNum] ?? {
      mode: 'aerodrome' as ControllerMode,
      name: 'Tower',
      facilityType: 'tower' as FacilityType,
    }

    const callsign = typeof data.callsign === 'string' ? data.callsign : ''
    const icaoMatch = callsign.match(/^([A-Z]{4})/)
    const localIcao = icaoMatch ? icaoMatch[1] : ''
    const positionId = typeof data.positionId === 'string' ? data.positionId : ''

    console.log(data)

    set({
      controllerMode: info.mode,
      facilityType: info.facilityType,
      positionId,
      localIcao,
      controllerCallsign: callsign,
    })
  },

  resetConnection: () => set({ ...DEFAULT_STATE }),
}))
