import { useLayoutEffect, type RefObject } from 'react'

const MIN_FONT_PX = 8
const measureCanvas = document.createElement('canvas')

function textOf(cell: HTMLElement): string[] {
  if (cell instanceof HTMLInputElement) return [cell.value]
  return Array.from(cell.children).map((child) => child.textContent ?? '')
}

function fitCell(cell: HTMLElement): void {
  cell.style.fontSize = ''
  const available = cell.clientWidth
  if (available === 0) return

  const style = getComputedStyle(cell)
  const baseSize = parseFloat(style.fontSize)
  const padding = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight)
  const room = available - padding
  const lines = textOf(cell).filter(Boolean)
  const context = measureCanvas.getContext('2d')
  if (!context || lines.length === 0 || room <= 0) return

  context.font = `${style.fontWeight} ${baseSize}px ${style.fontFamily}`
  const widest = Math.max(...lines.map((line) => context.measureText(line).width))
  if (widest <= room) return

  const fitted = Math.max(MIN_FONT_PX, Math.floor(baseSize * (room / widest) * 10) / 10)
  cell.style.fontSize = `${fitted}px`
}

export function useFitText(rootRef: RefObject<HTMLElement | null>, dependency: unknown): void {
  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return

    const fitAll = () => root.querySelectorAll<HTMLElement>('.box').forEach(fitCell)
    fitAll()
    document.fonts?.ready.then(fitAll)

    const observer = new ResizeObserver(fitAll)
    observer.observe(root)
    return () => observer.disconnect()
  }, [rootRef, dependency])
}
