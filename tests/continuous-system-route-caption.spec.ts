import { expect, test } from '@playwright/test'
import { continuousSystemRouteCaptionLayouts } from '../utils/continuous-system-route-caption'

test('wide captions on coincident vertical routes separate without overlapping @pure', { tag: '@pure' }, () => {
  const requests = [2, 3].map(jumpLevel => ({
    jumpLevel,
    destinationLabel: 'W'.repeat(80),
    selectedAnchor: { x: 0, y: 0 },
    remoteEndpoint: { x: 0, y: 60 },
  }))
  const captions = continuousSystemRouteCaptionLayouts(requests)
  const first = captions[0]!.bounds
  const second = captions[1]!.bounds

  expect(captions.map(caption => caption.jumpLabel)).toEqual(['Jump-2', 'Jump-3'])
  expect(second.x + second.width).toBeLessThanOrEqual(first.x)
  expect(continuousSystemRouteCaptionLayouts(requests)).toEqual(captions)
})

test('a system title obstacle keeps an upward route caption clear @pure', { tag: '@pure' }, () => {
  const [caption] = continuousSystemRouteCaptionLayouts([{
    jumpLevel: 2,
    destinationLabel: 'New Zone 2',
    selectedAnchor: { x: 100, y: 100 },
    remoteEndpoint: { x: 180, y: -1 },
  }], 5, [{ x: 100, y: -18, width: 160, height: 38 }])

  if (!caption) throw new Error('The route caption was not laid out.')
  const title = { x: 100, y: -18, width: 160, height: 38 }
  const separated = caption.bounds.x >= title.x + title.width
    || caption.bounds.x + caption.bounds.width <= title.x
    || caption.bounds.y >= title.y + title.height
    || caption.bounds.y + caption.bounds.height <= title.y
  expect(separated).toBe(true)
})
