import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useShallow } from 'zustand/react/shallow'
import { usePanelStore } from '../../stores/panelStore'
import { useUIStore } from '../../stores/uiStore'
import { activeSort, sortStrips, type SortKey } from '../Layout/sectionSort'
import { Strip } from './Strip'
import { StripTransfer } from './StripTransfer'

interface StripContainerProps {
  panelName: string
}

export function StripContainer({ panelName }: StripContainerProps) {
  const stored = usePanelStore(useShallow((s) => s.panels.find((p) => p.name === panelName)?.strips ?? []))
  const savedSort = useUIStore((s) => s.sectionSort[panelName])
  const strips = sortStrips(stored, activeSort(panelName, savedSort as SortKey | undefined))
  const stripIds = strips.map((s) => s.id)
  const { setNodeRef } = useDroppable({ id: panelName })

  return (
    <SortableContext id={panelName} items={stripIds} strategy={verticalListSortingStrategy}>
      <div ref={setNodeRef} className="strip-container">
        {strips.map((strip) =>
          strip.type === 'transfer' ? (
            <StripTransfer key={strip.id} stripId={strip.id} panelName={panelName} />
          ) : (
            <Strip key={strip.id} stripId={strip.id} panelName={panelName} />
          ),
        )}
      </div>
    </SortableContext>
  )
}
