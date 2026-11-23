import { usePanelStore } from '../../stores/panelStore'
import { useSelectedStrip } from '../Inspector/useSelectedStrip'
import type { StripType } from '../../types'

const TYPES: Array<{ type: Exclude<StripType, 'transfer'>; label: string; cls: string; path: string }> = [
  { type: 'departure', label: 'Departure', cls: 'd', path: 'M5 19l3-3M8 16l-3-8 2-1 5 6 4-4-2-5 2-1 4 7-6 6z' },
  { type: 'arrival', label: 'Arrival', cls: 'a', path: 'M19 5l-3 3M16 8l3 8-2 1-5-6-4 4 2 5-2 1-4-7 6-6z' },
  { type: 'overfly', label: 'Overfly', cls: 'o', path: 'M3 12h18M15 6l6 6-6 6' },
]

export function AddStripPanel({ onDone }: { onDone: () => void }) {
  const firstPanel = usePanelStore((s) => s.panels[0]?.name ?? '')
  const selected = useSelectedStrip()
  const panelName = selected?.panelName ?? firstPanel

  const add = (type: StripType) => {
    if (!panelName) return
    const id = `manual-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    usePanelStore.getState().addStrip(panelName, {
      id,
      type,
      values: {},
      euroscope: false,
      flightPlan: null,
      lastUpdate: Date.now(),
    })
    onDone()
  }

  return (
    <div className="pop" role="dialog" aria-label="Add strip">
      <div className="rph">
        <h2>Add strip</h2>
      </div>
      <p className="rsub">
        Adds a blank strip to <b>{panelName || 'the first section'}</b>.
      </p>
      <div className="ttiles">
        {TYPES.map(({ type, label, cls, path }) => (
          <button key={type} className={`tt ${cls}`} onClick={() => add(type)}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d={path} />
            </svg>
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}
