import type { Point } from '../domain/workspace'
import type { MapViewport, SvgViewportRect } from './map-zoom'

interface MinimumHistoryRevealViewportOptions {
  current: MapViewport
  targetBounds: SvgViewportRect
  usableRect: SvgViewportRect
  /** Optional scale required to reveal a target whose detail is currently collapsed. */
  minimumScale?: number
  maximumScale?: number
}

interface CenterMapTargetViewportOptions extends MinimumHistoryRevealViewportOptions {
  /** Allow an oversized target when its semantic detail requires a higher zoom. */
  prioritizeMinimumScale?: boolean
  /** Visible target anchor to center when the required detail scale cannot fit the bounds. */
  oversizedTargetAnchor?: Point
}

/** Keeps the current camera unless a target needs minimum pan or detail-reveal zoom. */
export function minimumHistoryRevealViewport(options: MinimumHistoryRevealViewportOptions): MapViewport | null {
  const { current, targetBounds, usableRect } = options
  if (![current.x, current.y, current.k, targetBounds.x, targetBounds.y, targetBounds.width, targetBounds.height,
    usableRect.x, usableRect.y, usableRect.width, usableRect.height].every(Number.isFinite)
    || current.k <= 0 || targetBounds.width < 0 || targetBounds.height < 0
    || usableRect.width <= 0 || usableRect.height <= 0) return null

  const maximumScale = options.maximumScale ?? Number.POSITIVE_INFINITY
  if (!Number.isFinite(maximumScale) && maximumScale !== Number.POSITIVE_INFINITY) return null
  const minimumScale = options.minimumScale ?? current.k
  if (!Number.isFinite(minimumScale) || minimumScale <= 0 || maximumScale <= 0) return null
  const k = Math.max(current.k, Math.min(maximumScale, minimumScale))
  return {
    x: minimumAxisTranslation(current.x, targetBounds.x, targetBounds.x + targetBounds.width, usableRect.x, usableRect.x + usableRect.width, k),
    y: minimumAxisTranslation(current.y, targetBounds.y, targetBounds.y + targetBounds.height, usableRect.y, usableRect.y + usableRect.height, k),
    k,
  }
}

/** Centers a target at its largest feasible scale while preserving the current scale when it fits. */
export function centerMapTargetViewport(options: CenterMapTargetViewportOptions): MapViewport | null {
  const { current, targetBounds, usableRect } = options
  if (![current.x, current.y, current.k, targetBounds.x, targetBounds.y, targetBounds.width, targetBounds.height,
    usableRect.x, usableRect.y, usableRect.width, usableRect.height].every(Number.isFinite)
    || current.k <= 0 || targetBounds.width < 0 || targetBounds.height < 0
    || usableRect.width <= 0 || usableRect.height <= 0) return null

  const maximumScale = options.maximumScale ?? Number.POSITIVE_INFINITY
  if (!Number.isFinite(maximumScale) && maximumScale !== Number.POSITIVE_INFINITY) return null
  const minimumScale = options.minimumScale ?? current.k
  if (!Number.isFinite(minimumScale) || minimumScale <= 0 || maximumScale <= 0) return null
  const oversizedAnchor = options.oversizedTargetAnchor
  if (oversizedAnchor && ![oversizedAnchor.x, oversizedAnchor.y].every(Number.isFinite)) return null
  const horizontalFitScale = targetBounds.width > 0 ? usableRect.width / targetBounds.width : Number.POSITIVE_INFINITY
  const verticalFitScale = targetBounds.height > 0 ? usableRect.height / targetBounds.height : Number.POSITIVE_INFINITY
  const fitCeiling = Math.min(maximumScale, horizontalFitScale, verticalFitScale)
  if (!Number.isFinite(fitCeiling) || fitCeiling <= 0) return null
  const minimumScaleCeiling = options.prioritizeMinimumScale ? maximumScale : fitCeiling
  const k = Math.max(Math.min(current.k, fitCeiling), Math.min(minimumScale, minimumScaleCeiling))
  const targetCenterX = k > fitCeiling && oversizedAnchor ? oversizedAnchor.x : targetBounds.x + targetBounds.width / 2
  const targetCenterY = k > fitCeiling && oversizedAnchor ? oversizedAnchor.y : targetBounds.y + targetBounds.height / 2
  return {
    x: usableRect.x + usableRect.width / 2 - targetCenterX * k,
    y: usableRect.y + usableRect.height / 2 - targetCenterY * k,
    k,
  }
}

/** Keeps the Cluster camera if any anchor is visible; otherwise reveals its nearest anchor at current scale. */
export function revealNearestAnchorViewport(options: {
  current: MapViewport
  anchorBounds: readonly SvgViewportRect[]
  usableRect: SvgViewportRect
}): MapViewport | null {
  const { current, anchorBounds, usableRect } = options
  if (!anchorBounds.length) return null
  if (anchorBounds.some(bounds => targetIntersectsViewport(bounds, current, usableRect))) return current

  let nearest: MapViewport | null = null
  let nearestDistance = Number.POSITIVE_INFINITY
  for (const targetBounds of anchorBounds) {
    const candidate = minimumHistoryRevealViewport({ current, targetBounds, usableRect })
    if (!candidate) continue
    const distance = (candidate.x - current.x) ** 2 + (candidate.y - current.y) ** 2
    if (distance < nearestDistance) {
      nearest = candidate
      nearestDistance = distance
    }
  }
  return nearest
}

function targetIntersectsViewport(
  targetBounds: SvgViewportRect,
  current: MapViewport,
  usableRect: SvgViewportRect,
): boolean {
  const left = current.x + targetBounds.x * current.k
  const top = current.y + targetBounds.y * current.k
  const right = left + targetBounds.width * current.k
  const bottom = top + targetBounds.height * current.k
  return [left, top, right, bottom].every(Number.isFinite)
    && right > usableRect.x && left < usableRect.x + usableRect.width
    && bottom > usableRect.y && top < usableRect.y + usableRect.height
}

function minimumAxisTranslation(
  translation: number,
  targetStart: number,
  targetEnd: number,
  usableStart: number,
  usableEnd: number,
  scale: number,
): number {
  const projectedStart = translation + targetStart * scale
  const projectedEnd = translation + targetEnd * scale
  const projectedSize = projectedEnd - projectedStart
  const usableSize = usableEnd - usableStart

  if (projectedSize <= usableSize) {
    if (projectedStart < usableStart) return usableStart - targetStart * scale
    if (projectedEnd > usableEnd) return usableEnd - targetEnd * scale
    return translation
  }

  // An oversized target only needs to intersect the usable area to count as revealed.
  if (projectedEnd < usableStart) return usableStart + 1 - targetEnd * scale
  if (projectedStart > usableEnd) return usableEnd - 1 - targetStart * scale
  return translation
}

/** Returns the world-space bounding box of a rotated ellipse plus its optional stroke margin. */
export function rotatedEllipseBounds(
  center: Point,
  radii: { horizontal: number; vertical: number },
  rotationDegrees: number,
  strokeMargin = 0,
): SvgViewportRect | null {
  if (![center.x, center.y, radii.horizontal, radii.vertical, rotationDegrees, strokeMargin].every(Number.isFinite)
    || radii.horizontal < 0 || radii.vertical < 0 || strokeMargin < 0) return null
  const angle = rotationDegrees * Math.PI / 180
  const horizontal = Math.hypot(radii.horizontal * Math.cos(angle), radii.vertical * Math.sin(angle)) + strokeMargin
  const vertical = Math.hypot(radii.horizontal * Math.sin(angle), radii.vertical * Math.cos(angle)) + strokeMargin
  return {
    x: center.x - horizontal,
    y: center.y - vertical,
    width: horizontal * 2,
    height: vertical * 2,
  }
}
