import { Droppable } from '@hello-pangea/dnd'
import { useShallow } from 'zustand/react/shallow'
import { useConnectionStore } from '../../stores/connectionStore'
import { usePanelStore } from '../../stores/panelStore'
import { StripSkeleton } from '../ui/Skeleton'
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
  const syncing = useConnectionStore((s) => s.isSyncing)
  const showSkeleton = syncing && strips.length === 0

  return (
    <Droppable droppableId={panelName}>
      {(provided) => (
        <div className="secbody" ref={provided.innerRef} {...provided.droppableProps}>
          {showSkeleton && <StripSkeleton />}
          {strips.map((strip, index) =>
            strip.type === 'transfer' ? (
              <StripTransfer key={strip.id} stripId={strip.id} panelName={panelName} index={index} />
            ) : (
              <Strip key={strip.id} stripId={strip.id} panelName={panelName} index={index} />
            ),
          )}
          {provided.placeholder}
        </div>
      )}
    </Droppable>
  )
}
