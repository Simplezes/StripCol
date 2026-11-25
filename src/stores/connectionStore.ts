import { create } from 'zustand'
import type { ControllerMode, FacilityType, ControllerData } from '../types'

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

const BOARD_KEY = 'boardOverride'
const BOARD_TYPES: FacilityType[] = ['del', 'ground', 'tower', 'approach', 'center']

const MODE_OF_BOARD: Record<FacilityType, ControllerMode> = {
  del: 'aerodrome',
  ground: 'aerodrome',
  tower: 'aerodrome',
  approach: 'approach',
  center: 'center',
}

export function modeOfBoard(board: FacilityType): ControllerMode {
  return MODE_OF_BOARD[board]
}

function loadBoardOverride(): FacilityType | null {
  try {
    const saved = localStorage.getItem(BOARD_KEY) as FacilityType | null
    return saved && BOARD_TYPES.includes(saved) ? saved : null
  } catch {
    return null
  }
}

function saveBoardOverride(board: FacilityType | null): void {
  try {
    if (board) localStorage.setItem(BOARD_KEY, board)
    else localStorage.removeItem(BOARD_KEY)
  } catch {
    return
  }
}

const AIRPORTS_KEY = 'extraAirports'

function loadExtraAirports(): string[] {
  try {
    const saved = JSON.parse(localStorage.getItem(AIRPORTS_KEY) ?? '[]')
    return Array.isArray(saved) ? saved.filter((v) => typeof v === 'string') : []
  } catch {
    return []
  }
}

function saveExtraAirports(airports: string[]): void {
  try {
    localStorage.setItem(AIRPORTS_KEY, JSON.stringify(airports))
  } catch {
    return
  }
}

let _reconnectFn: (() => void) | null = null

export function registerReconnect(fn: () => void): void {
  _reconnectFn = fn
}

export function triggerReconnect(): void {
  _reconnectFn?.()
}

interface ConnectionState {
  isConnected: boolean
  isPaired: boolean
  isPluginLinked: boolean
  isSyncing: boolean
  detectedFacility: FacilityType
  boardOverride: FacilityType | null
  controllerMode: ControllerMode
  facilityType: FacilityType
  positionId: string
  localIcao: string
  controllerCallsign: string
  metars: Record<string, string>
  extraAirports: string[]

  setSyncing: (value: boolean) => void
  setBoardOverride: (board: FacilityType | null) => void
  setConnected: (value: boolean) => void
  setPaired: (value: boolean) => void
  setPluginLinked: (value: boolean) => void
  setControllerInfo: (data: ControllerData) => void
  setMetar: (station: string, metar: string) => void
  addAirport: (icao: string) => void
  clearExtraAirports: () => void
  resetConnection: () => void
}

function boardState(
  override: FacilityType | null,
  detected: FacilityType,
): { facilityType: FacilityType; controllerMode: ControllerMode } {
  const board = override ?? detected
  return { facilityType: board, controllerMode: MODE_OF_BOARD[board] }
}

const DEFAULT_STATE = {
  isConnected: false,
  isPaired: false,
  isPluginLinked: false,
  isSyncing: false,
  detectedFacility: 'tower' as FacilityType,
  boardOverride: null as FacilityType | null,
  controllerMode: 'aerodrome' as ControllerMode,
  facilityType: 'tower' as FacilityType,
  positionId: '',
  localIcao: '',
  controllerCallsign: '',
  metars: {} as Record<string, string>,
  extraAirports: [] as string[],
}

export const useConnectionStore = create<ConnectionState>((set, get) => ({
  ...DEFAULT_STATE,
  extraAirports: loadExtraAirports(),
  boardOverride: loadBoardOverride(),
  ...boardState(loadBoardOverride(), DEFAULT_STATE.detectedFacility),

  setBoardOverride: (board) => {
    saveBoardOverride(board)
    const detected = get().detectedFacility
    set({ boardOverride: board, ...boardState(board, detected) })
  },

  setSyncing: (value) => set({ isSyncing: value }),

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

    set({
      detectedFacility: info.facilityType,
      ...boardState(get().boardOverride, info.facilityType),
      positionId,
      localIcao,
      controllerCallsign: callsign,
    })
  },

  setMetar: (station, metar) => set((s) => ({ metars: { ...s.metars, [station]: metar } })),

  addAirport: (icao) => {
    const extra = [...new Set([...get().extraAirports, icao])]
    saveExtraAirports(extra)
    set({ extraAirports: extra })
  },

  clearExtraAirports: () => {
    saveExtraAirports([])
    set({ extraAirports: [] })
  },

  resetConnection: () => {
    const override = get().boardOverride
    set({ ...DEFAULT_STATE, extraAirports: get().extraAirports, boardOverride: override, ...boardState(override, DEFAULT_STATE.detectedFacility) })
  },
}))
