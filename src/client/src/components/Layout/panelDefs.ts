import type { FacilityType } from '../../types'

export interface PanelDef {
  key: string
  defaultName: string
  cssClass: string
  col: 1 | 2 | 3
  noCollapse?: boolean
}

export const DELIVERY_PANELS: PanelDef[] = [
  { key: 'del-pending',   defaultName: 'Pending',   cssClass: 'panel-pending',   col: 1 },
  { key: 'del-clearance', defaultName: 'Clearance', cssClass: 'panel-clearance', col: 2 },
  { key: 'handover',      defaultName: 'Handover',  cssClass: 'panel-handover',  col: 3, noCollapse: true },
]

export const GROUND_PANELS: PanelDef[] = [
  { key: 'gnd-pending',   defaultName: 'Pending',         cssClass: 'panel-pending',  col: 1 },
  { key: 'gnd-clearance', defaultName: 'Clearance',       cssClass: 'panel-clearance',col: 2 },
  { key: 'gnd-pushback',  defaultName: 'Pushback',        cssClass: 'panel-pushback', col: 2 },
  { key: 'gnd-movement',  defaultName: 'Ground Movement', cssClass: 'panel-ground',   col: 3 },
  { key: 'handover',      defaultName: 'Handover',        cssClass: 'panel-handover', col: 3 },
]

export const TOWER_PANELS: PanelDef[] = [
  { key: 'twr-pending',   defaultName: 'Pending',         cssClass: 'panel-pending',  col: 1 },
  { key: 'twr-clearance', defaultName: 'Clearance',       cssClass: 'panel-clearance',col: 1 },
  { key: 'twr-pushback',  defaultName: 'Pushback',        cssClass: 'panel-pushback', col: 2 },
  { key: 'twr-movement',  defaultName: 'Ground Movement', cssClass: 'panel-ground',   col: 2 },
  { key: 'twr-holding',   defaultName: 'Holding Point',   cssClass: 'panel-hp-rwy',   col: 2 },
  { key: 'twr-sequence',  defaultName: 'Sequence',        cssClass: 'panel-sequence', col: 3 },
  { key: 'handover',      defaultName: 'Handover',        cssClass: 'panel-handover', col: 3 },
]

export const RADAR_PANELS: PanelDef[] = [
  { key: 'departures', defaultName: 'Departures', cssClass: 'panel-departures', col: 1 },
  { key: 'arrivals',   defaultName: 'Arrivals',   cssClass: 'panel-arrivals',   col: 2 },
  { key: 'overfly',    defaultName: 'Overfly',    cssClass: 'panel-overfly',    col: 3 },
  { key: 'holding',    defaultName: 'Holding',    cssClass: 'panel-holding',    col: 3 },
  { key: 'handover',   defaultName: 'Handover',   cssClass: 'panel-handover',   col: 3 },
]

export const FACILITY_PANEL_MAP: Record<FacilityType, PanelDef[]> = {
  del:      DELIVERY_PANELS,
  ground:   GROUND_PANELS,
  tower:    TOWER_PANELS,
  approach: RADAR_PANELS,
  center:   RADAR_PANELS,
}

export type LayoutMode = 'del' | 'ground' | 'tower' | 'radar'

export function facilityToLayoutMode(facilityType: FacilityType): LayoutMode {
  if (facilityType === 'approach' || facilityType === 'center') return 'radar'
  return facilityType as LayoutMode
}

export function getPanelName(def: PanelDef): string {
  return def.key === 'handover' ? 'Handover' : def.defaultName
}
