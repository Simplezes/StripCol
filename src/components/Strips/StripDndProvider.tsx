import type { ReactNode } from 'react'
import { useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import { usePanelStore } from '../../stores/panelStore'
import { useConnectionStore } from '../../stores/connectionStore'
import { buildInitialValues } from '../../utils/stripValues'
import { panelNameToStripType } from '../../utils/stripActions'
import type { StripData } from '../../types'
import { StripGhostContent } from './StripGhostContent'

interface StripDndProviderProps {
  children: ReactNode
}

export function StripDndProvider({ children }: StripDndProviderProps) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const [activeStrip, setActiveStrip] = useState<StripData | null>(null)
  const [activePanelName, setActivePanelName] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
  )

  function handleDragStart({ active }: DragStartEvent) {
    const id = active.id as string
    setActiveId(id)

    const state = usePanelStore.getState()
    for (const panel of state.panels) {
      const strip = panel.strips.find((s) => s.id === id)
      if (strip) {
        setActiveStrip(strip)
        setActivePanelName(panel.name)
        break
      }
    }
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null)
    setActiveStrip(null)
    setActivePanelName(null)

    if (!over || active.id === over.id) return

    const activeId = active.id as string
    const overId = over.id as string

    const state = usePanelStore.getState()

    const sourcePanel = state.panels.find((p) => p.strips.some((s) => s.id === activeId))
    if (!sourcePanel) return

    const overContainerId =
      (over.data.current?.sortable?.containerId as string | undefined) ?? overId

    const targetPanel = state.panels.find(
      (p) => p.name === overContainerId || p.strips.some((s) => s.id === overId),
    )
    if (!targetPanel) return

    if (sourcePanel.name === targetPanel.name) {
      const ids = sourcePanel.strips.map((s) => s.id)
      const oldIndex = ids.indexOf(activeId)
      const newIndex = ids.indexOf(overId)
      if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
        state.reorderStrips(sourcePanel.name, arrayMove(ids, oldIndex, newIndex))
      }
    } else {
      const overIndex = targetPanel.strips.findIndex((s) => s.id === overId)
      const insertAt = overIndex === -1 ? undefined : overIndex

      const inferredType = panelNameToStripType(targetPanel.name)
      const strip = sourcePanel.strips.find((s) => s.id === activeId)!
      const { controllerMode } = useConnectionStore.getState()

      if (inferredType && inferredType !== strip.type && strip.type !== 'transfer') {
        const newValues = strip.flightPlan
          ? buildInitialValues(strip.flightPlan, inferredType, controllerMode)
          : { ...strip.values }
        state.updateStrip(sourcePanel.name, activeId, { type: inferredType, values: newValues })
      }

      state.moveStrip(sourcePanel.name, targetPanel.name, activeId, insertAt)
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      {children}

      <DragOverlay dropAnimation={null}>
        {activeId && activeStrip ? (
          <StripGhostContent strip={activeStrip} panelName={activePanelName ?? ''} />
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
