import type { CSSProperties, PointerEvent, ReactNode } from 'react'
import { useUIStore } from '../../stores/uiStore'

interface AppShellProps {
  header: ReactNode
  board: ReactNode
  inspector: ReactNode
  footer: ReactNode
}

function InspectorResizer() {
  const setInspectorWidth = useUIStore((s) => s.setInspectorWidth)

  const startDrag = (event: PointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    const handle = event.currentTarget
    handle.setPointerCapture(event.pointerId)
    handle.classList.add('dragging')
    document.body.classList.add('resizing')

    const move = (e: globalThis.PointerEvent) => setInspectorWidth(window.innerWidth - e.clientX)
    const stop = () => {
      handle.classList.remove('dragging')
      document.body.classList.remove('resizing')
      handle.removeEventListener('pointermove', move)
      handle.removeEventListener('pointerup', stop)
      handle.removeEventListener('pointercancel', stop)
    }
    handle.addEventListener('pointermove', move)
    handle.addEventListener('pointerup', stop)
    handle.addEventListener('pointercancel', stop)
  }

  return <div className="insp-resize" role="separator" aria-orientation="vertical" aria-label="Resize inspector" onPointerDown={startDrag} />
}

export function AppShell({ header, board, inspector, footer }: AppShellProps) {
  const inspectorOpen = useUIStore((s) => s.inspectorOpen)
  const inspectorWidth = useUIStore((s) => s.inspectorWidth)
  const statusHidden = useUIStore((s) => s.statusHidden)

  return (
    <div
      className={`app${inspectorOpen ? '' : ' no-insp'}${statusHidden ? ' no-sbar' : ''}`}
      style={{ '--insp-w': `${inspectorWidth}px` } as CSSProperties}
    >
      {header}
      {board}
      {inspector}
      {inspectorOpen && <InspectorResizer />}
      {statusHidden ? null : footer}
    </div>
  )
}
