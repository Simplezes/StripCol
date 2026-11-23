import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { Fragment } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useDragStore } from '../../stores/dragStore'
import { useConnectionStore } from '../../stores/connectionStore'
import { usePanelStore } from '../../stores/panelStore'
import { StripSkeleton } from '../ui/Skeleton'
import { useUIStore } from '../../stores/uiStore'
import { activeSort, isOrdered, sortStrips, type SortKey } from '../Layout/sectionSort'
import { Strip } from './Strip'
import { StripTransfer } from './StripTransfer'

function DropSlot({ height }: { height: number }) {
  return (
    <div className="drop-slot" style={{ height }} aria-hidden="true">
      Drop here
    </div>
  )
}

interface StripContainerProps {
  panelName: string
}

export function StripContainer({ panelName }: StripContainerProps) {
  const stored = usePanelStore(useShallow((s) => s.panels.find((p) => p.name === panelName)?.strips ?? []))
  const savedSort = useUIStore((s) => s.sectionSort[panelName])
  const strips = sortStrips(stored, activeSort(panelName, savedSort as SortKey | undefined))
  const stripIds = strips.map((s) => s.id)
  const slotIndex = useDragStore((s) => (s.overPanel === panelName && s.sourcePanel !== panelName ? s.overIndex : -1))
  const slotHeight = useDragStore((s) => s.slotHeight)
  const showSlot = slotIndex >= 0 && !isOrdered(activeSort(panelName, savedSort as SortKey | undefined))
  const syncing = useConnectionStore((s) => s.isSyncing)
  const showSkeleton = syncing && strips.length === 0

  return (
    <SortableContext id={panelName} items={stripIds} strategy={verticalListSortingStrategy}>
      <div className="secbody">
        {showSkeleton && <StripSkeleton />}
        {strips.map((strip, i) => (
          <Fragment key={strip.id}>
            {showSlot && slotIndex === i && <DropSlot height={slotHeight} />}
            {strip.type === 'transfer' ? (
              <StripTransfer stripId={strip.id} panelName={panelName} />
            ) : (
              <Strip stripId={strip.id} panelName={panelName} />
            )}
          </Fragment>
        ))}
        {showSlot && slotIndex >= strips.length && <DropSlot height={slotHeight} />}
      </div>
    </SortableContext>
  )
}
