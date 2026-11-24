import { useEffect, useRef, useState } from 'react'
import appIcon from '../../assets/app-icon.png'
import { useConnectionStore } from '../../stores/connectionStore'
import { usePanelStore } from '../../stores/panelStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { useUIStore } from '../../stores/uiStore'
import { hpaToInHg, useQnh } from '../../hooks/useQnh'
import { AirportMenu } from './AirportMenu'
import { BOARD_TITLES, BoardMenu } from './BoardMenu'
import { closeWindow, isDesktop, isWindowMaximized, minimizeWindow, toggleMaximizeWindow } from '../../platform/desktop'

function useZuluTime(showSeconds: boolean): string {
  const [time, setTime] = useState('')

  useEffect(() => {
    const tick = () => {
      const now = new Date()
      const h = String(now.getUTCHours()).padStart(2, '0')
      const m = String(now.getUTCMinutes()).padStart(2, '0')
      const s = String(now.getUTCSeconds()).padStart(2, '0')
      setTime(showSeconds ? `${h}:${m}:${s}` : `${h}:${m}`)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [showSeconds])

  return time
}

function WindowControls() {
  const [maximized, setMaximized] = useState(false)

  useEffect(() => {
    isWindowMaximized().then(setMaximized).catch(() => {})
  }, [])

  return (
    <div className="win" role="group" aria-label="Window controls">
      <button className="wb" aria-label="Minimize" onClick={() => minimizeWindow()}>
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
          <path d="M0 5h10" stroke="currentColor" strokeWidth="1" fill="none" />
        </svg>
      </button>
      <button
        className="wb"
        aria-label="Maximize or restore"
        onClick={() => toggleMaximizeWindow().then(setMaximized).catch(() => {})}
      >
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
          <path
            d={maximized ? 'M2.5 2.5V0.5h7v7h-2M0.5 2.5h7v7h-7z' : 'M0.5 0.5h9v9h-9z'}
            stroke="currentColor"
            strokeWidth="1"
            fill="none"
          />
        </svg>
      </button>
      <button className="wb close" aria-label="Close" onClick={() => closeWindow()}>
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
          <path d="M0 0l10 10M10 0L0 10" stroke="currentColor" strokeWidth="1" fill="none" />
        </svg>
      </button>
    </div>
  )
}

export function SystemBar() {
  const facilityType = useConnectionStore((s) => s.facilityType)
  const showSeconds = useSettingsStore((s) => s.settings.showSeconds)
  const searchQuery = useUIStore((s) => s.searchQuery)
  const setSearchQuery = useUIStore((s) => s.setSearchQuery)
  const openSettings = useUIStore((s) => s.openSettings)
  const hasUpdate = useUIStore((s) => s.hasUpdate)
  const inspectorOpen = useUIStore((s) => s.inspectorOpen)
  const toggleInspector = useUIStore((s) => s.toggleInspector)
  const stripCount = usePanelStore((s) => s.panels.reduce((n, p) => n + p.strips.length, 0))
  const handoverCount = usePanelStore(
    (s) => s.panels.flatMap((p) => p.strips).filter((st) => st.type === 'transfer').length,
  )

  const boardOverride = useConnectionStore((s) => s.boardOverride)
  const boardRef = useRef<HTMLButtonElement>(null)
  const [boardAnchor, setBoardAnchor] = useState<DOMRect | null>(null)

  const zuluTime = useZuluTime(showSeconds)
  const localIcao = useConnectionStore((s) => s.localIcao)
  const metars = useConnectionStore((s) => s.metars)
  const extraAirports = useConnectionStore((s) => s.extraAirports)
  const [pickedIcao, setPickedIcao] = useState('')
  const airports = [...new Set([localIcao, ...extraAirports, ...Object.keys(metars)].filter(Boolean))].sort()
  const icao = airports.includes(pickedIcao) ? pickedIcao : localIcao || airports[0] || ''
  const hpa = useQnh(icao)
  const [qnhInHg, setQnhInHg] = useState(false)
  const airportRef = useRef<HTMLButtonElement>(null)
  const [airportAnchor, setAirportAnchor] = useState<DOMRect | null>(null)

  return (
    <header className="bar" data-tauri-drag-region>
      <div className="brand" data-tauri-drag-region>
        <img src={appIcon} alt="StripCol" draggable={false} />
      </div>

      <div className="ttl" data-tauri-drag-region>
        <span className="crumb">StripCol</span>
        <svg width="8" height="12" viewBox="0 0 8 12" aria-hidden="true">
          <path d="M1.5 1l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <button
          ref={boardRef}
          className="boardbtn"
          aria-haspopup="menu"
          title="Change board layout"
          onClick={() => setBoardAnchor(boardRef.current?.getBoundingClientRect() ?? null)}
        >
          <h1>{BOARD_TITLES[facilityType] ?? 'Board'}</h1>
          {boardOverride && <small>Manual</small>}
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
            <path d="M2 3.5l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        {boardAnchor && <BoardMenu anchor={boardAnchor} onClose={() => setBoardAnchor(null)} />}
      </div>

      <div className="chips" data-tauri-drag-region>
        <span className="chip">{stripCount} strips</span>
        {handoverCount > 0 && (
          <span className="chip hot">
            <u />
            {handoverCount} {handoverCount === 1 ? 'handover' : 'handovers'}
          </span>
        )}
      </div>

      <div className="search">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-4-4" />
        </svg>
        <input
          type="text"
          id="globalSearchInput"
          placeholder="Search callsign or route"
          autoComplete="off"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="wx">
          <button
            ref={airportRef}
            className="wx-airport"
            aria-haspopup="menu"
            title="Choose airport"
            onClick={() => setAirportAnchor(airportRef.current?.getBoundingClientRect() ?? null)}
          >
            {icao || '----'}
            <svg width="9" height="9" viewBox="0 0 10 10" aria-hidden="true">
              <path d="M2 3.5l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          {airportAnchor && (
            <AirportMenu
              anchor={airportAnchor}
              airports={airports}
              selected={icao}
              onSelect={(next) => {
                setPickedIcao(next)
                setAirportAnchor(null)
              }}
              onClose={() => setAirportAnchor(null)}
            />
          )}
          <button
            className="wx-item wx-qnh"
            title="Switch between hPa and inHg"
            disabled={hpa === null}
            onClick={() => setQnhInHg((v) => !v)}
          >
            <small>QNH</small>
            <b>{hpa === null ? '----' : qnhInHg ? hpaToInHg(hpa) : hpa}</b>
            {hpa !== null && <i>{qnhInHg ? hpa : hpaToInHg(hpa)}</i>}
          </button>
        <span className="wx-item">
          <b id="zuluTime">{zuluTime}</b>
          <small>ZULU</small>
        </span>
      </div>

      <button
        className={`tgl${inspectorOpen ? ' on' : ''}`}
        title="Toggle inspector"
        aria-pressed={inspectorOpen}
        onClick={toggleInspector}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="4" width="18" height="16" rx="1" />
          <path d="M15 4v16" />
          <rect className="fill" x="15" y="4" width="6" height="16" fill="currentColor" stroke="none" />
        </svg>
      </button>

      <button
        id="settingsBtn"
        className={`gear${hasUpdate ? ' has-update' : ''}`}
        title="Settings"
        onClick={() => {
          useUIStore.getState().setHasUpdate(false)
          openSettings()
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
        </svg>
      </button>
      {isDesktop && <WindowControls />}
    </header>
  )
}
