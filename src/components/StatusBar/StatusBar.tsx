import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useConnectionStore } from '../../stores/connectionStore'
import { useFlightStore } from '../../stores/flightStore'
import { useUIStore, type StatusPanel } from '../../stores/uiStore'
import { getAppVersion } from '../../platform/desktop'
import { LinkCodePill } from './LinkCodePill'
import { StatusBarMenu } from './StatusBarMenu'
import { StationsPanel } from './StationsPanel'
import { NearbyPanel } from './NearbyPanel'
import { AddStripPanel } from './AddStripPanel'
import { FiltersPanel } from './FiltersPanel'
import { LinkPanel } from './LinkPanel'

const TOOLS: Array<{ id: StatusPanel; label: string; icon: ReactNode }> = [
  {
    id: 'stations',
    label: 'Stations',
    icon: <path d="M3 12a9 9 0 0 1 18 0M6.5 12a5.5 5.5 0 0 1 11 0M12 12v8M9 20h6" />,
  },
  {
    id: 'nearby',
    label: 'Nearby',
    icon: (
      <>
        <circle cx="12" cy="12" r="2" />
        <path d="M12 3v3M12 18v3M3 12h3M18 12h3" />
        <circle cx="12" cy="12" r="8" />
      </>
    ),
  },
  { id: 'add', label: 'Add strip', icon: <path d="M12 5v14M5 12h14" /> },
  { id: 'filters', label: 'Filters', icon: <path d="M3 5h18l-7 8v6l-4-2v-4z" /> },
]

export function StatusBar() {
  const isConnected = useConnectionStore((s) => s.isConnected)
  const isPaired = useConnectionStore((s) => s.isPaired)
  const controllerCallsign = useConnectionStore((s) => s.controllerCallsign)
  const statusPanel = useUIStore((s) => s.statusPanel)
  const togglePanel = useUIStore((s) => s.toggleStatusPanel)
  const closePanel = useUIStore((s) => s.closeStatusPanel)
  const items = useUIStore((s) => s.statusItems)
  const [menuAt, setMenuAt] = useState<{ x: number; y: number } | null>(null)
  const nearbyCount = useFlightStore((s) => s.nearbyCallsigns.length)
  const [version, setVersion] = useState('')
  const barRef = useRef<HTMLElement>(null)

  useEffect(() => {
    getAppVersion().then(setVersion).catch(() => setVersion(''))
  }, [])

  useEffect(() => {
    if (!statusPanel) return
    const onDown = (e: MouseEvent) => {
      if (!barRef.current?.contains(e.target as Node)) closePanel()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closePanel()
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [statusPanel, closePanel])

  const statusClass = isPaired ? 'paired' : isConnected ? 'online' : 'offline'
  const statusText = isPaired ? 'PLUGIN LINKED' : isConnected ? 'WAITING FOR PLUGIN' : 'GATEWAY OFFLINE'
  const statusHint = isPaired
    ? 'Gateway reachable and the EuroScope plugin is connected'
    : isConnected
      ? 'Gateway reachable, but the EuroScope plugin is not connected to this link code'
      : 'Cannot reach the gateway. Retrying automatically'

  const renderPanel = (id: StatusPanel) => {
    switch (id) {
      case 'stations':
        return <StationsPanel onDone={closePanel} />
      case 'nearby':
        return <NearbyPanel onDone={closePanel} />
      case 'add':
        return <AddStripPanel onDone={closePanel} />
      case 'filters':
        return <FiltersPanel />
      case 'link':
        return <LinkPanel onDone={closePanel} />
    }
  }

  return (
    <footer
      className="sbar"
      aria-label="Status bar"
      ref={barRef}
      onContextMenu={(e) => {
        e.preventDefault()
        closePanel()
        setMenuAt({ x: e.clientX, y: e.clientY })
      }}
    >
      <div className="sbg">
        {TOOLS.filter((tool) => items[tool.id]).map((tool) => (
          <div className="sbw" key={tool.id}>
            <button
              className={`sbi${statusPanel === tool.id ? ' on' : ''}`}
              aria-haspopup="dialog"
              aria-expanded={statusPanel === tool.id}
              onClick={() => togglePanel(tool.id)}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                {tool.icon}
              </svg>
              <span className="lbl">{tool.label}</span>
              {tool.id === 'nearby' && nearbyCount > 0 && <em>{nearbyCount}</em>}
            </button>
            {statusPanel === tool.id && renderPanel(tool.id)}
          </div>
        ))}
      </div>
      <div className="sbg r">
        <span id="wsStatus" className="sbi sbs" title={statusHint}>
          <i className={statusClass} />
          {statusText}
        </span>
        {items.link && <LinkCodePill />}
        {items.position && controllerCallsign && (
          <span className="sbi sbs opt3">
            <b>{controllerCallsign.split('_').join(' ')}</b>
          </span>
        )}
        {items.version && version && <span className="sbi sbs opt1">v{version}</span>}
      </div>
      {statusPanel === 'link' && renderPanel('link')}
      {menuAt && <StatusBarMenu x={menuAt.x} y={menuAt.y} onClose={() => setMenuAt(null)} />}
    </footer>
  )
}
