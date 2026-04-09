import { createPortal } from 'react-dom'
import { useEffect, useRef, useState } from 'react'
import { usePanelContextMenuStore } from '../../stores/panelContextMenuStore'
import { usePanelStore } from '../../stores/panelStore'
import { useFlightStore } from '../../stores/flightStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { useConnectionStore } from '../../stores/connectionStore'
import { apiFetch } from '../../utils/api'
import type { StripType } from '../../types'

function getLinkCode() {
  return useSettingsStore.getState().settings.linkCode
}

function positionSafely(el: HTMLElement, x: number, y: number) {
  requestAnimationFrame(() => {
    const { innerWidth, innerHeight } = window
    const rect = el.getBoundingClientRect()
    const left = Math.max(8, x + rect.width > innerWidth ? innerWidth - rect.width - 8 : x)
    const top = Math.max(8, y + rect.height > innerHeight ? innerHeight - rect.height - 8 : y)
    el.style.left = `${left}px`
    el.style.top = `${top}px`
    el.style.visibility = 'visible'
  })
}

function MenuItem({
  icon,
  label,
  sublabel,
  onClick,
  variant = 'default',
  chevron = false,
}: {
  icon: string
  label: string
  sublabel?: string
  onClick: () => void
  variant?: 'default' | 'success' | 'danger'
  chevron?: boolean
}) {
  return (
    <div className={`menu-item menu-item-${variant}`} onClick={onClick}>
      <span className="material-icons menu-item-icon">{icon}</span>
      <div className="menu-item-content">
        <span className="menu-item-label">{label}</span>
        {sublabel && <span className="menu-item-sublabel">{sublabel}</span>}
      </div>
      {chevron && <span className="material-icons menu-item-arrow">chevron_right</span>}
    </div>
  )
}

function MenuSection({ label, icon }: { label: string; icon?: string }) {
  return (
    <div className="menu-section">
      {icon && <span className="material-icons">{icon}</span>}
      {label}
    </div>
  )
}

function BackButton({ onBack }: { onBack: () => void }) {
  return (
    <div className="menu-back-btn" onClick={onBack}>
      <span className="material-icons">arrow_back</span>Back
    </div>
  )
}

const STRIP_TYPES: Array<{ type: StripType; label: string; icon: string }> = [
  { type: 'departure', label: 'Departure', icon: 'flight_takeoff' },
  { type: 'arrival',   label: 'Arrival',   icon: 'flight_land'    },
  { type: 'overfly',   label: 'Overfly',   icon: 'airplanemode_active' },
]

function AddStripView({
  panelName,
  onBack,
  onClose,
}: {
  panelName: string
  onBack: () => void
  onClose: () => void
}) {
  const handleAdd = (type: StripType) => {
    const id = `manual-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    const values: Record<string, string> = {}
    usePanelStore.getState().addStrip(panelName, {
      id,
      type,
      values,
      euroscope: false,
      flightPlan: null,
      lastUpdate: Date.now(),
    })
    onClose()
  }

  return (
    <div className="menu-scroll-container">
      <BackButton onBack={onBack} />
      <div className="type-cards">
        {STRIP_TYPES.map(({ type, label, icon }) => (
          <div key={type} className={`type-card type-card-${type}`} onClick={() => handleAdd(type)}>
            <span className="material-icons type-card-icon">{icon}</span>
            <span className="type-card-label">{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function AssumeView({
  panelName,
  onBack,
  onClose,
}: {
  panelName: string
  onBack: () => void
  onClose: () => void
}) {
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

  const filtered = callsigns
    .filter((c) => c.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => a.localeCompare(b))

  const handleAssume = async (callsign: string) => {
    const res = await apiFetch('/api/assume-aircraft', {
      method: 'POST',
      body: JSON.stringify({ code: getLinkCode(), callsign, panel: panelName }),
    })
    if (res.ok) {
      onClose()
    }
  }

  const showLoading = requested && callsigns.length === 0
  const showEmpty = requested && callsigns.length > 0 && filtered.length === 0

  return (
    <div className="menu-scroll-container">
      <BackButton onBack={onBack} />
      {callsigns.length > 0 && (
        <div className="search-wrapper">
          <span className="material-icons search-icon">search</span>
          <input
            className="procedure-search"
            type="text"
            placeholder="Search callsign…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onMouseDown={(e) => e.stopPropagation()}
            autoFocus
          />
        </div>
      )}
      {showLoading && (
        <div className="transfer-status">
          <span className="material-icons" style={{ fontSize: '1rem', opacity: 0.5 }}>radar</span>
          Searching for nearby aircraft…
        </div>
      )}
      {showEmpty && (
        <div className="transfer-status">No matches</div>
      )}
      <div className="transfer-list">
        {filtered.map((cs) => (
          <div key={cs} className="atc-btn" onClick={() => handleAssume(cs)}>
            <span className="material-icons atc-icon">airplanemode_active</span>
            <span className="atc-callsign">{cs}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

type View = 'main' | 'addstrip' | 'assume'

function MainView({
  panelName,
  setView,
}: {
  panelName: string
  setView: (v: View) => void
}) {
  return (
    <div className="menu-scroll-container">
      <MenuSection label="Panel" icon="dashboard" />
      <MenuItem icon="add" label="Add Strip Manually" onClick={() => setView('addstrip')} chevron />
      <MenuItem
        icon="connecting_airports"
        label="Assume Aircraft"
        sublabel="Add untracked flight"
        onClick={() => setView('assume')}
        chevron
      />
    </div>
  )
}

export function PanelContextMenu() {
  const { visible, x, y, panelName, hide } = usePanelContextMenuStore()
  const menuRef = useRef<HTMLDivElement>(null)
  const [view, setView] = useState<View>('main')

  useEffect(() => {
    if (visible) setView('main')
  }, [visible, panelName])

  useEffect(() => {
    if (visible && menuRef.current) {
      positionSafely(menuRef.current, x, y)
    }
  }, [visible, x, y, view])

  useEffect(() => {
    if (!visible) return
    const handler = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) hide()
    }
    document.addEventListener('mousedown', handler, true)
    return () => document.removeEventListener('mousedown', handler, true)
  }, [visible, hide])

  if (!visible || !panelName) return null

  const renderView = () => {
    switch (view) {
      case 'addstrip':
        return (
          <AddStripView
            panelName={panelName}
            onBack={() => setView('main')}
            onClose={hide}
          />
        )
      case 'assume':
        return (
          <AssumeView
            panelName={panelName}
            onBack={() => setView('main')}
            onClose={hide}
          />
        )
      default:
        return <MainView panelName={panelName} setView={setView} />
    }
  }

  return createPortal(
    <div
      ref={menuRef}
      className="strip-context-menu"
      style={{ position: 'fixed', left: x, top: y, visibility: 'hidden' }}
      onWheel={(e) => e.stopPropagation()}
    >
      {renderView()}
    </div>,
    document.body,
  )
}
