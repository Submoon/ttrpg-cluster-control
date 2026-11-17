import { expect, test } from '@playwright/test'
import { continuousMapRouteCurve } from '../utils/continuous-map-route-geometry'
import { placeContinuousMapRouteLabels } from '../utils/continuous-map-route-labels'

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

test('the selected route gets the readable label when two labels compete', { tag: '@pure' }, () => {
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
  expect([...neutral.keys()]).toEqual(['first', 'clear'])
  expect([...selected.keys()]).toEqual(['selected', 'clear'])
  expect(selected.get('selected')?.text).toBe('Jump-12')
})

test('labels require an unobstructed badge inside the viewport on a readable length of path', { tag: '@pure' }, () => {
  const labels = placeContinuousMapRouteLabels({
    routes: [
      horizontalRoute('clipped', 2, -190, 210, 45),
      horizontalRoute('obstructed', 2, 0, 200, 100),
      horizontalRoute('too-short', 2, 100, 125, 50),
      horizontalRoute('readable', 2, -200, 630, 155),
    ],
    selectedRouteId: 'clipped',
    viewport: { x: 0, y: 0, k: 1 },
    viewportRect: { x: 0, y: 20, width: 250, height: 170 },
    svgPixelScale: 1,
    obstacles: [{ x: 93, y: 84, width: 54, height: 32 }],
  })
  expect([...labels.keys()]).toEqual(['readable'])
})
