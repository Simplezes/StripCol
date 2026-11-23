import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { useCellPickerStore } from '../../../stores/cellPickerStore'
import { usePanelStore } from '../../../stores/panelStore'
import type { FlightPlan } from '../../../types'
import { Group, Item, Sep } from '../../ContextMenu/MenuParts'
import { ProcedurePicker } from '../../ContextMenu/ProcedurePicker'
import { positionSafely } from '../../ContextMenu/menuHelpers'
import { cancelCellHint } from '../useCellHint'
import { ClearedLevelBody, FinalLevelBody, HeadingBody, SpeedBody, SquawkBody } from './NumberPickers'
import { PICKER_TITLES, applyCellValue, pointOptions, runwayOptions, utcTimeIn } from './pickerData'

interface BodyProps {
  flight: FlightPlan | null
  type: string
  current: string
  pick: (value: string) => void
}


function ClearItem({ pick }: { pick: (value: string) => void }) {
  return (
    <>
      <Sep />
      <Item label="Clear" icon="x" tone="no" onClick={() => pick('')} />
    </>
  )
}

function PointsBody({ flight, current, pick }: BodyProps) {
  const [query, setQuery] = useState('')
  const options = pointOptions(flight)
  const needle = query.trim().toUpperCase()
  const matches = needle ? options.filter((p) => p.name.includes(needle)) : options
  const typedIsNew = needle.length >= 2 && !options.some((p) => p.name === needle)

  const onKey = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return
    if (matches.length > 0) pick(matches[0].name)
    else if (typedIsNew) pick(needle)
  }

  return (
    <>
      <label className="pk-search">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-4-4" />
        </svg>
        <input
          value={query}
          placeholder="Search or type a point"
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKey}
          autoFocus
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
        />
      </label>
      <div className="pk-scroll">
        {matches.map((point) => (
          <Item key={point.name} label={point.name} value={point.eta} current={point.name === current.toUpperCase()} onClick={() => pick(point.name)} />
        ))}
        {matches.length === 0 && !typedIsNew && <Group label={options.length === 0 ? 'No route points available' : 'No matching points'} />}
        {typedIsNew && <Item label={`Use ${needle}`} icon="plus" onClick={() => pick(needle)} />}
      </div>
      <ClearItem pick={pick} />
    </>
  )
}


function TimeBody({ current, pick }: BodyProps) {
  const offsets = [0, 5, 10, 15, 30]
  return (
    <>
      {offsets.map((minutes) => {
        const time = utcTimeIn(minutes)
        return (
          <Item
            key={minutes}
            label={minutes === 0 ? 'Now' : `In ${minutes} min`}
            value={time}
            current={time === current}
            onClick={() => pick(time)}
          />
        )
      })}
      <ClearItem pick={pick} />
    </>
  )
}

function RunwayBody({ flight, type, current, pick }: BodyProps) {
  const runways = runwayOptions(flight, type)
  if (runways.length === 0) return <Group label="No runways known for this airport" />

  return (
    <>
      {runways.map((rwy) => (
        <Item key={rwy} label={`Runway ${rwy}`} current={rwy === current.toUpperCase()} onClick={() => pick(rwy)} />
      ))}
    </>
  )
}

const BODIES: Record<string, (props: BodyProps) => JSX.Element> = {
  c6: SquawkBody,
  c7: TimeBody,
  c9: SpeedBody,
  c12: PointsBody,
  c13: FinalLevelBody,
  c14: ClearedLevelBody,
  c16: HeadingBody,
  c18: RunwayBody,
  c19: PointsBody,
  c20: PointsBody,
  c21: PointsBody,
  c22: PointsBody,
}

export function CellPickerLayer() {
  const open = useCellPickerStore((s) => s.open)
  const close = useCellPickerStore((s) => s.closePicker)
  const stackRef = useRef<HTMLDivElement>(null)
  const strip = usePanelStore((s) => (open ? s.getStrip(open.stripId) : undefined))

  useEffect(() => {
    if (!open) return
    cancelCellHint()
    if (stackRef.current) positionSafely(stackRef.current, open.rect.left, open.rect.bottom + 4)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, close])

  if (!open || !strip) return null

  const flight = strip.flightPlan
  const current = strip.values[open.cell] ?? ''
  const pick = (value: string) => {
    applyCellValue(open.stripId, open.cell, value)
    close()
  }

  const renderBody = () => {
    if (open.cell === 'c8') {
      const isArrival = strip.type === 'arrival'
      const airport = (isArrival ? flight?.arrival : flight?.departure) ?? ''
      if (!flight || strip.type === 'overfly' || !airport) return <Group label="No procedure for this strip" />
      return <ProcedurePicker airport={airport} procType={isArrival ? 'STAR' : 'SID'} stripId={open.stripId} panelName={open.panelName} onClose={close} />
    }
    const Body = BODIES[open.cell]
    return Body ? <Body flight={flight} type={strip.type} current={current} pick={pick} /> : null
  }

  const standalone = open.cell !== 'c8'

  return createPortal(
    <>
      <div className="cm-backdrop" onMouseDown={close} />
      <div
        ref={stackRef}
        className="cm-stack"
        data-type={strip.type}
        style={{ left: open.rect.left, top: open.rect.bottom + 4, visibility: 'hidden' }}
        onWheel={(e) => e.stopPropagation()}
        onContextMenu={(e) => e.preventDefault()}
      >
        {standalone ? (
          <div className="cm w240 pk-menu" role="menu" data-type={strip.type}>
            <Group label={PICKER_TITLES[open.cell] ?? 'Choose'} />
            {renderBody()}
          </div>
        ) : (
          renderBody()
        )}
      </div>
    </>,
    document.body,
  )
}
