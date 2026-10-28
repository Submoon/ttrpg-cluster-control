/** Pans a map only when its SVG target falls outside the current viewport. */
export function revealSvgTarget(
  svg: SVGSVGElement | null,
  target: Element | null,
  panBy: (dx: number, dy: number) => void,
): boolean {
  if (!svg || !target) return false
  const bounds = target.getBoundingClientRect()
  return revealSvgPoint(svg, { x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 }, panBy)
}

/** Keeps an explicit screen-space anchor visible, useful for oversized targets such as Orbit rings. */
export function revealSvgPoint(
  svg: SVGSVGElement | null,
  point: { x: number; y: number },
  panBy: (dx: number, dy: number) => void,
  targetBounds = { left: point.x, right: point.x, top: point.y, bottom: point.y },
): boolean {
  if (!svg) return false
  const viewport = svg.getBoundingClientRect()
  if (viewport.width <= 0 || viewport.height <= 0) return false

  const margin = 20
  let dx = 0
  let dy = 0
  if (targetBounds.right < viewport.left + margin) dx = viewport.left + margin - point.x
  else if (targetBounds.left > viewport.right - margin) dx = viewport.right - margin - point.x
  if (targetBounds.bottom < viewport.top + margin) dy = viewport.top + margin - point.y
  else if (targetBounds.top > viewport.bottom - margin) dy = viewport.bottom - margin - point.y
  if (dx === 0 && dy === 0) return false

  const screenMatrix = svg.getScreenCTM()
  if (!screenMatrix) return false
  const inverse = screenMatrix.inverse()
  const origin = new DOMPoint(0, 0).matrixTransform(inverse)
  const offset = new DOMPoint(dx, dy).matrixTransform(inverse)
  panBy(offset.x - origin.x, offset.y - origin.y)
  return true
}
