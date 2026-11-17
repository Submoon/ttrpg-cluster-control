import type { Point } from '../domain/workspace'
import type { ContinuousMapRouteGeometry } from './continuous-map-route-geometry'

type Cubic = readonly [Point, Point, Point, Point]

/** Chooses among actual stroke hits in front-to-back paint order. */
export function nearestContinuousMapRouteHit(
  point: Point,
  candidates: readonly { id: string; geometry: ContinuousMapRouteGeometry }[],
  pixelsPerSceneUnit: number,
): string | undefined {
  if (!(pixelsPerSceneUnit > 0) || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return
  const toleranceSquared = (0.05 / pixelsPerSceneUnit) ** 2
  let nearest: string | undefined
  let nearestDistance = Number.POSITIVE_INFINITY
  for (const { id, geometry } of candidates) {
    const distance = distanceToCurveSquared(
      point, [geometry.start, geometry.control1, geometry.control2, geometry.end], toleranceSquared, nearestDistance, 0,
    )
    if (distance < nearestDistance) {
      nearest = id
      nearestDistance = distance
    }
  }
  return nearest
}

function midpoint(left: Point, right: Point): Point {
  return { x: (left.x + right.x) / 2, y: (left.y + right.y) / 2 }
}

function distanceToSegmentSquared(point: Point, start: Point, end: Point): number {
  const x = end.x - start.x
  const y = end.y - start.y
  const lengthSquared = x * x + y * y
  const fraction = lengthSquared === 0 ? 0 : ((point.x - start.x) * x + (point.y - start.y) * y) / lengthSquared
  const along = Math.max(0, Math.min(1, fraction))
  return (point.x - start.x - x * along) ** 2 + (point.y - start.y - y * along) ** 2
}

function distanceToCurveSquared(
  point: Point,
  [start, first, second, end]: Cubic,
  toleranceSquared: number,
  closestDistance: number,
  depth: number,
): number {
  const left = Math.min(start.x, first.x, second.x, end.x)
  const right = Math.max(start.x, first.x, second.x, end.x)
  const top = Math.min(start.y, first.y, second.y, end.y)
  const bottom = Math.max(start.y, first.y, second.y, end.y)
  const gapX = Math.max(left - point.x, point.x - right, 0)
  const gapY = Math.max(top - point.y, point.y - bottom, 0)
  if (gapX * gapX + gapY * gapY >= closestDistance) return closestDistance

  // The control polygon bounds the curve. Subdivide until its chord is subpixel-flat.
  if (depth >= 16 || (distanceToSegmentSquared(first, start, end) <= toleranceSquared
    && distanceToSegmentSquared(second, start, end) <= toleranceSquared)) {
    return Math.min(closestDistance, distanceToSegmentSquared(point, start, end))
  }
  const startFirst = midpoint(start, first)
  const firstSecond = midpoint(first, second)
  const secondEnd = midpoint(second, end)
  const leftJoin = midpoint(startFirst, firstSecond)
  const rightJoin = midpoint(firstSecond, secondEnd)
  const split = midpoint(leftJoin, rightJoin)
  const leftDistance = distanceToCurveSquared(point, [start, startFirst, leftJoin, split], toleranceSquared, closestDistance, depth + 1)
  return distanceToCurveSquared(point, [split, rightJoin, secondEnd, end], toleranceSquared, leftDistance, depth + 1)
}
