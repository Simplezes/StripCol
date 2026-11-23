import { useState } from 'react'
import { BackButton } from './MenuParts'
import { TransitionsView } from './TransitionsView'
import type { ProcGroup } from './procedureHelpers'
import { applyProcedure, groupProcedures } from './procedureHelpers'

export function ProcedureListView({
  procMap,
  runway,
  procType,
  stripId,
  panelName,
  onBack,
  onClose,
}: {
  procMap: Record<string, unknown>
  runway: string
  procType: 'SID' | 'STAR'
  stripId: string
  panelName: string
  onBack: () => void
  onClose: () => void
}) {
  const [search, setSearch] = useState('')
  const [selectedGroup, setSelectedGroup] = useState<ProcGroup | null>(null)

  if (selectedGroup) {
    return (
      <TransitionsView
        group={selectedGroup}
        runway={runway}
        procType={procType}
        stripId={stripId}
        panelName={panelName}
        onBack={() => setSelectedGroup(null)}
        onClose={onClose}
      />
    )
  }

  const groups = groupProcedures(procMap)
  const query = search.trim().toLowerCase()
  const filtered = query
    ? groups.filter((g) => g.baseName.toLowerCase().includes(query))
    : groups

  return (
    <div className="proc-picker">
      <BackButton onBack={onBack} />
      <div className="proc-context-bar">
        <span className="material-icons">turn_right</span>
        <span>RWY {runway}</span>
        <span className="proc-context-count">{groups.length} procedures</span>
      </div>
      <div className="search-wrapper proc-search-wrapper">
        <span className="material-icons search-icon">search</span>
        <input
          className="procedure-search"
          placeholder={`Search ${procType}…`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onMouseDown={(e) => e.stopPropagation()}
          autoFocus
        />
        {search && (
          <span
            className="material-icons proc-search-clear"
            onMouseDown={(e) => { e.preventDefault(); setSearch('') }}
          >close</span>
        )}
      </div>
      <div className="proc-picker-list">
        {filtered.length === 0 && (
          <div className="proc-picker-empty">No results for "{search}"</div>
        )}
        {filtered.map((g) => {
          const hasTransitions = g.transitions.length > 0
          return (
            <div
              key={g.baseName}
              className={`proc-item${!hasTransitions && g.base ? ' proc-item-base' : ''}`}
              onClick={() => {
                if (hasTransitions) setSelectedGroup(g)
                else if (g.base) applyProcedure(stripId, panelName, procType, runway, g.base, onClose)
              }}
            >
              <span className="proc-item-name">{g.baseName}</span>
              <div className="proc-item-right">
                {hasTransitions && (
                  <span className="proc-item-tag">
                    {g.transitions.length} via
                  </span>
                )}
                <span className="material-icons proc-item-chevron">
                  {hasTransitions ? 'chevron_right' : 'check'}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
