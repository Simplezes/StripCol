import { useEffect, useState } from 'react'
import heroLogo from '../../assets/icon_name.png'
import { useUIStore } from '../../stores/uiStore'
import { showToast } from '../../utils/toast'
import { getAppVersion, installPlugin, isDesktop, openExternal } from '../../platform/desktop'
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

function describeStatus(status: UpdateStatus, version: string): { detail: string; tone: string } {
  if (status.kind === 'checking') return { detail: 'Checking for updates…', tone: '' }
  if (status.kind === 'upToDate') return { detail: `You are on the latest version (${version}).`, tone: 'ok' }
  if (status.kind === 'error') return { detail: `Update failed: ${status.message}`, tone: 'bad' }
  if (status.kind !== 'download') return { detail: `Installed version ${version}.`, tone: '' }

  const { version: nextVersion, percent, downloadedBytes, totalBytes, ready } = status.download
  if (ready) return { detail: `Version ${nextVersion} is ready to install.`, tone: 'ok' }
  const size = totalBytes > 0 ? ` · ${formatMegabytes(downloadedBytes)} / ${formatMegabytes(totalBytes)} MB` : ''
  return { detail: `Downloading ${nextVersion} — ${Math.round(percent)}%${size}`, tone: '' }
}

function UpdateRow({
  status,
  version,
  onCheck,
  onInstall,
}: {
  status: UpdateStatus
  version: string
  onCheck: () => void
  onInstall: () => void
}) {
  const { detail, tone } = describeStatus(status, version)
  const download = status.kind === 'download' ? status.download : null
  const busy = status.kind === 'checking' || (download !== null && !download.ready)

  return (
    <div className="card upd">
      <div className="row">
        <div className="tx">
          <b>Software update</b>
          <small className={tone}>{detail}</small>
        </div>
        {download?.ready ? (
          <button className="btn pri" onClick={onInstall}>
            Restart and install
          </button>
        ) : (
          <button className="btn" onClick={onCheck} disabled={busy}>
            {busy ? 'Please wait…' : 'Check for updates'}
          </button>
        )}
      </div>
      {download && (
        <div
          className="updbar"
          role="progressbar"
          aria-valuenow={download.ready ? 100 : Math.round(download.percent)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <i style={{ width: `${download.ready ? 100 : download.percent}%` }} />
        </div>
      )}
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

  const handleInstallPlugin = async () => {
    try {
      const installedPath = await installPlugin()
      if (installedPath) showToast(`Plugin saved to ${installedPath}`, 'plugin-installed')
    } catch (error) {
      showToast(String(error), 'plugin-install-failed')
    }
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
          <span className="ver">Version {version}</span>
          <small>&copy; 2026 StripCol Project. Designed for VATSIM Colombia.</small>
        </div>
        <div className="abside">
          <UpdateRow
            status={status}
            version={version}
            onCheck={handleCheckForUpdates}
            onInstall={installDownloadedUpdate}
          />
          <div className="card lk">
            {isDesktop && (
              <button onClick={handleInstallPlugin}>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />
                </svg>
                Load plugin on EuroScope
                <span>StripCol.dll</span>
              </button>
            )}
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
        </div>
      </div>
    </>
  )
}
