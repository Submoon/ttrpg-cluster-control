export interface RevealScreenPoint {
  x: number
  y: number
}

export interface RevealScreenBounds {
  left: number
  top: number
  right: number
  bottom: number
}

export interface RevealScreenDelta {
  dx: number
  dy: number
}

export interface SvgScreenLinearTransform {
  a: number
  b: number
  c: number
  d: number
}

/** Calculates the painted bounds of a circle after its SVG screen transform. */
export function svgCirclePaintedBounds(
  center: RevealScreenPoint,
  radius: number,
  strokeWidth: number,
  matrix: SvgScreenLinearTransform,
): RevealScreenBounds | undefined {
  if (![center.x, center.y, radius, strokeWidth, matrix.a, matrix.b, matrix.c, matrix.d].every(Number.isFinite)
    || radius < 0 || strokeWidth < 0) return undefined

  const paintedRadius = radius + strokeWidth / 2
  const halfWidth = paintedRadius * Math.hypot(matrix.a, matrix.c)
  const halfHeight = paintedRadius * Math.hypot(matrix.b, matrix.d)
  const bounds = {
    left: center.x - halfWidth,
    top: center.y - halfHeight,
    right: center.x + halfWidth,
    bottom: center.y + halfHeight,
  }
  return [halfWidth, halfHeight, bounds.left, bounds.top, bounds.right, bounds.bottom].every(Number.isFinite)
    ? bounds
    : undefined
}

/** Returns the minimal screen-space pan needed to reveal a painted target or anchor. */
export function revealTargetScreenDelta(
  viewport: RevealScreenBounds,
  targetBounds: RevealScreenBounds,
  anchor: RevealScreenPoint,
): RevealScreenDelta | undefined {
  const values = [
    viewport.left, viewport.top, viewport.right, viewport.bottom,
    targetBounds.left, targetBounds.top, targetBounds.right, targetBounds.bottom,
    anchor.x, anchor.y,
  ]
  if (!values.every(Number.isFinite)
    || viewport.right <= viewport.left || viewport.bottom <= viewport.top
    || targetBounds.right < targetBounds.left || targetBounds.bottom < targetBounds.top) return undefined
  const spans = [
    viewport.right - viewport.left,
    viewport.bottom - viewport.top,
    targetBounds.right - targetBounds.left,
    targetBounds.bottom - targetBounds.top,
  ]
  if (!spans.every(Number.isFinite)) return undefined

  return {
    dx: revealAxisDelta(viewport.left, viewport.right, targetBounds.left, targetBounds.right, anchor.x),
    dy: revealAxisDelta(viewport.top, viewport.bottom, targetBounds.top, targetBounds.bottom, anchor.y),
  }
}

function revealAxisDelta(
  viewportStart: number,
  viewportEnd: number,
  targetStart: number,
  targetEnd: number,
  anchor: number,
): number {
  const viewportSpan = viewportEnd - viewportStart
  const targetSpan = targetEnd - targetStart
  const padding = targetSpan <= viewportSpan
    ? Math.min(20, (viewportSpan - targetSpan) / 2)
    : Math.min(20, viewportSpan / 2)

  if (targetSpan > viewportSpan) {
    if (anchor < viewportStart + padding) return viewportStart + padding - anchor
    if (anchor > viewportEnd - padding) return viewportEnd - padding - anchor
    return 0
  }
  if (targetStart < viewportStart + padding) return viewportStart + padding - targetStart
  if (targetEnd > viewportEnd - padding) return viewportEnd - padding - targetEnd
  return 0
}

/** Pans a map only when an SVG target's painted bounds fall outside the current viewport. */
export function revealSvgTarget(
  svg: SVGSVGElement | null,
  target: Element | null,
  panBy: (dx: number, dy: number) => void,
): boolean {
  if (!svg || !target) return false
  const bounds = target.getBoundingClientRect()
  return revealSvgPoint(
    svg,
    { x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 },
    panBy,
    bounds,
  )
}

/** Keeps an explicit screen-space anchor visible, useful for targets too large to fit. */
export function revealSvgPoint(
  svg: SVGSVGElement | null,
  point: RevealScreenPoint,
  panBy: (dx: number, dy: number) => void,
  targetBounds: RevealScreenBounds = { left: point.x, right: point.x, top: point.y, bottom: point.y },
): boolean {
  if (!svg) return false
  const bounds = svg.getBoundingClientRect()
  const delta = revealTargetScreenDelta(bounds, targetBounds, point)
  if (!delta || (delta.dx === 0 && delta.dy === 0)) return false

  const screenMatrix = svg.getScreenCTM()
  if (!screenMatrix) return false
  try {
    const inverse = screenMatrix.inverse()
    const origin = new DOMPoint(0, 0).matrixTransform(inverse)
    const offset = new DOMPoint(delta.dx, delta.dy).matrixTransform(inverse)
    const dx = offset.x - origin.x
    const dy = offset.y - origin.y
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) return false
    panBy(dx, dy)
    return true
  } catch {
    return false
  }
}
