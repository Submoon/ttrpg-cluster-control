import { expect, test } from '@playwright/test'
import { clipWardenOrbitStroke } from '../utils/continuous-warden-orbit-clip'

test('an overview viewport wholly inside a large Orbit hides its unpainted stroke @pure', { tag: '@pure' }, () => {
  expect(clipWardenOrbitStroke(
    { center: { x: 0, y: 0 }, rx: 100, ry: 60, rotation: 27 },
    { x: -10, y: -10, width: 20, height: 20 },
    0,
  )).toEqual({ kind: 'hidden' })
})

test('rotated Orbit arcs keep visible endpoints and the original dash phase @pure', { tag: '@pure' }, () => {
  const ellipse = { center: { x: 0, y: 0 }, rx: 1100, ry: 360, rotation: 37 }
  const viewport = { x: 700, y: -180, width: 320, height: 360 }
  const result = clipWardenOrbitStroke(ellipse, viewport, 12)

  expect(result.kind).toBe('arcs')
  if (result.kind !== 'arcs') return
  expect(result.arcs.length).toBeGreaterThan(0)
  expect(result.arcs.length).toBeLessThanOrEqual(4)

  for (const arc of result.arcs) {
    const match = arc.path.match(/^M (\S+) (\S+) A (\S+) (\S+) (\S+) (\d) 1 (\S+) (\S+)$/)
    expect(match).not.toBeNull()
    if (!match) continue
    const start = { x: Number(match[1]), y: Number(match[2]) }
    const rx = Number(match[3])
    const ry = Number(match[4])
    const rotation = Number(match[5]) * Math.PI / 180
    const largeArc = Number(match[6])
    const end = { x: Number(match[7]), y: Number(match[8]) }
    expect(rx).toBe(ellipse.rx)
    expect(ry).toBe(ellipse.ry)
    expect(Number(match[5])).toBe(37)

    for (const endpoint of [start, end]) {
      expect(endpoint.x).toBeGreaterThanOrEqual(viewport.x - 12 - 1e-8)
      expect(endpoint.x).toBeLessThanOrEqual(viewport.x + viewport.width + 12 + 1e-8)
      expect(endpoint.y).toBeGreaterThanOrEqual(viewport.y - 12 - 1e-8)
      expect(endpoint.y).toBeLessThanOrEqual(viewport.y + viewport.height + 12 + 1e-8)
      const distances = [
        Math.abs(endpoint.x - (viewport.x - 12)),
        Math.abs(endpoint.x - (viewport.x + viewport.width + 12)),
        Math.abs(endpoint.y - (viewport.y - 12)),
        Math.abs(endpoint.y - (viewport.y + viewport.height + 12)),
      ]
      expect(Math.min(...distances)).toBeLessThan(1e-7)
    }

    const toAngle = (point: { x: number; y: number }) => {
      const dx = point.x - ellipse.center.x
      const dy = point.y - ellipse.center.y
      const localX = dx * Math.cos(rotation) + dy * Math.sin(rotation)
      const localY = -dx * Math.sin(rotation) + dy * Math.cos(rotation)
      return normalizeAngle(Math.atan2(localY / ellipse.ry, localX / ellipse.rx))
    }
    const startAngle = toAngle(start)
    const endAngle = toAngle(end)
    const span = normalizeAngle(endAngle - startAngle)
    expect(largeArc).toBe(span > Math.PI ? 1 : 0)

    const midpoint = pointAt(ellipse, rotation, startAngle + span / 2)
    expect(midpoint.x).toBeGreaterThanOrEqual(viewport.x - 12 - 1e-7)
    expect(midpoint.x).toBeLessThanOrEqual(viewport.x + viewport.width + 12 + 1e-7)
    expect(midpoint.y).toBeGreaterThanOrEqual(viewport.y - 12 - 1e-7)
    expect(midpoint.y).toBeLessThanOrEqual(viewport.y + viewport.height + 12 + 1e-7)

    expect(arc.dashOffset).toBeCloseTo(simpsonEllipseLength(startAngle, ellipse.rx, ellipse.ry), 5)
  }
})

test('a visible arc crossing angle zero restarts its native dash phase at the ellipse seam @pure', { tag: '@pure' }, () => {
  const ellipse = { center: { x: 0, y: 0 }, rx: 1100, ry: 360, rotation: 37 }
  const seam = pointAt(ellipse, ellipse.rotation * Math.PI / 180, 0)
  const result = clipWardenOrbitStroke(ellipse, {
    x: seam.x - 40,
    y: seam.y - 25,
    width: 80,
    height: 50,
  }, 0)

  expect(result.kind).toBe('arcs')
  if (result.kind !== 'arcs') return
  expect(result.arcs).toHaveLength(2)
  expect(result.arcs[0]!.dashOffset).toBeGreaterThan(0)
  expect(result.arcs[1]!.dashOffset).toBe(0)
})

test('fully visible large Orbits use two phase-continuous halves, including viewport tangencies @pure', { tag: '@pure' }, () => {
  const ellipse = { center: { x: 120, y: 90 }, rx: 320, ry: 175, rotation: 65 }
  const radians = ellipse.rotation * Math.PI / 180
  const halfWidth = Math.hypot(ellipse.rx * Math.cos(radians), ellipse.ry * Math.sin(radians))
  const halfHeight = Math.hypot(ellipse.rx * Math.sin(radians), ellipse.ry * Math.cos(radians))
  const viewport = {
    x: ellipse.center.x - halfWidth,
    y: ellipse.center.y - halfHeight,
    width: halfWidth * 2,
    height: halfHeight * 2,
  }
  const result = clipWardenOrbitStroke(ellipse, viewport, 0)

  expect(result.kind).toBe('arcs')
  if (result.kind !== 'arcs') return
  expect(result.arcs).toHaveLength(2)

  const halves = [[0, Math.PI], [Math.PI, Math.PI * 2]] as const
  for (const [index, [startAngle, endAngle]] of halves.entries()) {
    const arc = result.arcs[index]!
    const match = arc.path.match(/^M (\S+) (\S+) A (\S+) (\S+) (\S+) 0 1 (\S+) (\S+)$/)
    expect(match).not.toBeNull()
    if (!match) continue

    const start = { x: Number(match[1]), y: Number(match[2]) }
    const end = { x: Number(match[6]), y: Number(match[7]) }
    const expectedStart = pointAt(ellipse, radians, startAngle)
    const expectedEnd = pointAt(ellipse, radians, endAngle)
    expect(Number(match[3])).toBe(ellipse.rx)
    expect(Number(match[4])).toBe(ellipse.ry)
    expect(Number(match[5])).toBe(ellipse.rotation)
    expect(start.x).toBeCloseTo(expectedStart.x, 10)
    expect(start.y).toBeCloseTo(expectedStart.y, 10)
    expect(end.x).toBeCloseTo(expectedEnd.x, 10)
    expect(end.y).toBeCloseTo(expectedEnd.y, 10)
  }

  expect(result.arcs[0]!.dashOffset).toBe(0)
  expect(result.arcs[1]!.dashOffset).toBeCloseTo(simpsonEllipseLength(Math.PI, ellipse.rx, ellipse.ry), 5)
})

test('unsafe finite geometry retains the native ellipse fallback @pure', { tag: '@pure' }, () => {
  expect(clipWardenOrbitStroke(
    { center: { x: Number.NaN, y: 40 }, rx: 12, ry: 8, rotation: 65 },
    { x: 0, y: 0, width: 100, height: 80 },
    0,
  )).toEqual({ kind: 'ellipse' })
})

function normalizeAngle(angle: number): number {
  const normalized = angle % (Math.PI * 2)
  return normalized < 0 ? normalized + Math.PI * 2 : normalized
}

function pointAt(ellipse: { center: { x: number; y: number }; rx: number; ry: number }, rotation: number, angle: number) {
  const cosine = Math.cos(rotation)
  const sine = Math.sin(rotation)
  return {
    x: ellipse.center.x + ellipse.rx * Math.cos(angle) * cosine - ellipse.ry * Math.sin(angle) * sine,
    y: ellipse.center.y + ellipse.rx * Math.cos(angle) * sine + ellipse.ry * Math.sin(angle) * cosine,
  }
}

function simpsonEllipseLength(angle: number, rx: number, ry: number): number {
  const segments = 16_384
  const step = angle / segments
  let weightedSpeed = Math.hypot(rx * Math.sin(0), ry * Math.cos(0))
    + Math.hypot(rx * Math.sin(angle), ry * Math.cos(angle))
  for (let index = 1; index < segments; index += 1) {
    const speed = Math.hypot(rx * Math.sin(index * step), ry * Math.cos(index * step))
    weightedSpeed += (index % 2 === 0 ? 2 : 4) * speed
  }
  return weightedSpeed * step / 3
}
