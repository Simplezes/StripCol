import type { MouseEvent } from 'react'
import { useConnectionStore } from '../../stores/connectionStore'
import { useCellHintStore } from '../../stores/cellHintStore'
import { describeCell } from './cellHelp'

const HINT_DELAY_MS = 700

let timer: ReturnType<typeof setTimeout> | null = null
let pendingCell: HTMLElement | null = null

export function cancelCellHint(): void {
  if (timer) clearTimeout(timer)
  timer = null
  pendingCell = null
  useCellHintStore.getState().hide()
}

function cellOf(target: EventTarget): HTMLElement | null {
  return target instanceof HTMLElement ? target.closest<HTMLElement>('[data-cell]') : null
}

export function useCellHint(stripType: string) {
  const onMouseOver = (event: MouseEvent) => {
    const cell = cellOf(event.target)
    if (cell === pendingCell) return

    cancelCellHint()
    if (!cell) return

    pendingCell = cell
    timer = setTimeout(() => {
      const { controllerMode } = useConnectionStore.getState()
      const help = describeCell(cell.dataset.cell ?? '', controllerMode, stripType)
      useCellHintStore.getState().show({ ...help, rect: cell.getBoundingClientRect() })
    }, HINT_DELAY_MS)
  }

  return {
    onMouseOver,
    onMouseLeave: cancelCellHint,
    onMouseDown: cancelCellHint,
  }
}
