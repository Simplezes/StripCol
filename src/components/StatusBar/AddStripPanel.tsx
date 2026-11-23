import { usePanelStore } from '../../stores/panelStore'
import { useSelectedStrip } from '../Inspector/useSelectedStrip'
import type { StripType } from '../../types'

const TYPES: Array<{ type: Exclude<StripType, 'transfer'>; label: string; cls: string; path: string }> = [
  { type: 'departure', label: 'Departure', cls: 'd', path: 'M2 22h20M6.36 17.4L4 17l-2-4 1.1-.55a2 2 0 0 1 1.8 0l.17.1a2 2 0 0 0 1.8 0L8 12 5 6l.9-.45a2 2 0 0 1 2.09.2l4.02 3a2 2 0 0 0 2.1.2l4.19-2.06a2.41 2.41 0 0 1 1.73-.17L21 7a1.4 1.4 0 0 1 .87 1.99l-.38.76c-.23.46-.6.84-1.07 1.08L7.58 17.2a2 2 0 0 1-1.22.18z' },
  { type: 'arrival', label: 'Arrival', cls: 'a', path: 'M2 22h20M3.77 10.77L2 9l2-4.5 1.1.55c.55.28.9.84.9 1.45s.35 1.17.9 1.45L8 8.5l3-6 1.05.53a2 2 0 0 1 1.09 1.52l.72 5.4a2 2 0 0 0 1.09 1.52l4.4 2.2c.42.22.78.55 1.01.96l.6 1.03c.49.88-.06 1.98-1.06 2.1l-1.18.15c-.47.06-.95-.02-1.37-.24L4.29 11.15a2 2 0 0 1-.52-.38z' },
  { type: 'overfly', label: 'Overfly', cls: 'o', path: 'M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z' },
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
