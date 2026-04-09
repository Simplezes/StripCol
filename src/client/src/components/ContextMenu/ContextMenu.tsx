import { createPortal } from 'react-dom'
import { useEffect, useRef, useState } from 'react'
import { useContextMenuStore } from '../../stores/contextMenuStore'
import { usePanelStore } from '../../stores/panelStore'
import { useAssetsStore } from '../../stores/assetsStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { apiFetch } from '../../utils/api'
import {
  deleteStripByCallsign,
  renderAircraftAsStrip,
} from '../../utils/stripActions'
import { buildInitialValues } from '../../utils/stripValues'
import { useConnectionStore } from '../../stores/connectionStore'
import type { FlightPlan, StripType } from '../../types'

type MenuView =
  | { type: 'main' }
  | { type: 'route' }
  | { type: 'typemenu' }
  | { type: 'transfer' }
  | { type: 'flightinfo' }
  | { type: 'procedure'; airport: string; procType: 'SID' | 'STAR' }

function getLinkCode() {
  return useSettingsStore.getState().settings.linkCode
}

function positionSafely(el: HTMLElement, x: number, y: number) {
  requestAnimationFrame(() => {
    const { innerWidth, innerHeight } = window
    const rect = el.getBoundingClientRect()
    let left = x
    let top = y
    if (x + rect.width > innerWidth) left = innerWidth - rect.width - 8
    if (y + rect.height > innerHeight) top = innerHeight - rect.height - 8
    el.style.left = `${Math.max(8, left)}px`
    el.style.top = `${Math.max(8, top)}px`
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
      <span className="menu-item-content">
        <span className="menu-item-label">{label}</span>
        {sublabel && <span className="menu-item-sublabel">{sublabel}</span>}
      </span>
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
      <span className="material-icons">arrow_back</span>
      Back
    </div>
  )
}

function getRouteWordClass(word: string): string {
  const w = word.toUpperCase().split('/')[0]
  if (w === 'DCT') return 'point-dct'
  if (/^(RWY|RW|R)\d+[LR]?$/i.test(w) || /^\d+[LR]$/i.test(w)) return 'point-rwy'
  if (/^[A-Z]{3}$/i.test(w)) return 'point-vor'
  if (/^[A-Z]{5}$/i.test(w)) return 'point-fix'
  if (/^[A-Z]+\d+$/i.test(w) && w.length <= 6) return 'point-awy'
  if (/^(?=.*[A-Z])(?=.*\d)[A-Z0-9]{3,}$/i.test(w)) return 'point-proc'
  return 'point-unk'
}

function RouteView({ flight, onBack }: { flight: FlightPlan; onBack: () => void }) {
  const words = (flight.route ?? '').trim().split(/\s+/).filter(Boolean)
  return (
    <div>
      <div className="menu-header">
        <div className="menu-header-top">
          <span className="menu-callsign">{flight.callsign}</span>
          <span className="menu-type-pill menu-type-pill-route">Route</span>
        </div>
        <div className="menu-header-route">
          <span>{flight.departure || '???'}</span>
          <span className="material-icons">arrow_forward</span>
          <span>{flight.arrival || '???'}</span>
          {flight.aircraftType && <span className="menu-actype">· {flight.aircraftType}</span>}
        </div>
      </div>
      <BackButton onBack={onBack} />
      <div className="menu-scroll-container">
        <div className="route-text-flow">
          {words.length === 0 && (
            <span className="route-empty">No route filed</span>
          )}
          {words.map((word, i) => {
            const parts = word.includes('/') ? word.split('/', 2) : null
            return parts ? (
              <span key={i} className="route-word">
                <span className={getRouteWordClass(parts[0])}>{parts[0]}</span>
                <span className="word-extra">/{parts[1]}</span>
              </span>
            ) : (
              <span key={i} className={`route-word ${getRouteWordClass(word)}`}>
                {word}
              </span>
            )
          })}
        </div>
      </div>
    </div>
  )
}

const TYPE_OPTIONS: Array<{ value: StripType; label: string; icon: string; color: string }> = [
  { value: 'departure', label: 'Departure', icon: 'flight_takeoff', color: 'var(--strip-departure)' },
  { value: 'arrival', label: 'Arrival', icon: 'flight_land', color: 'var(--strip-arrival)' },
  { value: 'overfly', label: 'Overfly', icon: 'airplanemode_active', color: 'var(--strip-overfly)' },
]

function TypeView({
  stripId,
  panelName,
  currentType,
  flight,
  onBack,
  onClose,
}: {
  stripId: string
  panelName: string
  currentType: StripType
  flight: FlightPlan | null
  onBack: () => void
  onClose: () => void
}) {
  const handleSelect = (newType: StripType) => {
    if (newType === currentType) return
    const { controllerMode } = useConnectionStore.getState()
    const values = flight
      ? buildInitialValues(flight, newType, controllerMode)
      : {}
    usePanelStore.getState().updateStrip(panelName, stripId, { type: newType, values })
    onClose()
  }

  return (
    <div className="proc-picker">
      <BackButton onBack={onBack} />
      <div className="proc-context-bar">
        <span className="material-icons">swap_vert</span>
        Change strip type
      </div>
      <div className="type-cards">
        {TYPE_OPTIONS.map((opt) => {
          const isActive = currentType === opt.value
          return (
            <div
              key={opt.value}
              className={`type-card type-card-${opt.value}${isActive ? ' type-card-active' : ''}`}
              onClick={() => handleSelect(opt.value)}
            >
              <span className="material-icons type-card-icon">{opt.icon}</span>
              <span className="type-card-label">{opt.label}</span>
              {isActive && <span className="material-icons type-card-check">check_circle</span>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

interface ATCEntry {
  callsign: string
  frequency: string
  expandedCallsign: string
}

const SUFFIX_ORDER = ['_CTR', '_APP', '_TWR', '_GND', '_DEL']
const SUFFIX_LABELS: Record<string, { label: string; icon: string }> = {
  _CTR: { label: 'Center', icon: 'public' },
  _APP: { label: 'Approach', icon: 'flight_land' },
  _TWR: { label: 'Tower', icon: 'flight_takeoff' },
  _GND: { label: 'Ground', icon: 'directions_car' },
  _DEL: { label: 'Delivery', icon: 'call' },
}

function TransferView({
  flight,
  onBack,
  onClose,
}: {
  flight: FlightPlan
  onBack: () => void
  onClose: () => void
}) {
  const [atcList, setAtcList] = useState<ATCEntry[] | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    apiFetch(`/api/ATC-list?code=${getLinkCode()}`)
      .then((r) => r.json())
      .then((data: ATCEntry[]) => {
        const cleaned = data
          .filter((atc) => atc.frequency && atc.frequency !== 'N/A')
          .map((atc) => ({
            ...atc,
            frequency: !isNaN(Number(atc.frequency))
              ? parseFloat(atc.frequency).toFixed(3)
              : atc.frequency,
            expandedCallsign: atc.callsign.split('_').join(' '),
          }))
          .sort((a, b) => {
            const ai = SUFFIX_ORDER.findIndex((s) => a.callsign.endsWith(s))
            const bi = SUFFIX_ORDER.findIndex((s) => b.callsign.endsWith(s))
            return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
          })
        setAtcList(cleaned)
      })
      .catch(() => setError(true))
  }, [])

  const handleTransfer = async (targetCallsign: string) => {
    await apiFetch('/api/ATC-transfer', {
      method: 'POST',
      body: JSON.stringify({
        code: getLinkCode(),
        callsign: flight.callsign,
        targetATC: targetCallsign,
      }),
    })
    onClose()
  }

  const handleUnicom = async () => {
    const res = await apiFetch('/api/end-tracking', {
      method: 'POST',
      body: JSON.stringify({ code: getLinkCode(), callsign: flight.callsign }),
    })
    if (res.ok) deleteStripByCallsign(flight.callsign)
    onClose()
  }

  return (
    <div>
      <div className="proc-context-bar">
        <span className="material-icons">compare_arrows</span>
        Transfer — {flight.callsign}
      </div>
      <BackButton onBack={onBack} />
      <div className="menu-scroll-container transfer-list">
        {error && (
          <div className="transfer-status transfer-error">
            <span className="material-icons">error_outline</span>
            Failed to load ATC stations
          </div>
        )}
        {!atcList && !error && (
          <div className="transfer-status">Loading…</div>
        )}
        {atcList && (
          <>
            {SUFFIX_ORDER.map((suffix) => {
              const group = atcList.filter((a) => a.callsign.endsWith(suffix))
              if (!group.length) return null
              const { label, icon } = SUFFIX_LABELS[suffix]
              return (
                <div key={suffix}>
                  <MenuSection label={label} />
                  {group.map((atc) => (
                    <div
                      key={atc.callsign}
                      className="atc-btn"
                      onClick={() => handleTransfer(atc.callsign)}
                    >
                      <span className="material-icons atc-icon">{icon}</span>
                      <span className="atc-callsign">{atc.expandedCallsign}</span>
                      <span className="atc-frequency">{atc.frequency}</span>
                    </div>
                  ))}
                </div>
              )
            })}
            <MenuSection label="UNICOM" />
            <div className="atc-btn" onClick={handleUnicom}>
              <span className="material-icons atc-icon">radio</span>
              <span className="atc-callsign">UNICOM</span>
              <span className="atc-frequency">122.800</span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

type ProceduresJson = Record<string, Record<string, Record<string, unknown>>>

const KNOWN_APPROACH_TYPES = ['ILS', 'RNAV', 'VORDME', 'LOC']

interface ProcGroup {
  baseName: string
  base: string | null
  transitions: string[]
}

function groupProcedures(procMap: Record<string, unknown>): ProcGroup[] {
  const groups: Record<string, ProcGroup> = {}
  for (const key of Object.keys(procMap).sort()) {
    const xIdx = key.indexOf('x')
    const baseName = xIdx === -1 ? key : key.slice(0, xIdx)
    if (!groups[baseName]) groups[baseName] = { baseName, base: null, transitions: [] }
    if (xIdx === -1) groups[baseName].base = key
    else groups[baseName].transitions.push(key)
  }
  return Object.values(groups).sort((a, b) => a.baseName.localeCompare(b.baseName))
}

function detectApproachTypes(procMap: Record<string, unknown>): string[] {
  const found = new Set<string>()
  for (const name of Object.keys(procMap)) {
    const upper = name.toUpperCase()
    for (const t of KNOWN_APPROACH_TYPES) {
      if (new RegExp(`(?:^|x)${t}(?:x|$)`, 'i').test(upper)) found.add(t)
    }
  }
  return Array.from(found)
}

async function applyProcedure(
  stripId: string,
  panelName: string,
  procType: 'SID' | 'STAR',
  runway: string,
  procName: string,
  onClose: () => void,
) {
  const strip = usePanelStore.getState().getStrip(stripId)
  if (!strip) { onClose(); return }

  const code = useSettingsStore.getState().settings.linkCode
  const callsign = strip.flightPlan?.callsign
  const { controllerMode } = useConnectionStore.getState()
  const normalizedRunway = runway.trim().toUpperCase()
  const normalizedProcName = procName.split('/')[0].trim().toUpperCase()

  let runwayKey: string | null = null
  if (procType === 'STAR' || controllerMode === 'approach' || controllerMode === 'center') {
    runwayKey = 'c18'
  } else if (procType === 'SID' && controllerMode === 'aerodrome') {
    runwayKey = 'c16'
  }

  if (code && callsign) {
    const fieldName = procType === 'STAR' ? 'star' : 'sid'
    const endpoint = procType === 'STAR' ? '/api/set-star' : '/api/set-sid'
    try {
      const res = await apiFetch(endpoint, {
        method: 'POST',
        body: JSON.stringify({ code, callsign, runway: normalizedRunway, [fieldName]: normalizedProcName }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
    } catch (err) {
      console.error(`Failed to set ${procType}:`, err)
      return
    }
  }

  const clearedNotifPoints: Record<string, string> = {}
  for (let i = 19; i <= 27; i++) clearedNotifPoints[`c${i}`] = ''

  usePanelStore.getState().updateStrip(panelName, stripId, {
    values: {
      ...strip.values,
      ...clearedNotifPoints,
      c8: normalizedProcName,
      ...(runwayKey ? { [runwayKey]: normalizedRunway } : {}),
    },
    ...(strip.flightPlan
      ? {
        flightPlan: {
          ...strip.flightPlan,
          ...(procType === 'STAR'
            ? { star: normalizedProcName, arrivalRwy: normalizedRunway }
            : { sid: normalizedProcName, departureRwy: normalizedRunway }),
        },
      }
      : {}),
  })
  onClose()
}

const APPROACH_META: Record<string, { icon: string; color: string; label: string }> = {
  ILS: { icon: 'sensors', color: 'var(--atm-blue)', label: 'ILS' },
  RNAV: { icon: 'satellite_alt', color: 'var(--atm-green)', label: 'RNAV' },
  VORDME: { icon: 'radar', color: 'var(--atm-amber)', label: 'VOR/DME' },
  LOC: { icon: 'navigation', color: 'var(--atm-steel)', label: 'LOC' },
}

function TransitionsView({
  group,
  runway,
  procType,
  stripId,
  panelName,
  onBack,
  onClose,
}: {
  group: ProcGroup
  runway: string
  procType: 'SID' | 'STAR'
  stripId: string
  panelName: string
  onBack: () => void
  onClose: () => void
}) {
  return (
    <div className="proc-picker">
      <BackButton onBack={onBack} />
      <div className="proc-context-bar">
        <span className="material-icons">rule</span>
        <span>{group.baseName}</span>
        <span className="proc-context-rwy">RWY {runway}</span>
      </div>
      <div className="proc-picker-list">
        {group.base && (
          <div
            className="proc-trans-item proc-trans-base"
            onClick={() => applyProcedure(stripId, panelName, procType, runway, group.base!, onClose)}
          >
            <div className="proc-trans-name">
              <span className="material-icons proc-trans-dot">radio_button_checked</span>
              {group.base}
            </div>
            <span className="proc-item-tag proc-item-tag-default">Direct</span>
          </div>
        )}
        {[...group.transitions].sort().map((key) => {
          const via = key.slice(key.indexOf('x') + 1)
          return (
            <div
              key={key}
              className="proc-trans-item"
              onClick={() => applyProcedure(stripId, panelName, procType, runway, key, onClose)}
            >
              <div className="proc-trans-name">
                <span className="material-icons proc-trans-dot">radio_button_unchecked</span>
                {group.baseName}
              </div>
              <span className="proc-trans-via">via <strong>{via}</strong></span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ProcedureListView({
  procMap,
  runway,
  procType,
  stripId,
  panelName,
  onBack,
  onClose,
}: {
  procMap: Record<string, unknown>
  runway: string
  procType: 'SID' | 'STAR'
  stripId: string
  panelName: string
  onBack: () => void
  onClose: () => void
}) {
  const [search, setSearch] = useState('')
  const [selectedGroup, setSelectedGroup] = useState<ProcGroup | null>(null)

  if (selectedGroup) {
    return (
      <TransitionsView
        group={selectedGroup}
        runway={runway}
        procType={procType}
        stripId={stripId}
        panelName={panelName}
        onBack={() => setSelectedGroup(null)}
        onClose={onClose}
      />
    )
  }

  const groups = groupProcedures(procMap)
  const query = search.trim().toLowerCase()
  const filtered = query
    ? groups.filter((g) => g.baseName.toLowerCase().includes(query))
    : groups

  return (
    <div className="proc-picker">
      <BackButton onBack={onBack} />
      <div className="proc-context-bar">
        <span className="material-icons">turn_right</span>
        <span>RWY {runway}</span>
        <span className="proc-context-count">{groups.length} procedures</span>
      </div>
      <div className="search-wrapper proc-search-wrapper">
        <span className="material-icons search-icon">search</span>
        <input
          className="procedure-search"
          placeholder={`Search ${procType}…`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onMouseDown={(e) => e.stopPropagation()}
          autoFocus
        />
        {search && (
          <span
            className="material-icons proc-search-clear"
            onMouseDown={(e) => { e.preventDefault(); setSearch('') }}
          >close</span>
        )}
      </div>
      <div className="proc-picker-list">
        {filtered.length === 0 && (
          <div className="proc-picker-empty">No results for "{search}"</div>
        )}
        {filtered.map((g) => {
          const hasTransitions = g.transitions.length > 0
          return (
            <div
              key={g.baseName}
              className={`proc-item${!hasTransitions && g.base ? ' proc-item-base' : ''}`}
              onClick={() => {
                if (hasTransitions) setSelectedGroup(g)
                else if (g.base) applyProcedure(stripId, panelName, procType, runway, g.base, onClose)
              }}
            >
              <span className="proc-item-name">{g.baseName}</span>
              <div className="proc-item-right">
                {hasTransitions && (
                  <span className="proc-item-tag">
                    {g.transitions.length} via
                  </span>
                )}
                <span className="material-icons proc-item-chevron">
                  {hasTransitions ? 'chevron_right' : 'check'}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ApproachTypeView({
  procMap,
  runway,
  stripId,
  panelName,
  onBack,
  onClose,
}: {
  procMap: Record<string, unknown>
  runway: string
  stripId: string
  panelName: string
  onBack: () => void
  onClose: () => void
}) {
  const [selectedType, setSelectedType] = useState<string | null>(null)

  if (selectedType !== null) {
    const knownRegex = (t: string) => new RegExp(`(?:^|x)${t}(?:x|$)`, 'i')
    const filtered: Record<string, unknown> =
      selectedType === 'ALL'
        ? procMap
        : Object.fromEntries(
          Object.entries(procMap).filter(([name]) => knownRegex(selectedType).test(name)),
        )
    return (
      <ProcedureListView
        procMap={filtered}
        runway={runway}
        procType="STAR"
        stripId={stripId}
        panelName={panelName}
        onBack={() => setSelectedType(null)}
        onClose={onClose}
      />
    )
  }

  const types = detectApproachTypes(procMap)
  const totalCount = Object.keys(procMap).length

  return (
    <div className="proc-picker">
      <BackButton onBack={onBack} />
      <div className="proc-context-bar">
        <span className="material-icons">flight_land</span>
        <span>RWY {runway}</span>
        <span className="proc-context-rwy">Approach type</span>
      </div>
      <div className="proc-picker-list proc-appr-list">
        <div
          className="proc-appr-all"
          onClick={() => setSelectedType('ALL')}
        >
          <span className="material-icons">apps</span>
          <span className="proc-appr-label">All STARs</span>
          <span className="proc-appr-count">{totalCount}</span>
        </div>
        {types.map((t) => {
          const meta = APPROACH_META[t] ?? { icon: 'flight_land', color: 'var(--sys-text-dim)', label: t }
          const count = Object.keys(procMap).filter((name) =>
            new RegExp(`(?:^|x)${t}(?:x|$)`, 'i').test(name),
          ).length
          return (
            <div
              key={t}
              className="proc-appr-btn"
              style={{ '--appr-color': meta.color } as React.CSSProperties}
              onClick={() => setSelectedType(t)}
            >
              <span className="material-icons proc-appr-icon">{meta.icon}</span>
              <span className="proc-appr-label">{meta.label}</span>
              <span className="proc-appr-count">{count}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ProcedurePicker({
  airport,
  procType,
  stripId,
  panelName,
  onBack,
  onClose,
}: {
  airport: string
  procType: 'SID' | 'STAR'
  stripId: string
  panelName: string
  onBack: () => void
  onClose: () => void
}) {
  const [selectedRunway, setSelectedRunway] = useState<string | null>(null)
  const procedures = useAssetsStore.getState().procedures as Record<string, ProceduresJson>
  const airportData = procedures?.[airport]?.[procType]

  if (!airportData) {
    return (
      <div className="proc-picker">
        <BackButton onBack={onBack} />
        <div className="proc-picker-empty">No {procType} found for {airport}</div>
      </div>
    )
  }

  if (selectedRunway !== null) {
    const procMap = airportData[selectedRunway] as Record<string, unknown> ?? {}
    if (procType === 'STAR') {
      return (
        <ApproachTypeView
          procMap={procMap}
          runway={selectedRunway}
          stripId={stripId}
          panelName={panelName}
          onBack={() => setSelectedRunway(null)}
          onClose={onClose}
        />
      )
    }
    return (
      <ProcedureListView
        procMap={procMap}
        runway={selectedRunway}
        procType={procType}
        stripId={stripId}
        panelName={panelName}
        onBack={() => setSelectedRunway(null)}
        onClose={onClose}
      />
    )
  }

  const procedureIcon = procType === 'SID' ? 'flight_takeoff' : 'flight_land'
  const runways = Object.keys(airportData).sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }),
  )

  return (
    <div className="proc-picker">
      <div className="proc-picker-hero">
        <div className="proc-picker-hero-airport">{airport}</div>
        <span className={`proc-type-badge proc-type-${procType.toLowerCase()}`}>
          <span className="material-icons">{procedureIcon}</span>
          {procType}
        </span>
      </div>
      <div className="proc-context-bar proc-context-bar-top">
        <span className="material-icons">connecting_airports</span>
        Select runway
      </div>
      <div className="proc-rwy-grid">
        {runways.map((rwy) => {
          const count = Object.keys(airportData[rwy] as Record<string, unknown>).length
          return (
            <div key={rwy} className="proc-rwy-card" onClick={() => setSelectedRunway(rwy)}>
              <span className="proc-rwy-num">{rwy}</span>
              <span className="proc-rwy-count">{count}</span>
            </div>
          )
        })}
      </div>
      <div className="proc-picker-footer">
        <span className="material-icons">arrow_back</span>
        <span onClick={onBack} style={{ cursor: 'pointer' }}>Back to menu</span>
      </div>
    </div>
  )
}

const PLAN_TYPE_LABELS: Record<string, string> = { I: 'IFR', V: 'VFR', Y: 'IFR → VFR', Z: 'VFR → IFR' }
const ENGINE_TYPE_LABELS: Record<string, string> = { J: 'Jet', T: 'Turboprop', P: 'Piston', E: 'Electric', M: 'Mixed' }
const COMM_TYPE_LABELS: Record<string, string> = { v: 'Voice', t: 'Text', r: 'Receive only' }

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value && value !== '0') return null
  return (
    <div className="finfo-row">
      <span className="finfo-label">{label}</span>
      <span className="finfo-value">{value}</span>
    </div>
  )
}

function InfoSection({ label }: { label: string }) {
  return <div className="finfo-section">{label}</div>
}

function FlightInfoView({ flight, onBack }: { flight: FlightPlan; onBack: () => void }) {
  const enroute =
    flight.enrouteHours || flight.enrouteMinutes
      ? `${flight.enrouteHours ?? '0'}h ${flight.enrouteMinutes ?? '0'}m`
      : null
  const fuel =
    flight.fuelHours || flight.fuelMinutes
      ? `${flight.fuelHours ?? '0'}h ${flight.fuelMinutes ?? '0'}m`
      : null
  const engines =
    flight.engineNumber != null && flight.engineType
      ? `${flight.engineNumber}× ${ENGINE_TYPE_LABELS[flight.engineType] ?? flight.engineType}`
      : null
  const commType = flight.communicationType
    ? (COMM_TYPE_LABELS[flight.communicationType] ?? flight.communicationType)
    : null
  const annotations = (flight.flightStripAnnotations ?? []).filter(Boolean)

  return (
    <div className="finfo-container">
      <div className="menu-header">
        <div className="menu-header-top">
          <span className="menu-callsign">{flight.callsign}</span>
          <span className="menu-type-pill menu-type-pill-route">Details</span>
        </div>
        <div className="menu-header-route">
          <span>{flight.departure || '???'}</span>
          <span className="material-icons">arrow_forward</span>
          <span>{flight.arrival || '???'}</span>
          {flight.aircraftType && <span className="menu-actype">· {flight.aircraftType}</span>}
        </div>
      </div>
      <BackButton onBack={onBack} />
      <div className="finfo-scroll">
        <InfoSection label="General" />
        <InfoRow label="Plan type" value={PLAN_TYPE_LABELS[flight.planType ?? ''] ?? flight.planType as string} />
        <InfoRow label="WTC" value={flight.wtc as string} />
        <InfoRow label="Comm" value={commType} />
        <InfoRow label="RVSM" value={flight.rvsm ? 'Yes' : flight.rvsm === false ? 'No' : null} />
        <InfoRow label="Ground state" value={flight.groundState as string} />
        <InfoRow label="Scratch pad" value={flight.scratchPad as string} />

        <InfoSection label="Aircraft" />
        <InfoRow label="Equipment" value={flight.aircraftInfo as string} />
        <InfoRow label="Engines" value={engines} />
        <InfoRow label="Capabilities" value={flight.capabilities && flight.capabilities !== '\u0000' ? flight.capabilities as string : null} />

        <InfoSection label="Route" />
        <InfoRow label="Alternate" value={flight.alternate as string} />
        <InfoRow label="Entry point" value={flight.entryPoint as string} />
        <InfoRow label="Exit point" value={flight.exitPoint as string} />
        <InfoRow label="Direct to" value={flight.directTo as string} />
        <InfoRow label="Next COPX" value={flight.nextCopxPoint as string} />
        <InfoRow label="FIR COPX" value={flight.nextFirCopxPoint as string} />

        <InfoSection label="Times" />
        <InfoRow label="ETD" value={flight.estimatedDepartureTime as string} />
        <InfoRow label="ATD" value={flight.atd ? String(flight.atd) : null} />
        <InfoRow label="Enroute" value={enroute} />
        <InfoRow label="Fuel" value={fuel} />

        <InfoSection label="ATC" />
        <InfoRow label="Squawk" value={flight.squawk as string} />
        <InfoRow label="Tracking" value={flight.trackingControllerId as string} />
        <InfoRow label="Handoff to" value={flight.handoffTargetControllerId as string} />
        <InfoRow label="Assigned alt" value={flight.assignedFinalAltitude ? String(flight.assignedFinalAltitude) : null} />
        <InfoRow label="Assigned rate" value={flight.assignedRate ? String(flight.assignedRate) : null} />

        {annotations.length > 0 && <>
          <InfoSection label="Annotations" />
          {annotations.map((a, i) => (
            <InfoRow key={i} label={`#${i + 1}`} value={a} />
          ))}
        </>}
      </div>
    </div>
  )
}

function MainView({
  stripId,
  panelName,
  setView,
  onClose,
}: {
  stripId: string
  panelName: string
  setView: (v: MenuView) => void
  onClose: () => void
}) {
  const strip = usePanelStore.getState().getStrip(stripId)
  if (!strip) return null

  const { euroscope, flightPlan: fp, type } = strip
  const isTransfer = euroscope && fp?.transfer

  const handleDelete = () => {
    if (!euroscope || !fp) {
      usePanelStore.getState().removeStrip(panelName, stripId)
    } else {
      deleteStripByCallsign(fp.callsign)
    }
    onClose()
  }

  if (isTransfer && fp) {
    return (
      <div>
        <div className="menu-header menu-header-transfer">
          <div className="menu-header-top">
            <span className="menu-callsign">{fp.callsign}</span>
            <span className="menu-type-pill menu-type-pill-transfer">Handoff</span>
          </div>
          <div className="menu-header-route">
            <span>{fp.departure || '???'}</span>
            <span className="material-icons">arrow_forward</span>
            <span>{fp.arrival || '???'}</span>
            {fp.aircraftType && <span className="menu-actype">· {fp.aircraftType}</span>}
          </div>
        </div>
        <div className="menu-scroll-container">
          <div className="handoff-actions">
            <div
              className="handoff-btn handoff-accept"
              onClick={async () => {
                const res = await apiFetch('/api/accept-handoff', {
                  method: 'POST',
                  body: JSON.stringify({ code: getLinkCode(), callsign: fp.callsign }),
                })
                if (res.ok) {
                  deleteStripByCallsign(fp.callsign)
                  renderAircraftAsStrip({ ...fp, transfer: false })
                } else {
                  usePanelStore.getState().removeStrip(panelName, stripId)
                }
                onClose()
              }}
            >
              <span className="material-icons">check_circle</span>
              Accept
            </div>
            <div
              className="handoff-btn handoff-refuse"
              onClick={async () => {
                const res = await apiFetch('/api/refuse-handoff', {
                  method: 'POST',
                  body: JSON.stringify({ code: getLinkCode(), callsign: fp.callsign }),
                })
                if (res.ok) deleteStripByCallsign(fp.callsign)
                else usePanelStore.getState().removeStrip(panelName, stripId)
                onClose()
              }}
            >
              <span className="material-icons">cancel</span>
              Refuse
            </div>
          </div>
          <MenuSection label="Strip" icon="dashboard" />
          <MenuItem icon="delete" label="Remove Strip" variant="danger" onClick={handleDelete} />
        </div>
      </div>
    )
  }

  if (euroscope && fp) {
    const isCleared = (fp.clearedFlag as number) == 1
    const showProcedure = type === 'departure' || type === 'arrival'
    const depAirport = type === 'departure' ? fp.departure : fp.arrival
    const procType = type === 'departure' ? 'SID' : 'STAR'
    const currentProc = type === 'departure'
      ? (fp.sid as string | undefined)
      : (fp.star as string | undefined)
    const currentRwy = type === 'departure'
      ? (fp.departureRwy as string | undefined)
      : (fp.arrivalRwy as string | undefined)

    return (
      <div>
        <div className={`menu-header menu-header-${type}`}>
          <div className="menu-header-top">
            <span className="menu-callsign">{fp.callsign}</span>
            <span className={`menu-type-pill menu-type-pill-${type}`}>{type}</span>
          </div>
          <div className="menu-header-route">
            <span>{fp.departure || '???'}</span>
            <span className="material-icons">arrow_forward</span>
            <span>{fp.arrival || '???'}</span>
            {fp.aircraftType && <span className="menu-actype">· {fp.aircraftType}</span>}
          </div>
          {(currentProc || fp.squawk) && (
            <div className="menu-header-chips">
              {currentProc && (
                <span className={`menu-chip menu-chip-${procType.toLowerCase()}`}>
                  {currentProc}{currentRwy ? ` · RWY ${currentRwy}` : ''}
                </span>
              )}
              {fp.squawk && <span className="menu-chip">{fp.squawk as string}</span>}
            </div>
          )}
        </div>
        <div className="menu-scroll-container">
          <MenuSection label="Flight Data" icon="info" />
          <MenuItem
            icon="route"
            label="Show Route"
            sublabel={fp.route ? (fp.route as string).trim().split(/\s+/).slice(0, 4).join(' ') + '\u2026' : undefined}
            onClick={() => setView({ type: 'route' })}
            chevron
          />
          <MenuItem
            icon="info"
            label="Flight Details"
            sublabel={[fp.wtc, fp.planType ? (PLAN_TYPE_LABELS[fp.planType as string] ?? fp.planType as string) : null, fp.alternate ? `ALT ${fp.alternate as string}` : null].filter(Boolean).join(' · ') || undefined}
            onClick={() => setView({ type: 'flightinfo' })}
            chevron
          />
          {showProcedure && (
            <MenuItem
              icon={type === 'departure' ? 'flight_takeoff' : 'flight_land'}
              label={`Change ${procType}`}
              sublabel={currentProc ? `${currentProc}${currentRwy ? ` · RWY ${currentRwy}` : ''}` : 'Not assigned'}
              onClick={() => setView({ type: 'procedure', airport: depAirport, procType })}
              chevron
            />
          )}
          <MenuItem
            icon="swap_vert"
            label="Change Strip Type"
            sublabel={type.charAt(0).toUpperCase() + type.slice(1)}
            onClick={() => setView({ type: 'typemenu' })}
            chevron
          />

          <MenuSection label="ATC" icon="headset_mic" />
          {type === 'departure' && (<>
            <MenuItem
              icon={isCleared ? 'restart_alt' : 'check_circle'}
              label={isCleared ? 'Reset Clearance' : 'Issue Clearance'}
              variant={isCleared ? 'default' : 'success'}
              onClick={async () => {
                try {
                  const res = await apiFetch('/api/set-clearance', {
                    method: 'POST',
                    body: JSON.stringify({
                      code: getLinkCode(),
                      callsign: fp.callsign,
                      cleared: isCleared ? 'false' : 'true',
                    }),
                  })
                  if (res.ok) {
                    const newFlag = isCleared ? 0 : 1
                    const newC12 = newFlag === 1 ? 'Ⓑ' : ''
                    usePanelStore
                      .getState()
                      .updateStrip(panelName, stripId, {
                        flightPlan: { ...fp, clearedFlag: newFlag },
                        values: { ...strip.values, c12: newC12 },
                      })
                  }
                } catch (err) {
                  console.error('Clearance toggle failed:', err)
                }
                onClose()
              }}
            />
            <MenuItem
              icon="dialpad"
              label="Generate Squawk"
              sublabel={fp.squawk ? String(fp.squawk) : undefined}
              onClick={async () => {
                await apiFetch('/api/generate-squawk', {
                  method: 'POST',
                  body: JSON.stringify({ code: getLinkCode(), callsign: fp.callsign }),
                }).catch(console.error)
                onClose()
              }}
            />
          </>)}
          <MenuItem
            icon="compare_arrows"
            label="Transfer"
            onClick={() => setView({ type: 'transfer' })}
            chevron
          />
          <MenuItem
            icon="logout"
            label="Free Aircraft"
            variant="success"
            onClick={async () => {
              const res = await apiFetch('/api/end-tracking', {
                method: 'POST',
                body: JSON.stringify({ code: getLinkCode(), callsign: fp.callsign }),
              })
              if (res.ok) deleteStripByCallsign(fp.callsign)
              onClose()
            }}
          />

          <MenuSection label="Strip" icon="dashboard" />
          <MenuItem icon="delete" label="Remove Strip" variant="danger" onClick={handleDelete} />
        </div>
      </div>
    )
  }

  return (
    <div className="menu-scroll-container">
      <MenuSection label="Strip" icon="dashboard" />
      <MenuItem icon="delete" label="Remove Strip" variant="danger" onClick={handleDelete} />
    </div>
  )
}

export function ContextMenu() {
  const { visible, x, y, stripId, panelName, hide } = useContextMenuStore()
  const menuRef = useRef<HTMLDivElement>(null)
  const [view, setView] = useState<MenuView>({ type: 'main' })

  useEffect(() => {
    if (visible) setView({ type: 'main' })
  }, [visible, stripId])

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

  if (!visible || !stripId || !panelName) return null

  const strip = usePanelStore.getState().getStrip(stripId)
  if (!strip) return null

  const renderView = () => {
    switch (view.type) {
      case 'route':
        return strip.flightPlan ? (
          <RouteView flight={strip.flightPlan} onBack={() => setView({ type: 'main' })} />
        ) : null

      case 'flightinfo':
        return strip.flightPlan ? (
          <FlightInfoView flight={strip.flightPlan} onBack={() => setView({ type: 'main' })} />
        ) : null

      case 'typemenu':
        return (
          <TypeView
            stripId={stripId}
            panelName={panelName}
            currentType={strip.type}
            flight={strip.flightPlan}
            onBack={() => setView({ type: 'main' })}
            onClose={hide}
          />
        )

      case 'transfer':
        return strip.flightPlan ? (
          <TransferView
            flight={strip.flightPlan}
            onBack={() => setView({ type: 'main' })}
            onClose={hide}
          />
        ) : null

      case 'procedure':
        return (
          <ProcedurePicker
            airport={view.airport}
            procType={view.procType}
            stripId={stripId}
            panelName={panelName}
            onBack={() => setView({ type: 'main' })}
            onClose={hide}
          />
        )

      default:
        return (
          <MainView
            stripId={stripId}
            panelName={panelName}
            setView={setView}
            onClose={hide}
          />
        )
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
