export type StripType = 'departure' | 'arrival' | 'overfly' | 'transfer'

export interface FlightPlan {
  callsign: string
  departure: string
  arrival: string
  aircraftType?: string
  route?: string
  squawk?: string
  clearanceReceived?: boolean
  remarks?: string
  transfer?: boolean
  transferFrom?: string
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
  routePoints?: Array<{ name: string; eta?: string; ato?: string }>
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
  autoCells?: string[]
  unit?: 'aerodrome' | 'approach' | 'center'
  unitValues?: Partial<Record<'aerodrome' | 'approach' | 'center', Record<string, string>>>
}

export interface PanelData {
  name: string
  strips: StripData[]
}

export interface Settings {
  audioEnabled: boolean
  mutedSounds: string[]
  toastsEnabled: boolean
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
  autoAcceptTransfers: boolean
  autoFillTimes: boolean
}

export type ControllerMode = 'aerodrome' | 'approach' | 'center' | ''
export type FacilityType = 'del' | 'ground' | 'tower' | 'approach' | 'center'

export interface ControllerData {
  callsign?: string
  facility?: number | string
  positionId?: string
  [key: string]: unknown
}
