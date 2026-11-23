import { useCallback, useEffect, useRef, useState } from 'react'
import { useConnectionStore } from '../../stores/connectionStore'
import { usePanelStore } from '../../stores/panelStore'
import { rebuildBoard } from '../../utils/stripActions'
import type { StripData } from '../../types'
import { Section } from './Section'
import { PanelContextMenu } from './PanelContextMenu'
import {
  FACILITY_PANEL_MAP,
  facilityToLayoutMode,
  getPanelName,
  type LayoutMode,
  type PanelDef,
} from './panelDefs'

const COLLAPSED_KEY = 'handoverCollapsed'
const NO_STRIPS: StripData[] = []
const SECTION_CHROME_WIDTH = 18

function loadHandoverCollapsed(layoutMode: LayoutMode): boolean {
  try {
    const saved = JSON.parse(localStorage.getItem(COLLAPSED_KEY) || '{}')
    return saved[layoutMode] !== false
  } catch {
    return true
  }
}

function saveHandoverCollapsed(layoutMode: LayoutMode, collapsed: boolean) {
  try {
    const saved = JSON.parse(localStorage.getItem(COLLAPSED_KEY) || '{}')
    saved[layoutMode] = collapsed
    localStorage.setItem(COLLAPSED_KEY, JSON.stringify(saved))
  } catch {
    return
  }
}

function useAdaptiveWidth(laneRef: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const el = laneRef.current
    if (!el) return
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width = entry.contentRect.width
        el.style.setProperty('--cqw', `${Math.max(0, width - SECTION_CHROME_WIDTH) / 100}px`)
        let mode = 'full'
        if (width < 180) mode = 'compact-1'
        else if (width < 260) mode = 'compact-2'
        else if (width < 480) mode = 'compact-3'
        if (el.dataset.widthMode !== mode) el.dataset.widthMode = mode
      }
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [laneRef])
}

interface LaneProps {
  defs: PanelDef[]
  handoverCollapsed: boolean
  onToggleHandover: () => void
}

function Lane({ defs, handoverCollapsed, onToggleHandover }: LaneProps) {
  const laneRef = useRef<HTMLDivElement>(null)
  useAdaptiveWidth(laneRef)

  return (
    <div ref={laneRef} className="lane">
      {defs.map((def) => (
        <Section
          key={def.key}
          panelName={getPanelName(def)}
          isHandover={def.key === 'handover'}
          handoverCollapsed={handoverCollapsed}
          onToggleHandover={onToggleHandover}
        />
      ))}
    </div>
  )
}

export function MainLayout() {
  const facilityType = useConnectionStore((s) => s.facilityType)
  const defs = FACILITY_PANEL_MAP[facilityType]
  const layoutMode = facilityToLayoutMode(facilityType)
  const [handoverCollapsed, setHandoverCollapsed] = useState(() => loadHandoverCollapsed(layoutMode))
  const previousTransfers = useRef<number | null>(null)

  useEffect(() => {
    rebuildBoard(defs.map(getPanelName))
    setHandoverCollapsed(loadHandoverCollapsed(layoutMode))
    previousTransfers.current = null
  }, [facilityType, defs, layoutMode])

  const handoverDef = defs.find((d) => d.key === 'handover')
  const handoverCollapsible = Boolean(handoverDef && !handoverDef.noCollapse)
  const handoverStrips = usePanelStore((s) => s.getPanel('Handover')?.strips ?? NO_STRIPS)

  const setCollapsed = useCallback(
    (next: boolean) => {
      setHandoverCollapsed(next)
      saveHandoverCollapsed(layoutMode, next)
    },
    [layoutMode],
  )

  useEffect(() => {
    if (!handoverCollapsible) return
    const transfers = handoverStrips.filter((s) => s.type === 'transfer').length
    const before = previousTransfers.current
    previousTransfers.current = transfers

    if (transfers > 0 && handoverCollapsed) setCollapsed(false)
    else if (before && transfers === 0 && !handoverCollapsed) setCollapsed(true)
  }, [handoverStrips, handoverCollapsible, handoverCollapsed, setCollapsed])

  const lanes = [1, 2, 3]
    .map((col) => defs.filter((d) => d.col === col))
    .filter((laneDefs) => laneDefs.length > 0)

  return (
    <>
      <main className="board" id="mainLayout" data-layout={layoutMode} style={{ ['--lanes' as string]: lanes.length }}>
        {lanes.map((laneDefs) => (
          <Lane
            key={laneDefs[0].key}
            defs={laneDefs}
            handoverCollapsed={handoverCollapsed}
            onToggleHandover={() => setCollapsed(!handoverCollapsed)}
          />
        ))}
      </main>
      <PanelContextMenu />
    </>
  )
}
