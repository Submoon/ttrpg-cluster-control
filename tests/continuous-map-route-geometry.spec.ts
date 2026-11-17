import { expect, test } from '@playwright/test'
import type { JumpRoute, Point } from '../domain/workspace'
import { projectContinuousSystemGeometry } from '../utils/continuous-map-projection'
import { buildContinuousMapRouteGeometries, continuousMapRouteCurve } from '../utils/continuous-map-route-geometry'
import { buildContinuousWardenRouteGeometries } from '../utils/continuous-warden-routes'

const from = projectContinuousSystemGeometry({
  id: 'from',
  name: 'Origin',
  anchor: { x: 100, y: 50 },
  objects: [{ id: 'departure', name: 'Departure', locationKey: 'JP1', position: { x: 680, y: 180 } }],
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

test('a continuous route follows each attached Jump Point only at that end’s detail level', { tag: '@pure' }, () => {
  const geometry = (detailSystemIds: string[], connection = route) => buildContinuousWardenRouteGeometries({
    routes: [connection],
    projections: [from, to],
    detailSystemIds: new Set(detailSystemIds),
  }).get(connection.id)

  expect(geometry([])).toMatchObject({ start: { x: 100, y: 50 }, end: { x: 500, y: 100 } })
  expect(geometry(['from'])).toMatchObject({ start: { x: 140, y: 30 }, end: { x: 500, y: 100 } })
  expect(geometry(['to'])).toMatchObject({ start: { x: 100, y: 50 }, end: { x: 520, y: 160 } })
  expect(geometry(['from', 'to'])).toMatchObject({ start: { x: 140, y: 30 }, end: { x: 520, y: 160 } })
  expect(geometry(['from', 'to'], { ...route, fromPointId: null })).toMatchObject({
    start: { x: 100, y: 50 },
    end: { x: 520, y: 160 },
  })
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
