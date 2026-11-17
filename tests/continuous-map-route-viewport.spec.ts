import { expect, test } from '@playwright/test'
import { buildContinuousMapRouteGeometries, continuousMapRouteCurve } from '../utils/continuous-map-route-geometry'
import { centerContinuousMapRouteViewport, revealContinuousMapRouteViewport } from '../utils/continuous-map-route-viewport'

function routeCurve(from: number, to: number) {
  return continuousMapRouteCurve(
    { x: from, y: 100 },
    { x: from + 10, y: 140 },
    { x: to - 10, y: 140 },
    { x: to, y: 100 },
  )
}

test('Center fits the complete route drawn after crossing a detail threshold', { tag: '@pure' }, () => {
  const detail = routeCurve(110, 290)
  const overview = routeCurve(0, 400)
  expect(centerContinuousMapRouteViewport({
    current: { x: -400, y: -300, k: 4 },
    usableRect: { x: 60, y: 20, width: 440, height: 240 },
    padding: 20,
    geometryAt: scale => scale >= 3 ? detail : overview,
  })).toEqual({ x: 80, y: 25, k: 1 })
})

test('history reveals the moved exit or route midpoint with minimal pan at the current zoom', { tag: '@pure' }, () => {
  const current = { x: 0, y: 0, k: 2 }
  const usableRect = { x: 0, y: 0, width: 600, height: 360 }
  const geometry = routeCurve(0, 400)
  const options = { current, geometry, usableRect, padding: 12 }
  expect(revealContinuousMapRouteViewport({ ...options, unresolved: false })).toEqual(current)
  expect(revealContinuousMapRouteViewport({ ...options, unresolved: true })).toEqual({ x: -212, y: 0, k: 2 })
})

test('Center includes a distant lane’s fixed screen-space bend', { tag: '@pure' }, () => {
  const endpoints = { fromSystemId: 'a', toSystemId: 'b', start: { x: 0, y: 0 }, end: { x: 800, y: 0 } }
  const routes = [{ ...endpoints, id: 'one' }, { ...endpoints, id: 'two' }, { ...endpoints, id: 'three' }]
  const geometryAt = (scale: number) => buildContinuousMapRouteGeometries(routes, {
    pixelsPerSceneUnit: scale,
    fanOutLimitPixels: 96,
  }).get('two')
  const viewport = centerContinuousMapRouteViewport({
    current: { x: 0, y: 0, k: 1 },
    usableRect: { x: 40, y: 20, width: 100, height: 60 },
    padding: 10,
    geometryAt,
  })
  expect(viewport).toEqual({ x: 50, y: 38, k: 0.1 })
})
