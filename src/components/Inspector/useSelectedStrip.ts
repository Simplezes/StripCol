import { useMemo } from 'react'
import { usePanelStore } from '../../stores/panelStore'
import { useUIStore } from '../../stores/uiStore'
import type { StripData } from '../../types'

interface SelectedStrip {
  strip: StripData
  panelName: string
}

export function useSelectedStrip(): SelectedStrip | null {
  const selectedId = useUIStore((s) => s.selectedStripId)
  const panels = usePanelStore((s) => s.panels)

  return useMemo(() => {
    if (!selectedId) return null
    for (const panel of panels) {
      const strip = panel.strips.find((st) => st.id === selectedId)
      if (strip) return { strip, panelName: panel.name }
    }
    return null
  }, [selectedId, panels])
}
