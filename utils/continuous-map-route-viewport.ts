import type { ContinuousMapRouteGeometry } from './continuous-map-route-geometry'
import { centerMapTargetViewport, minimumHistoryRevealViewport } from './continuous-map-history-reveal'
import { MAP_ZOOM_MAX_SCALE, type MapViewport, type SvgViewportRect } from './map-zoom'

interface RouteViewportOptions {
  current: MapViewport
  usableRect: SvgViewportRect
  padding: number
}

/** Fits the route drawn at the resulting zoom, where either endpoint can have collapsed. */
export function centerContinuousMapRouteViewport({
  current,
  usableRect,
  padding,
  svgPixelScale = 1,
  geometryAt,
}: RouteViewportOptions & {
  svgPixelScale?: number
  /** Geometry at the supplied scale under the current semantic-detail hysteresis. */
  geometryAt: (scale: number) => ContinuousMapRouteGeometry | undefined
}): MapViewport | null {
  const rect = insetViewport(usableRect, padding)
  const tolerance = 0.25 / svgPixelScale
  let candidate = current
  let visibleFit: { current: MapViewport; targetBounds: SvgViewportRect } | undefined
  for (let adjustment = 0; adjustment < 32; adjustment++) {
    const geometry = geometryAt(candidate.k)
    if (!geometry) return null
    const width = geometry.bounds.width * candidate.k
    const height = geometry.bounds.height * candidate.k
    const fitsUsable = width <= usableRect.width && height <= usableRect.height
    if (fitsUsable) visibleFit = { current: candidate, targetBounds: geometry.bounds }
    // Adaptive bends can converge without ever producing the same floating-point scale.
    // Accept a quarter-pixel residual inside the padding only when the actual curve fits.
    const settled = fitsUsable && width - rect.width <= tolerance && height - rect.height <= tolerance
    const next = centerMapTargetViewport({
      current: candidate,
      targetBounds: geometry.bounds,
      usableRect: settled ? usableRect : rect,
      maximumScale: MAP_ZOOM_MAX_SCALE,
    })
    if (!next || settled || next.k === candidate.k) return next
    // Fit can only decrease scale, and any newly collapsed detail may change the path bounds.
    candidate = next
  }
  return visibleFit ? centerMapTargetViewport({
    ...visibleFit,
    usableRect,
    maximumScale: MAP_ZOOM_MAX_SCALE,
  }) : null
}

/** History preserves zoom while revealing the unresolved marker or a useful point of the route. */
export function revealContinuousMapRouteViewport({
  current,
  usableRect,
  padding,
  geometry,
  unresolved,
}: RouteViewportOptions & {
  geometry: ContinuousMapRouteGeometry
  unresolved: boolean
}): MapViewport | null {
  const point = unresolved ? geometry.end : geometry.midpoint
  return minimumHistoryRevealViewport({
    current,
    targetBounds: { ...point, width: 0, height: 0 },
    usableRect: insetViewport(usableRect, padding),
  })
}

function insetViewport(rect: SvgViewportRect, padding: number): SvgViewportRect {
  const inset = Math.min(padding, rect.width / 4, rect.height / 4)
  return {
    x: rect.x + inset,
    y: rect.y + inset,
    width: rect.width - inset * 2,
    height: rect.height - inset * 2,
  }
}
