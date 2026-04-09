import { usePanelStore } from '../../stores/panelStore'
import { usePanelContextMenuStore } from '../../stores/panelContextMenuStore'
import { StripContainer } from '../Strips/StripContainer'

interface PanelCardProps {
  panelName: string
  cssClass: string
  isCollapsible: boolean
  isCollapsed: boolean
  onToggleCollapse: () => void
  showRowResize: boolean
  onRowResizeMouseDown: (e: React.MouseEvent<HTMLDivElement>) => void
}

export function PanelCard({
  panelName,
  cssClass,
  isCollapsible,
  isCollapsed,
  onToggleCollapse,
  showRowResize,
  onRowResizeMouseDown,
}: PanelCardProps) {
  const stripCount = usePanelStore((s) => s.getPanel(panelName)?.strips.length ?? 0)
  const showContext = usePanelContextMenuStore((s) => s.show)

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    showContext(e.clientX, e.clientY, panelName)
  }

  return (
    <div className={`card ${cssClass}`} data-panel-name={panelName} onContextMenu={handleContextMenu}>
      {showRowResize && (
        <div
          className="resize-handle flex justify-center items-center"
          onMouseDown={onRowResizeMouseDown}
        >
          <div
            style={{
              width: 40,
              height: 2,
              background: 'var(--sys-border)',
              borderRadius: 2,
              transition: 'background 0.2s',
            }}
          />
        </div>
      )}

      {/* Header */}
      <div className="card-header flex items-center gap-2">
        {isCollapsible && (
          <span
            className="material-icons handover-toggle-icon"
            style={{ cursor: 'pointer', fontSize: '1rem', userSelect: 'none' }}
            onClick={onToggleCollapse}
          >
            {isCollapsed ? 'expand_less' : 'expand_more'}
          </span>
        )}
        <span className="panel-name-text">{panelName}</span>
        <span
          className="panel-strip-count"
          data-count={stripCount}
        >
          {stripCount}
        </span>
      </div>

      <StripContainer panelName={panelName} />
    </div>
  )
}
