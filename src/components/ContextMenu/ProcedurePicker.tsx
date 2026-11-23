import { useState } from 'react'
import { useAssetsStore } from '../../stores/assetsStore'
import { usePanelStore } from '../../stores/panelStore'
import { Icon } from './Icon'
import { Field, Group, Item } from './MenuParts'
import {
  APPROACH_LABELS,
  applyProcedure,
  detectApproachTypes,
  groupProcedures,
  type ProcGroup,
  type ProceduresJson,
} from './procedureHelpers'

interface ProcedurePickerProps {
  airport: string
  procType: 'SID' | 'STAR'
  stripId: string
  panelName: string
  onClose: () => void
}

function currentRunway(stripId: string, procType: 'SID' | 'STAR'): string | null {
  const flight = usePanelStore.getState().getStrip(stripId)?.flightPlan
  const rwy = procType === 'SID' ? flight?.departureRwy : flight?.arrivalRwy
  return rwy ? String(rwy) : null
}

function currentProcedure(stripId: string, procType: 'SID' | 'STAR'): string | null {
  const flight = usePanelStore.getState().getStrip(stripId)?.flightPlan
  const name = procType === 'SID' ? flight?.sid : flight?.star
  return name ? String(name) : null
}

function matchesType(name: string, type: string): boolean {
  return new RegExp(`(?:^|x)${type}(?:x|$)`, 'i').test(name)
}

export function ProcedurePicker({ airport, procType, stripId, panelName, onClose }: ProcedurePickerProps) {
  const procedures = useAssetsStore.getState().procedures as Record<string, ProceduresJson>
  const airportData = procedures?.[airport]?.[procType] as Record<string, Record<string, unknown>> | undefined
  const runways = Object.keys(airportData ?? {}).sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }),
  )

  const [runway, setRunway] = useState<string>(() => {
    const preferred = currentRunway(stripId, procType)
    return preferred && runways.includes(preferred) ? preferred : (runways[0] ?? '')
  })
  const [search, setSearch] = useState('')
  const [approach, setApproach] = useState('ALL')
  const [group, setGroup] = useState<ProcGroup | null>(null)

  if (!airportData || runways.length === 0) {
    return (
      <div className="cm w300" role="menu">
        <Group label={`No ${procType} found for ${airport}`} />
      </div>
    )
  }

  const procMap = airportData[runway] ?? {}
  const approachTypes = procType === 'STAR' ? detectApproachTypes(procMap) : []
  const typeFiltered =
    approach === 'ALL'
      ? procMap
      : Object.fromEntries(Object.entries(procMap).filter(([name]) => matchesType(name, approach)))
  const query = search.trim().toLowerCase()
  const groups = groupProcedures(typeFiltered).filter((g) => !query || g.baseName.toLowerCase().includes(query))
  const current = currentProcedure(stripId, procType)?.split('x')[0]

  const apply = (name: string) => applyProcedure(stripId, panelName, procType, runway, name, onClose)

  return (
    <div className="cm w300" role="menu">
      <div className="seg">
        {runways.map((rwy) => (
          <b
            key={rwy}
            className={rwy === runway ? 'on' : ''}
            onClick={() => {
              setRunway(rwy)
              setGroup(null)
              setApproach('ALL')
            }}
          >
            {rwy}
          </b>
        ))}
      </div>

      {approachTypes.length > 0 && (
        <div className="seg">
          {['ALL', ...approachTypes].map((type) => (
            <b key={type} className={type === approach ? 'on' : ''} onClick={() => setApproach(type)}>
              {type === 'ALL' ? 'All' : (APPROACH_LABELS[type] ?? type)}
            </b>
          ))}
        </div>
      )}

      {group ? (
        <>
          <Item label={`‹ ${group.baseName}`} onClick={() => setGroup(null)} />
          {group.base && <Item label={group.base} value="Direct" onClick={() => apply(group.base as string)} />}
          {[...group.transitions].sort().map((key) => (
            <Item key={key} label={group.baseName} value={`via ${key.slice(key.indexOf('x') + 1)}`} onClick={() => apply(key)} />
          ))}
        </>
      ) : (
        <>
          <Field>
            <Icon name="search" />
            <input
              className="cm-input"
              placeholder={`Search ${procType}s at ${airport}`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onMouseDown={(e) => e.stopPropagation()}
              autoFocus
            />
          </Field>
          <div className="cm-scroll">
            {groups.length === 0 && <Group label={`No results for "${search}"`} />}
            {groups.map((g) => {
              const count = g.transitions.length
              return (
                <Item
                  key={g.baseName}
                  label={g.baseName}
                  value={count > 0 ? `${count} ${count === 1 ? 'transition' : 'transitions'}` : undefined}
                  current={current === g.baseName}
                  chevron={count > 0 && current !== g.baseName}
                  onClick={() => (count > 0 ? setGroup(g) : g.base && apply(g.base))}
                />
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
