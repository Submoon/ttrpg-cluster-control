import { expect, test } from '@playwright/test'
import { clampMapViewport, fitMapViewport, MAP_ZOOM_MIN_SCALE } from '../utils/map-zoom'

test('Fit scales an expanded scene below the historical floor while containing its full bounds', { tag: '@pure' }, () => {
  const bounds = { x: -1800, y: 240, width: 2360, height: 6760 }
  const viewport = { x: 0, y: 0, width: 960, height: 560 }
  const fitted = fitMapViewport(bounds, viewport, Number.MIN_VALUE)

  expect(fitted).toBeTruthy()
  expect(fitted?.k).toBeGreaterThan(0)
  expect(fitted?.k).toBeLessThan(MAP_ZOOM_MIN_SCALE)
  expect(fitted!.x + bounds.x * fitted!.k).toBeGreaterThanOrEqual(40)
  expect(fitted!.x + (bounds.x + bounds.width) * fitted!.k).toBeLessThanOrEqual(920)
  expect(fitted!.y + bounds.y * fitted!.k).toBeGreaterThanOrEqual(40)
  expect(fitted!.y + (bounds.y + bounds.height) * fitted!.k).toBeLessThanOrEqual(520)
})

test('the shared system Fit calculation keeps the historical minimum by default', { tag: '@pure' }, () => {
  const fitted = fitMapViewport(
    { x: -1800, y: 240, width: 2360, height: 6760 },
    { x: 0, y: 0, width: 960, height: 560 },
  )

  expect(fitted?.k).toBeGreaterThanOrEqual(MAP_ZOOM_MIN_SCALE)
})

test('Cluster viewport restoration honors its scene-derived minimum while shared callers retain 25 percent', { tag: '@pure' }, () => {
  expect(clampMapViewport({ x: 4, y: -8, k: 0.08 }, 0.02)?.k).toBe(0.08)
  expect(clampMapViewport({ x: 4, y: -8, k: 0.01 }, 0.02)?.k).toBe(0.02)
  expect(clampMapViewport({ x: 4, y: -8, k: 0.08 })?.k).toBe(MAP_ZOOM_MIN_SCALE)
})
