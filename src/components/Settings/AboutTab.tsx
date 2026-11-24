import { useEffect, useState } from 'react'
import heroLogo from '../../assets/icon_name.png'
import { useUIStore } from '../../stores/uiStore'
import { showToast } from '../../utils/toast'
import { getAppVersion, openExternal } from '../../platform/desktop'
import { checkForUpdates, installDownloadedUpdate } from '../../platform/updater'

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

function UpdateCard({ status, onInstall }: { status: UpdateStatus; onInstall: () => void }) {
  if (status.kind === 'checking') return <p className="note">Checking for updates…</p>
  if (status.kind === 'upToDate') return <p className="note ok">You are up to date.</p>
  if (status.kind === 'error') return <p className="note bad">Update error: {status.message}</p>
  if (status.kind !== 'download') return null

  const { version, percent, downloadedBytes, totalBytes, ready } = status.download
  const rounded = Math.round(percent)

  return (
    <div className="card upd">
      <div className="row">
        <div className="tx">
          <b>Update available — v{version}</b>
          <small>{ready ? 'Download complete.' : 'Downloading in the background.'}</small>
        </div>
        {ready && (
          <button className="btn pri" onClick={onInstall}>
            Restart and install
          </button>
        )}
      </div>
      <div className="bar2" role="progressbar" aria-valuenow={ready ? 100 : rounded} aria-valuemin={0} aria-valuemax={100}>
        <i style={{ width: `${ready ? 100 : rounded}%` }} />
      </div>
      <div className="mt">
        <span>{ready ? '100%' : `${rounded}%`}</span>
        <span>
          {formatMegabytes(downloadedBytes)} MB / {formatMegabytes(totalBytes)} MB
        </span>
      </div>
    </div>
  )
}

function ExternalIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M14 4h6v6M20 4l-9 9M18 14v5H5V6h5" />
    </svg>
  )
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
        showToast(`Update available: V${availableVersion}`, 'update-available')
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
        showToast(`Update V${readyVersion} ready to install.`, 'update-ready')
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

  return (
    <>
      <div className="ph">
        <h2>About</h2>
        <span>Version and updates</span>
      </div>

      <div className="ab">
        <div className="hero">
          <img src={heroLogo} alt="StripCol" />
          <span>Electronic flight strips for Colombia</span>
          <span>Version {version}</span>
        </div>
        <div>
          <UpdateCard status={status} onInstall={installDownloadedUpdate} />
          <div className="card lk">
            <button onClick={handleCheckForUpdates} disabled={status.kind === 'checking'}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />
              </svg>
              Check for updates
            </button>
            <button onClick={() => openExternal('https://github.com/simplezes')}>
              <ExternalIcon />
              Developer
              <span>Simplezes</span>
            </button>
            <button onClick={() => openExternal('https://github.com/Simplezes/StripCol/blob/main/LICENSE')}>
              <ExternalIcon />
              License
              <span>MIT</span>
            </button>
          </div>
          <p className="note">&copy; 2026 StripCol Project. Designed for VATSIM Colombia.</p>
        </div>
      </div>
    </>
  )
}
