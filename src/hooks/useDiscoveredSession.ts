import { useEffect, useState } from 'react'
import { useSettingsStore } from '../stores/settingsStore'
import { apiFetch } from '../utils/api'
import type { ControllerData } from '../types'

export interface DiscoveredSession {
  code: string
  controller: ControllerData
}

const POLL_INTERVAL_MS = 4000

export function useDiscoveredSession(): DiscoveredSession | null {
  const linkCode = useSettingsStore((s) => s.settings.linkCode)
  const [found, setFound] = useState<DiscoveredSession | null>(null)

  useEffect(() => {
    let cancelled = false

    const poll = async () => {
      try {
        const res = await apiFetch('/api/discover')
        const sessions: DiscoveredSession[] = await res.json()
        if (!cancelled) setFound(sessions.find((s) => s.code !== linkCode) ?? null)
      } catch {
        if (!cancelled) setFound(null)
      }
    }

    poll()
    const timer = setInterval(poll, POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [linkCode])

  return found
}
