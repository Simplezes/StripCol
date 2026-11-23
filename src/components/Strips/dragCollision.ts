import { closestCenter, pointerWithin, rectIntersection, type CollisionDetection } from '@dnd-kit/core'

export const stripCollision: CollisionDetection = (args) => {
  const pointerHits = pointerWithin(args)
  const hits = pointerHits.length > 0 ? pointerHits : rectIntersection(args)

  const sectionHit = hits.find((hit) => args.droppableContainers.find((c) => c.id === hit.id)?.data.current?.type === 'section')
  if (!sectionHit) return hits

  const stripsInSection = args.droppableContainers.filter((container) => {
    const rect = args.droppableRects.get(container.id)
    return container.data.current?.sortable?.containerId === sectionHit.id && rect !== undefined && rect.height > 0
  })

  if (stripsInSection.length === 0) return [sectionHit]

  const closest = closestCenter({ ...args, droppableContainers: stripsInSection })
  return closest.length > 0 ? closest : [sectionHit]
}
