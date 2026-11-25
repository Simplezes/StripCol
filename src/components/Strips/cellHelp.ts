import type { ControllerMode } from '../../types'
import { layoutFor, type CellSpec } from '../../utils/stripLayout'
import { isTowerDeparture } from '../../utils/stripValues'

export interface CellHelp {
  title: string
  text: string
}

const NOTE: CellHelp = { title: 'Free box', text: 'Free text for your own use. Kept on the strip, not sent to EuroScope.' }

const FIXED: Record<string, CellHelp> = {
  c1: { title: 'Callsign', text: 'Aircraft callsign.' },
  c2: { title: 'Aircraft type', text: 'ICAO aircraft type from the flight plan.' },
  c3: { title: 'Speed', text: 'Filed true airspeed in knots, four digits (N0450).' },
  c4: { title: 'Departure', text: 'Departure aerodrome.' },
  c5: { title: 'Destination', text: 'Destination aerodrome.' },
  c6: { title: 'Squawk', text: 'Transponder code. Editing it assigns the new squawk in EuroScope.' },
  c7: { title: 'Departure time', text: 'Actual departure time in UTC (HHMM). Editing it updates EuroScope.' },
  c9: { title: 'Speed adjustment', text: 'Assigned speed in knots, or Mach when you type a decimal such as .78. Editing it updates EuroScope.' },
  c10: { title: 'Registration', text: 'Aircraft registration, read from the REG/ remark of the flight plan.' },
  c11: { title: 'Status', text: 'Special status from the STS/ remark of the flight plan, such as HOSP or STATE.' },
  c12: { title: 'Direct to', text: 'Fix the aircraft is cleared direct to. Clearing it also resets the assigned heading.' },
  c13: { title: 'Final level', text: 'Requested cruise level in hundreds of feet (350). Editing it changes the final level in EuroScope.' },
  c14: {
    title: 'Cleared level',
    text: 'Level the aircraft is cleared to. CA clears it to the airport, VAP for a visual approach. Editing it updates EuroScope.',
  },
  c16: { title: 'Heading', text: 'Assigned heading or radar vector. Editing it updates EuroScope.' },
  c32: { title: 'ETA', text: 'Estimated time of arrival at the destination.' },
  c33: { title: 'Print time', text: 'Date and time (UTC) this strip was created.' },
}

const RUNWAY: CellHelp = {
  title: 'Runway',
  text: 'Runway in use. Changing it also switches the SID or STAR to one valid for that runway.',
}

function describeSpec(spec: CellSpec): CellHelp {
  if (spec.kind === 'time') {
    return { title: spec.title, text: `${spec.text ?? 'Time in UTC.'} Triple-click to stamp the current UTC time.` }
  }
  if (spec.kind === 'point') {
    return { title: spec.title, text: `${spec.text ?? 'Filled in from the route.'} Triple-click to pick another point.` }
  }
  return { title: spec.title, text: spec.text ?? NOTE.text }
}

export function describeCell(key: string, mode: ControllerMode, type: string): CellHelp {
  const layout = layoutFor(mode, type)
  const spec = layout.cells[key]
  if (spec) return describeSpec(spec)
  if (key === layout.runway) return RUNWAY

  const towerDeparture = isTowerDeparture(mode, type)
  if (key === 'c7' && towerDeparture) {
    return { title: 'EOBT', text: 'Estimated off-block time from the flight plan (HHMM UTC). Editing it updates EuroScope.' }
  }
  if (key === 'c8') {
    const procedure = type === 'arrival' ? 'Route clearance (STAR)' : 'Clearance (SID)'
    return {
      title: procedure,
      text: 'Ⓑ is added once the clearance is received. Triple-click to set the clearance or change the procedure.',
    }
  }
  return FIXED[key] ?? NOTE
}
