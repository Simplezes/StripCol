import { useState } from 'react'
import { BackButton } from './MenuParts'
import { ProcedureListView } from './ProcedureListView'
import { APPROACH_META, detectApproachTypes } from './procedureHelpers'

export function ApproachTypeView({
  procMap,
  runway,
  stripId,
  panelName,
  onBack,
  onClose,
}: {
  procMap: Record<string, unknown>
  runway: string
  stripId: string
  panelName: string
  onBack: () => void
  onClose: () => void
}) {
  const [selectedType, setSelectedType] = useState<string | null>(null)

  if (selectedType !== null) {
    const knownRegex = (t: string) => new RegExp(`(?:^|x)${t}(?:x|$)`, 'i')
    const filtered: Record<string, unknown> =
      selectedType === 'ALL'
        ? procMap
        : Object.fromEntries(
          Object.entries(procMap).filter(([name]) => knownRegex(selectedType).test(name)),
        )
    return (
      <ProcedureListView
        procMap={filtered}
        runway={runway}
        procType="STAR"
        stripId={stripId}
        panelName={panelName}
        onBack={() => setSelectedType(null)}
        onClose={onClose}
      />
    )
  }

  const types = detectApproachTypes(procMap)
  const totalCount = Object.keys(procMap).length

  return (
    <div className="proc-picker">
      <BackButton onBack={onBack} />
      <div className="proc-context-bar">
        <span className="material-icons">flight_land</span>
        <span>RWY {runway}</span>
        <span className="proc-context-rwy">Approach type</span>
      </div>
      <div className="proc-picker-list proc-appr-list">
        <div
          className="proc-appr-all"
          onClick={() => setSelectedType('ALL')}
        >
          <span className="material-icons">apps</span>
          <span className="proc-appr-label">All STARs</span>
          <span className="proc-appr-count">{totalCount}</span>
        </div>
        {types.map((t) => {
          const meta = APPROACH_META[t] ?? { icon: 'flight_land', color: 'var(--sys-text-dim)', label: t }
          const count = Object.keys(procMap).filter((name) =>
            new RegExp(`(?:^|x)${t}(?:x|$)`, 'i').test(name),
          ).length
          return (
            <div
              key={t}
              className="proc-appr-btn"
              style={{ '--appr-color': meta.color } as React.CSSProperties}
              onClick={() => setSelectedType(t)}
            >
              <span className="material-icons proc-appr-icon">{meta.icon}</span>
              <span className="proc-appr-label">{meta.label}</span>
              <span className="proc-appr-count">{count}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
