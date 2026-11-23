import { useEffect, useRef, useState } from 'react'
import { useConnectionStore, triggerReconnect } from '../../stores/connectionStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { useUIStore } from '../../stores/uiStore'
import { apiFetch } from '../../utils/api'
import { showToast } from '../../utils/toast'

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

function LinkCodePill() {
  const linkCode = useSettingsStore((s) => s.settings.linkCode)
  const [editing, setEditing] = useState(false)
  const [inputVal, setInputVal] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const startEdit = () => {
    setInputVal(linkCode || '')
    setEditing(true)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  const saveCode = async () => {
    const code = inputVal.trim().toUpperCase()
    setEditing(false)
    if (code.length !== 5) return
    try {
      const res = await apiFetch(`/api/pair/${code}`)
      const result = await res.json()
      if (result.success) {
        useSettingsStore.getState().update({ linkCode: code })
        triggerReconnect()
        showToast('Linked successfully!', 'success')
      } else {
        showToast(`Pairing failed: ${result.message}`, 'error')
      }
    } catch {
      showToast('Connection failed', 'error')
    }
  }

  return (
    <div
      className="sys-link-pill"
      id="linkCodeStatus"
      onDoubleClick={startEdit}
      style={{ cursor: 'pointer' }}
      title="Double-click to enter Link Code"
    >
      <span className="pill-label">LINK</span>
      <span id="currentLinkCodeDisplay" className="pill-value">
        {editing ? (
          <input
            ref={inputRef}
            className="sys-input-minimal"
            type="text"
            maxLength={5}
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value.toUpperCase())}
            onBlur={() => setTimeout(() => { if (editing) saveCode() }, 100)}
            onKeyDown={(e) => { if (e.key === 'Enter') inputRef.current?.blur() }}
            onMouseDown={(e) => e.stopPropagation()}
            style={{ width: 50 }}
          />
        ) : (
          linkCode || '-----'
        )}
      </span>
    </div>
  )
}

export function SystemBar() {
  const isConnected = useConnectionStore((s) => s.isConnected)
  const isPaired = useConnectionStore((s) => s.isPaired)
  const showSeconds = useSettingsStore((s) => s.settings.showSeconds)
  const searchQuery = useUIStore((s) => s.searchQuery)
  const setSearchQuery = useUIStore((s) => s.setSearchQuery)
  const openSettings = useUIStore((s) => s.openSettings)
  const hasUpdate = useUIStore((s) => s.hasUpdate)

  const zuluTime = useZuluTime(showSeconds)

  return (
    <header className="system-bar">
      <div className="system-inner">
        <div className="sys-section sys-left">
          <div className="sys-status-info">
            <span
              id="wsStatus"
              className={`status-badge ${isPaired ? 'paired' : isConnected ? 'online' : 'offline'}`}
            >
              {isPaired ? 'PAIRED' : isConnected ? 'ONLINE' : 'OFFLINE'}
            </span>
            <LinkCodePill />
          </div>
        </div>

        <div className="sys-section sys-center">
          <div className="sys-search-wrapper">
            <span className="material-icons search-icon">manage_search</span>
            <input
              type="text"
              id="globalSearchInput"
              placeholder="SEARCH TRAFFIC..."
              autoComplete="off"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="sys-section sys-right">
          <div className="sys-clock-group">
            <span className="clock-label">ZULU</span>
            <span id="zuluTime">{zuluTime}</span>
          </div>
          <div className="sys-divider" />
          <button
            id="settingsBtn"
            className={`sys-action-btn${hasUpdate ? ' has-update' : ''}`}
            title="Settings"
            onClick={() => {
              useUIStore.getState().setHasUpdate(false)
              openSettings()
            }}
          >
            <span className="material-icons">settings</span>
          </button>
        </div>
      </div>
    </header>
  )
}
