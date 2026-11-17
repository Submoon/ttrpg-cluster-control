import { expect, test } from '@playwright/test'
import {
  centerMapTargetViewport,
  minimumHistoryRevealViewport,
  revealNearestAnchorViewport,
  rotatedEllipseBounds,
} from '../utils/continuous-map-history-reveal'
import { continuousMapKeyboardIntent } from '../utils/continuous-map-keyboard-intent'
import { continuousMapDetailScale } from '../utils/continuous-map-projection'

test('a feasible Center applies the same camera threshold as map detail @pure', () => {
  const targetBounds = { x: 0, y: 0, width: 183, height: 120 }
  const svgPixelScale = 1280 / 960
  const threshold = continuousMapDetailScale(targetBounds, svgPixelScale, 250)
  const center = centerMapTargetViewport({
    current: { x: 0, y: 0, k: .5 },
    targetBounds,
    usableRect: { x: 0, y: 0, width: 960, height: 560 },
    minimumScale: threshold,
  })
  expect(center?.k).toBe(threshold)
  expect(center?.k).toBeGreaterThanOrEqual(continuousMapDetailScale(targetBounds, svgPixelScale, 250))
})

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

test('history reveal exposes the near edge of an oversized target with minimum pan @pure', () => {
  expect(minimumHistoryRevealViewport({
    current: { x: 0, y: 0, k: 1 },
    targetBounds: { x: 1200, y: 100, width: 1200, height: 40 },
    usableRect: { x: 0, y: 0, width: 960, height: 560 },
  })).toEqual({ x: -241, y: 0, k: 1 })
})

test('history reveal exposes the far edge of an oversized target on the left with minimum pan @pure', () => {
  expect(minimumHistoryRevealViewport({
    current: { x: 0, y: 0, k: 1 },
    targetBounds: { x: -2400, y: 100, width: 1200, height: 40 },
    usableRect: { x: 0, y: 0, width: 960, height: 560 },
  })).toEqual({ x: 1201, y: 0, k: 1 })
})

test('Center moves a target into the usable-area center without refitting its scale @pure', () => {
  expect(centerMapTargetViewport({
    current: { x: -120, y: 32, k: 0.8 },
    targetBounds: { x: 300, y: 100, width: 80, height: 48 },
    usableRect: { x: 0, y: 0, width: 960, height: 560 },
  })).toEqual({ x: 208, y: 180.8, k: 0.8 })
})

test('Center clamps an infeasible reveal floor to the target fit ceiling @pure', () => {
  expect(centerMapTargetViewport({
    current: { x: 0, y: 0, k: 0.8 },
    targetBounds: { x: 100, y: 100, width: 1000, height: 800 },
    usableRect: { x: 0, y: 0, width: 500, height: 400 },
    minimumScale: 0.6,
    maximumScale: 4,
  })?.k).toBe(0.5)
})

test('Cluster fallback keeps the current camera for an intersecting anchor @pure', () => {
  const current = { x: 0, y: 0, k: 1 }
  expect(revealNearestAnchorViewport({
    current,
    anchorBounds: [{ x: 950, y: 100, width: 32, height: 32 }],
    usableRect: { x: 0, y: 0, width: 960, height: 560 },
  })).toBe(current)
})

test('Cluster fallback pans the nearest surviving anchor without changing zoom @pure', () => {
  expect(revealNearestAnchorViewport({
    current: { x: 0, y: 0, k: 1 },
    anchorBounds: [
      { x: 1200, y: 100, width: 32, height: 32 },
      { x: 1600, y: 100, width: 32, height: 32 },
    ],
    usableRect: { x: 0, y: 0, width: 960, height: 560 },
  })).toEqual({ x: -272, y: 0, k: 1 })
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
  if (!bounds) throw new Error('The finite rotated Orbit did not produce bounds.')
  expect(bounds.x).toBeCloseTo(120.943, 2)
  expect(bounds.y).toBeCloseTo(40.943, 2)
  expect(bounds.width).toBeCloseTo(158.114, 2)
  expect(bounds.height).toBeCloseTo(158.114, 2)
})

test('continuous keyboard activation honors Move and Add before entity inspection @pure', () => {
  expect(continuousMapKeyboardIntent({
    key: 'Enter', targetKind: 'object', addArmed: false, chooserOpen: false,
    moveTargeting: true, clusterMoveTargeting: false,
  })).toBe('move-target')
  expect(continuousMapKeyboardIntent({
    key: 'Enter', targetKind: 'orbit', addArmed: false, chooserOpen: false,
    moveTargeting: false, clusterMoveTargeting: true,
  })).toBe('move-target')
  expect(continuousMapKeyboardIntent({
    key: 'Enter', targetKind: 'orbit', addArmed: true, chooserOpen: false,
    moveTargeting: false, clusterMoveTargeting: false,
  })).toBe('add-target')
  expect(continuousMapKeyboardIntent({
    key: 'Enter', targetKind: 'map', addArmed: true, chooserOpen: false,
    moveTargeting: false, clusterMoveTargeting: false,
  })).toBe('add-target')
  expect(continuousMapKeyboardIntent({
    key: 'Enter', targetKind: 'object', addArmed: false, chooserOpen: true,
    moveTargeting: false, clusterMoveTargeting: false,
  })).toBeNull()
})
