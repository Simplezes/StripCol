import { createPortal } from 'react-dom'
import { parseHpa } from '../../hooks/useQnh'
import { useState } from 'react'
import { useConnectionStore } from '../../stores/connectionStore'
import { Field, Group, Item, Sep } from '../ContextMenu/MenuParts'

interface AirportMenuProps {
  anchor: DOMRect
  airports: string[]
  selected: string
  onSelect: (icao: string) => void
  onClose: () => void
}

export function AirportMenu({ anchor, airports, selected, onSelect, onClose }: AirportMenuProps) {
  const metars = useConnectionStore((s) => s.metars)
  const extraCount = useConnectionStore((s) => s.extraAirports.length)
  const addAirport = useConnectionStore((s) => s.addAirport)
  const clearExtraAirports = useConnectionStore((s) => s.clearExtraAirports)
  const [draft, setDraft] = useState('')

  const submitDraft = () => {
    const icao = draft.trim().toUpperCase()
    if (!/^[A-Z]{4}$/.test(icao)) return
    addAirport(icao)
    onSelect(icao)
  }

  return createPortal(
    <>
      <div className="cm-backdrop" onMouseDown={onClose} />
      <div className="cm-stack" style={{ left: Math.max(8, anchor.left), top: anchor.bottom + 6 }}>
        <div className="cm w200" role="menu">
          <Group label="Airport" />
          {airports.map((icao) => {
            const hpa = metars[icao] ? parseHpa(metars[icao]) : null
            return (
              <Item
                key={icao}
                label={icao}
                value={hpa === null ? undefined : `${hpa} hPa`}
                current={icao === selected}
                onClick={() => onSelect(icao)}
              />
            )
          })}
          <Sep />
          <Field>
            <input
              className="cm-input"
              placeholder="Add airport (ICAO)"
              maxLength={4}
              value={draft}
              autoFocus
              onChange={(e) => setDraft(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && submitDraft()}
            />
          </Field>
          {extraCount > 0 && <Item label="Remove added airports" onClick={clearExtraAirports} />}
        </div>
      </div>
    </>,
    document.body,
  )
}
