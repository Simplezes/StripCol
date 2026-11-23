import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useCellHintStore } from '../../stores/cellHintStore'
import { useDragStore } from '../../stores/dragStore'
import { cancelCellHint } from './useCellHint'

const HALF_WIDTH = 130
const GAP = 8

export function CellHintLayer() {
  const hint = useCellHintStore((s) => s.hint)
  const dragging = useDragStore((s) => s.activeId !== null)

  useEffect(() => {
    if (!hint) return
    window.addEventListener('keydown', cancelCellHint)
    window.addEventListener('blur', cancelCellHint)
    window.addEventListener('wheel', cancelCellHint, { passive: true })
    return () => {
      window.removeEventListener('keydown', cancelCellHint)
      window.removeEventListener('blur', cancelCellHint)
      window.removeEventListener('wheel', cancelCellHint)
    }
  }, [hint])

  if (!hint || dragging) return null

  const centre = Math.min(
    window.innerWidth - HALF_WIDTH - GAP,
    Math.max(HALF_WIDTH + GAP, hint.rect.left + hint.rect.width / 2),
  )
  const above = hint.rect.top > 110
  const style = above
    ? { left: centre, top: hint.rect.top - GAP, transform: 'translate(-50%, -100%)' }
    : { left: centre, top: hint.rect.bottom + GAP, transform: 'translate(-50%, 0)' }

  return createPortal(
    <div className="cell-hint" style={style} role="tooltip">
      <b>{hint.title}</b>
      <span>{hint.text}</span>
    </div>,
    document.body,
  )
}
