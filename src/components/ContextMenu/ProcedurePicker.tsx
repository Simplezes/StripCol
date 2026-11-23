import { useAssetsStore } from '../../stores/assetsStore'
import { useState } from 'react'
import { ApproachTypeView } from './ApproachTypeView'
import { BackButton } from './MenuParts'
import { ProcedureListView } from './ProcedureListView'
import type { ProceduresJson } from './procedureHelpers'

export function ProcedurePicker({
  airport,
  procType,
  stripId,
  panelName,
  onBack,
  onClose,
}: {
  airport: string
  procType: 'SID' | 'STAR'
  stripId: string
  panelName: string
  onBack: () => void
  onClose: () => void
}) {
  const [selectedRunway, setSelectedRunway] = useState<string | null>(null)
  const procedures = useAssetsStore.getState().procedures as Record<string, ProceduresJson>
  const airportData = procedures?.[airport]?.[procType]

  if (!airportData) {
    return (
      <div className="proc-picker">
        <BackButton onBack={onBack} />
        <div className="proc-picker-empty">No {procType} found for {airport}</div>
      </div>
    )
  }

  if (selectedRunway !== null) {
    const procMap = airportData[selectedRunway] as Record<string, unknown> ?? {}
    if (procType === 'STAR') {
      return (
        <ApproachTypeView
          procMap={procMap}
          runway={selectedRunway}
          stripId={stripId}
          panelName={panelName}
          onBack={() => setSelectedRunway(null)}
          onClose={onClose}
        />
      )
    }
    return (
      <ProcedureListView
        procMap={procMap}
        runway={selectedRunway}
        procType={procType}
        stripId={stripId}
        panelName={panelName}
        onBack={() => setSelectedRunway(null)}
        onClose={onClose}
      />
    )
  }

  const procedureIcon = procType === 'SID' ? 'flight_takeoff' : 'flight_land'
  const runways = Object.keys(airportData).sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }),
  )

  return (
    <div className="proc-picker">
      <div className="proc-picker-hero">
        <div className="proc-picker-hero-airport">{airport}</div>
        <span className={`proc-type-badge proc-type-${procType.toLowerCase()}`}>
          <span className="material-icons">{procedureIcon}</span>
          {procType}
        </span>
      </div>
      <div className="proc-context-bar proc-context-bar-top">
        <span className="material-icons">connecting_airports</span>
        Select runway
      </div>
      <div className="proc-rwy-grid">
        {runways.map((rwy) => {
          const count = Object.keys(airportData[rwy] as Record<string, unknown>).length
          return (
            <div key={rwy} className="proc-rwy-card" onClick={() => setSelectedRunway(rwy)}>
              <span className="proc-rwy-num">{rwy}</span>
              <span className="proc-rwy-count">{count}</span>
            </div>
          )
        })}
      </div>
      <div className="proc-picker-footer">
        <span className="material-icons">arrow_back</span>
        <span onClick={onBack} style={{ cursor: 'pointer' }}>Back to menu</span>
      </div>
    </div>
  )
}
