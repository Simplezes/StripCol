import { useEffect, useState } from 'react'
import { useUIStore } from '../../stores/uiStore'
import { showToast } from '../../utils/toast'
import { Divider } from '../ui/Divider'

export function AboutTab() {
  const [version, setVersion] = useState('...')
  const [updateStatus, setUpdateStatus] = useState<React.ReactNode>(null)
  const [checking, setChecking] = useState(false)

  useEffect(() => {
    window.electronAPI?.getVersion?.()
      .then((v) => setVersion(v))
      .catch(() => {})

    if (window.electronAPI) {
      window.electronAPI.onUpdateAvailable?.((info: unknown) => {
        const i = info as { version: string }
        useUIStore.getState().setHasUpdate(true)
        showToast(`Update available: V${i.version}`, 'info')
        setUpdateStatus(
          <div style={{ background: 'rgba(110,231,183,0.1)', border: '1px solid rgba(110,231,183,0.2)', padding: '8px', borderRadius: 4 }}>
            <div style={{ fontWeight: 700 }}>Update Available: V{i.version}</div>
            <div id="downloadProgress" style={{ fontSize: 11, color: 'var(--sys-text-dim)', marginTop: 4 }}>
              Initializing download…
            </div>
          </div>,
        )
      })

      window.electronAPI.onUpdateNotAvailable?.(() => {
        setUpdateStatus(<span style={{ color: 'var(--atm-green)' }}>You are up to date!</span>)
        setChecking(false)
      })

      window.electronAPI.onUpdateError?.((msg) => {
        setUpdateStatus(<span style={{ color: 'var(--atm-red)' }}>Update error: {msg}</span>)
        setChecking(false)
      })

      window.electronAPI.onDownloadProgress?.((progress: unknown) => {
        const p = progress as { percent: number; transferred: number; total: number }
        const el = document.getElementById('downloadProgress')
        if (el) {
          el.textContent = `Downloading: ${Math.round(p.percent)}% (${(p.transferred / 1048576).toFixed(2)} MB / ${(p.total / 1048576).toFixed(2)} MB)`
        }
      })

      window.electronAPI.onUpdateDownloaded?.((info: unknown) => {
        const i = info as { version: string }
        showToast(`Update V${i.version} ready to install.`, 'success')
      })
    }
  }, [])

  const checkForUpdates = async () => {
    setChecking(true)
    setUpdateStatus(<span style={{ color: 'var(--atm-blue)' }}>Checking…</span>)
    await window.electronAPI?.checkForUpdates?.().catch(() => setChecking(false))
  }

  const openExternal = (url: string) => {
    if (window.electronAPI?.openExternal) window.electronAPI.openExternal(url)
    else window.open(url, '_blank')
  }

  return (
    <>
      <div className="about-hero">
        <img src="img/icon_name.png" alt="StripCol Logo" className="hero-logo" />
        <div className="hero-version">
          Version <span id="appVersionDisplay">{version}</span>
        </div>
      </div>

      <div className="settings-card" style={{ marginTop: 16, textAlign: 'center' }}>
        <button
          className="custom-btn primary"
          style={{ width: '100%' }}
          onClick={checkForUpdates}
          disabled={checking}
        >
          <span className="material-icons">system_update</span> Check for Updates
        </button>
        {updateStatus && (
          <div id="updateStatus" className="status-msg" style={{ marginTop: 12 }}>
            {updateStatus}
          </div>
        )}
      </div>

      <div className="settings-card" style={{ marginTop: 12, padding: 0 }}>
        <div className="about-grid">
          <div className="about-row">
            <span className="about-label">Developer</span>
            <button
              className="about-value link"
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              onClick={() => openExternal('https://github.com/simplezes')}
            >
              Simplezes
            </button>
          </div>
          <Divider />
          <div className="about-row">
            <span className="about-label">License</span>
            <button
              className="about-value link"
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              onClick={() => openExternal('https://github.com/Simplezes/StripCol/blob/main/LICENSE')}
            >
              MIT License
            </button>
          </div>
        </div>
      </div>

      <div className="about-footer">
        &copy; 2026 StripCol Project.
        <br />
        Designed for Vatsim Colombia.
      </div>
    </>
  )
}
