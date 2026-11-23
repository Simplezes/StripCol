import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useDroppable } from '@dnd-kit/core'
import { useDragStore } from '../../stores/dragStore'
import { usePanelStore } from '../../stores/panelStore'
import { usePanelContextMenuStore } from '../../stores/panelContextMenuStore'
import { useUIStore } from '../../stores/uiStore'
import { Item } from '../ContextMenu/MenuParts'
import { StripContainer } from '../Strips/StripContainer'
import { SORT_LABELS, activeSort, sortConfig, type SortKey } from './sectionSort'

interface SectionProps {
  panelName: string
  isHandover: boolean
  handoverCollapsed: boolean
  onToggleHandover: () => void
}

function SortMenu({ panelName, anchor, onClose }: { panelName: string; anchor: DOMRect; onClose: () => void }) {
  const saved = useUIStore((s) => s.sectionSort[panelName]) as SortKey | undefined
  const setSort = useUIStore((s) => s.setSectionSort)
  const current = activeSort(panelName, saved)

  return createPortal(
    <>
      <div className="cm-backdrop" onMouseDown={onClose} />
      <div className="cm-stack" style={{ left: Math.max(8, anchor.right - 180), top: anchor.bottom + 4 }}>
        <div className="cm w180" role="menu">
          {sortConfig(panelName).options.map((key) => (
            <Item
              key={key}
              label={SORT_LABELS[key]}
              current={key === current}
              onClick={() => {
                setSort(panelName, key)
                onClose()
              }}
            />
          ))}
        </div>
      </div>
    </>,
    document.body,
  )
}

export function Section({ panelName, isHandover, handoverCollapsed, onToggleHandover }: SectionProps) {
  const stripCount = usePanelStore((s) => s.getPanel(panelName)?.strips.length ?? 0)
  const hasIncoming = usePanelStore(
    (s) => s.getPanel(panelName)?.strips.some((st) => st.type === 'transfer') ?? false,
  )
  const showContext = usePanelContextMenuStore((s) => s.show)
  const savedSort = useUIStore((s) => s.sectionSort[panelName]) as SortKey | undefined
  const storedCollapsed = useUIStore((s) => s.sectionCollapsed[panelName] === true)
  const toggleStored = useUIStore((s) => s.toggleSectionCollapsed)
  const sortRef = useRef<HTMLButtonElement>(null)
  const [sortAnchor, setSortAnchor] = useState<DOMRect | null>(null)
  const { setNodeRef } = useDroppable({ id: panelName, data: { type: 'section' } })
  const dropOver = useDragStore((s) => s.overPanel === panelName && s.sourcePanel !== panelName)

  const collapsed = isHandover ? handoverCollapsed : storedCollapsed
  const toggleCollapsed = isHandover ? onToggleHandover : () => toggleStored(panelName)

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    showContext(e.clientX, e.clientY, panelName)
  }

  const classes = ['sec']
  if (hasIncoming) classes.push('alert')
  if (collapsed) classes.push('collapsed')
  if (stripCount === 0) classes.push('empty')
  if (dropOver) classes.push('drop-over')

  return (
    <section ref={setNodeRef} className={classes.join(' ')} data-panel-name={panelName} onContextMenu={handleContextMenu}>
      <header className="sechd">
        <h2 className="ttl">{panelName}</h2>
        <span className="cnt">{stripCount}</span>
        <button
          ref={sortRef}
          className="sort"
          aria-label={`Sort ${panelName}`}
          aria-haspopup="menu"
          onClick={() => setSortAnchor(sortRef.current?.getBoundingClientRect() ?? null)}
        >
          {SORT_LABELS[activeSort(panelName, savedSort)]}
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
            <path d="M2 3.5l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <button
          className="fold"
          aria-label={collapsed ? `Expand ${panelName}` : `Collapse ${panelName}`}
          aria-expanded={!collapsed}
          onClick={toggleCollapsed}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
            <path
              d={collapsed ? 'M2.5 4.5L6 8l3.5-3.5' : 'M2.5 7.5L6 4l3.5 3.5'}
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </header>
      <StripContainer panelName={panelName} />
      {sortAnchor && <SortMenu panelName={panelName} anchor={sortAnchor} onClose={() => setSortAnchor(null)} />}
    </section>
  )
}
