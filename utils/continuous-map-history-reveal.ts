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
  if (projectedEnd < usableStart) return usableStart - targetStart * scale
  if (projectedStart > usableEnd) return usableEnd - targetEnd * scale
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
