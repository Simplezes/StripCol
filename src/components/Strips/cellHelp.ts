import type { ControllerMode } from '../../types'

export interface CellHelp {
  title: string
  text: string
}

const NOTE: CellHelp = { title: 'Free note', text: 'Free text for your own use. Kept on the strip, not sent to EuroScope.' }

function pointNote(n: number): CellHelp {
  return {
    title: `Notification point ${n}`,
    text: `Fix you want to be notified about. Its estimated time is shown in the ETA cell for point ${n}.`,
  }
}

function pointEta(n: number): CellHelp {
  return {
    title: `ETA over point ${n}`,
    text: `Estimated time over notification point ${n}. Filled in automatically when the point is set.`,
  }
}

const FIXED: Record<string, CellHelp> = {
  c1: { title: 'Callsign', text: 'Aircraft callsign.' },
  c2: { title: 'Aircraft type', text: 'ICAO aircraft type from the flight plan.' },
  c3: { title: 'Ground speed', text: 'Current ground speed in knots, as seen by EuroScope.' },
  c4: { title: 'Departure', text: 'Departure aerodrome.' },
  c5: { title: 'Arrival', text: 'Destination aerodrome.' },
  c6: { title: 'Squawk', text: 'Transponder code. Editing it assigns the new squawk in EuroScope.' },
  c7: { title: 'Departure time', text: 'Actual or estimated departure time in UTC (HHMM). Editing it updates EuroScope.' },
  c9: { title: 'Assigned speed', text: 'Assigned speed in knots, or Mach when you type a decimal such as .78. Editing it updates EuroScope.' },
  c10: { title: 'Registration', text: 'Aircraft registration, read from the REG/ remark of the flight plan.' },
  c11: { title: 'Status', text: 'Special status from the STS/ remark of the flight plan, such as HOSP or STATE.' },
  c13: { title: 'Final altitude', text: 'Requested cruise level. Editing it changes the final altitude in EuroScope.' },
  c14: {
    title: 'Cleared altitude',
    text: 'Level the aircraft is cleared to. Use CA to climb at pilot discretion or VA for a visual approach clearance. Editing it updates EuroScope.',
  },
  c18: { title: 'Runway', text: 'Assigned runway. Changing it also switches the SID or STAR to one valid for that runway.' },
  c24: pointEta(1),
  c25: pointEta(2),
  c26: pointEta(3),
  c27: pointEta(4),
  c32: { title: 'Estimated arrival', text: 'Estimated time of arrival at the destination.' },
  c33: { title: 'Last update', text: 'Date and time (UTC) this strip was last updated.' },
}

export function describeCell(key: string, mode: ControllerMode, type: string): CellHelp {
  const radar = mode !== 'aerodrome'

  switch (key) {
    case 'c8':
      if (type === 'arrival') return { title: 'STAR', text: 'Standard arrival route. Changing it from the right-click menu updates EuroScope.' }
      if (type === 'departure') return { title: 'SID', text: 'Standard instrument departure. Changing it from the right-click menu updates EuroScope.' }
      return { title: 'Procedure', text: 'Departure or arrival procedure.' }
    case 'c12':
      return radar
        ? { title: 'Direct to', text: 'Fix the aircraft is cleared direct to. Clearing it also resets the assigned heading.' }
        : { title: 'Clearance', text: 'Direct point or clearance note. Filling it moves the strip from Pending to Clearance when auto-move is on.' }
    case 'c16':
      return radar || type !== 'departure'
        ? { title: 'Assigned heading', text: 'Heading assigned to the aircraft. Editing it updates EuroScope.' }
        : { title: 'Departure runway', text: 'Runway assigned for departure.' }
    case 'c19':
    case 'c20':
    case 'c21':
    case 'c22':
      return pointNote(Number(key.slice(1)) - 18)
    default:
      return FIXED[key] ?? NOTE
  }
}
