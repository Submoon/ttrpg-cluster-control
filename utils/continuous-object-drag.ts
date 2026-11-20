import type { Point } from '../domain/workspace'
import type { ContinuousWardenSystemProjection } from './continuous-map-projection'

/** Resolves a grabbed object's translated local position without snapping its origin to the pointer. */
export function continuousObjectDragTarget(
  projection: Pick<ContinuousWardenSystemProjection, 'unprojectLocalPoint'>,
  anchorDelta: Point,
  objectOrigin: Point,
  pointerStart: Point,
  pointerCurrent: Point,
): Point {
  const startLocal = projection.unprojectLocalPoint({
    x: pointerStart.x - anchorDelta.x,
    y: pointerStart.y - anchorDelta.y,
  })
  const currentLocal = projection.unprojectLocalPoint({
    x: pointerCurrent.x - anchorDelta.x,
    y: pointerCurrent.y - anchorDelta.y,
  })
  return {
    x: objectOrigin.x + currentLocal.x - startLocal.x,
    y: objectOrigin.y + currentLocal.y - startLocal.y,
  }
}

/** Uses visible client pixels so the drag latch remains stable at every camera zoom. */
export function hasMapDragThreshold(start: Point, current: Point, thresholdPixels = 4): boolean {
  return Math.hypot(current.x - start.x, current.y - start.y) >= thresholdPixels
}
