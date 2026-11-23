import { useEffect } from 'react'
import type { SensorAPI } from '@hello-pangea/dnd'

const START_DISTANCE = 6

export function useStripPointerSensor(api: SensorAPI) {
  useEffect(() => {
    function handlePointerDown(down: PointerEvent) {
      if (down.pointerType !== 'mouse' || down.button !== 0) return

      const draggableId = api.findClosestDraggableId(down)
      if (!draggableId) return

      const preDrag = api.tryGetLock(draggableId, release)
      if (!preDrag) return

      let drag: ReturnType<typeof preDrag.fluidLift> | null = null

      function release() {
        window.removeEventListener('pointermove', handleMove, true)
        window.removeEventListener('pointerup', handleUp, true)
        window.removeEventListener('keydown', handleKey, true)
      }

      function handleMove(move: PointerEvent) {
        const point = { x: move.clientX, y: move.clientY }

        if (!drag) {
          const travelled = Math.hypot(point.x - down.clientX, point.y - down.clientY)
          if (travelled < START_DISTANCE) return
          ;(document.activeElement as HTMLElement | null)?.blur()
          window.getSelection()?.removeAllRanges()
          drag = preDrag!.fluidLift(point)
          return
        }

        drag.move(point)
      }

      function handleUp() {
        if (drag) drag.drop()
        else preDrag!.abort()
        release()
      }

      function handleKey(event: KeyboardEvent) {
        if (event.key !== 'Escape') return
        if (drag) drag.cancel()
        else preDrag!.abort()
        release()
      }

      window.addEventListener('pointermove', handleMove, true)
      window.addEventListener('pointerup', handleUp, true)
      window.addEventListener('keydown', handleKey, true)
    }

    window.addEventListener('pointerdown', handlePointerDown, true)
    return () => window.removeEventListener('pointerdown', handlePointerDown, true)
  }, [api])
}
