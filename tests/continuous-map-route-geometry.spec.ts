import { expect, test } from '@playwright/test'
import type { JumpRoute, Point } from '../domain/workspace'
import { previewWardenSystemObjects, projectContinuousSystemGeometry } from '../utils/continuous-map-projection'
import {
  buildContinuousMapRouteGeometries,
  continuousMapRoundedRectBoundaryPoint,
  continuousMapRouteCurve,
  separateCoincidentRoundedFrameRouteEndpoints,
} from '../utils/continuous-map-route-geometry'
import { buildContinuousWardenRouteGeometries } from '../utils/continuous-warden-routes'
import { continuousSystemFrames } from '../utils/continuous-system-frames'

const from = projectContinuousSystemGeometry({
  id: 'from',
  name: 'Origin',
  anchor: { x: 100, y: 50 },
  objects: [
    { id: 'departure', name: 'Departure', locationKey: 'JP1', position: { x: 680, y: 180 } },
    { id: 'primary-star', name: 'Primary Star', locationKey: 'STAR1', position: { x: 480, y: 280 } },
    { id: 'companion-star', name: 'Companion Star', locationKey: 'STAR2', position: { x: 460, y: 280 } },
  ],
  orbits: [],
})
const to = projectContinuousSystemGeometry({
  id: 'to',
  name: 'Destination',
  anchor: { x: 500, y: 100 },
  objects: [{ id: 'arrival', name: 'Arrival', locationKey: 'JP1', position: { x: 580, y: 580 } }],
  orbits: [],
})
const route: JumpRoute = {
  id: 'route',
  name: 'Departure to Arrival',
  jumpLevel: 3,
  fromSystemId: from.id,
  fromPointId: 'departure',
  toSystemId: to.id,
  toPointId: 'arrival',
  playerShared: false,
}

test('route endpoints meet the facing edges of an asymmetric rounded system frame @pure', { tag: '@pure' }, () => {
  const anchor = { x: 20, y: 25 }
  const frame = { x: -20, y: -10, width: 140, height: 80 }

  expect(continuousMapRoundedRectBoundaryPoint(anchor, frame, { x: 500, y: 25 })).toEqual({ x: 120, y: 25 })
  expect(continuousMapRoundedRectBoundaryPoint(anchor, frame, { x: 20, y: 500 })).toEqual({ x: 20, y: 70 })
  expect(continuousMapRoundedRectBoundaryPoint(anchor, frame, { x: 500, y: 500 })).toEqual({
    x: 20 + 480 * (45 / 475),
    y: 70,
  })
})

test('coincident system anchors can choose opposite facing frame edges @pure', { tag: '@pure' }, () => {
  const anchor = { x: 20, y: 25 }
  const frame = { x: -20, y: -10, width: 140, height: 80 }

  expect(continuousMapRoundedRectBoundaryPoint(anchor, frame, anchor, { x: 1, y: 0 })).toEqual({ x: 120, y: 25 })
  expect(continuousMapRoundedRectBoundaryPoint(anchor, frame, anchor, { x: -1, y: 0 })).toEqual({ x: -20, y: 25 })
  expect(continuousMapRoundedRectBoundaryPoint(anchor, { ...frame, width: 0 }, { x: 200, y: 25 })).toEqual(anchor)
})

test('diagonal route endpoints meet the visible rounded frame arc and clamp radius to its dimensions @pure', { tag: '@pure' }, () => {
  const diagonal = continuousMapRoundedRectBoundaryPoint(
    { x: 50, y: 50 },
    { x: 0, y: 0, width: 100, height: 100 },
    { x: 100, y: 0 },
  )
  expect(diagonal.x).toBeCloseTo(82 + Math.sqrt(162), 10)
  expect(diagonal.y).toBeCloseTo(18 - Math.sqrt(162), 10)

  const narrowFrame = continuousMapRoundedRectBoundaryPoint(
    { x: 10, y: 15 },
    { x: 0, y: 0, width: 20, height: 80 },
    { x: 100, y: -100 },
  )
  expect(Math.hypot(narrowFrame.x - 10, narrowFrame.y - 10)).toBeCloseTo(10, 10)
  const clippedAnchor = continuousMapRoundedRectBoundaryPoint(
    { x: 0, y: 0 },
    { x: 0, y: 0, width: 100, height: 100 },
    { x: 100, y: 100 },
  )
  expect(clippedAnchor.x).toBeCloseTo(82 + Math.sqrt(162), 10)
  expect(clippedAnchor.y).toBeCloseTo(82 + Math.sqrt(162), 10)
})

test('a rounded corner clipped through a system anchor still resolves a visible route edge @pure', { tag: '@pure' }, () => {
  const systems = [
    { id: 'a', anchor: { x: 0, y: 0 }, envelope: { x: -100, y: -100, width: 200, height: 200 } },
    { id: 'b', anchor: { x: 2, y: 0 }, envelope: { x: -100, y: -100, width: 200, height: 200 } },
    { id: 'c', anchor: { x: 0, y: 2 }, envelope: { x: -100, y: -100, width: 200, height: 200 } },
  ]
  const frames = continuousSystemFrames(systems)
  const frame = frames.get('a')!
  expect(frame).toEqual({ x: -100, y: -100, width: 101, height: 101 })

  const endpoint = continuousMapRoundedRectBoundaryPoint(systems[0]!.anchor, frame, systems[1]!.anchor)
  expect(endpoint).not.toEqual(systems[0]!.anchor)
  expect(Math.hypot(endpoint.x + 17, endpoint.y + 17)).toBeCloseTo(18, 8)
  expect(endpoint.x).toBeGreaterThanOrEqual(-17)
  expect(endpoint.y).toBeGreaterThanOrEqual(-17)

  const routeGeometry = buildContinuousMapRouteGeometries([{
    id: 'route-from-clipped-anchor',
    fromSystemId: 'a',
    toSystemId: 'b',
    start: endpoint,
    end: systems[1]!.anchor,
  }]).get('route-from-clipped-anchor')
  expect(routeGeometry?.start).toEqual(endpoint)
  expect(routeGeometry && [
    routeGeometry.bounds.x,
    routeGeometry.bounds.y,
    routeGeometry.bounds.width,
    routeGeometry.bounds.height,
  ].every(Number.isFinite)).toBe(true)
})

test('edge-touching overview routes separate coincident frame fallbacks on their rounded borders @pure', { tag: '@pure' }, () => {
  const systems = [
    projectContinuousSystemGeometry({ id: 'a', name: 'A', anchor: { x: 50, y: 40 }, objects: [], orbits: [] }),
    projectContinuousSystemGeometry({ id: 'b', name: 'B', anchor: { x: 150, y: 40 }, objects: [], orbits: [] }),
  ]
  const frames = new Map([
    ['a', { x: 0, y: 0, width: 100, height: 80 }],
    ['b', { x: 100, y: 0, width: 100, height: 80 }],
  ])
  const geometries = buildContinuousWardenRouteGeometries({
    routes: [
      { id: 'forward', name: 'A to B', jumpLevel: 1, fromSystemId: 'a', fromPointId: null, toSystemId: 'b', toPointId: null, playerShared: false },
      { id: 'reverse', name: 'B to A', jumpLevel: 1, fromSystemId: 'b', fromPointId: null, toSystemId: 'a', toPointId: null, playerShared: false },
    ],
    projections: systems,
    detailSystemIds: new Set(),
    frames,
  })
  const forward = geometries.get('forward')!
  const reverse = geometries.get('reverse')!
  expect(forward.start.x).toBe(100)
  expect(forward.end.x).toBe(100)
  expect(forward.start.y).toBeGreaterThanOrEqual(18)
  expect(forward.start.y).toBeLessThanOrEqual(62)
  expect(forward.end.y).toBeGreaterThanOrEqual(18)
  expect(forward.end.y).toBeLessThanOrEqual(62)
  expect(Math.hypot(forward.start.x - forward.end.x, forward.start.y - forward.end.y)).toBeGreaterThanOrEqual(16)
  expect(reverse.start).toEqual(forward.end)
  expect(reverse.end).toEqual(forward.start)
  expect(forward.path).not.toBe(reverse.path)
  expect(Math.hypot(forward.start.x - forward.end.x, forward.start.y - forward.end.y)).toBeGreaterThan(0)
  expect(Math.hypot(reverse.start.x - reverse.end.x, reverse.start.y - reverse.end.y)).toBeGreaterThan(0)
})

test('rounded frame route endpoints preserve a real narrow gap at every zoom scale @pure', { tag: '@pure' }, () => {
  const startAnchor = { x: 50, y: 40 }
  const startFrame = { x: 0, y: 0, width: 100, height: 80 }
  const endAnchor = { x: 150.00001, y: 40 }
  const endFrame = { x: 100.00001, y: 0, width: 100, height: 80 }
  const startPoint = { x: 100, y: 40 }
  const endPoint = { x: 100.00001, y: 40 }

  for (const scale of [1, 1000]) {
    expect(separateCoincidentRoundedFrameRouteEndpoints(
      startAnchor,
      startFrame,
      startPoint,
      endAnchor,
      endFrame,
      endPoint,
      scale,
    )).toEqual({ start: startPoint, end: endPoint })
  }
})

test('overview routes meet system borders and attach each Jump Point only at that end’s detail level', { tag: '@pure' }, () => {
  const frames = continuousSystemFrames([from, to].map(projection => ({
    id: projection.id,
    anchor: projection.anchor,
    envelope: projection.envelope,
  })))
  const fromFrame = frames.get(from.id)!
  const toFrame = frames.get(to.id)!
  const fromPoint = from.objects[0]!.scenePosition
  const toPoint = to.objects[0]!.scenePosition
  const facingFromEdge = (toward: Point) => continuousMapRoundedRectBoundaryPoint(from.anchor, fromFrame, toward)
  const facingToEdge = (toward: Point) => continuousMapRoundedRectBoundaryPoint(to.anchor, toFrame, toward)
  const geometry = (detailSystemIds: string[], connection = route) => buildContinuousWardenRouteGeometries({
    routes: [connection],
    projections: [from, to],
    detailSystemIds: new Set(detailSystemIds),
  }).get(connection.id)

  expect(geometry([])).toMatchObject({
    start: facingFromEdge(to.anchor),
    end: facingToEdge(from.anchor),
  })
  expect(geometry(['from'])).toMatchObject({
    start: fromPoint,
    end: facingToEdge(fromPoint),
  })
  expect(geometry(['to'])).toMatchObject({
    start: facingFromEdge(toPoint),
    end: toPoint,
  })
  expect(geometry(['from', 'to'])).toMatchObject({ start: fromPoint, end: toPoint })
  expect(geometry(['from', 'to'], { ...route, fromPointId: null })).toMatchObject({
    start: facingFromEdge(toPoint),
    end: toPoint,
  })
  expect(geometry([], { ...route, fromPointId: null, toPointId: null })).toMatchObject({
    start: facingFromEdge(to.anchor),
    end: facingToEdge(from.anchor),
  })
})

test('held group object previews move detailed routes and hosted Orbit rings without changing committed projections', { tag: '@pure' }, () => {
  const hosted = projectContinuousSystemGeometry({
    id: 'hosted',
    name: 'Hosted system',
    anchor: { x: 160, y: 90 },
    objects: [{ id: 'host', name: 'Host', locationKey: 'JP1', position: { x: 680, y: 180 } }],
    orbits: [{
      id: 'hosted-orbit',
      center: { x: 680, y: 180 },
      radii: { horizontal: 48, vertical: 24 },
      rotation: 12,
    }],
  })
  const committedStart = hosted.objects[0]!.scenePosition
  const committedOrbitCenter = hosted.orbits[0]!.sceneCenter
  const movedPosition = { x: 740, y: 220 }
  const preview = previewWardenSystemObjects(
    hosted,
    new Map([['host', movedPosition]]),
    new Map([['hosted-orbit', 'host']]),
  )
  const previewRoute = buildContinuousWardenRouteGeometries({
    routes: [{ ...route, fromSystemId: hosted.id, fromPointId: 'host' }],
    projections: [preview, to],
    detailSystemIds: new Set([hosted.id]),
  }).get(route.id)

  expect(previewRoute?.start).toEqual(preview.objects[0]!.scenePosition)
  expect(preview.objects[0]?.scenePosition).toEqual(hosted.projectLocalPoint(movedPosition))
  expect(preview.orbits[0]?.center).toEqual(movedPosition)
  expect(preview.orbits[0]?.sceneCenter).toEqual(hosted.projectLocalPoint(movedPosition))
  expect(hosted.objects[0]?.scenePosition).toEqual(committedStart)
  expect(hosted.orbits[0]?.sceneCenter).toEqual(committedOrbitCenter)
})

test('authored and previewed exits stay in scene space as automatic exits follow the origin anchor', { tag: '@pure' }, () => {
  const authored: JumpRoute = {
    ...route,
    id: 'authored',
    toSystemId: null,
    toPointId: null,
    unresolvedExit: 'Surveyed exit',
  }
  const automatic: JumpRoute = { ...authored, id: 'automatic', unresolvedExit: 'Unplaced exit' }
  const build = (detail: boolean, anchorOverrides?: Map<string, Point>, exitPositionOverrides?: Map<string, Point>) =>
    buildContinuousWardenRouteGeometries({
      routes: [authored, automatic],
      projections: [from],
      detailSystemIds: new Set(detail ? [from.id] : []),
      anchorOverrides,
      unresolvedExitPositions: { authored: { x: 1200, y: 900 } },
      exitPositionOverrides,
    })
  const overview = build(false)
  const detail = build(true)
  expect(overview.get(authored.id)?.end).toEqual({ x: 1200, y: 900 })
  expect(detail.get(authored.id)?.end).toEqual(overview.get(authored.id)?.end)
  expect(overview.get(automatic.id)?.end).toEqual({ x: 235, y: 114 })
  expect(detail.get(automatic.id)?.end).toEqual(overview.get(automatic.id)?.end)

  const moved = build(true, new Map([[from.id, { x: 200, y: 80 }]]))
  expect(moved.get(authored.id)).toMatchObject({ start: { x: 240, y: 60 }, end: { x: 1200, y: 900 } })
  expect(moved.get(automatic.id)).toMatchObject({ start: { x: 240, y: 60 }, end: { x: 335, y: 144 } })
  const previewed = build(true, undefined, new Map([[authored.id, { x: -240, y: 620 }]]))
  expect(previewed.get(authored.id)?.end).toEqual({ x: -240, y: 620 })
})

test('coincident displayed pairs have separate route lanes regardless of direction or route order', { tag: '@pure' }, () => {
  const start = { x: 20, y: 140 }
  const end = { x: 720, y: 140 }
  const forward = { id: 'forward', fromSystemId: 'a', toSystemId: 'b', start, end }
  const reverse = { id: 'reverse', fromSystemId: 'b', toSystemId: 'a', start: end, end: start }
  const secondPair = { id: 'overlap', fromSystemId: 'c', toSystemId: 'd', start, end }
  const routes = [forward, reverse, secondPair]
  const scene = buildContinuousMapRouteGeometries(routes)
  const midpoints = routes.map(route => scene.get(route.id)!.midpoint.y).sort((a, b) => a - b)
  expect(midpoints[1]! - midpoints[0]!).toBeGreaterThan(12)
  expect(midpoints[2]! - midpoints[1]!).toBeGreaterThan(12)
  expect(scene.get(reverse.id)).toMatchObject({ start: end, end: start })

  const reordered = buildContinuousMapRouteGeometries([...routes].reverse())
  for (const route of routes) expect(reordered.get(route.id)).toEqual(scene.get(route.id))
})

test('route bounds frame the full painted curve between its endpoints', { tag: '@pure' }, () => {
  const curve = continuousMapRouteCurve(
    { x: 0, y: 0 },
    { x: 100, y: 90 },
    { x: 200, y: 90 },
    { x: 300, y: 0 },
  )
  expect(curve.midpoint).toEqual({ x: 150, y: 67.5 })
  expect(curve.bounds).toEqual({ x: 0, y: 0, width: 300, height: 67.5 })

  const asymmetric = continuousMapRouteCurve(
    { x: 0, y: 0 },
    { x: 100, y: -120 },
    { x: 200, y: -90 },
    { x: 300, y: 90 },
  )
  expect(asymmetric.bounds).toEqual({ x: 0, y: -72, width: 300, height: 162 })
})

test('coincident endpoints still provide distinct, nondegenerate paths to select and frame', { tag: '@pure' }, () => {
  const point = { x: 260, y: 500 }
  const first = { id: 'one', fromSystemId: 'a', toSystemId: 'b', start: point, end: point }
  const reverse = { id: 'two', fromSystemId: 'b', toSystemId: 'a', start: point, end: point }
  const scene = buildContinuousMapRouteGeometries([first, reverse])
  const one = scene.get(first.id)!
  const two = scene.get(reverse.id)!
  for (const geometry of [one, two]) {
    expect(geometry.start).toEqual(point)
    expect(geometry.end).toEqual(point)
    expect(geometry.bounds.width).toBeGreaterThan(10)
    expect(geometry.bounds.height).toBeGreaterThan(10)
  }
  expect(Math.abs(one.midpoint.y - two.midpoint.y)).toBeGreaterThan(12)
})

test('three overlapping route strokes retain separate hit lanes at distant overview', { tag: '@pure' }, () => {
  const start = { x: 20, y: 140 }
  const end = { x: 820, y: 140 }
  const routes = [
    { id: 'a', fromSystemId: 'origin', toSystemId: 'destination', start, end },
    { id: 'b', fromSystemId: 'destination', toSystemId: 'origin', start: end, end: start },
    { id: 'c', fromSystemId: 'origin', toSystemId: 'destination', start, end },
  ]
  const pixelsPerSceneUnit = 0.1
  const display = { pixelsPerSceneUnit, fanOutLimitPixels: 96 }
  const scaled = buildContinuousMapRouteGeometries(routes, display)
  const midpointScreenY = routes.map(route => scaled.get(route.id)!.midpoint.y * pixelsPerSceneUnit)
    .sort((left, right) => left - right)
  expect(midpointScreenY[1]! - midpointScreenY[0]!).toBeGreaterThan(14)
  expect(midpointScreenY[2]! - midpointScreenY[1]!).toBeGreaterThan(14)
  for (const route of routes) expect(scaled.get(route.id)).toMatchObject({ start: route.start, end: route.end })

  const coincident = buildContinuousMapRouteGeometries(routes.map(route => ({ ...route, start, end: start })), display)
  const loopOffsets = routes.map(route => (coincident.get(route.id)!.midpoint.y - start.y) * pixelsPerSceneUnit)
    .sort((left, right) => left - right)
  expect(loopOffsets.every(offset => Math.abs(offset) > 23)).toBe(true)
  expect(loopOffsets[1]! - loopOffsets[0]!).toBeGreaterThan(14)
  expect(loopOffsets[2]! - loopOffsets[1]!).toBeGreaterThan(14)
})
