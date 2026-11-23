type Point = { x: number; y: number }
type OrbitArc = { path: string; dashOffset: number }

const TAU = Math.PI * 2
const ANGLE_EPSILON = 1e-12

/**
 * Keeps a very large rotated Orbit cheap to paint by returning only the pieces
 * of its curve near the viewport. The arc dash offsets retain the phase of the
 * original ellipse, whose path starts at angle zero.
 */
export function clipWardenOrbitStroke(
  ellipse: { center: { x: number; y: number }; rx: number; ry: number; rotation: number },
  viewport: { x: number; y: number; width: number; height: number },
  overscan: number,
): { kind: 'ellipse' } | { kind: 'hidden' } | { kind: 'arcs'; arcs: readonly OrbitArc[] } {
  const values = [
    ellipse.center.x, ellipse.center.y, ellipse.rx, ellipse.ry, ellipse.rotation,
    viewport.x, viewport.y, viewport.width, viewport.height, overscan,
  ]
  if (!values.every(Number.isFinite)
    || ellipse.rx <= 0 || ellipse.ry <= 0
    || viewport.width < 0 || viewport.height < 0) {
    return { kind: 'ellipse' }
  }

  const padding = Math.max(0, overscan)
  const left = viewport.x - padding
  const top = viewport.y - padding
  const right = viewport.x + viewport.width + padding
  const bottom = viewport.y + viewport.height + padding
  const radians = (ellipse.rotation % 360) * Math.PI / 180
  const cosine = Math.cos(radians)
  const sine = Math.sin(radians)
  const halfWidth = Math.hypot(ellipse.rx * cosine, ellipse.ry * sine)
  const halfHeight = Math.hypot(ellipse.rx * sine, ellipse.ry * cosine)
  const bounds = {
    left: ellipse.center.x - halfWidth,
    top: ellipse.center.y - halfHeight,
    right: ellipse.center.x + halfWidth,
    bottom: ellipse.center.y + halfHeight,
  }
  if (![left, top, right, bottom, radians, cosine, sine, halfWidth, halfHeight,
    bounds.left, bounds.top, bounds.right, bounds.bottom].every(Number.isFinite)) {
    return { kind: 'ellipse' }
  }

  const coordinateTolerance = Number.EPSILON * 32 * Math.max(
    1, Math.abs(left), Math.abs(top), Math.abs(right), Math.abs(bottom),
    Math.abs(ellipse.center.x), Math.abs(ellipse.center.y), ellipse.rx, ellipse.ry,
  )
  const angles: number[] = []
  const addIntersections = (a: number, b: number, distance: number, otherCoordinate: (angle: number) => number, otherMinimum: number, otherMaximum: number) => {
    const amplitude = Math.hypot(a, b)
    if (!Number.isFinite(amplitude) || amplitude === 0 || !Number.isFinite(distance)) return false

    const amplitudeTolerance = Number.EPSILON * 16 * Math.max(amplitude, Math.abs(distance))
    if (Math.abs(distance) > amplitude + amplitudeTolerance) return true

    const ratio = Math.max(-1, Math.min(1, distance / amplitude))
    const offset = Math.acos(ratio)
    const phase = Math.atan2(b, a)
    for (const angle of [phase - offset, phase + offset]) {
      const normalized = normalizeAngle(angle)
      const other = otherCoordinate(normalized)
      if (!Number.isFinite(normalized) || !Number.isFinite(other)) return false
      if (other >= otherMinimum - coordinateTolerance && other <= otherMaximum + coordinateTolerance) {
        angles.push(normalized)
      }
    }
    return true
  }

  const pointAt = (angle: number): Point => {
    const normalizedAngle = normalizeAngle(angle)
    const x = ellipse.center.x + ellipse.rx * Math.cos(normalizedAngle) * cosine - ellipse.ry * Math.sin(normalizedAngle) * sine
    const y = ellipse.center.y + ellipse.rx * Math.cos(normalizedAngle) * sine + ellipse.ry * Math.sin(normalizedAngle) * cosine
    return { x, y }
  }
  const inside = (point: Point) => point.x >= left && point.x <= right && point.y >= top && point.y <= bottom
  const arcs: OrbitArc[] = []
  const fullEllipseAsArcs = () => {
    if (!appendArc(0, Math.PI, 0)
      || !appendArc(Math.PI, TAU, ellipseArcLength(Math.PI, ellipse.rx, ellipse.ry))) {
      return { kind: 'ellipse' as const }
    }
    return { kind: 'arcs' as const, arcs }
  }

  // Split a fully visible curve before SVG paints its large ellipse resource every camera frame.
  if (bounds.left >= left && bounds.top >= top && bounds.right <= right && bounds.bottom <= bottom) {
    return fullEllipseAsArcs()
  }

  const verticalA = ellipse.rx * cosine
  const verticalB = -ellipse.ry * sine
  const horizontalA = ellipse.rx * sine
  const horizontalB = ellipse.ry * cosine
  for (const edge of [left, right]) {
    if (!addIntersections(verticalA, verticalB, edge - ellipse.center.x,
      angle => pointAt(angle).y, top, bottom)) return { kind: 'ellipse' }
  }
  for (const edge of [top, bottom]) {
    if (!addIntersections(horizontalA, horizontalB, edge - ellipse.center.y,
      angle => pointAt(angle).x, left, right)) return { kind: 'ellipse' }
  }

  angles.sort((first, second) => first - second)
  const cuts: number[] = []
  for (const angle of angles) {
    if (cuts.length === 0 || angle - cuts[cuts.length - 1]! > ANGLE_EPSILON) cuts.push(angle)
  }
  if (cuts.length > 1 && cuts[0]! + TAU - cuts[cuts.length - 1]! <= ANGLE_EPSILON) cuts.pop()

  if (cuts.length === 0) {
    return inside(pointAt(0)) ? fullEllipseAsArcs() : { kind: 'hidden' }
  }

  const intervalVisible = cuts.map((start, index) => {
    const next = cuts[(index + 1) % cuts.length]!
    const span = index === cuts.length - 1 ? next + TAU - start : next - start
    return inside(pointAt(start + span / 2))
  })
  if (intervalVisible.every(Boolean)) return fullEllipseAsArcs()
  if (intervalVisible.every(visible => !visible)) return { kind: 'hidden' }

  for (let startIndex = 0; startIndex < cuts.length; startIndex += 1) {
    const previousIndex = (startIndex + cuts.length - 1) % cuts.length
    if (!intervalVisible[startIndex] || intervalVisible[previousIndex]) continue

    let span = 0
    let intervalIndex = startIndex
    while (intervalVisible[intervalIndex]) {
      const start = cuts[intervalIndex]!
      const next = cuts[(intervalIndex + 1) % cuts.length]!
      span += intervalIndex === cuts.length - 1 ? next + TAU - start : next - start
      intervalIndex = (intervalIndex + 1) % cuts.length
    }

    const startAngle = cuts[startIndex]!
    const endAngle = startAngle + span
    if (endAngle > TAU + ANGLE_EPSILON) {
      if (!appendArc(startAngle, TAU, ellipseArcLength(startAngle, ellipse.rx, ellipse.ry))) return { kind: 'ellipse' }
      if (!appendArc(0, endAngle - TAU, 0)) return { kind: 'ellipse' }
    } else if (!appendArc(startAngle, Math.min(endAngle, TAU), ellipseArcLength(startAngle, ellipse.rx, ellipse.ry))) {
      return { kind: 'ellipse' }
    }
  }

  return arcs.length > 0 ? { kind: 'arcs', arcs } : { kind: 'hidden' }

  function appendArc(startAngle: number, endAngle: number, dashDistance: number): boolean {
    const span = endAngle - startAngle
    const start = pointAt(startAngle)
    const end = pointAt(endAngle)
    if (![start.x, start.y, end.x, end.y, span, dashDistance].every(Number.isFinite) || span <= 0) return false

    const rotationDegrees = ((ellipse.rotation % 360) + 360) % 360
    const largeArc = span > Math.PI ? 1 : 0
    arcs.push({
      path: `M ${svgNumber(start.x)} ${svgNumber(start.y)} A ${svgNumber(ellipse.rx)} ${svgNumber(ellipse.ry)} ${svgNumber(rotationDegrees)} ${largeArc} 1 ${svgNumber(end.x)} ${svgNumber(end.y)}`,
      dashOffset: dashDistance,
    })
    return true
  }
}

function normalizeAngle(angle: number): number {
  const normalized = angle % TAU
  return normalized < 0 ? normalized + TAU : normalized
}

function svgNumber(value: number): string {
  return Object.is(value, -0) ? '0' : String(value)
}

/** Composite 8-point Gauss-Legendre integration: at most 512 speed samples per phase. */
function ellipseArcLength(angle: number, rx: number, ry: number): number {
  if (angle <= 0) return 0
  const scale = Math.max(rx, ry)
  const normalizedAngle = normalizeAngle(angle)
  if (normalizedAngle === 0) return 0
  const segmentCount = Math.max(1, Math.ceil(normalizedAngle * 32 / Math.PI))
  const segmentWidth = normalizedAngle / segmentCount
  const nodes = [
    -0.9602898564975363, -0.7966664774136267, -0.525532409916329,
    -0.1834346424956498, 0.1834346424956498, 0.525532409916329,
    0.7966664774136267, 0.9602898564975363,
  ]
  const weights = [
    0.1012285362903763, 0.2223810344533745, 0.3137066458778873,
    0.362683783378362, 0.362683783378362, 0.3137066458778873,
    0.2223810344533745, 0.1012285362903763,
  ]
  let normalizedLength = 0

  for (let segment = 0; segment < segmentCount; segment += 1) {
    const start = segment * segmentWidth
    const midpoint = start + segmentWidth / 2
    let weightedSpeed = 0
    for (let sample = 0; sample < nodes.length; sample += 1) {
      const angleAtSample = midpoint + segmentWidth / 2 * nodes[sample]!
      const speed = Math.hypot((rx / scale) * Math.sin(angleAtSample), (ry / scale) * Math.cos(angleAtSample))
      weightedSpeed += weights[sample]! * speed
    }
    normalizedLength += segmentWidth / 2 * weightedSpeed
  }

  return normalizedLength * scale
}
