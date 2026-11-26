import { expect, test } from '@playwright/test'
import { continuousMapRouteCurve } from '../utils/continuous-map-route-geometry'
import { placeContinuousMapRouteLabels } from '../utils/continuous-map-route-labels'
import { layoutContinuousMapObjectCaptions } from '../utils/continuous-map-caption-layout'

function horizontalRoute(id: string, jumpLevel: number, left: number, right: number, y: number) {
  return {
    id,
    jumpLevel,
    geometry: continuousMapRouteCurve(
      { x: left, y },
      { x: left + 20, y },
      { x: right - 20, y },
      { x: right, y },
    ),
  }
}

test('the selected route keeps its center badge while a competing badge moves along its curve', { tag: '@pure' }, () => {
  const routes = [
    horizontalRoute('first', 2, 0, 200, 70),
    horizontalRoute('selected', 12, 0, 200, 79),
    horizontalRoute('clear', 3, 0, 200, 130),
  ]
  const options = {
    routes,
    viewport: { x: 10, y: 0, k: 1 },
    viewportRect: { x: 0, y: 0, width: 250, height: 160 },
    svgPixelScale: 1,
  }
  const neutral = placeContinuousMapRouteLabels({ ...options, selectedRouteId: null })
  const selected = placeContinuousMapRouteLabels({ ...options, selectedRouteId: 'selected' })
  expect([...neutral.keys()]).toEqual(['first', 'selected', 'clear'])
  expect([...selected.keys()]).toEqual(['selected', 'first', 'clear'])
  expect(neutral.get('first')?.position).toEqual({ x: 100, y: 70 })
  expect(selected.get('selected')?.position).toEqual({ x: 100, y: 79 })
  expect(Math.abs(selected.get('first')!.position.x - 100)).toBeGreaterThan(54)
  expect(selected.get('selected')?.text).toBe('Jump-12')
})

test('labels require an unobstructed badge inside the viewport on a readable length of path', { tag: '@pure' }, () => {
  const labels = placeContinuousMapRouteLabels({
    routes: [
      horizontalRoute('clipped', 2, -190, 210, 45),
      horizontalRoute('obstructed', 2, 0, 200, 100),
      horizontalRoute('too-short', 2, 100, 125, 50),
      horizontalRoute('readable', 2, -200, 630, 155),
      horizontalRoute('no-room', 2, 0, 200, 186),
    ],
    selectedRouteId: 'clipped',
    viewport: { x: 0, y: 0, k: 1 },
    viewportRect: { x: 0, y: 20, width: 250, height: 170 },
    svgPixelScale: 1,
    obstacles: [{ x: 93, y: 84, width: 54, height: 32 }],
  })
  expect([...labels.keys()]).toEqual(['clipped', 'obstructed', 'readable'])
  expect(labels.get('clipped')!.position.x).toBeGreaterThan(31)
  expect(labels.get('obstructed')!.position.x).toBeLessThan(62)
})

test('map captions reserve visible marks and Zone names before placing route badges', { tag: '@pure' }, () => {
  const viewport = { x: 0, y: 0, width: 260, height: 180 }
  const zone = { x: 65, y: 105, width: 100, height: 32 }
  const { offsets, obstacles } = layoutContinuousMapObjectCaptions([
    { id: 'visible', point: { x: 115, y: 85 }, name: 'Object', key: 'VES-01', radius: 16, unit: 1 },
    { id: 'front', point: { x: 115, y: 85 }, name: 'Selected', radius: 16, unit: 1, selected: true },
    { id: 'outside', point: { x: -400, y: 25 }, name: 'Outside', radius: 12, unit: 1 },
  ], [zone], viewport, 1)
  expect([...offsets.keys()]).toEqual(['front', 'visible'])
  expect(offsets.get('front')!.y).toBeLessThan(0)
  expect(Math.abs(offsets.get('visible')!.x)).toBeGreaterThan(12)

  const route = horizontalRoute('occupied', 1, 10, 220, 85)
  const labels = placeContinuousMapRouteLabels({
    routes: [route], obstacles, selectedRouteId: null, svgPixelScale: 1,
    viewport: { x: 0, y: 0, k: 1 }, viewportRect: viewport,
  })
  expect(labels.get('occupied')?.position).toBeDefined()
  expect(labels.get('occupied')?.position).not.toEqual(route.geometry.midpoint)
})
