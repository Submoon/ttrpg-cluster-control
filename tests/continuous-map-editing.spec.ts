import { expect, test } from '@playwright/test'
import { resolveContinuousObjectOwnerIds } from '../utils/continuous-map-editing'
import { continuousObjectDragTarget, hasMapDragThreshold } from '../utils/continuous-object-drag'

const systems = [
  { id: 'vesper', envelope: { x: 0, y: 0, width: 100, height: 100 } },
  { id: 'altair', envelope: { x: 200, y: 0, width: 100, height: 100 } },
]

test('a definite map hit owns an Add click before envelope inference @pure', () => {
  expect(resolveContinuousObjectOwnerIds({ x: 250, y: 50 }, systems, 'vesper')).toEqual(['vesper'])
})

test('a unique envelope owns an Add click, while overlap and outside require an owner choice @pure', () => {
  expect(resolveContinuousObjectOwnerIds({ x: 50, y: 50 }, systems)).toEqual(['vesper'])
  const overlap = [systems[0]!, { id: 'altair', envelope: { x: 50, y: 20, width: 100, height: 100 } }]
  expect(resolveContinuousObjectOwnerIds({ x: 75, y: 50 }, overlap)).toEqual(['vesper', 'altair'])
  expect(resolveContinuousObjectOwnerIds({ x: 150, y: 150 }, systems)).toEqual(['vesper', 'altair'])
})

test('continuous Move preserves the off-center grab point and uses a client-pixel threshold @pure', () => {
  const projection = {
    unprojectLocalPoint: (point: { x: number; y: number }) => ({
      x: (point.x - 100) / 0.2,
      y: (point.y - 60) / 0.2,
    }),
  }
  const anchorDelta = { x: 12, y: -8 }
  const pointerStart = { x: 100 + 500 * 0.2 + anchorDelta.x, y: 60 + 280 * 0.2 + anchorDelta.y }
  const pointerCurrent = { x: pointerStart.x + 2, y: pointerStart.y + 1 }

  expect(continuousObjectDragTarget(projection, anchorDelta, { x: 560, y: 315 }, pointerStart, pointerCurrent))
    .toEqual({ x: 570, y: 320 })
  expect(hasMapDragThreshold({ x: 100, y: 100 }, { x: 103.9, y: 100 })).toBe(false)
  expect(hasMapDragThreshold({ x: 100, y: 100 }, { x: 104, y: 100 })).toBe(true)
})
