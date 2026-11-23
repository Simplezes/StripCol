import { useEffect, useState } from 'react'
import heroLogo from '../../assets/icon_name.png'
import { useUIStore } from '../../stores/uiStore'
import { showToast } from '../../utils/toast'
import { getAppVersion, openExternal } from '../../platform/desktop'
import { checkForUpdates, installDownloadedUpdate } from '../../platform/updater'
import { Divider } from '../ui/Divider'

const BYTES_PER_MEGABYTE = 1048576

interface DownloadState {
  version: string
  percent: number
  downloadedBytes: number
  totalBytes: number
  ready: boolean
}

type UpdateStatus =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'upToDate' }
  | { kind: 'error'; message: string }
  | { kind: 'download'; download: DownloadState }

function formatMegabytes(bytes: number): string {
  return (bytes / BYTES_PER_MEGABYTE).toFixed(2)
}

function UpdateStatusView({ status, onInstall }: { status: UpdateStatus; onInstall: () => void }) {
  if (status.kind === 'checking') {
    return <span style={{ color: 'var(--atm-blue)' }}>Checking…</span>
  }
  if (status.kind === 'upToDate') {
    return <span style={{ color: 'var(--atm-green)' }}>You are up to date!</span>
  }
  if (status.kind === 'error') {
    return <span style={{ color: 'var(--atm-red)' }}>Update error: {status.message}</span>
  }
  if (status.kind === 'download') {
    const { version, percent, downloadedBytes, totalBytes, ready } = status.download
    return (
      <div style={{ background: 'rgba(110,231,183,0.1)', border: '1px solid rgba(110,231,183,0.2)', padding: '8px', borderRadius: 4 }}>
        <div style={{ fontWeight: 700 }}>Update Available: V{version}</div>
        <div style={{ fontSize: 11, color: 'var(--sys-text-dim)', marginTop: 4 }}>
          {ready
            ? 'Download complete.'
            : `Downloading: ${Math.round(percent)}% (${formatMegabytes(downloadedBytes)} MB / ${formatMegabytes(totalBytes)} MB)`}
        </div>
        {ready && (
          <button className="custom-btn primary" style={{ marginTop: 8, width: '100%' }} onClick={onInstall}>
            Restart and install
          </button>
        )}
      </div>
    )
  }
  return null
}

export function AboutTab() {
  const [version, setVersion] = useState('...')
  const [status, setStatus] = useState<UpdateStatus>({ kind: 'idle' })

  useEffect(() => {
    getAppVersion()
      .then(setVersion)
      .catch(() => {})
  }, [])

  const handleCheckForUpdates = async () => {
    setStatus({ kind: 'checking' })
    await checkForUpdates({
      onAvailable: (availableVersion) => {
        useUIStore.getState().setHasUpdate(true)
        showToast(`Update available: V${availableVersion}`, 'info')
        setStatus({
          kind: 'download',
          download: { version: availableVersion, percent: 0, downloadedBytes: 0, totalBytes: 0, ready: false },
        })
      },
      onProgress: (percent, downloadedBytes, totalBytes) => {
        setStatus((current) =>
          current.kind === 'download'
            ? { kind: 'download', download: { ...current.download, percent, downloadedBytes, totalBytes } }
            : current,
        )
      },
      onReady: (readyVersion) => {
        showToast(`Update V${readyVersion} ready to install.`, 'success')
        setStatus((current) =>
          current.kind === 'download'
            ? { kind: 'download', download: { ...current.download, ready: true } }
            : current,
        )
      },
      onUpToDate: () => setStatus({ kind: 'upToDate' }),
      onError: (message) => setStatus({ kind: 'error', message }),
    })
  }

  const checking = status.kind === 'checking'

  return (
    <>
      <div className="about-hero">
        <img src={heroLogo} alt="StripCol Logo" className="hero-logo" />
        <div className="hero-version">
          Version <span id="appVersionDisplay">{version}</span>
        </div>
      </div>

      <div className="settings-card" style={{ marginTop: 16, textAlign: 'center' }}>
        <button
          className="custom-btn primary"
          style={{ width: '100%' }}
          onClick={handleCheckForUpdates}
          disabled={checking}
        >
          <span className="material-icons">system_update</span> Check for Updates
        </button>
        {status.kind !== 'idle' && (
          <div id="updateStatus" className="status-msg" style={{ marginTop: 12 }}>
            <UpdateStatusView status={status} onInstall={installDownloadedUpdate} />
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
