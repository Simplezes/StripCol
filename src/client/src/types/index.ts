export type StripType = 'departure' | 'arrival' | 'overfly' | 'transfer'

export interface FlightPlan {
  callsign: string
  departure: string
  arrival: string
  aircraftType?: string
  route?: string
  altitude?: string
  squawk?: string
  speed?: string
  remarks?: string
  clearedFlag?: number
  transfer?: boolean
  positionId?: string
  sid?: string
  star?: string
  groundSpeed?: number
  atd?: number | string
  finalAltitude?: number
  clearedAltitude?: number
  departureRwy?: string
  arrivalRwy?: string
  estimatedArrival?: string
  assignedSpeed?: number
  assignedMach?: number
  assignedHeading?: number
  directTo?: string
  nextCopxPoint?: string
  departurePoints?: Array<{ name: string; eta?: string }>
  arrivalPoints?: Array<{ name: string; eta?: string }>
  aircraftInfo?: string
  alternate?: string
  assignedCommunicationType?: string
  assignedFinalAltitude?: number
  assignedRate?: number
  capabilities?: string
  communicationType?: string
  engineNumber?: number
  engineType?: string
  enrouteHours?: string
  enrouteMinutes?: string
  entryPoint?: string
  exitPoint?: string
  estimatedDepartureTime?: string
  flightStripAnnotations?: string[]
  fuelHours?: string
  fuelMinutes?: string
  groundState?: string
  handoffTargetControllerId?: string
  nextFirCopxPoint?: string
  planType?: string
  rvsm?: boolean
  scratchPad?: string
  trackingControllerId?: string
  wtc?: string
  [key: string]: unknown
}

export interface StripData {
  id: string
  type: StripType
  values: Record<string, string>
  euroscope: boolean
  flightPlan: FlightPlan | null
  lastUpdate: number
}

export interface PanelData {
  name: string
  strips: StripData[]
}

export interface Settings {
  audioEnabled: boolean
  cleanupEnabled: boolean
  cleanupMinutes: number
  showSeconds: boolean
  departureColor: string
  arrivalColor: string
  overflyColor: string
  linkCode: string
  serverIp: string
  discordRpcEnabled: boolean
  theme: string
  darkStrips: boolean
  autohideHeader: boolean
  autoMoveClearance: boolean
  autoMoveRevert: boolean
}

export type ControllerMode = 'aerodrome' | 'approach' | 'center' | ''
export type FacilityType = 'del' | 'ground' | 'tower' | 'approach' | 'center'

export interface ControllerData {
  callsign?: string
  facility?: number | string
  positionId?: string
  [key: string]: unknown
}

export interface ElectronAPI {
  getVersion: () => Promise<string>
  restartServer: (ip: string) => void
  saveSettings: (settings: { serverIp: string; discordRpcEnabled: boolean }) => void
  checkForUpdates: () => Promise<{ success?: boolean; error?: string }>
  startUpdate: () => Promise<{ success: boolean }>
  getUpdateStatus: () => Promise<{ updateInfo: unknown; updateDownloaded: boolean }>
  rendererReady: () => void
  openExternal: (url: string) => void
  listUserThemes: () => Promise<string[]>
  onUpdateAvailable: (cb: (info: unknown) => void) => void
  onUpdateNotAvailable: (cb: (info: unknown) => void) => void
  onUpdateError: (cb: (message: string) => void) => void
  onDownloadProgress: (cb: (progress: unknown) => void) => void
  onUpdateDownloaded: (cb: (info: unknown) => void) => void
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI
  }
}
