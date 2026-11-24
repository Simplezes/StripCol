export interface DesktopSettings {
  serverIp: string
  discordRpcEnabled: boolean
}

export const isDesktop = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

export async function getAppVersion(): Promise<string> {
  if (!isDesktop) return ''
  const { getVersion } = await import('@tauri-apps/api/app')
  return getVersion()
}

export async function saveDesktopSettings(settings: DesktopSettings): Promise<void> {
  if (!isDesktop) return
  const { invoke } = await import('@tauri-apps/api/core')
  await invoke('save_settings', { settings })
}

export async function restartGateway(serverIp: string): Promise<void> {
  if (!isDesktop) return
  const { invoke } = await import('@tauri-apps/api/core')
  await invoke('restart_gateway', { serverIp })
}

export async function openExternal(url: string): Promise<void> {
  if (!isDesktop) {
    window.open(url, '_blank')
    return
  }
  const { openUrl } = await import('@tauri-apps/plugin-opener')
  await openUrl(url)
}

export async function startWindowDrag(): Promise<void> {
  if (!isDesktop) return
  const { getCurrentWindow } = await import('@tauri-apps/api/window')
  await getCurrentWindow().startDragging()
}

export async function minimizeWindow(): Promise<void> {
  if (!isDesktop) return
  const { getCurrentWindow } = await import('@tauri-apps/api/window')
  await getCurrentWindow().minimize()
}

export async function toggleMaximizeWindow(): Promise<boolean> {
  if (!isDesktop) return false
  const { getCurrentWindow } = await import('@tauri-apps/api/window')
  const win = getCurrentWindow()
  await win.toggleMaximize()
  return win.isMaximized()
}

export async function isWindowMaximized(): Promise<boolean> {
  if (!isDesktop) return false
  const { getCurrentWindow } = await import('@tauri-apps/api/window')
  return getCurrentWindow().isMaximized()
}

export async function closeWindow(): Promise<void> {
  if (!isDesktop) return
  const { getCurrentWindow } = await import('@tauri-apps/api/window')
  await getCurrentWindow().close()
}
