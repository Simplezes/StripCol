import type { FlightPlan } from '../../types'
import { BackButton } from './MenuParts'

export const PLAN_TYPE_LABELS: Record<string, string> = { I: 'IFR', V: 'VFR', Y: 'IFR → VFR', Z: 'VFR → IFR' }
export const ENGINE_TYPE_LABELS: Record<string, string> = { J: 'Jet', T: 'Turboprop', P: 'Piston', E: 'Electric', M: 'Mixed' }
export const COMM_TYPE_LABELS: Record<string, string> = { v: 'Voice', t: 'Text', r: 'Receive only' }

export function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value && value !== '0') return null
  return (
    <div className="finfo-row">
      <span className="finfo-label">{label}</span>
      <span className="finfo-value">{value}</span>
    </div>
  )
}

export function InfoSection({ label }: { label: string }) {
  return <div className="finfo-section">{label}</div>
}

export function FlightInfoView({ flight, onBack }: { flight: FlightPlan; onBack: () => void }) {
  const enroute =
    flight.enrouteHours || flight.enrouteMinutes
      ? `${flight.enrouteHours ?? '0'}h ${flight.enrouteMinutes ?? '0'}m`
      : null
  const fuel =
    flight.fuelHours || flight.fuelMinutes
      ? `${flight.fuelHours ?? '0'}h ${flight.fuelMinutes ?? '0'}m`
      : null
  const engines =
    flight.engineNumber != null && flight.engineType
      ? `${flight.engineNumber}× ${ENGINE_TYPE_LABELS[flight.engineType] ?? flight.engineType}`
      : null
  const commType = flight.communicationType
    ? (COMM_TYPE_LABELS[flight.communicationType] ?? flight.communicationType)
    : null
  const annotations = (flight.flightStripAnnotations ?? []).filter(Boolean)

  return (
    <div className="finfo-container">
      <div className="menu-header">
        <div className="menu-header-top">
          <span className="menu-callsign">{flight.callsign}</span>
          <span className="menu-type-pill menu-type-pill-route">Details</span>
        </div>
        <div className="menu-header-route">
          <span>{flight.departure || '???'}</span>
          <span className="material-icons">arrow_forward</span>
          <span>{flight.arrival || '???'}</span>
          {flight.aircraftType && <span className="menu-actype">· {flight.aircraftType}</span>}
        </div>
      </div>
      <BackButton onBack={onBack} />
      <div className="finfo-scroll">
        <InfoSection label="General" />
        <InfoRow label="Plan type" value={PLAN_TYPE_LABELS[flight.planType ?? ''] ?? flight.planType as string} />
        <InfoRow label="WTC" value={flight.wtc as string} />
        <InfoRow label="Comm" value={commType} />
        <InfoRow label="RVSM" value={flight.rvsm ? 'Yes' : flight.rvsm === false ? 'No' : null} />
        <InfoRow label="Ground state" value={flight.groundState as string} />
        <InfoRow label="Scratch pad" value={flight.scratchPad as string} />

        <InfoSection label="Aircraft" />
        <InfoRow label="Equipment" value={flight.aircraftInfo as string} />
        <InfoRow label="Engines" value={engines} />
        <InfoRow label="Capabilities" value={flight.capabilities && flight.capabilities !== '\u0000' ? flight.capabilities as string : null} />

        <InfoSection label="Route" />
        <InfoRow label="Alternate" value={flight.alternate as string} />
        <InfoRow label="Entry point" value={flight.entryPoint as string} />
        <InfoRow label="Exit point" value={flight.exitPoint as string} />
        <InfoRow label="Direct to" value={flight.directTo as string} />
        <InfoRow label="Next COPX" value={flight.nextCopxPoint as string} />
        <InfoRow label="FIR COPX" value={flight.nextFirCopxPoint as string} />

        <InfoSection label="Times" />
        <InfoRow label="ETD" value={flight.estimatedDepartureTime as string} />
        <InfoRow label="ATD" value={flight.atd ? String(flight.atd) : null} />
        <InfoRow label="Enroute" value={enroute} />
        <InfoRow label="Fuel" value={fuel} />

        <InfoSection label="ATC" />
        <InfoRow label="Squawk" value={flight.squawk as string} />
        <InfoRow label="Tracking" value={flight.trackingControllerId as string} />
        <InfoRow label="Handoff to" value={flight.handoffTargetControllerId as string} />
        <InfoRow label="Assigned alt" value={flight.assignedFinalAltitude ? String(flight.assignedFinalAltitude) : null} />
        <InfoRow label="Assigned rate" value={flight.assignedRate ? String(flight.assignedRate) : null} />

        {annotations.length > 0 && <>
          <InfoSection label="Annotations" />
          {annotations.map((a, i) => (
            <InfoRow key={i} label={`#${i + 1}`} value={a} />
          ))}
        </>}
      </div>
    </div>
  )
}
