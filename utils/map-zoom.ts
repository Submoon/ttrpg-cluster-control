/**
 * Shared zoom bounds keep both map renderers and their navigation controls in sync.
 */
export const MAP_ZOOM_MIN_SCALE = 0.25
export const MAP_ZOOM_MAX_SCALE = 16

/** D3's serializable translate/scale state for a map viewport. */
export interface MapViewport {
  x: number
  y: number
  k: number
}

/** A drawable rectangle in SVG viewport user coordinates. */
export interface SvgViewportRect {
  x: number
  y: number
  width: number
  height: number
}

const DEFAULT_VIEWBOX: SvgViewportRect = { x: 0, y: 0, width: 960, height: 560 }
const FIT_PADDING = 40

/** Returns a finite transform and clamps its scale to the map's supported range. */
export function clampMapViewport(viewport: MapViewport): MapViewport | undefined {
  if (!Number.isFinite(viewport.x) || !Number.isFinite(viewport.y) || !Number.isFinite(viewport.k)) {
    return undefined
  }

  return {
    x: viewport.x,
    y: viewport.y,
    k: Math.max(MAP_ZOOM_MIN_SCALE, Math.min(MAP_ZOOM_MAX_SCALE, viewport.k)),
  }
}

/** Returns a usable positive-size SVG rectangle when all of its values are finite. */
export function normalizeSvgViewportRect(rect: SvgViewportRect): SvgViewportRect | undefined {
  if (!Number.isFinite(rect.x) || !Number.isFinite(rect.y)
    || !Number.isFinite(rect.width) || !Number.isFinite(rect.height)
    || rect.width <= 0 || rect.height <= 0
    || !Number.isFinite(rect.x + rect.width) || !Number.isFinite(rect.y + rect.height)) {
    return undefined
  }

  return { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
}

/** Converts a rectangle to the extent shape expected by D3 zoom. */
export function svgViewportExtent(rect: SvgViewportRect): [[number, number], [number, number]] {
  return [[rect.x, rect.y], [rect.x + rect.width, rect.y + rect.height]]
}

/**
 * Finds the drawable area of an SVG in its own user-coordinate space.
 * The inverse screen matrix accounts for CSS sizing and SVG viewBox letterboxing while retaining
 * the full client viewport as drawable space.
 */
export function getSvgViewportRect(element: SVGSVGElement): SvgViewportRect {
  const viewBox = element.viewBox?.baseVal
  const fallback = normalizeSvgViewportRect({
    x: viewBox?.x ?? DEFAULT_VIEWBOX.x,
    y: viewBox?.y ?? DEFAULT_VIEWBOX.y,
    width: viewBox?.width ?? DEFAULT_VIEWBOX.width,
    height: viewBox?.height ?? DEFAULT_VIEWBOX.height,
  }) ?? DEFAULT_VIEWBOX
  const clientRect = element.getBoundingClientRect()
  const matrix = element.getScreenCTM()

  if (!matrix || clientRect.width <= 0 || clientRect.height <= 0) return fallback

  try {
    const inverse = matrix.inverse()
    const corners = [
      [clientRect.left, clientRect.top],
      [clientRect.right, clientRect.top],
      [clientRect.left, clientRect.bottom],
      [clientRect.right, clientRect.bottom],
    ].map(([x, y]) => ({
      x: inverse.a * x! + inverse.c * y! + inverse.e,
      y: inverse.b * x! + inverse.d * y! + inverse.f,
    }))
    const left = Math.min(...corners.map(point => point.x))
    const top = Math.min(...corners.map(point => point.y))
    const right = Math.max(...corners.map(point => point.x))
    const bottom = Math.max(...corners.map(point => point.y))
    return normalizeSvgViewportRect({ x: left, y: top, width: right - left, height: bottom - top }) ?? fallback
  } catch {
    return fallback
  }
}

/**
 * Centers scene bounds inside a usable SVG rectangle with the same padding used by legacy Fit.
 * Returns undefined when either rectangle is invalid so the caller can choose a safe fallback.
 */
export function fitMapViewport(bounds: SvgViewportRect, usableRect: SvgViewportRect): MapViewport | undefined {
  const viewport = normalizeSvgViewportRect(usableRect)
  if (!viewport || !Number.isFinite(bounds.x) || !Number.isFinite(bounds.y)
    || !Number.isFinite(bounds.width) || !Number.isFinite(bounds.height)
    || bounds.width < 0 || bounds.height < 0 || (bounds.width === 0 && bounds.height === 0)) {
    return undefined
  }

  const padding = Math.min(FIT_PADDING, viewport.width / 4, viewport.height / 4)
  const width = Math.max(1, bounds.width)
  const height = Math.max(1, bounds.height)
  const availableWidth = Math.max(1, viewport.width - padding * 2)
  const availableHeight = Math.max(1, viewport.height - padding * 2)
  const k = Math.max(MAP_ZOOM_MIN_SCALE, Math.min(
    MAP_ZOOM_MAX_SCALE,
    availableWidth / width,
    availableHeight / height,
  ))

  const fittedViewport = {
    x: viewport.x + (viewport.width - width * k) / 2 - bounds.x * k,
    y: viewport.y + (viewport.height - height * k) / 2 - bounds.y * k,
    k,
  }
  return Number.isFinite(fittedViewport.x) && Number.isFinite(fittedViewport.y)
    ? fittedViewport
    : undefined
}
