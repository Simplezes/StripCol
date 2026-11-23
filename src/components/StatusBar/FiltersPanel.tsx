import { usePanelStore } from '../../stores/panelStore'
import { useUIStore, type TrafficFilters } from '../../stores/uiStore'

const ROWS: Array<{ type: keyof TrafficFilters; label: string; cls: string }> = [
  { type: 'departure', label: 'Departures', cls: 'd' },
  { type: 'arrival', label: 'Arrivals', cls: 'a' },
  { type: 'overfly', label: 'Overfly', cls: 'o' },
]

export function FiltersPanel() {
  const filters = useUIStore((s) => s.trafficFilters)
  const toggle = useUIStore((s) => s.toggleTraffic)
  const reset = useUIStore((s) => s.resetTraffic)
  const panels = usePanelStore((s) => s.panels)
  const strips = panels.flatMap((p) => p.strips)

  const countOf = (type: keyof TrafficFilters) => strips.filter((st) => st.type === type).length
  const total = ROWS.reduce((n, r) => n + countOf(r.type), 0)
  const shown = ROWS.reduce((n, r) => n + (filters[r.type] ? countOf(r.type) : 0), 0)

  return (
    <div className="pop" role="dialog" aria-label="Filters">
      <div className="rph">
        <h2>Filters</h2>
        <button className="rclr" onClick={reset}>
          Reset
        </button>
      </div>
      <p className="rsub">
        Showing <b>{shown}</b> of {total} strips.
      </p>
      <div className="rlab">Traffic</div>
      <div className="fgrid">
        {ROWS.map(({ type, label, cls }) => (
          <button
            key={type}
            className={`fch ${cls}${filters[type] ? ' on' : ''}`}
            aria-pressed={filters[type]}
            onClick={() => toggle(type)}
          >
            <u />
            {label}
            <i>{countOf(type)}</i>
          </button>
        ))}
      </div>
    </div>
  )
}
