import { useEffect } from 'react'
import { useSettingsStore } from '../stores/settingsStore'
import { usePanelStore } from '../stores/panelStore'

const CHECK_INTERVAL_MS = 30_000

export function useStripCleanup(): void {
  const enabled = useSettingsStore((s) => s.settings.cleanupEnabled)

  useEffect(() => {
    if (!enabled) return
    const inactiveSince = new Map<string, number>()

    function sweep() {
      const now = Date.now()
      const timeoutMs = useSettingsStore.getState().settings.cleanupMinutes * 60_000
      const seen = new Set<string>()

      usePanelStore.getState().panels.forEach((panel) => {
        panel.strips.forEach((strip) => {
          if (strip.euroscope || !strip.flightPlan) return
          seen.add(strip.id)
          const since = inactiveSince.get(strip.id) ?? now
          inactiveSince.set(strip.id, since)
          if (now - since >= timeoutMs) {
            usePanelStore.getState().removeStrip(panel.name, strip.id)
            inactiveSince.delete(strip.id)
          }
        })
      })

      inactiveSince.forEach((_, id) => {
        if (!seen.has(id)) inactiveSince.delete(id)
      })
    }

    sweep()
    const interval = setInterval(sweep, CHECK_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [enabled])
}
