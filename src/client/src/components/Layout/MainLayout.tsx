import { useCallback, useEffect, useRef, useState } from 'react'
import { useConnectionStore } from '../../stores/connectionStore'
import { usePanelStore } from '../../stores/panelStore'
import { PanelCard } from './PanelCard'
import { PanelContextMenu } from './PanelContextMenu'
import {
  FACILITY_PANEL_MAP,
  facilityToLayoutMode,
  getPanelName,
  type LayoutMode,
  type PanelDef,
} from './panelDefs'
import type { FacilityType } from '../../types'

interface GridState {
  h1: number // % 
  h2: number
  h3: number
  c1: number // fr
  c2: number
  c3: number
}

const GRID_DEFAULTS: Record<LayoutMode, GridState> = {
  del:    { h1: 100, h2: 100, h3: 100, c1: 35, c2: 35, c3: 30 },
  ground: { h1: 70,  h2: 50,  h3: 60,  c1: 35, c2: 35, c3: 30 },
  tower:  { h1: 70,  h2: 50,  h3: 60,  c1: 35, c2: 35, c3: 30 },
  radar:  { h1: 100, h2: 100, h3: 35,  c1: 35, c2: 35, c3: 30 },
}

function loadGrid(layoutMode: LayoutMode): GridState {
  try {
    const saved = JSON.parse(localStorage.getItem('layoutGridHeights') || '{}')
    const m = saved[layoutMode]
    if (m && m.c1 !== undefined) return { ...GRID_DEFAULTS[layoutMode], ...m }
  } catch {  }
  return { ...GRID_DEFAULTS[layoutMode] }
}

function saveGrid(layoutMode: LayoutMode, grid: GridState) {
  try {
    const all = JSON.parse(localStorage.getItem('layoutGridHeights') || '{}')
    all[layoutMode] = grid
    localStorage.setItem('layoutGridHeights', JSON.stringify(all))
  } catch {  }
}

function loadHandoverCollapsed(layoutMode: LayoutMode): boolean {
  try {
    const saved = JSON.parse(localStorage.getItem('handoverCollapsed') || '{}')
    return saved[layoutMode] !== false
  } catch {
    return true
  }
}

function saveHandoverCollapsed(layoutMode: LayoutMode, collapsed: boolean) {
  try {
    const saved = JSON.parse(localStorage.getItem('handoverCollapsed') || '{}')
    saved[layoutMode] = collapsed
    localStorage.setItem('handoverCollapsed', JSON.stringify(saved))
  } catch {  }
}

function applyHandoverHeight(grid: GridState, col: 1 | 2 | 3, collapsed: boolean): GridState {
  const hKey = `h${col}` as 'h1' | 'h2' | 'h3'
  return {
    ...grid,
    [hKey]: collapsed ? 96 : 60,
  }
}

function initLayoutPanels(defs: PanelDef[]) {
  const names = defs.map(getPanelName)
  usePanelStore.getState().resetToLayout(names)
}

function getColumnDefs(defs: PanelDef[], col: 1 | 2 | 3): PanelDef[] {
  return defs.filter((d) => d.col === col)
}

function useAdaptiveWidth(colRef: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const el = colRef.current
    if (!el) return
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = entry.contentRect.width
        let mode = 'full'
        if (w < 220) mode = 'compact-1'
        else if (w < 320) mode = 'compact-2'
        else if (w < 450) mode = 'compact-3'
        if (el.dataset.widthMode !== mode) el.dataset.widthMode = mode
      }
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [colRef])
}

function useRowResize(
  colRef: React.RefObject<HTMLDivElement | null>,
  colIndex: 1 | 2 | 3,
  gridRef: React.MutableRefObject<GridState>,
  onGridChange: (next: GridState) => void,
) {
  return useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      const startY = e.clientY
      const colEl = colRef.current
      if (!colEl) return

      const hKey = `h${colIndex}` as 'h1' | 'h2' | 'h3'
      const startH = gridRef.current[hKey]
      const totalH = colEl.clientHeight

      function onMove(ev: MouseEvent) {
        const deltaY = ev.clientY - startY
        const deltaPct = (deltaY / totalH) * 100
        const newH = Math.min(90, Math.max(10, startH + deltaPct))
        onGridChange({ ...gridRef.current, [hKey]: newH })
      }
      function onUp() {
        document.removeEventListener('mousemove', onMove)
        document.removeEventListener('mouseup', onUp)
        document.body.style.removeProperty('cursor')
      }
      document.body.style.cursor = 'ns-resize'
      document.addEventListener('mousemove', onMove)
      document.addEventListener('mouseup', onUp)
    },
    [colRef, colIndex, gridRef, onGridChange],
  )
}

interface ColProps {
  colIndex: 1 | 2 | 3
  defs: PanelDef[]
  layoutMode: LayoutMode
  handoverCollapsed: boolean
  onToggleHandover: () => void
  gridRef: React.MutableRefObject<GridState>
  onGridChange: (next: GridState) => void
  onColResizeMouseDown?: (e: React.MouseEvent) => void
  showColResize: boolean
}

function PanelColumn({
  colIndex,
  defs,
  layoutMode,
  handoverCollapsed,
  onToggleHandover,
  gridRef,
  onGridChange,
  onColResizeMouseDown,
  showColResize,
}: ColProps) {
  const colRef = useRef<HTMLDivElement>(null)
  useAdaptiveWidth(colRef)

  const rowResizeHandler = useRowResize(colRef, colIndex, gridRef, onGridChange)

  const lastDef = defs[defs.length - 1]
  const isLastHandover =
    lastDef?.key === 'handover' || lastDef?.defaultName === 'Handover'
  const hasNoCollapse = lastDef?.noCollapse === true

  const canHaveRowResize =
    defs.length >= 2 &&
    !isLastHandover &&
    !(layoutMode === 'radar') &&
    !(layoutMode === 'tower' && colIndex === 3)

  const isHandoverCol = isLastHandover && !hasNoCollapse
  const collapseClass = isHandoverCol && handoverCollapsed ? 'handover-collapsed' : ''

  return (
    <div
      ref={colRef}
      className={`panel-col ${collapseClass}`}
      data-col={colIndex}
    >
      {defs.map((def, idx) => {
        const panelName = getPanelName(def)
        const isHandover = def.key === 'handover'
        const isCollapsible = isHandover && !def.noCollapse
        const isSecond = idx === defs.length - 1 && idx > 0
        const showRowResize = canHaveRowResize && isSecond

        return (
          <PanelCard
            key={panelName}
            panelName={panelName}
            cssClass={def.cssClass}
            isCollapsible={isCollapsible}
            isCollapsed={handoverCollapsed}
            onToggleCollapse={onToggleHandover}
            showRowResize={showRowResize}
            onRowResizeMouseDown={rowResizeHandler}
          />
        )
      })}

      {showColResize && (
        <div
          className="resize-handle-v flex justify-center items-center"
          onMouseDown={onColResizeMouseDown}
          onDoubleClick={(e) => {
            e.preventDefault()
            const defaults = { c1: 35, c2: 35, c3: 30 }
            const cur = gridRef.current
            if (colIndex === 2) {
              const combined = cur.c1 + cur.c2
              onGridChange({ ...cur, c1: defaults.c1, c2: combined - defaults.c1 })
            } else if (colIndex === 3) {
              const total = cur.c1 + cur.c2 + cur.c3
              onGridChange({ ...cur, c2: 70 - cur.c1, c3: total - 70 })
            }
          }}
        >
          <div
            style={{
              width: 2,
              height: 40,
              background: 'var(--sys-border)',
              borderRadius: 2,
              transition: 'background 0.2s',
            }}
          />
        </div>
      )}
    </div>
  )
}

export function MainLayout() {
  const facilityType = useConnectionStore((s) => s.facilityType)

  const [layoutMode, setLayoutMode] = useState<LayoutMode>(() =>
    facilityToLayoutMode(facilityType),
  )
  const [grid, setGrid] = useState<GridState>(() => loadGrid(facilityToLayoutMode(facilityType)))
  const [handoverCollapsed, setHandoverCollapsed] = useState<boolean>(() =>
    loadHandoverCollapsed(facilityToLayoutMode(facilityType)),
  )

  const gridRef = useRef<GridState>(grid)
  const prevTransferCountRef = useRef<number | null>(null)

  const handleGridChange = useCallback((next: GridState) => {
    gridRef.current = next
    setGrid(next)
    saveGrid(layoutMode, next)
  }, [layoutMode])

  useEffect(() => {
    const mode = facilityToLayoutMode(facilityType)
    const defs = FACILITY_PANEL_MAP[facilityType]

    initLayoutPanels(defs)

    const collapsed = loadHandoverCollapsed(mode)
    const newGrid = handoverDef && !handoverDef.noCollapse
      ? applyHandoverHeight(loadGrid(mode), handoverDef.col, collapsed)
      : loadGrid(mode)

    gridRef.current = newGrid
    setGrid(newGrid)

    setHandoverCollapsed(collapsed)
    prevTransferCountRef.current = null

    const noCollapseDefs = defs.filter((d) => d.noCollapse)
    if (noCollapseDefs.length > 0 && mode === 'del') {
      setHandoverCollapsed(false)
    }

    setLayoutMode(mode)
  }, [facilityType])

  const handoverStrips = usePanelStore((s) => s.getPanel('Handover')?.strips ?? [])
  const defs = FACILITY_PANEL_MAP[facilityType]
  const handoverDef = defs.find((d) => d.key === 'handover')
  const handoverCollapsible = handoverDef && !handoverDef.noCollapse

  useEffect(() => {
    if (!handoverCollapsible) return
    const transferCount = handoverStrips.filter((s) => s.type === 'transfer').length
    const prevTransferCount = prevTransferCountRef.current
    prevTransferCountRef.current = transferCount

    if (transferCount > 0 && handoverCollapsed) {
      const nextCollapsed = false
      setHandoverCollapsed(nextCollapsed)
      saveHandoverCollapsed(layoutMode, false)
      if (handoverDef) {
        handleGridChange(applyHandoverHeight(gridRef.current, handoverDef.col, nextCollapsed))
      }
      return
    }

    if (prevTransferCount && transferCount === 0 && !handoverCollapsed) {
      const nextCollapsed = true
      setHandoverCollapsed(nextCollapsed)
      saveHandoverCollapsed(layoutMode, true)
      if (handoverDef) {
        handleGridChange(applyHandoverHeight(gridRef.current, handoverDef.col, nextCollapsed))
      }
    }
  }, [handoverStrips, handoverCollapsible, handoverCollapsed, layoutMode, handoverDef, handleGridChange])

  const toggleHandover = useCallback(() => {
    const next = !handoverCollapsed
    setHandoverCollapsed(next)
    saveHandoverCollapsed(layoutMode, next)

    if (handoverDef) {
      handleGridChange(applyHandoverHeight(gridRef.current, handoverDef.col, next))
    }
  }, [handoverCollapsed, layoutMode, handoverDef, handleGridChange])

  const makeColResize = useCallback(
    (colIndex: 2 | 3) => (e: React.MouseEvent) => {
      e.preventDefault()
      const startX = e.clientX
      const totalWidth =
        (e.currentTarget as HTMLElement).closest('.main-layout')?.clientWidth ?? window.innerWidth
      const { c1: sc1, c2: sc2, c3: sc3 } = gridRef.current

      function onMove(ev: MouseEvent) {
        const deltaX = ev.clientX - startX
        const deltaPct = (deltaX / totalWidth) * 100
        let c1 = sc1, c2 = sc2, c3 = sc3
        if (colIndex === 2) {
          c1 = Math.max(10, sc1 + deltaPct)
          c2 = Math.max(10, sc1 + sc2 - c1)
        } else {
          c2 = Math.max(10, sc2 + deltaPct)
          c3 = Math.max(10, sc2 + sc3 - c2)
        }
        handleGridChange({ ...gridRef.current, c1, c2, c3 })
      }
      function onUp() {
        document.removeEventListener('mousemove', onMove)
        document.removeEventListener('mouseup', onUp)
        document.body.style.removeProperty('cursor')
      }
      document.body.style.cursor = 'ew-resize'
      document.addEventListener('mousemove', onMove)
      document.addEventListener('mouseup', onUp)
    },
    [handleGridChange],
  )

  const colResizeCol2 = makeColResize(2)
  const colResizeCol3 = makeColResize(3)

  const col1Defs = getColumnDefs(defs, 1)
  const col2Defs = getColumnDefs(defs, 2)
  const col3Defs = getColumnDefs(defs, 3)

  const layoutStyle = {
    '--h1': `${grid.h1}%`,
    '--h2': `${grid.h2}%`,
    '--h3': `${grid.h3}%`,
    '--c1': `${grid.c1}fr`,
    '--c2': `${grid.c2}fr`,
    '--c3': `${grid.c3}fr`,
  } as React.CSSProperties

  return (
    <>
      <div
        id="mainLayout"
        className="main-layout"
        data-layout={layoutMode}
        style={layoutStyle}
      >
        <PanelColumn
          colIndex={1}
          defs={col1Defs}
          layoutMode={layoutMode}
          handoverCollapsed={handoverCollapsed}
          onToggleHandover={toggleHandover}
          gridRef={gridRef}
          onGridChange={handleGridChange}
          showColResize={false}
        />
        <PanelColumn
          colIndex={2}
          defs={col2Defs}
          layoutMode={layoutMode}
          handoverCollapsed={handoverCollapsed}
          onToggleHandover={toggleHandover}
          gridRef={gridRef}
          onGridChange={handleGridChange}
          showColResize
          onColResizeMouseDown={colResizeCol2}
        />
        <PanelColumn
          colIndex={3}
          defs={col3Defs}
          layoutMode={layoutMode}
          handoverCollapsed={handoverCollapsed}
          onToggleHandover={toggleHandover}
          gridRef={gridRef}
          onGridChange={handleGridChange}
          showColResize
          onColResizeMouseDown={colResizeCol3}
        />
      </div>
      <PanelContextMenu />
    </>
  )
}
