import { expect, test } from '@playwright/test'
import { buildContinuousMapRouteGeometries } from '../utils/continuous-map-route-geometry'
import { nearestContinuousMapRouteHit } from '../utils/continuous-map-route-hit'

test('a covered middle route wins against its two later-painted neighbors at its centerline', { tag: '@pure' }, () => {
  const pixelsPerSceneUnit = 0.1
  const endpoints = { fromSystemId: 'a', toSystemId: 'b', start: { x: 0, y: 0 }, end: { x: 1600, y: 0 } }
  const routes = Array.from({ length: 23 }, (_, index) => ({ ...endpoints, id: `route-${String(index).padStart(2, '0')}` }))
  const geometry = buildContinuousMapRouteGeometries(routes, { pixelsPerSceneUnit, fanOutLimitPixels: 96 })
  const covering = ['route-12', 'route-10']
  const candidates = [...covering, 'route-11'].map(id => ({ id, geometry: geometry.get(id)! }))
  const point = geometry.get('route-11')!.midpoint

  for (const id of covering) {
    const separation = Math.abs(geometry.get(id)!.midpoint.y - point.y) * pixelsPerSceneUnit
    expect(separation).toBeLessThan(7)
  }
  expect(nearestContinuousMapRouteHit(point, candidates, pixelsPerSceneUnit)).toBe('route-11')
})

test('exact centerline ties keep front-to-back paint priority', { tag: '@pure' }, () => {
  const geometry = buildContinuousMapRouteGeometries([
    { id: 'route', fromSystemId: 'a', toSystemId: 'b', start: { x: 0, y: 0 }, end: { x: 600, y: 120 } },
  ]).get('route')!
  const hits = [{ id: 'front', geometry }, { id: 'back', geometry }]
  expect(nearestContinuousMapRouteHit(geometry.midpoint, hits, 1)).toBe('front')
})
