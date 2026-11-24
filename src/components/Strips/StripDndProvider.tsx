import type { ReactNode } from 'react'
import { DragDropContext, type DragStart, type DragUpdate, type DropResult } from '@hello-pangea/dnd'
import { usePanelStore } from '../../stores/panelStore'
import { useUIStore } from '../../stores/uiStore'
import { useDragStore } from '../../stores/dragStore'
import { activeSort, isOrdered, sortStrips, type SortKey } from '../Layout/sectionSort'
import { useConnectionStore } from '../../stores/connectionStore'
import { buildInitialValues } from '../../utils/stripValues'
import { assumeAircraft, panelNameToStripType } from '../../utils/stripActions'
import type { StripData } from '../../types'
import { useStripPointerSensor } from './useStripPointerSensor'

interface StripDndProviderProps {
  children: ReactNode
}

const LANDED_MS = 900
const SENSORS = [useStripPointerSensor]

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

function moveToPanel(strip: StripData, sourcePanel: string, targetPanel: string, index: number) {
  const state = usePanelStore.getState()
  const insertAt = isOrdered(sortKeyOf(targetPanel)) ? undefined : index

  const inferredType = panelNameToStripType(targetPanel)
  if (inferredType && inferredType !== strip.type && strip.type !== 'transfer') {
    const { controllerMode } = useConnectionStore.getState()
    const values = strip.flightPlan
      ? buildInitialValues(strip.flightPlan, inferredType, controllerMode)
      : { ...strip.values }
    state.updateStrip(sourcePanel, strip.id, { type: inferredType, values })
  }

  state.moveStrip(sourcePanel, targetPanel, strip.id, insertAt)
}

function reorderInPanel(panelName: string, activeId: string, index: number) {
  const before = displayedIds(panelName)
  const next = displayedIds(panelName, activeId)
  next.splice(Math.min(index, next.length), 0, activeId)
  if (next.join() === before.join()) return

  usePanelStore.getState().reorderStrips(panelName, next)
  if (isOrdered(sortKeyOf(panelName))) useUIStore.getState().setSectionSort(panelName, 'MANUAL')
}

function handleDragStart({ draggableId, source }: DragStart) {
  useDragStore.getState().start(draggableId, source.droppableId)
  document.body.classList.add('dragging')
}

function handleDragUpdate({ destination }: DragUpdate) {
  useDragStore.getState().setOver(destination?.droppableId ?? null)
}

function handleDragEnd({ draggableId, source, destination }: DropResult) {
  useDragStore.getState().end()
  document.body.classList.remove('dragging')
  if (!destination) return

  const sourcePanel = usePanelStore.getState().panels.find((p) => p.name === source.droppableId)
  const strip = sourcePanel?.strips.find((s) => s.id === draggableId)
  if (!strip) return

  if (source.droppableId === destination.droppableId) {
    reorderInPanel(source.droppableId, draggableId, destination.index)
  } else {
    moveToPanel(strip, source.droppableId, destination.droppableId, destination.index)
    if (!strip.euroscope && strip.flightPlan && strip.type !== 'transfer') {
      assumeAircraft(strip.flightPlan.callsign)
    }
  }

  useDragStore.getState().setLanded(draggableId)
  setTimeout(() => useDragStore.getState().setLanded(null), LANDED_MS)
}

export function StripDndProvider({ children }: StripDndProviderProps) {
  return (
    <DragDropContext
      sensors={SENSORS}
      onDragStart={handleDragStart}
      onDragUpdate={handleDragUpdate}
      onDragEnd={handleDragEnd}
    >
      {children}
    </DragDropContext>
  )
}
