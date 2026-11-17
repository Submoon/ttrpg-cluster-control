import { expect, test } from '@playwright/test'
import { minimumHistoryRevealViewport, rotatedEllipseBounds } from '../utils/continuous-map-history-reveal'

test('history reveal keeps an already visible target camera unchanged @pure', () => {
  const current = { x: -120, y: 32, k: 0.8 }
  expect(minimumHistoryRevealViewport({
    current,
    targetBounds: { x: 300, y: 100, width: 80, height: 48 },
    usableRect: { x: 0, y: 0, width: 960, height: 560 },
  })).toEqual(current)
})

test('history reveal pans an offscreen target by the least distance without changing scale @pure', () => {
  const current = { x: 0, y: 0, k: 1 }
  expect(minimumHistoryRevealViewport({
    current,
    targetBounds: { x: 1200, y: 100, width: 50, height: 40 },
    usableRect: { x: 0, y: 0, width: 960, height: 560 },
  })).toEqual({ x: -290, y: 0, k: 1 })
})

test('history reveal only raises scale to a missing entity reveal threshold @pure', () => {
  expect(minimumHistoryRevealViewport({
    current: { x: 0, y: 0, k: 0.2 },
    targetBounds: { x: 100, y: 100, width: 20, height: 20 },
    usableRect: { x: 0, y: 0, width: 960, height: 560 },
    minimumScale: 0.5,
  })).toEqual({ x: 0, y: 0, k: 0.5 })
})

test('rotated Orbit bounds use the ellipse projected extents @pure', () => {
  const bounds = rotatedEllipseBounds({ x: 200, y: 120 }, { horizontal: 100, vertical: 50 }, 45)
  expect(bounds.x).toBeCloseTo(120.943, 2)
  expect(bounds.y).toBeCloseTo(40.943, 2)
  expect(bounds.width).toBeCloseTo(158.114, 2)
  expect(bounds.height).toBeCloseTo(158.114, 2)
})
