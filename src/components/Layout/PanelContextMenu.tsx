import { createPortal } from 'react-dom'
import { useEffect, useRef, useState } from 'react'
import { usePanelContextMenuStore } from '../../stores/panelContextMenuStore'
import { usePanelStore } from '../../stores/panelStore'
import { useFlightStore } from '../../stores/flightStore'
import { apiFetch } from '../../utils/api'
import type { StripType } from '../../types'
import { Icon } from '../ContextMenu/Icon'
import { Field, Group, Item } from '../ContextMenu/MenuParts'
import { getLinkCode, positionSafely } from '../ContextMenu/menuHelpers'

type View = 'none' | 'add' | 'assume'

const STRIP_TYPES: Array<{ type: StripType; label: string; swatch: string }> = [
  { type: 'departure', label: 'Departure', swatch: 'dep' },
  { type: 'arrival', label: 'Arrival', swatch: 'arr' },
  { type: 'overfly', label: 'Overfly', swatch: 'ovf' },
]

function AddStripFlyout({ panelName, onClose }: { panelName: string; onClose: () => void }) {
  const handleAdd = (type: StripType) => {
    const id = `manual-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    usePanelStore.getState().addStrip(panelName, {
      id,
      type,
      values: {},
      euroscope: false,
      flightPlan: null,
      lastUpdate: Date.now(),
    })
    onClose()
  }

  return (
    <div className="cm w200" role="menu">
      {STRIP_TYPES.map(({ type, label, swatch }) => (
        <Item key={type} label={label} swatch={swatch} onClick={() => handleAdd(type)} />
      ))}
    </div>
  )
}

function AssumeFlyout({ panelName, onClose }: { panelName: string; onClose: () => void }) {
  const [requested, setRequested] = useState(false)
  const [search, setSearch] = useState('')
  const callsigns = useFlightStore((s) => s.nearbyCallsigns)

  useEffect(() => {
    useFlightStore.getState().setNearbyCallsigns([])
    apiFetch('/api/get-nearby-aircraft', {
      method: 'POST',
      body: JSON.stringify({ code: getLinkCode() }),
    }).catch(console.error)
    setRequested(true)
  }, [])

  const filtered = callsigns.filter((c) => c.toLowerCase().includes(search.toLowerCase())).sort((a, b) => a.localeCompare(b))

  const handleAssume = async (callsign: string) => {
    try {
      const res = await apiFetch('/api/assume-aircraft', {
        method: 'POST',
        body: JSON.stringify({ code: getLinkCode(), callsign, panel: panelName }),
      })
      if (res.ok) onClose()
    } catch (err) {
      console.error('Assume aircraft failed:', err)
    }
  }

  return (
    <div className="cm w300" role="menu">
      <Field>
        <Icon name="search" />
        <input
          className="cm-input"
          placeholder="Search callsign"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onMouseDown={(e) => e.stopPropagation()}
          autoFocus
        />
      </Field>
      {requested && callsigns.length === 0 && <Group label="Searching for nearby aircraft…" />}
      {callsigns.length > 0 && filtered.length === 0 && <Group label="No matches" />}
      <div className="cm-scroll">
        {filtered.map((callsign) => (
          <Item key={callsign} icon="plane" label={callsign} onClick={() => handleAssume(callsign)} />
        ))}
      </div>
    </div>
  )
}

export function PanelContextMenu() {
  const { visible, x, y, panelName, hide } = usePanelContextMenuStore()
  const stackRef = useRef<HTMLDivElement>(null)
  const [view, setView] = useState<View>('none')

  useEffect(() => {
    if (visible) setView('none')
  }, [visible, panelName])

  useEffect(() => {
    if (visible && stackRef.current) positionSafely(stackRef.current, x, y)
  }, [visible, x, y, view])

  useEffect(() => {
    if (!visible) return
    const onDown = (e: MouseEvent) => {
      if (!stackRef.current?.contains(e.target as Node)) hide()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') hide()
    }
    document.addEventListener('mousedown', onDown, true)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown, true)
      document.removeEventListener('keydown', onKey)
    }
  }, [visible, hide])

  if (!visible || !panelName) return null

  const toggle = (next: View) => setView(view === next ? 'none' : next)

  return createPortal(
    <div
      ref={stackRef}
      className="cm-stack"
      style={{ left: x, top: y, visibility: 'hidden' }}
      onWheel={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="cm" role="menu">
        <Item icon="plus" label="Add strip manually" chevron hot={view === 'add'} onClick={() => toggle('add')} />
        <Item icon="radar" label="Assume aircraft" value="Untracked flight" chevron hot={view === 'assume'} onClick={() => toggle('assume')} />
      </div>
      {view === 'add' && <AddStripFlyout panelName={panelName} onClose={hide} />}
      {view === 'assume' && <AssumeFlyout panelName={panelName} onClose={hide} />}
    </div>,
    document.body,
  )
}
