import type { ReactNode } from 'react'
import { useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragMoveEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { usePanelStore } from '../../stores/panelStore'
import { useUIStore } from '../../stores/uiStore'
import { useDragStore } from '../../stores/dragStore'
import { activeSort, isOrdered, sortStrips, type SortKey } from '../Layout/sectionSort'
import { useConnectionStore } from '../../stores/connectionStore'
import { buildInitialValues } from '../../utils/stripValues'
import { panelNameToStripType } from '../../utils/stripActions'
import type { StripData } from '../../types'
import { StripGhostContent } from './StripGhostContent'
import { stripCollision } from './dragCollision'

interface StripDndProviderProps {
  children: ReactNode
}

interface DropTarget {
  panel: string
  index: number
}

const DROP_ANIMATION = { duration: 200, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' }
const LANDED_MS = 900

function sortKeyOf(panelName: string): SortKey {
  return activeSort(panelName, useUIStore.getState().sectionSort[panelName] as SortKey | undefined)
}

function displayedIds(panelName: string, excludeId?: string): string[] {
  const panel = usePanelStore.getState().panels.find((p) => p.name === panelName)
  if (!panel) return []
  return sortStrips(panel.strips, sortKeyOf(panelName))
    .map((s) => s.id)
    .filter((id) => id !== excludeId)
}

function resolveTarget({ active, over }: Pick<DragMoveEvent, 'active' | 'over'>): DropTarget | null {
  if (!over) return null

  const activeId = active.id as string
  const overId = over.id as string
  const containerId = (over.data.current?.sortable?.containerId as string | undefined) ?? overId
  const panel = usePanelStore.getState().panels.find((p) => p.name === containerId)
  if (!panel) return null

  const ids = displayedIds(panel.name, activeId)
  const overIndex = ids.indexOf(overId)
  if (overIndex === -1) return { panel: panel.name, index: ids.length }

  const dragged = active.rect.current.translated
  const draggedCenter = dragged ? dragged.top + dragged.height / 2 : 0
  const overCenter = over.rect.top + over.rect.height / 2
  return { panel: panel.name, index: overIndex + (draggedCenter > overCenter ? 1 : 0) }
}

function moveToPanel(strip: StripData, sourcePanel: string, target: DropTarget) {
  const state = usePanelStore.getState()
  const sortKey = sortKeyOf(target.panel)
  const insertAt = isOrdered(sortKey) ? undefined : target.index

  const inferredType = panelNameToStripType(target.panel)
  if (inferredType && inferredType !== strip.type && strip.type !== 'transfer') {
    const { controllerMode } = useConnectionStore.getState()
    const values = strip.flightPlan
      ? buildInitialValues(strip.flightPlan, inferredType, controllerMode)
      : { ...strip.values }
    state.updateStrip(sourcePanel, strip.id, { type: inferredType, values })
  }

  state.moveStrip(sourcePanel, target.panel, strip.id, insertAt)
}

function reorderInPanel(panelName: string, activeId: string, index: number) {
  const before = displayedIds(panelName)
  const next = displayedIds(panelName, activeId)
  next.splice(Math.min(index, next.length), 0, activeId)
  if (next.join() === before.join()) return

  usePanelStore.getState().reorderStrips(panelName, next)
  if (isOrdered(sortKeyOf(panelName))) useUIStore.getState().setSectionSort(panelName, 'MANUAL')
}

export function StripDndProvider({ children }: StripDndProviderProps) {
  const [activeStrip, setActiveStrip] = useState<StripData | null>(null)
  const crossingPanels = useDragStore((s) => s.overPanel !== null && s.overPanel !== s.sourcePanel)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  function finish() {
    setActiveStrip(null)
    useDragStore.getState().end()
    document.body.classList.remove('dragging')
  }

  function handleDragStart({ active }: DragStartEvent) {
    const id = active.id as string
    const panel = usePanelStore.getState().panels.find((p) => p.strips.some((s) => s.id === id))
    if (!panel) return

    setActiveStrip(panel.strips.find((s) => s.id === id) ?? null)
    useDragStore.getState().start(id, panel.name, active.rect.current.initial?.height ?? 92)
    document.body.classList.add('dragging')
  }

  function handleDragMove(event: DragMoveEvent) {
    const target = resolveTarget(event)
    useDragStore.getState().setTarget(target?.panel ?? null, target?.index ?? -1)
  }

  function handleDragEnd(event: DragEndEvent) {
    const activeId = event.active.id as string
    const target = resolveTarget(event)
    finish()
    if (!target) return

    const source = usePanelStore.getState().panels.find((p) => p.strips.some((s) => s.id === activeId))
    const strip = source?.strips.find((s) => s.id === activeId)
    if (!source || !strip) return

    if (source.name === target.panel) reorderInPanel(source.name, activeId, target.index)
    else moveToPanel(strip, source.name, target)

    useDragStore.getState().setLanded(activeId)
    setTimeout(() => useDragStore.getState().setLanded(null), LANDED_MS)
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={stripCollision}
      autoScroll={{ threshold: { x: 0, y: 0.18 }, acceleration: 14 }}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
      onDragCancel={finish}
    >
      {children}

      <DragOverlay dropAnimation={crossingPanels ? null : DROP_ANIMATION}>
        {activeStrip ? <StripGhostContent strip={activeStrip} /> : null}
      </DragOverlay>
    </DndContext>
  )
}
