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
  sharesDisplayedEndpoints?: boolean
}

export interface ContinuousMapRouteDisplayScale {
  pixelsPerSceneUnit: number
  /** Screen space available for expanding coincident lanes beyond their canonical bends. */
  fanOutLimitPixels: number
}

export const CONTINUOUS_SYSTEM_FRAME_CORNER_RADIUS = 18

/**
 * Resolves where a ray from a system anchor meets its displayed rounded rectangular frame.
 * Collapsed frames or frames whose trimmed corner excludes the anchor safely resolve to the anchor.
 */
export function continuousMapRoundedRectBoundaryPoint(
  anchor: Point,
  frame: SvgViewportRect,
  toward: Point,
  coincidentDirection: Point = { x: 1, y: 0 },
): Point {
  if (!(frame.width > 0 && frame.height > 0)) return { ...anchor }
  const left = frame.x
  const top = frame.y
  const right = frame.x + frame.width
  const bottom = frame.y + frame.height
  const radius = Math.min(
    CONTINUOUS_SYSTEM_FRAME_CORNER_RADIUS,
    frame.width / 2,
    frame.height / 2,
  )
  if (!roundedRectContains(anchor, left, top, right, bottom, radius)) return { ...anchor }

  let dx = toward.x - anchor.x
  let dy = toward.y - anchor.y
  if (dx === 0 && dy === 0) {
    dx = coincidentDirection.x
    dy = coincidentDirection.y
    if (dx === 0 && dy === 0) dx = 1
  }

  const boundsDistance = Math.min(
    dx > 0 ? (right - anchor.x) / dx : dx < 0 ? (left - anchor.x) / dx : Number.POSITIVE_INFINITY,
    dy > 0 ? (bottom - anchor.y) / dy : dy < 0 ? (top - anchor.y) / dy : Number.POSITIVE_INFINITY,
  )
  if (radius === 0) return pointAt(anchor, dx, dy, boundsDistance)

  const candidates: number[] = []
  addStraightBoundaryCandidates(anchor, dx, dy, left, top, right, bottom, radius, candidates)
  addRoundedCornerCandidates(anchor, dx, dy, left, top, right, bottom, radius, boundsDistance, candidates)
  const distance = Math.min(...candidates)
  return Number.isFinite(distance) ? pointAt(anchor, dx, dy, distance) : { ...anchor }
}

function roundedRectContains(
  point: Point,
  left: number,
  top: number,
  right: number,
  bottom: number,
  radius: number,
): boolean {
  if (point.x < left || point.x > right || point.y < top || point.y > bottom) return false
  if (radius === 0) return true
  const centerX = Math.max(left + radius, Math.min(right - radius, point.x))
  const centerY = Math.max(top + radius, Math.min(bottom - radius, point.y))
  const dx = point.x - centerX
  const dy = point.y - centerY
  return dx * dx + dy * dy <= radius * radius + Number.EPSILON * radius * radius * 16
}

function addStraightBoundaryCandidates(
  anchor: Point,
  dx: number,
  dy: number,
  left: number,
  top: number,
  right: number,
  bottom: number,
  radius: number,
  candidates: number[],
): void {
  const epsilon = 1e-9
  if (dx < 0) {
    const distance = (left - anchor.x) / dx
    const y = anchor.y + dy * distance
    if (y >= top + radius - epsilon && y <= bottom - radius + epsilon) candidates.push(distance)
  } else if (dx > 0) {
    const distance = (right - anchor.x) / dx
    const y = anchor.y + dy * distance
    if (y >= top + radius - epsilon && y <= bottom - radius + epsilon) candidates.push(distance)
  }
  if (dy < 0) {
    const distance = (top - anchor.y) / dy
    const x = anchor.x + dx * distance
    if (x >= left + radius - epsilon && x <= right - radius + epsilon) candidates.push(distance)
  } else if (dy > 0) {
    const distance = (bottom - anchor.y) / dy
    const x = anchor.x + dx * distance
    if (x >= left + radius - epsilon && x <= right - radius + epsilon) candidates.push(distance)
  }
}

function addRoundedCornerCandidates(
  anchor: Point,
  dx: number,
  dy: number,
  left: number,
  top: number,
  right: number,
  bottom: number,
  radius: number,
  boundsDistance: number,
  candidates: number[],
): void {
  const corners = [
    { x: left + radius, y: top + radius, isOnArc: (point: Point) => point.x <= left + radius && point.y <= top + radius },
    { x: right - radius, y: top + radius, isOnArc: (point: Point) => point.x >= right - radius && point.y <= top + radius },
    { x: left + radius, y: bottom - radius, isOnArc: (point: Point) => point.x <= left + radius && point.y >= bottom - radius },
    { x: right - radius, y: bottom - radius, isOnArc: (point: Point) => point.x >= right - radius && point.y >= bottom - radius },
  ]
  const a = dx * dx + dy * dy
  if (a === 0) return
  const epsilon = 1e-8

  for (const corner of corners) {
    const offsetX = anchor.x - corner.x
    const offsetY = anchor.y - corner.y
    const b = 2 * (offsetX * dx + offsetY * dy)
    const c = offsetX * offsetX + offsetY * offsetY - radius * radius
    const discriminant = b * b - 4 * a * c
    if (discriminant < -epsilon) continue
    const root = Math.sqrt(Math.max(0, discriminant))
    for (const distance of [(-b - root) / (2 * a), (-b + root) / (2 * a)]) {
      if (distance < 0 || distance > boundsDistance + epsilon) continue
      const point = pointAt(anchor, dx, dy, distance)
      if (corner.isOnArc(point)) candidates.push(distance)
    }
  }
}

function pointAt(anchor: Point, dx: number, dy: number, distance: number): Point {
  return { x: anchor.x + dx * distance, y: anchor.y + dy * distance }
}

const LANE_SPACING = 32
const MINIMUM_LOOP_RADIUS = 24
const LANE_SPACING_PIXELS = 32
const MINIMUM_LOOP_RADIUS_PIXELS = 36

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
  display?: ContinuousMapRouteDisplayScale,
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
  const sharedPairExtents = new Map<string, number>()
  for (const routes of displayedPairs.values()) {
    const used = new Set<number>()
    const overflow: string[] = []
    let lastLane = 0
    let largestLane = 0
    for (const route of routes) {
      const followsSystemOrder = route.toSystemId === null || route.fromSystemId <= route.toSystemId
      const direction = followsSystemOrder === followsPointOrder(route) ? 1 : -1
      const lane = (preferredLanes.get(route.id) ?? 1) * direction
      if (used.has(lane)) overflow.push(route.id)
      else {
        displayedLanes.set(route.id, lane)
        used.add(lane)
        lastLane = Math.max(lastLane, lane)
        largestLane = Math.max(largestLane, Math.abs(lane))
      }
    }
    // Distinct logical pairs can collapse onto the same pair of displayed positions.
    for (const routeId of overflow) displayedLanes.set(routeId, ++lastLane)
    if (routes.length > 1) {
      for (const route of routes) sharedPairExtents.set(route.id, Math.max(largestLane, lastLane))
    }
  }

  return new Map(routes.map(route => {
    const { id, start, end } = route
    const dx = end.x - start.x
    const dy = end.y - start.y
    const length = Math.hypot(dx, dy)
    const lane = displayedLanes.get(id)!
    const pairExtent = sharedPairExtents.get(id)
    const { spacing, loopRadius } = routeLaneMetrics(pairExtent, length === 0, display)
    let geometry: ContinuousMapRouteGeometry
    if (length === 0) {
      const radius = loopRadius + Math.abs(lane) * spacing
      const side = lane < 0 ? -1 : 1
      const direction = route.toSystemId !== null && route.fromSystemId > route.toSystemId ? -1 : 1
      const control1 = { x: start.x + direction * radius, y: start.y + side * radius }
      const control2 = { x: start.x - direction * radius, y: start.y + side * radius }
      geometry = continuousMapRouteCurve(start, control1, control2, end)
    } else {
      const bend = lane * spacing * (followsPointOrder(route) ? 1 : -1)
      const offsetX = -dy / length * bend
      const offsetY = dx / length * bend
      const control1 = { x: start.x + dx / 3 + offsetX, y: start.y + dy / 3 + offsetY }
      const control2 = { x: end.x - dx / 3 + offsetX, y: end.y - dy / 3 + offsetY }
      geometry = continuousMapRouteCurve(start, control1, control2, end)
    }
    return [id, pairExtent === undefined ? geometry : { ...geometry, sharesDisplayedEndpoints: true }]
  }))
}

function routeLaneMetrics(
  pairExtent: number | undefined,
  coincident: boolean,
  display: ContinuousMapRouteDisplayScale | undefined,
): { spacing: number; loopRadius: number } {
  if (!pairExtent || !display || !(display.pixelsPerSceneUnit > 0)) {
    return { spacing: LANE_SPACING, loopRadius: MINIMUM_LOOP_RADIUS }
  }
  const baseLoopPixels = coincident ? Math.min(MINIMUM_LOOP_RADIUS_PIXELS, display.fanOutLimitPixels / 2) : 0
  const spacingPixels = Math.min(LANE_SPACING_PIXELS, (display.fanOutLimitPixels - baseLoopPixels) / pairExtent)
  return {
    spacing: Math.max(LANE_SPACING, spacingPixels / display.pixelsPerSceneUnit),
    loopRadius: Math.max(MINIMUM_LOOP_RADIUS, baseLoopPixels / display.pixelsPerSceneUnit),
  }
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
