import { create } from 'zustand'

export type ProceduresData = Record<string, unknown>

export interface SectorEntry {
  airports: string[]
  [key: string]: unknown
}

export type SectorsData = Record<string, SectorEntry>

export interface SectorPosition {
  callsign: string
  frequency: string
  id: string
  suffix: string
}

export interface TransferPoint {
  previous: string
  departureRunway: string
  fix: string
  next: string
  arrivalRunway: string
  fromOwners: string[]
  toOwners: string[]
}

const LOCAL_PROCEDURES = './assets/procedures.json'
const LOCAL_SECTORS = './assets/sectors.json'

async function fetchProcedures(): Promise<unknown> {
  try {
    const r = await fetch(LOCAL_PROCEDURES)
    if (r.ok) return await r.json()
  } catch { }

  return null
}

async function fetchSectors(): Promise<unknown> {
  try {
    const r = await fetch(LOCAL_SECTORS)
    if (r.ok) return await r.json()
  } catch { }

  return null
}

interface AssetsState {
  procedures: ProceduresData
  sectors: SectorsData
  transfers: TransferPoint[]
  positions: SectorPosition[]
  loaded: boolean
  fromSectorFile: boolean

  load: () => Promise<void>
  applySectorData: (data: { procedures?: ProceduresData; sectors?: SectorsData; transfers?: TransferPoint[]; positions?: SectorPosition[] }) => void

  checkSector: (positionId: string, airportCode: string) => boolean
}

export const useAssetsStore = create<AssetsState>((set, get) => ({
  procedures: {},
  sectors: {},
  transfers: [],
  positions: [],
  loaded: false,
  fromSectorFile: false,

  load: async () => {
    try {
      const [procedures, sectors] = await Promise.all([
        fetchProcedures(),
        fetchSectors(),
      ])
      console.log('Assets: Procedures & Sectors loaded.')
      if (get().fromSectorFile) {
        set({ loaded: true })
        return
      }
      set({
        procedures: (procedures as ProceduresData) ?? {},
        sectors: (sectors as SectorsData) ?? {},
        loaded: true,
      })
    } catch (e) {
      console.error('Error loading assets', e)
    }
  },

  applySectorData: (data) => {
    const hasProcedures = data.procedures && Object.keys(data.procedures).length > 0
    set((state) => ({
      procedures: hasProcedures ? (data.procedures as ProceduresData) : state.procedures,
      sectors: data.sectors ?? state.sectors,
      transfers: Array.isArray(data.transfers) ? data.transfers : state.transfers,
      positions: Array.isArray(data.positions) ? data.positions : state.positions,
      fromSectorFile: hasProcedures || state.fromSectorFile,
    }))
  },

  checkSector: (positionId, airportCode) => {
    const { sectors } = get()
    const airport = airportCode.toUpperCase()

    if (sectors[positionId]?.airports.includes(airport)) return true

    if (positionId.includes(':')) {
      for (const part of positionId.split(':')) {
        if (sectors[part]?.airports.includes(airport)) return true
      }
    }

    return false
  },
}))
