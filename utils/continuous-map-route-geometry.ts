import type { Point } from '../domain/workspace'
import type { SvgViewportRect } from './map-zoom'

export interface ContinuousMapRouteEndpoints {
  id: string
  fromSystemId: string
  toSystemId: string | null
  start: Point
  end: Point
}

export interface ContinuousMapRouteGeometry {
  start: Point
  control1: Point
  control2: Point
  end: Point
  path: string
  midpoint: Point
  bounds: SvgViewportRect
}

const LANE_SPACING = 32
const MINIMUM_LOOP_RADIUS = 24

/** Builds renderable geometry from the scene points of a continuous cubic route. */
export function continuousMapRouteCurve(
  start: Point,
  control1: Point,
  control2: Point,
  end: Point,
): ContinuousMapRouteGeometry {
  const horizontal = cubicExtents(start.x, control1.x, control2.x, end.x)
  const vertical = cubicExtents(start.y, control1.y, control2.y, end.y)
  return {
    start,
    control1,
    control2,
    end,
    path: `M ${start.x} ${start.y} C ${control1.x} ${control1.y} ${control2.x} ${control2.y} ${end.x} ${end.y}`,
    midpoint: {
      x: (start.x + 3 * control1.x + 3 * control2.x + end.x) / 8,
      y: (start.y + 3 * control1.y + 3 * control2.y + end.y) / 8,
    },
    bounds: {
      x: horizontal.min,
      y: vertical.min,
      width: horizontal.max - horizontal.min,
      height: vertical.max - vertical.min,
    },
  }
}

function cubicExtents(start: number, control1: number, control2: number, end: number): { min: number; max: number } {
  const firstDelta = control1 - start
  const middleDelta = control2 - control1
  const finalDelta = end - control2
  // Extrema are the interior roots of the cubic's derivative along this axis.
  const a = finalDelta - 2 * middleDelta + firstDelta
  const b = 2 * (middleDelta - firstDelta)
  const c = firstDelta
  const candidates = [start, end]
  for (const t of derivativeRoots(a, b, c)) {
    if (t > 0 && t < 1) candidates.push(start + t * (3 * c + t * (1.5 * b + t * a)))
  }
  return { min: Math.min(...candidates), max: Math.max(...candidates) }
}

function derivativeRoots(a: number, b: number, c: number): number[] {
  if (a === 0) return b === 0 ? [] : [-c / b]
  const discriminant = b * b - 4 * a * c
  if (discriminant < 0) return []
  // Use the larger-magnitude numerator first to avoid cancellation for a nearly linear derivative.
  const numerator = -0.5 * (b + (b < 0 ? -1 : 1) * Math.sqrt(discriminant))
  return numerator === 0 ? [0] : [numerator / a, c / numerator]
}

/** Draws continuous route geometry from independently resolved Warden or player endpoints. */
export function buildContinuousMapRouteGeometries(
  routes: readonly ContinuousMapRouteEndpoints[],
): ReadonlyMap<string, ContinuousMapRouteGeometry> {
  const sortedRoutes = [...routes].sort((left, right) => left.id < right.id ? -1 : left.id === right.id ? 0 : 1)
  const logicalPairs = new Map<string, ContinuousMapRouteEndpoints[]>()
  const displayedPairs = new Map<string, ContinuousMapRouteEndpoints[]>()
  const preferredLanes = new Map<string, number>()
  for (const route of sortedRoutes) {
    const { start, end, fromSystemId, toSystemId } = route
    if (toSystemId !== null) {
      const [first, second] = [fromSystemId, toSystemId].sort()
      appendRoute(logicalPairs, JSON.stringify([first, second]), route)
    }
    const [first, second] = followsPointOrder(route) ? [start, end] : [end, start]
    appendRoute(displayedPairs, JSON.stringify([first.x, first.y, second.x, second.y]), route)
  }

  for (const routes of logicalPairs.values()) {
    const half = Math.floor(routes.length / 2)
    routes.forEach((route, index) => {
      const lane = routes.length === 1 ? 1 : index - half + Number(routes.length % 2 === 0 && index >= half)
      preferredLanes.set(route.id, lane)
    })
  }

  const displayedLanes = new Map<string, number>()
  for (const routes of displayedPairs.values()) {
    const used = new Set<number>()
    const overflow: string[] = []
    let lastLane = 0
    for (const route of routes) {
      const followsSystemOrder = route.toSystemId === null || route.fromSystemId <= route.toSystemId
      const direction = followsSystemOrder === followsPointOrder(route) ? 1 : -1
      const lane = (preferredLanes.get(route.id) ?? 1) * direction
      if (used.has(lane)) overflow.push(route.id)
      else {
        displayedLanes.set(route.id, lane)
        used.add(lane)
        lastLane = Math.max(lastLane, lane)
      }
    }
    // Distinct logical pairs can collapse onto the same pair of displayed positions.
    for (const routeId of overflow) displayedLanes.set(routeId, ++lastLane)
  }

  return new Map(routes.map(route => {
    const { id, start, end } = route
    const dx = end.x - start.x
    const dy = end.y - start.y
    const length = Math.hypot(dx, dy)
    const lane = displayedLanes.get(id)!
    if (length === 0) {
      const radius = MINIMUM_LOOP_RADIUS + Math.abs(lane) * LANE_SPACING
      const side = lane < 0 ? -1 : 1
      const direction = route.toSystemId !== null && route.fromSystemId > route.toSystemId ? -1 : 1
      const control1 = { x: start.x + direction * radius, y: start.y + side * radius }
      const control2 = { x: start.x - direction * radius, y: start.y + side * radius }
      return [id, continuousMapRouteCurve(start, control1, control2, end)]
    }
    const bend = lane * LANE_SPACING * (followsPointOrder(route) ? 1 : -1)
    const offsetX = -dy / length * bend
    const offsetY = dx / length * bend
    const control1 = { x: start.x + dx / 3 + offsetX, y: start.y + dy / 3 + offsetY }
    const control2 = { x: end.x - dx / 3 + offsetX, y: end.y - dy / 3 + offsetY }
    return [id, continuousMapRouteCurve(start, control1, control2, end)]
  }))
}

function appendRoute(
  groups: Map<string, ContinuousMapRouteEndpoints[]>,
  key: string,
  route: ContinuousMapRouteEndpoints,
): void {
  const group = groups.get(key)
  if (group) group.push(route)
  else groups.set(key, [route])
}

function followsPointOrder({ start, end }: ContinuousMapRouteEndpoints): boolean {
  return start.x < end.x || (start.x === end.x && start.y <= end.y)
}
