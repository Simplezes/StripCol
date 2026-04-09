import { useSettingsStore } from '../stores/settingsStore'

export function getGatewayUrl(): string {
  if (import.meta.env.DEV) return ''
  const { serverIp } = useSettingsStore.getState().settings
  return `http://${serverIp}:3000`
}

export async function apiFetch(
  endpoint: string,
  options: RequestInit = {},
): Promise<Response> {
  const url = endpoint.startsWith('http')
    ? endpoint
    : `${getGatewayUrl()}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`

  if (options.method && options.method !== 'GET' && !options.headers) {
    options = { ...options, headers: { 'Content-Type': 'application/json' } }
  }

  return fetch(url, options)
}
