import type { Point } from '../domain/workspace'
import { CONTINUOUS_SYSTEM_FRAME_CORNER_RADIUS } from './continuous-map-route-geometry'
import { constrainContinuousSystemFrame, continuousSystemFrames, type ContinuousSystemFrameInput } from './continuous-system-frames'
import type { SvgViewportRect } from './map-zoom'

const ELASTIC_REACH_PIXELS = 80

export interface ContinuousMapElasticPlacementInput {
  systemId: string
  anchor: Point
  /** The frame being shown before this gesture, after neighboring-frame clipping. */
  displayedFrame: SvgViewportRect
  /** The unclipped authored frame, or the starting content frame for a legacy system. */
  preferredFrame: SvgViewportRect
  target: Point
  fixedFrames: readonly ContinuousSystemFrameInput[]
  pixelsPerSceneUnit: number
}

export interface ContinuousMapElasticPlacementPreview {
  /** Closed, smoothed contour used only while the object gesture is active. */
  path: string
  /** The constrained regular frame that would be displayed after a valid release. */
  displayedFrame: SvgViewportRect
  /** The authored frame to store on a valid release. */
  preferredFrame: SvgViewportRect
  /** Whether the released root point fits in the temporarily stretched contour. */
  acceptsDrop: boolean
}

interface ContourPoint extends Point {
  phase: number
  distance: number
}

interface Contour {
  length: number
  points: ContourPoint[]
  at(phase: number): ContourPoint
}

/**
 * Builds a local rounded-frame stretch preview and a constrained regular frame for an accepted drop.
 * The path is presentation only; callers persist `preferredFrame` only when `acceptsDrop` is true.
 */
export function planContinuousMapElasticPlacement(
  input: ContinuousMapElasticPlacementInput,
): ContinuousMapElasticPlacementPreview | null {
  const { systemId, anchor, displayedFrame, preferredFrame, target, fixedFrames, pixelsPerSceneUnit } = input
  if (![anchor.x, anchor.y, target.x, target.y, pixelsPerSceneUnit].every(Number.isFinite)
    || pixelsPerSceneUnit <= 0
    || !isFinitePositiveFrame(displayedFrame)
    || !isFinitePositiveFrame(preferredFrame)
    || fixedFrames.some(frame => frame.id === systemId || !isFiniteFrame(frame.envelope))) return null

  const radius = frameRadius(displayedFrame)
  const located = locateRoundedFrame(target, displayedFrame, radius)
  if (located.inside) return null

  const previewReach = ELASTIC_REACH_PIXELS / pixelsPerSceneUnit
  const gap = located.distance
  if (!Number.isFinite(gap) || gap < 0.05 / pixelsPerSceneUnit
    || gap > previewReach) return null

  // Most drops are nowhere near an envelope. Reject those analytically before sampling a contour.
  const sampledContour = roundedFrameContour(displayedFrame, radius)
  const nearest = sampledContour.at(located.phase)
  const contour = contourWithPoint(sampledContour, nearest)
  const growthMargin = Math.max(Number.EPSILON, Math.min(0.001, previewReach / 1000))
  const commitBudget = previewReach + growthMargin
  const stretch = Math.min(previewReach, gap + Math.min(8 / pixelsPerSceneUnit, gap * 1.5))
  const direction = {
    x: (target.x - nearest.x) / gap,
    y: (target.y - nearest.y) / gap,
  }
  const maximum = maximumSafeStretch(contour, located.phase, direction, stretch, fixedFrames)
  const stretched = deformContour(contour, located.phase, {
    x: direction.x * stretch * maximum,
    y: direction.y * stretch * maximum,
  })
  const preferredCandidate = growRoundedFrameToContain(
    preferredFrame,
    target,
    CONTINUOUS_SYSTEM_FRAME_CORNER_RADIUS,
    growthMargin,
  )
  let displayedCandidate: SvgViewportRect
  try {
    displayedCandidate = constrainContinuousSystemFrame(
      { id: systemId, anchor, envelope: preferredCandidate },
      fixedFrames,
    )
  } catch {
    return null
  }
  const acceptsDrop = withinGrowthBudget(preferredFrame, preferredCandidate, commitBudget)
    && continuousMapRoundedFrameContains(target, displayedCandidate)
    && pointInPolygonInclusive(target, stretched.points)

  return {
    path: contourPath(stretched.points),
    displayedFrame: displayedCandidate,
    preferredFrame: preferredCandidate,
    acceptsDrop,
  }
}

/** Returns the nearest point on a rounded rectangle, including its Euclidean distance. */
export function nearestContinuousMapRoundedFramePoint(
  point: Point,
  frame: SvgViewportRect,
): { point: Point; distance: number } {
  if (!isFinitePositiveFrame(frame) || !Number.isFinite(point.x) || !Number.isFinite(point.y)) {
    return { point: { ...point }, distance: Number.POSITIVE_INFINITY }
  }
  const nearest = locateRoundedFrame(point, frame, frameRadius(frame))
  return { point: { x: nearest.x, y: nearest.y }, distance: nearest.distance }
}

/** Returns true when the scene point lies inside the regular rounded frame. */
export function continuousMapRoundedFrameContains(point: Point, frame: SvgViewportRect): boolean {
  if (!isFinitePositiveFrame(frame) || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return false
  return roundedFrameContains(point, frame, frameRadius(frame))
}

/** Creates the rounded-rectangle SVG contour shared by frame and elastic previews. */
export function continuousMapRoundedFramePath(frame: SvgViewportRect): string {
  const radius = frameRadius(frame)
  return [
    'M', frame.x + radius, frame.y,
    'H', frame.x + frame.width - radius,
    'A', radius, radius, 0, 0, 1, frame.x + frame.width, frame.y + radius,
    'V', frame.y + frame.height - radius,
    'A', radius, radius, 0, 0, 1, frame.x + frame.width - radius, frame.y + frame.height,
    'H', frame.x + radius,
    'A', radius, radius, 0, 0, 1, frame.x, frame.y + frame.height - radius,
    'V', frame.y + radius,
    'A', radius, radius, 0, 0, 1, frame.x + radius, frame.y,
    'Z',
  ].join(' ')
}

function frameRadius(frame: SvgViewportRect): number {
  return Math.max(0, Math.min(CONTINUOUS_SYSTEM_FRAME_CORNER_RADIUS, frame.width / 2, frame.height / 2))
}

function isFinitePositiveFrame(frame: SvgViewportRect): boolean {
  return isFiniteFrame(frame) && frame.width > 0 && frame.height > 0
}

function isFiniteFrame(frame: SvgViewportRect): boolean {
  return [frame.x, frame.y, frame.width, frame.height, frame.x + frame.width, frame.y + frame.height].every(Number.isFinite)
    && Number.isFinite(2 * (frame.width + frame.height))
    && frame.width >= 0 && frame.height >= 0
}

function locateRoundedFrame(
  point: Point,
  frame: SvgViewportRect,
  radius: number,
): { inside: boolean; x: number; y: number; phase: number; distance: number } {
  let nearest = { x: 0, y: 0, phase: 0, distance: Number.POSITIVE_INFINITY }
  const consider = (phase: number) => {
    const candidate = roundedFramePointAt(frame, radius, phase)
    const distance = Math.hypot(point.x - candidate.x, point.y - candidate.y)
    if (distance < nearest.distance) nearest = { ...candidate, distance }
  }
  const right = frame.x + frame.width
  const bottom = frame.y + frame.height
  const lines = [
    [{ x: frame.x + radius, y: frame.y }, { x: right - radius, y: frame.y }],
    [{ x: right, y: frame.y + radius }, { x: right, y: bottom - radius }],
    [{ x: right - radius, y: bottom }, { x: frame.x + radius, y: bottom }],
    [{ x: frame.x, y: bottom - radius }, { x: frame.x, y: frame.y + radius }],
  ] as const
  for (const [lineIndex, [start, end]] of lines.entries()) {
    const dx = end.x - start.x
    const dy = end.y - start.y
    const squareLength = dx * dx + dy * dy
    const fraction = squareLength === 0
      ? 0
      : clamp(((point.x - start.x) * dx + (point.y - start.y) * dy) / squareLength, 0, 1)
    consider(lineIndex * 2 + fraction)
  }

  if (radius > 0) {
    const arcs = [
      { center: { x: right - radius, y: frame.y + radius }, start: -Math.PI / 2 },
      { center: { x: right - radius, y: bottom - radius }, start: 0 },
      { center: { x: frame.x + radius, y: bottom - radius }, start: Math.PI / 2 },
      { center: { x: frame.x + radius, y: frame.y + radius }, start: Math.PI },
    ] as const
    for (const [arcIndex, arc] of arcs.entries()) {
      const angle = Math.atan2(point.y - arc.center.y, point.x - arc.center.x)
      const relative = ((angle - arc.start) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2)
      consider(arcIndex * 2 + 1 + clamp(relative / (Math.PI / 2), 0, 1))
    }
  }
  return { ...nearest, inside: roundedFrameContains(point, frame, radius) }
}

function roundedFramePointAt(frame: SvgViewportRect, radius: number, phase: number): ContourPoint {
  const wrapped = (phase + 8) % 8
  const index = Math.floor(wrapped)
  const fraction = wrapped - index
  const right = frame.x + frame.width
  const bottom = frame.y + frame.height
  let point: Point
  if (index === 0) point = { x: frame.x + radius + (frame.width - 2 * radius) * fraction, y: frame.y }
  else if (index === 1) point = arc({ x: right - radius, y: frame.y + radius }, radius, -Math.PI / 2).at(fraction)
  else if (index === 2) point = { x: right, y: frame.y + radius + (frame.height - 2 * radius) * fraction }
  else if (index === 3) point = arc({ x: right - radius, y: bottom - radius }, radius, 0).at(fraction)
  else if (index === 4) point = { x: right - radius - (frame.width - 2 * radius) * fraction, y: bottom }
  else if (index === 5) point = arc({ x: frame.x + radius, y: bottom - radius }, radius, Math.PI / 2).at(fraction)
  else if (index === 6) point = { x: frame.x, y: bottom - radius - (frame.height - 2 * radius) * fraction }
  else point = arc({ x: frame.x + radius, y: frame.y + radius }, radius, Math.PI).at(fraction)
  const lengths = [
    Math.max(0, frame.width - 2 * radius),
    Math.PI * radius / 2,
    Math.max(0, frame.height - 2 * radius),
    Math.PI * radius / 2,
    Math.max(0, frame.width - 2 * radius),
    Math.PI * radius / 2,
    Math.max(0, frame.height - 2 * radius),
    Math.PI * radius / 2,
  ]
  let distance = 0
  for (let segment = 0; segment < index; segment += 1) distance += lengths[segment]!
  return { ...point, phase: wrapped, distance: distance + lengths[index]! * fraction }
}

function roundedFrameContains(point: Point, frame: SvgViewportRect, radius: number): boolean {
  const right = frame.x + frame.width
  const bottom = frame.y + frame.height
  if (point.x < frame.x || point.x > right || point.y < frame.y || point.y > bottom) return false
  const centerX = clamp(point.x, frame.x + radius, right - radius)
  const centerY = clamp(point.y, frame.y + radius, bottom - radius)
  const dx = point.x - centerX
  const dy = point.y - centerY
  return dx * dx + dy * dy <= radius * radius + Number.EPSILON * radius * radius * 16
}

function growRoundedFrameToContain(frame: SvgViewportRect, point: Point, radius: number, margin: number): SvgViewportRect {
  let left = Math.min(frame.x, point.x - margin)
  let top = Math.min(frame.y, point.y - margin)
  let right = Math.max(frame.x + frame.width, point.x + margin)
  let bottom = Math.max(frame.y + frame.height, point.y + margin)
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const candidate = { x: left, y: top, width: right - left, height: bottom - top }
    if (roundedFrameContains(point, candidate, frameRadius(candidate))) return candidate
    const localRadius = Math.min(radius, candidate.width / 2, candidate.height / 2)
    const centerX = clamp(point.x, left + localRadius, right - localRadius)
    const centerY = clamp(point.y, top + localRadius, bottom - localRadius)
    const distance = Math.hypot(point.x - centerX, point.y - centerY)
    const extra = Math.max(0.001, distance - localRadius + 0.001)
    if (point.x < left + localRadius) left -= extra
    else if (point.x > right - localRadius) right += extra
    if (point.y < top + localRadius) top -= extra
    else if (point.y > bottom - localRadius) bottom += extra
  }
  return { x: left, y: top, width: right - left, height: bottom - top }
}

function roundedFrameContour(frame: SvgViewportRect, radius: number): Contour {
  return roundedFrameContourGeometry(frame, radius)
}

function roundedFrameContourGeometry(frame: SvgViewportRect, radius: number): Contour {
  const right = frame.x + frame.width
  const bottom = frame.y + frame.height
  const horizontalLength = Math.max(0, frame.width - 2 * radius)
  const verticalLength = Math.max(0, frame.height - 2 * radius)
  const segments = [
    line({ x: frame.x + radius, y: frame.y }, horizontalLength, { x: horizontalLength, y: 0 }),
    arc({ x: right - radius, y: frame.y + radius }, radius, -Math.PI / 2),
    line({ x: right, y: frame.y + radius }, verticalLength, { x: 0, y: verticalLength }),
    arc({ x: right - radius, y: bottom - radius }, radius, 0),
    line({ x: right - radius, y: bottom }, horizontalLength, { x: -horizontalLength, y: 0 }),
    arc({ x: frame.x + radius, y: bottom - radius }, radius, Math.PI / 2),
    line({ x: frame.x, y: bottom - radius }, verticalLength, { x: 0, y: -verticalLength }),
    arc({ x: frame.x + radius, y: frame.y + radius }, radius, Math.PI),
  ].map((segment, index) => ({ ...segment, index, start: 0 }))

  let length = 0
  for (const segment of segments) {
    segment.start = length
    length += segment.length
  }
  const at = (phase: number): ContourPoint => {
    const wrapped = (phase + 8) % 8
    const index = Math.floor(wrapped)
    const segment = segments[index]!
    const fraction = wrapped - index
    const point = segment.at(fraction)
    return { ...point, phase: wrapped, distance: segment.start + segment.length * fraction }
  }
  const points = segments.flatMap((segment, index) => {
    const steps = Math.min(64, 2 * Math.max(1, Math.ceil(segment.length / 8)))
    return Array.from({ length: steps }, (_, step) => at(index + step / steps))
  })
  return { length, points, at }
}

/** Keep the exact nearest location in the sampled sequence used for both the visible curve and safety checks. */
function contourWithPoint(contour: Contour, point: ContourPoint): Contour {
  const distanceTolerance = Math.max(Number.EPSILON * contour.length * 8, 1e-9)
  if (contour.points.some(sample => Math.abs(sample.distance - point.distance) <= distanceTolerance)) return contour

  const nextSampleIndex = contour.points.findIndex(sample => sample.distance > point.distance)
  const insertionIndex = nextSampleIndex === -1 ? contour.points.length : nextSampleIndex
  const points = [
    ...contour.points.slice(0, insertionIndex),
    point,
    ...contour.points.slice(insertionIndex),
  ]
  return { ...contour, points }
}

function line(start: Point, length: number, delta: Point) {
  return {
    length,
    at: (fraction: number): Point => ({ x: start.x + delta.x * fraction, y: start.y + delta.y * fraction }),
  }
}

function arc(center: Point, radius: number, start: number) {
  return {
    length: Math.PI * radius / 2,
    at: (fraction: number): Point => ({
      x: center.x + radius * Math.cos(start + fraction * Math.PI / 2),
      y: center.y + radius * Math.sin(start + fraction * Math.PI / 2),
    }),
  }
}

function deformContour(contour: Contour, phase: number, delta: Point): Contour {
  const centerDistance = contour.at(phase).distance
  const influence = (point: ContourPoint): number => {
    const around = Math.abs(centerDistance - point.distance)
    const distance = Math.min(around, contour.length - around) / Math.min(99, contour.length * 0.17)
    return Math.max(0, 1 - distance * distance) ** 3
  }
  const move = (point: ContourPoint): ContourPoint => {
    const weight = influence(point)
    return { ...point, x: point.x + weight * delta.x, y: point.y + weight * delta.y }
  }
  return {
    length: contour.length,
    points: contour.points.map(move),
    at: (nextPhase: number) => move(contour.at(nextPhase)),
  }
}

function maximumSafeStretch(
  contour: Contour,
  phase: number,
  direction: Point,
  stretch: number,
  fixedFrames: readonly ContinuousSystemFrameInput[],
): number {
  if (stretch <= 0 || fixedFrames.length === 0) return 1
  const centerDistance = contour.at(phase).distance
  let maximum = 1
  for (const point of contour.points) {
    const around = Math.abs(centerDistance - point.distance)
    const t = Math.min(around, contour.length - around) / Math.min(99, contour.length * 0.17)
    const weight = Math.max(0, 1 - t * t) ** 3
    if (weight === 0) continue
    const end = {
      x: point.x + direction.x * stretch * weight,
      y: point.y + direction.y * stretch * weight,
    }
    for (const fixed of fixedFrames) {
      const hit = segmentInteriorEntry(point, end, fixed.envelope)
      if (hit !== null) maximum = Math.min(maximum, Math.max(0, hit - 1e-6))
    }
  }
  return maximum
}

function segmentInteriorEntry(start: Point, end: Point, frame: SvgViewportRect): number | null {
  const dx = end.x - start.x
  const dy = end.y - start.y
  let enter = 0
  let leave = 1
  for (const [origin, delta, minimum, maximum] of [
    [start.x, dx, frame.x, frame.x + frame.width],
    [start.y, dy, frame.y, frame.y + frame.height],
  ] as const) {
    if (delta === 0) {
      if (origin <= minimum || origin >= maximum) return null
      continue
    }
    const first = (minimum - origin) / delta
    const second = (maximum - origin) / delta
    enter = Math.max(enter, Math.min(first, second))
    leave = Math.min(leave, Math.max(first, second))
    if (enter >= leave) return null
  }
  return leave > 0 && enter < 1 ? clamp(enter, 0, 1) : null
}

function pointInPolygonInclusive(point: Point, points: readonly Point[]): boolean {
  let inside = false
  for (let index = 0; index < points.length; index += 1) {
    const start = points[index]!
    const end = points[(index + 1) % points.length]!
    const dx = end.x - start.x
    const dy = end.y - start.y
    const squareLength = dx * dx + dy * dy
    if (squareLength > 0) {
      const fraction = clamp(((point.x - start.x) * dx + (point.y - start.y) * dy) / squareLength, 0, 1)
      const nearestX = start.x + dx * fraction
      const nearestY = start.y + dy * fraction
      const tolerance = Math.max(1e-8, Math.max(Math.abs(point.x), Math.abs(point.y), 1) * 1e-12)
      if (Math.hypot(point.x - nearestX, point.y - nearestY) <= tolerance) return true
    }
    if ((start.y > point.y) !== (end.y > point.y)
      && point.x < start.x + (end.x - start.x) * (point.y - start.y) / (end.y - start.y)) inside = !inside
  }
  return inside
}

function withinGrowthBudget(
  original: SvgViewportRect,
  candidate: SvgViewportRect,
  budget: number,
): boolean {
  const tolerance = Math.max(Number.EPSILON * Math.max(Math.abs(original.x), Math.abs(original.y), original.width, original.height) * 8, 1e-9)
  return original.x - candidate.x <= budget + tolerance
    && original.y - candidate.y <= budget + tolerance
    && candidate.x + candidate.width - original.x - original.width <= budget + tolerance
    && candidate.y + candidate.height - original.y - original.height <= budget + tolerance
}

function contourPath(points: readonly ContourPoint[]): string {
  if (points.length < 3) return ''
  const format = (point: Point) => `${point.x.toFixed(2)} ${point.y.toFixed(2)}`
  const count = points.length
  return `M ${format(points[0]!)}${points.map((start, index) => {
    const before = points[(index + count - 1) % count]!
    const end = points[(index + 1) % count]!
    const after = points[(index + 2) % count]!
    return ` C ${format({ x: start.x + (end.x - before.x) / 6, y: start.y + (end.y - before.y) / 6 })}`
      + ` ${format({ x: end.x - (after.x - start.x) / 6, y: end.y - (after.y - start.y) / 6 })} ${format(end)}`
  }).join('')} Z`
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

interface BoundedZoneLandingInput {
  systemId: string
  anchor: Point
  displayedFrame: SvgViewportRect
  target: Point
  /** A known starting root enables fallback for an existing object's pointer gesture. */
  origin?: Point
  /** A pointer gesture supplies its screen scale. Numeric placement must fit the current root frame. */
  pixelsPerSceneUnit?: number
  /** Axis-aligned bounds of the entire branch, relative to its root in scene units. */
  relativeBounds: SvgViewportRect
  /** Raw frames reproduce the same clipping when the grown preferred frame is saved. */
  authoredFrames?: readonly ContinuousSystemFrameInput[]
  fixedFrames: readonly ContinuousSystemFrameInput[]
}

interface BoundedZoneLanding {
  root: Point
  frame: SvgViewportRect
  authoredFrame: SvgViewportRect
  grew: boolean
}

/** Fits one rigid branch. Numeric placement and new support must fit at the requested point. */
export function planBoundedZoneLanding(input: BoundedZoneLandingInput): BoundedZoneLanding | null {
  const { systemId, anchor, displayedFrame, target, origin, pixelsPerSceneUnit, relativeBounds, authoredFrames, fixedFrames } = input
  if (![anchor.x, anchor.y, target.x, target.y].every(Number.isFinite)
    || !isFinitePositiveFrame(displayedFrame) || !isFiniteFrame(relativeBounds)
    || fixedFrames.some(frame => frame.id === systemId || !isFiniteFrame(frame.envelope))
    || new Set(fixedFrames.map(frame => frame.id)).size !== fixedFrames.length) return null
  const reach = pixelsPerSceneUnit === undefined ? 0 : ELASTIC_REACH_PIXELS / pixelsPerSceneUnit
  if (!Number.isFinite(reach) || reach < 0) return null

  const fit = (root: Point): BoundedZoneLanding | null => {
    const inside = continuousMapRoundedFrameContains(root, displayedFrame)
    if (!inside && nearestContinuousMapRoundedFramePoint(root, displayedFrame).distance > reach + 1e-9) return null
    const left = root.x + relativeBounds.x
    const top = root.y + relativeBounds.y
    const right = left + relativeBounds.width
    const bottom = top + relativeBounds.height
    const points = [root, { x: left, y: top }, { x: left, y: bottom }, { x: right, y: top }, { x: right, y: bottom }]
    const preferred = points.reduce<SvgViewportRect>((candidate, point) => continuousMapRoundedFrameContains(point, candidate)
      ? candidate
      : growRoundedFrameToContain(candidate, point, CONTINUOUS_SYSTEM_FRAME_CORNER_RADIUS, 0.001), displayedFrame)
    let frame = constrainContinuousSystemFrame({ id: systemId, anchor, envelope: preferred }, fixedFrames)
    if (!containsFrame(frame, displayedFrame) || points.some(point => !continuousMapRoundedFrameContains(point, frame))) return null
    const original = authoredFrames?.find(candidate => candidate.id === systemId)?.envelope ?? displayedFrame
    const grew = !sameFrame(frame, displayedFrame)
    if (!grew) return { root, frame, authoredFrame: original, grew }

    const leftEdge = Math.min(frame.x, original.x)
    const topEdge = Math.min(frame.y, original.y)
    const authoredFrame = {
      x: leftEdge,
      y: topEdge,
      width: Math.max(frame.x + frame.width, original.x + original.width) - leftEdge,
      height: Math.max(frame.y + frame.height, original.y + original.height) - topEdge,
    }
    if (authoredFrames) {
      const applied = continuousSystemFrames(authoredFrames.map(candidate => candidate.id === systemId
        ? { ...candidate, envelope: authoredFrame }
        : candidate))
      const appliedFrame = applied.get(systemId)
      if (!appliedFrame || !containsFrame(appliedFrame, displayedFrame)
        || fixedFrames.some(fixed => !sameFrame(fixed.envelope, applied.get(fixed.id)))
        || points.some(point => !continuousMapRoundedFrameContains(point, appliedFrame))) return null
      frame = appliedFrame
    }
    return { root, frame, authoredFrame, grew }
  }

  const exact = fit(target)
  if (exact || !origin) return exact

  const nearest = nearestContinuousMapRoundedFramePoint(target, displayedFrame)
  const boundedTarget = nearest.distance > reach && !continuousMapRoundedFrameContains(target, displayedFrame)
    ? {
        x: nearest.point.x + (target.x - nearest.point.x) * reach / nearest.distance,
        y: nearest.point.y + (target.y - nearest.point.y) * reach / nearest.distance,
      }
    : target
  const projected = fit(boundedTarget)
  if (projected) return projected

  let lastFeasible = fit(origin)
  if (!lastFeasible) return null
  let lower = 0
  let upper = 1
  for (let step = 0; step < 30; step += 1) {
    const fraction = (lower + upper) / 2
    const candidate = fit({
      x: origin.x + (boundedTarget.x - origin.x) * fraction,
      y: origin.y + (boundedTarget.y - origin.y) * fraction,
    })
    if (candidate) {
      lastFeasible = candidate
      lower = fraction
    } else upper = fraction
  }
  return lastFeasible
}


function containsFrame(outer: SvgViewportRect, inner: SvgViewportRect): boolean {
  const tolerance = 1e-7
  return outer.x <= inner.x + tolerance && outer.y <= inner.y + tolerance
    && outer.x + outer.width >= inner.x + inner.width - tolerance
    && outer.y + outer.height >= inner.y + inner.height - tolerance
}

function sameFrame(first: SvgViewportRect, second: SvgViewportRect | undefined): boolean {
  return !!second && containsFrame(first, second) && containsFrame(second, first)
}
