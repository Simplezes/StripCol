import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Icon } from '../../ContextMenu/Icon'
import { KNOTS, LEVELS, MACH, SQUAWKS } from './pickerData'

interface NumberBodyProps {
  current: string
  pick: (value: string) => void
}

interface ListRow {
  value: string
  label: string
  hint: string
}

const TEXT_OFF = { autoComplete: 'off', autoCorrect: 'off', autoCapitalize: 'off', spellCheck: false } as const

function Readout({ value, unit, onStep }: { value: string; unit: string; onStep: (direction: 1 | -1) => void }) {
  return (
    <div className="pk-dial">
      <button aria-label="Decrease" onClick={() => onStep(-1)}>
        −
      </button>
      <div className="pk-val">
        <b>{value || '—'}</b>
        <small>{unit}</small>
      </div>
      <button aria-label="Increase" onClick={() => onStep(1)}>
        +
      </button>
    </div>
  )
}

function NumberList({ rows, selected, onPick }: { rows: ListRow[]; selected: string; onPick: (value: string) => void }) {
  const listRef = useRef<HTMLDivElement>(null)
  const selectedRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const list = listRef.current
    const row = selectedRef.current
    if (list && row) list.scrollTop = row.offsetTop - list.clientHeight / 2 + row.clientHeight / 2
  }, [])

  return (
    <div ref={listRef} className="pk-list">
      {rows.map((row) => {
        const on = row.value === selected
        return (
          <button key={row.value} ref={on ? selectedRef : undefined} className={`pk-row${on ? ' cur' : ''}`} onClick={() => onPick(row.value)}>
            <b>{row.label}</b>
            {on && <Icon name="check" />}
            <em>{row.hint}</em>
          </button>
        )
      })}
    </div>
  )
}

function Entry({ draft, placeholder, onDraft, onApply, onClear }: {
  draft: string
  placeholder: string
  onDraft: (value: string) => void
  onApply: () => void
  onClear?: () => void
}) {
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') onApply()
  }

  return (
    <div className="pk-foot">
      <input value={draft} placeholder={placeholder} inputMode="decimal" onChange={(e) => onDraft(e.target.value)} onKeyDown={onKey} {...TEXT_OFF} />
      <button className="pk-set" onClick={onApply}>
        Set
      </button>
      {onClear && (
        <button className="pk-clr" onClick={onClear}>
          Clear
        </button>
      )}
    </div>
  )
}

function delta(from: number, to: number, format: (n: number) => string): string {
  if (from === to) return 'Selected'
  return `${to > from ? '+' : '−'}${format(Math.abs(to - from))}`
}

function machText(value: number): string {
  return `.${String(Math.round(value * 100)).padStart(2, '0')}`
}

export function SpeedBody({ current, pick }: NumberBodyProps) {
  const [unit, setUnit] = useState<'kt' | 'mach'>(current.includes('.') ? 'mach' : 'kt')
  const [draft, setDraft] = useState(current || '250')

  const switchUnit = (next: 'kt' | 'mach') => {
    setUnit(next)
    setDraft(next === 'kt' ? '250' : '.78')
  }

  const number = unit === 'kt' ? parseInt(draft, 10) : parseFloat(draft)
  const step = (direction: 1 | -1) => {
    const base = Number.isFinite(number) ? number : unit === 'kt' ? 250 : 0.78
    if (unit === 'kt') setDraft(String(Math.min(999, Math.max(0, base + direction * 10))))
    else setDraft(machText(Math.min(0.99, Math.max(0.1, base + direction * 0.01))))
  }

  const rows: ListRow[] =
    unit === 'kt'
      ? KNOTS.map((v) => ({ value: v, label: v, hint: delta(number, Number(v), String) }))
      : MACH.map((v) => ({ value: v, label: v, hint: delta(number, Number(v), machText) }))

  const apply = () => {
    const valid = unit === 'kt' ? /^\d{2,3}$/.test(draft) : /^0?\.\d{1,2}$/.test(draft)
    if (valid) pick(draft)
  }

  return (
    <>
      <div className="seg">
        <b className={unit === 'kt' ? 'on' : ''} onClick={() => switchUnit('kt')}>
          Knots
        </b>
        <b className={unit === 'mach' ? 'on' : ''} onClick={() => switchUnit('mach')}>
          Mach
        </b>
      </div>
      <Readout value={draft} unit={unit === 'kt' ? 'kt' : 'mach'} onStep={step} />
      <NumberList rows={rows} selected={draft} onPick={pick} />
      <Entry draft={draft} placeholder={unit === 'kt' ? 'Speed in knots' : 'Mach, e.g. .78'} onDraft={setDraft} onApply={apply} onClear={() => pick('')} />
    </>
  )
}

function levelFeet(level: string): string {
  return `${(Number(level) * 100).toLocaleString('en-US')} ft`
}

function LevelBody({ current, pick, prefix, withTokens }: NumberBodyProps & { prefix: string; withTokens: boolean }) {
  const initial = current.replace(/\D/g, '')
  const [draft, setDraft] = useState(initial || '350')

  const step = (direction: 1 | -1) => {
    const base = parseInt(draft, 10)
    const next = Math.min(460, Math.max(10, (Number.isFinite(base) ? base : 350) + direction * 10))
    setDraft(String(next).padStart(3, '0'))
  }

  const rows: ListRow[] = [...LEVELS].reverse().map((level) => ({
    value: level,
    label: `${prefix}${level}`,
    hint: levelFeet(level),
  }))

  const apply = () => {
    if (/^\d{1,3}$/.test(draft)) pick(`${prefix}${draft.padStart(3, '0')}`)
  }

  return (
    <>
      {withTokens && (
        <div className="pk-tokens">
          <button className={`pk-chip${current === 'CA' ? ' on' : ''}`} onClick={() => pick('CA')}>
            CA
          </button>
          <button className={`pk-chip${current === 'VAP' ? ' on' : ''}`} onClick={() => pick('VAP')}>
            VAP
          </button>
        </div>
      )}
      <Readout value={draft ? `${prefix}${draft}` : ''} unit="level" onStep={step} />
      <NumberList rows={rows} selected={draft.padStart(3, '0')} onPick={(level) => pick(`${prefix}${level}`)} />
      <Entry draft={draft} placeholder="Level, e.g. 350" onDraft={(v) => setDraft(v.replace(/\D/g, '').slice(0, 3))} onApply={apply} onClear={withTokens ? () => pick('') : undefined} />
    </>
  )
}

export function ClearedLevelBody(props: NumberBodyProps) {
  return <LevelBody {...props} prefix="" withTokens />
}

export function FinalLevelBody(props: NumberBodyProps) {
  return <LevelBody {...props} prefix="" withTokens={false} />
}

function wrapHeading(value: number): number {
  return ((((Math.round(value) - 1) % 360) + 360) % 360) + 1
}

export function HeadingBody({ current, pick }: NumberBodyProps) {
  const [draft, setDraft] = useState(current.replace(/\D/g, '') || '090')
  const number = parseInt(draft, 10)

  const move = (amount: number) => setDraft(String(wrapHeading((Number.isFinite(number) ? number : 0) + amount)).padStart(3, '0'))
  const apply = () => {
    if (/^\d{1,3}$/.test(draft) && Number(draft) <= 360) pick(draft.padStart(3, '0'))
  }

  return (
    <>
      <Readout value={draft} unit="deg" onStep={(direction) => move(direction * 5)} />
      <div className="pk-tokens">
        {[
          ['N', '360'],
          ['E', '090'],
          ['S', '180'],
          ['W', '270'],
        ].map(([label, value]) => (
          <button key={label} className={`pk-chip${draft === value ? ' on' : ''}`} onClick={() => pick(value)}>
            {label}
          </button>
        ))}
      </div>
      <Entry draft={draft} placeholder="Heading, e.g. 270" onDraft={(v) => setDraft(v.replace(/\D/g, '').slice(0, 3))} onApply={apply} onClear={() => pick('')} />
    </>
  )
}

const KEYS = ['0', '1', '2', '3', '4', '5', '6', '7']
const EMERGENCY = ['7500', '7600', '7700']

export function SquawkBody({ current, pick }: NumberBodyProps) {
  const [digits, setDigits] = useState('')
  const code = current.replace(/\D/g, '')
  const slots = [0, 1, 2, 3]

  const press = (digit: string) => setDigits((d) => (d.length < 4 ? d + digit : d))
  const apply = () => {
    if (digits.length === 4) pick(`A${digits}`)
  }

  return (
    <>
      <div className="pk-squawk">
        {slots.map((i) => (
          <b key={i} className={digits[i] ? 'filled' : i === digits.length ? 'next' : ''}>
            {digits[i] ?? ''}
          </b>
        ))}
      </div>
      <div className="pk-keys">
        {KEYS.map((key) => (
          <button key={key} onClick={() => press(key)}>
            {key}
          </button>
        ))}
        <button className="wide" aria-label="Delete last digit" onClick={() => setDigits((d) => d.slice(0, -1))}>
          Delete
        </button>
        <button className="wide go" disabled={digits.length !== 4} onClick={apply}>
          Set
        </button>
      </div>
      {[SQUAWKS.slice(0, 3), SQUAWKS.slice(3, 6)].map((row) => (
        <div key={row[0].code} className="pk-tokens">
          {row.map((entry) => (
            <button
              key={entry.code}
              className={`pk-chip${entry.code === code ? ' on' : ''}${EMERGENCY.includes(entry.code) ? ' alert' : ''}`}
              title={entry.label}
              onClick={() => pick(`A${entry.code}`)}
            >
              {entry.code}
            </button>
          ))}
        </div>
      ))}
    </>
  )
}
