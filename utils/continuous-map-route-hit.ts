import type { Point } from '../domain/workspace'
import type { ContinuousMapRouteGeometry } from './continuous-map-route-geometry'

type Cubic = readonly [Point, Point, Point, Point]
type RouteCurve = Pick<ContinuousMapRouteGeometry, 'start' | 'control1' | 'control2' | 'end'>
interface CurveProjection {
  progression: number
  distanceSquared: number
}

function controlPoints({ start, control1, control2, end }: RouteCurve): Cubic {
  return [start, control1, control2, end]
}

/** Projects onto the displayed cubic and reports its logical parameter, including exact endpoints. */
export function projectPointOntoRoute(point: Point, curve: RouteCurve): number | null {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return null
  const controls = controlPoints(curve)
  const extent = Math.max(1, ...controls.map(p => Math.hypot(p.x - curve.start.x, p.y - curve.start.y)))
  return nearestCurveProjection(point, controls, (extent * 1e-7) ** 2).progression
}

function nearestCurveProjection(
  point: Point,
  controls: Cubic,
  toleranceSquared: number,
  distanceSquared = Number.POSITIVE_INFINITY,
): CurveProjection {
  return projectCurveSegment(point, controls, toleranceSquared, { progression: 0, distanceSquared }, 0, 0)
}

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
    const { distanceSquared: distance } = nearestCurveProjection(point, controlPoints(geometry), toleranceSquared, nearestDistance)
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

function pointDistanceSquared(left: Point, right: Point): number {
  return (left.x - right.x) ** 2 + (left.y - right.y) ** 2
}

function projectSegment(point: Point, start: Point, end: Point): { fraction: number; distanceSquared: number } {
  const x = end.x - start.x
  const y = end.y - start.y
  const lengthSquared = x * x + y * y
  const fraction = lengthSquared === 0 ? 0 : ((point.x - start.x) * x + (point.y - start.y) * y) / lengthSquared
  const along = Math.max(0, Math.min(1, fraction))
  return { fraction: along, distanceSquared: pointDistanceSquared(point, { x: start.x + x * along, y: start.y + y * along }) }
}

function projectCurveSegment(
  point: Point,
  [start, first, second, end]: Cubic,
  toleranceSquared: number,
  closest: CurveProjection,
  firstProgression: number,
  depth: number,
): CurveProjection {
  const left = Math.min(start.x, first.x, second.x, end.x)
  const right = Math.max(start.x, first.x, second.x, end.x)
  const top = Math.min(start.y, first.y, second.y, end.y)
  const bottom = Math.max(start.y, first.y, second.y, end.y)
  const gapX = Math.max(left - point.x, point.x - right, 0)
  const gapY = Math.max(top - point.y, point.y - bottom, 0)
  if (gapX * gapX + gapY * gapY >= closest.distanceSquared) return closest

  // The chord must approximate both the curve and its parameterization, even on straight paths.
  const dx = (end.x - start.x) / 3
  const dy = (end.y - start.y) / 3
  const span = 2 ** -depth
  if (depth >= 19 || (pointDistanceSquared(first, { x: start.x + dx, y: start.y + dy }) <= toleranceSquared
    && pointDistanceSquared(second, { x: end.x - dx, y: end.y - dy }) <= toleranceSquared)) {
    const projected = projectSegment(point, start, end)
    return projected.distanceSquared < closest.distanceSquared
      ? { progression: firstProgression + span * projected.fraction, distanceSquared: projected.distanceSquared }
      : closest
  }
  const startFirst = midpoint(start, first)
  const firstSecond = midpoint(first, second)
  const secondEnd = midpoint(second, end)
  const leftJoin = midpoint(startFirst, firstSecond)
  const rightJoin = midpoint(firstSecond, secondEnd)
  const split = midpoint(leftJoin, rightJoin)
  const leftProjection = projectCurveSegment(point, [start, startFirst, leftJoin, split], toleranceSquared, closest, firstProgression, depth + 1)
  return projectCurveSegment(point, [split, rightJoin, secondEnd, end], toleranceSquared, leftProjection, firstProgression + span / 2, depth + 1)
}
