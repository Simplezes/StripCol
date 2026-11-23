import { isDesktop } from './desktop'

export interface UpdateHandlers {
  onAvailable?: (version: string) => void
  onProgress?: (percent: number, downloadedBytes: number, totalBytes: number) => void
  onReady?: (version: string) => void
  onUpToDate?: () => void
  onError?: (message: string) => void
}

export async function checkForUpdates(handlers: UpdateHandlers): Promise<void> {
  if (!isDesktop) {
    handlers.onUpToDate?.()
    return
  }

  try {
    const { check } = await import('@tauri-apps/plugin-updater')
    const update = await check()

    if (!update) {
      handlers.onUpToDate?.()
      return
    }

    handlers.onAvailable?.(update.version)

    let totalBytes = 0
    let downloadedBytes = 0
    await update.download((event) => {
      if (event.event === 'Started') {
        totalBytes = event.data.contentLength ?? 0
      } else if (event.event === 'Progress') {
        downloadedBytes += event.data.chunkLength
        const percent = totalBytes > 0 ? (downloadedBytes / totalBytes) * 100 : 0
        handlers.onProgress?.(percent, downloadedBytes, totalBytes)
      }
    })

    pendingInstall = () => update.install()
    handlers.onReady?.(update.version)
  } catch (error) {
    handlers.onError?.(error instanceof Error ? error.message : String(error))
  }
}

let pendingInstall: (() => Promise<void>) | null = null

export function hasDownloadedUpdate(): boolean {
  return pendingInstall !== null
}

export async function installDownloadedUpdate(): Promise<void> {
  if (!pendingInstall) return
  await pendingInstall()
  const { relaunch } = await import('@tauri-apps/plugin-process')
  await relaunch()
}
