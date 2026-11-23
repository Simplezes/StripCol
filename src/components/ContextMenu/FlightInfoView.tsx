import type { FlightPlan, StripType } from '../../types'
import { MenuHeader } from './MenuParts'

export const PLAN_TYPE_LABELS: Record<string, string> = { I: 'IFR', V: 'VFR', Y: 'IFR → VFR', Z: 'VFR → IFR' }
export const ENGINE_TYPE_LABELS: Record<string, string> = { J: 'Jet', T: 'Turboprop', P: 'Piston', E: 'Electric', M: 'Mixed' }
export const COMM_TYPE_LABELS: Record<string, string> = { v: 'Voice', t: 'Text', r: 'Receive only' }

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value && value !== '0') return null
  return (
    <div className="r">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  )
}

export function FlightInfoView({ flight, type }: { flight: FlightPlan; type: StripType }) {
  const enroute =
    flight.enrouteHours || flight.enrouteMinutes
      ? `${flight.enrouteHours ?? '0'}h ${flight.enrouteMinutes ?? '0'}m`
      : null
  const fuel =
    flight.fuelHours || flight.fuelMinutes ? `${flight.fuelHours ?? '0'}h ${flight.fuelMinutes ?? '0'}m` : null
  const engines =
    flight.engineNumber != null && flight.engineType
      ? `${flight.engineNumber}× ${ENGINE_TYPE_LABELS[flight.engineType] ?? flight.engineType}`
      : null
  const commType = flight.communicationType
    ? (COMM_TYPE_LABELS[flight.communicationType] ?? flight.communicationType)
    : null
  const annotations = (flight.flightStripAnnotations ?? []).filter(Boolean)

  return (
    <div className="cm w400" role="menu" data-type={type}>
      <MenuHeader flight={flight} pill="Details" />
      <div className="cm-kv">
        <h3>General</h3>
        <Row label="Plan type" value={PLAN_TYPE_LABELS[flight.planType ?? ''] ?? (flight.planType as string)} />
        <Row label="WTC" value={flight.wtc as string} />
        <Row label="Comm" value={commType} />
        <Row label="RVSM" value={flight.rvsm ? 'Yes' : flight.rvsm === false ? 'No' : null} />
        <Row label="Ground state" value={flight.groundState as string} />
        <Row label="Scratch pad" value={flight.scratchPad as string} />

        <h3>Aircraft</h3>
        <Row label="Equipment" value={flight.aircraftInfo as string} />
        <Row label="Engines" value={engines} />
        <Row
          label="Capabilities"
          value={flight.capabilities && flight.capabilities !== '\u0000' ? (flight.capabilities as string) : null}
        />

        <h3>Route</h3>
        <Row label="Alternate" value={flight.alternate as string} />
        <Row label="Entry point" value={flight.entryPoint as string} />
        <Row label="Exit point" value={flight.exitPoint as string} />
        <Row label="Direct to" value={flight.directTo as string} />
        <Row label="Next COPX" value={flight.nextCopxPoint as string} />
        <Row label="FIR COPX" value={flight.nextFirCopxPoint as string} />

        <h3>Times</h3>
        <Row label="ETD" value={flight.estimatedDepartureTime as string} />
        <Row label="ATD" value={flight.atd ? String(flight.atd) : null} />
        <Row label="Enroute" value={enroute} />
        <Row label="Fuel" value={fuel} />

        <h3>ATC</h3>
        <Row label="Squawk" value={flight.squawk as string} />
        <Row label="Tracking" value={flight.trackingControllerId as string} />
        <Row label="Handoff to" value={flight.handoffTargetControllerId as string} />
        <Row label="Assigned alt" value={flight.assignedFinalAltitude ? String(flight.assignedFinalAltitude) : null} />
        <Row label="Assigned rate" value={flight.assignedRate ? String(flight.assignedRate) : null} />

        {annotations.length > 0 && <h3>Annotations</h3>}
        {annotations.map((note, i) => (
          <Row key={i} label={`#${i + 1}`} value={note} />
        ))}
      </div>
    </div>
  )
}
