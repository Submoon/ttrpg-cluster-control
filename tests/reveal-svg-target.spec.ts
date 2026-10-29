import { expect, test } from '@playwright/test'
import {
  revealTargetScreenDelta,
  svgCirclePaintedBounds,
  type RevealScreenBounds,
} from '../utils/reveal-svg-target'

test('a partially clipped painted marker is panned by its overflowing edges', { tag: '@pure' }, () => {
  const viewport = { left: 0, top: 0, right: 1440, bottom: 960 }
  const center = { x: 1420, y: 940 }
  const paintedBounds = svgCirclePaintedBounds(center, 7, 2, { a: 24, b: 0, c: 0, d: 24 })

  expect(paintedBounds).toEqual({ left: 1228, top: 748, right: 1612, bottom: 1132 })
  expect(revealTargetScreenDelta(viewport, paintedBounds!, center)).toEqual({ dx: -192, dy: -192 })
})

test('a target inside the padded viewport does not move', { tag: '@pure' }, () => {
  const viewport = { left: 0, top: 0, right: 1440, bottom: 960 }
  const target = { left: 200, top: 300, right: 400, bottom: 500 }

  expect(revealTargetScreenDelta(viewport, target, { x: 300, y: 400 })).toEqual({ dx: 0, dy: 0 })
})

test('leading-edge clipping is corrected on the left and top', { tag: '@pure' }, () => {
  const viewport = { left: 0, top: 0, right: 100, bottom: 80 }
  const target = { left: -5, top: -8, right: 40, bottom: 35 }

  expect(revealTargetScreenDelta(viewport, target, { x: 17.5, y: 13.5 })).toEqual({ dx: 25, dy: 26.5 })
})

test('near-full targets use reduced padding so the full target still fits', { tag: '@pure' }, () => {
  const viewport = { left: 0, top: 0, right: 100, bottom: 80 }
  const target = { left: 0, top: 0, right: 98, bottom: 78 }

  expect(revealTargetScreenDelta(viewport, target, { x: 49, y: 39 })).toEqual({ dx: 1, dy: 1 })
})

test('oversized targets keep the explicit anchor visible and become idempotent', { tag: '@pure' }, () => {
  const viewport = { left: 0, top: 0, right: 100, bottom: 80 }
  const target = { left: -60, top: -60, right: 140, bottom: 140 }
  const anchor = { x: 10, y: 90 }
  const delta = revealTargetScreenDelta(viewport, target, anchor)

  expect(delta).toEqual({ dx: 10, dy: -30 })
  const movedTarget: RevealScreenBounds = {
    left: target.left + delta!.dx,
    top: target.top + delta!.dy,
    right: target.right + delta!.dx,
    bottom: target.bottom + delta!.dy,
  }
  const movedAnchor = { x: anchor.x + delta!.dx, y: anchor.y + delta!.dy }
  expect(revealTargetScreenDelta(viewport, movedTarget, movedAnchor)).toEqual({ dx: 0, dy: 0 })
})

test('painted-circle bounds account for nonuniform screen scaling', { tag: '@pure' }, () => {
  expect(svgCirclePaintedBounds({ x: 50, y: 40 }, 7, 2, { a: 2, b: 0, c: 0, d: 3 }))
    .toEqual({ left: 34, top: 16, right: 66, bottom: 64 })
})

test('invalid or zero-sized viewports are rejected', { tag: '@pure' }, () => {
  expect(revealTargetScreenDelta(
    { left: 0, top: 0, right: 0, bottom: 80 },
    { left: 1, top: 1, right: 2, bottom: 2 },
    { x: 1, y: 1 },
  )).toBeUndefined()
  expect(revealTargetScreenDelta(
    { left: 0, top: 0, right: 100, bottom: 80 },
    { left: 1, top: 1, right: Number.POSITIVE_INFINITY, bottom: 2 },
    { x: 1, y: 1 },
  )).toBeUndefined()
})
