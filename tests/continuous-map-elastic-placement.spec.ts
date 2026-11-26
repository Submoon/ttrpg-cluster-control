import { expect, test } from '@playwright/test'
import {
  continuousMapRoundedFrameContains,
  planContinuousMapElasticPlacement,
  planBoundedZoneLanding,
} from '../utils/continuous-map-elastic-placement'

const anchor = { x: 100, y: 60 }
const frame = { x: 0, y: 0, width: 200, height: 120 }

test('a nearby single-object drop gets a local rounded stretch and only necessary frame growth @pure', { tag: '@pure' }, () => {
  const preview = planContinuousMapElasticPlacement({
    systemId: 'source',
    anchor,
    displayedFrame: frame,
    preferredFrame: frame,
    target: { x: 206, y: 60 },
    fixedFrames: [],
    pixelsPerSceneUnit: 1,
  })

  expect(preview).not.toBeNull()
  expect(preview?.path).toMatch(/^M .+ Z$/)
  expect(preview?.acceptsDrop).toBe(true)
  expect(preview?.preferredFrame).toEqual({ x: 0, y: 0, width: 206.001, height: 120 })
})

test('a far object drop does not create an elastic frame preview @pure', { tag: '@pure' }, () => {
  const preview = planContinuousMapElasticPlacement({
    systemId: 'source',
    anchor,
    displayedFrame: frame,
    preferredFrame: frame,
    target: { x: 286, y: 60 },
    fixedFrames: [],
    pixelsPerSceneUnit: 1,
  })

  expect(preview).toBeNull()
})

test('a straight-side drop through 40 pixels commits a regular frame that contains it @pure', { tag: '@pure' }, () => {
  const preview = planContinuousMapElasticPlacement({
    systemId: 'source',
    anchor,
    displayedFrame: frame,
    preferredFrame: frame,
    target: { x: 240, y: 60 },
    fixedFrames: [],
    pixelsPerSceneUnit: 1,
  })

  expect(preview).not.toBeNull()
  expect(preview?.acceptsDrop).toBe(true)
  const xCoordinates = Array.from(preview!.path.matchAll(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g), match => Number(match[1]))
  expect(Math.max(...xCoordinates)).toBeGreaterThan(220)
  expect(continuousMapRoundedFrameContains({ x: 240, y: 60 }, preview!.preferredFrame)).toBe(true)
  expect(preview?.preferredFrame.width).toBeLessThanOrEqual(frame.width + 40.001)

  const beyondReach = planContinuousMapElasticPlacement({
    systemId: 'source',
    anchor,
    displayedFrame: frame,
    preferredFrame: frame,
    target: { x: 281, y: 60 },
    fixedFrames: [],
    pixelsPerSceneUnit: 1,
  })
  expect(beyondReach).toBeNull()
})

test('the visible elastic edge accepts straight-side drops through its 80 pixel reach @pure', { tag: '@pure' }, () => {
  for (const x of [278, 279, 280]) {
    const target = { x, y: 60 }
    const preview = planContinuousMapElasticPlacement({
      systemId: 'source',
      anchor,
      displayedFrame: frame,
      preferredFrame: frame,
      target,
      fixedFrames: [],
      pixelsPerSceneUnit: 1,
    })

    expect(preview, `A drop ${x - 200} pixels beyond the right edge should remain inside the elastic range.`).not.toBeNull()
    expect(preview?.acceptsDrop).toBe(true)
    expect(continuousMapRoundedFrameContains(target, preview!.displayedFrame)).toBe(true)
    expect(continuousMapRoundedFrameContains(target, preview!.preferredFrame)).toBe(true)
    expect(preview?.preferredFrame.width).toBeLessThanOrEqual(frame.width + 80.001)
  }
})

test('the exact elastic limit accepts a straight-side drop between contour samples @pure', { tag: '@pure' }, () => {
  const target = { x: 280, y: 61 }
  const preview = planContinuousMapElasticPlacement({
    systemId: 'source',
    anchor,
    displayedFrame: frame,
    preferredFrame: frame,
    target,
    fixedFrames: [],
    pixelsPerSceneUnit: 1,
  })

  expect(preview).not.toBeNull()
  expect(preview?.acceptsDrop).toBe(true)
  expect(continuousMapRoundedFrameContains(target, preview!.preferredFrame)).toBe(true)
  expect(continuousMapRoundedFrameContains(target, preview!.displayedFrame)).toBe(true)
})

test('the rounded corner keeps an accepted elastic drop inside the grown frame @pure', { tag: '@pure' }, () => {
  const target = { x: 224.426, y: -24.426 }
  const preview = planContinuousMapElasticPlacement({
    systemId: 'source',
    anchor,
    displayedFrame: frame,
    preferredFrame: frame,
    target,
    fixedFrames: [],
    pixelsPerSceneUnit: 1,
  })

  expect(preview).not.toBeNull()
  expect(preview?.acceptsDrop).toBe(true)
  expect(continuousMapRoundedFrameContains(target, preview!.preferredFrame)).toBe(true)
})

test('the exact elastic limit accepts an off-sample rounded-corner drop @pure', { tag: '@pure' }, () => {
  const angle = -Math.PI * 0.27
  const target = {
    x: 182 + 98 * Math.cos(angle),
    y: 18 + 98 * Math.sin(angle),
  }
  const preview = planContinuousMapElasticPlacement({
    systemId: 'source',
    anchor,
    displayedFrame: frame,
    preferredFrame: frame,
    target,
    fixedFrames: [],
    pixelsPerSceneUnit: 1,
  })

  expect(preview).not.toBeNull()
  expect(preview?.acceptsDrop).toBe(true)
  expect(continuousMapRoundedFrameContains(target, preview!.preferredFrame)).toBe(true)
  expect(continuousMapRoundedFrameContains(target, preview!.displayedFrame)).toBe(true)
})

test('a nearby drop cannot stretch the source contour into a fixed neighbor frame @pure', { tag: '@pure' }, () => {
  const preview = planContinuousMapElasticPlacement({
    systemId: 'source',
    anchor,
    displayedFrame: frame,
    preferredFrame: frame,
    target: { x: 206, y: 60 },
    fixedFrames: [{
      id: 'neighbor',
      anchor: { x: 255, y: 60 },
      envelope: { x: 205, y: -10, width: 100, height: 140 },
    }],
    pixelsPerSceneUnit: 1,
  })

  expect(preview).not.toBeNull()
  expect(preview?.acceptsDrop).toBe(false)

  const atLimit = planContinuousMapElasticPlacement({
    systemId: 'source',
    anchor,
    displayedFrame: frame,
    preferredFrame: frame,
    target: { x: 244, y: 61 },
    fixedFrames: [{
      id: 'neighbor',
      anchor: { x: 255, y: 60 },
      envelope: { x: 205, y: 20, width: 100, height: 80 },
    }],
    pixelsPerSceneUnit: 1,
  })

  expect(atLimit).not.toBeNull()
  expect(atLimit?.acceptsDrop).toBe(false)
})

test('rounded frame containment includes its edge and excludes its clipped corner @pure', { tag: '@pure' }, () => {
  expect(continuousMapRoundedFrameContains({ x: 200, y: 60 }, frame)).toBe(true)
  expect(continuousMapRoundedFrameContains({ x: 0, y: 0 }, frame)).toBe(false)
})

test('elastic contour sampling stays bounded for enormous frames and ignores zero-area neighbors @pure', { tag: '@pure' }, () => {
  const enormous = { x: 0, y: 0, width: 100_000_000, height: 100_000_000 }
  const preview = planContinuousMapElasticPlacement({
    systemId: 'source',
    anchor: { x: 50_000_000, y: 50_000_000 },
    displayedFrame: enormous,
    preferredFrame: enormous,
    target: { x: 100_000_006, y: 50_000_000 },
    fixedFrames: [{
      id: 'collapsed',
      anchor: { x: 100_000_030, y: 50_000_000 },
      envelope: { x: 100_000_020, y: 49_999_990, width: 0, height: 20 },
    }],
    pixelsPerSceneUnit: 1,
  })

  expect(preview).not.toBeNull()
  expect(preview?.path.length).toBeLessThan(20_000)
})

test('a far pointer lands a complete branch against a fixed neighboring frame @pure', () => {
  const fixed = { id: 'east', anchor: { x: 370, y: 60 }, envelope: { x: 320, y: 0, width: 100, height: 120 } }
  const request = {
    systemId: 'source',
    anchor,
    displayedFrame: frame,
    target: { x: 600, y: 60 },
    origin: { x: 100, y: 60 },
    fixedFrames: [fixed],
    pixelsPerSceneUnit: 1,
    relativeBounds: { x: -20, y: -10, width: 85, height: 20 },
  }
  const landing = planBoundedZoneLanding(request)

  expect(landing?.root.x).toBeCloseTo(255, 2)
  expect(landing?.root.y).toBe(60)
  expect(landing?.frame).toEqual(expect.objectContaining({ x: 0, y: 0, height: 120 }))
  expect(landing!.frame.x + landing!.frame.width).toBeLessThanOrEqual(320)
  expect(planBoundedZoneLanding({ ...request, origin: undefined })).toBeNull()
  expect(fixed.envelope).toEqual({ x: 320, y: 0, width: 100, height: 120 })
})

test('growing a clipped Zone keeps its authored side and every displayed neighbor fixed @pure', () => {
  const north = { id: 'source', anchor, envelope: frame }
  const east = { id: 'east', anchor: { x: 250, y: 60 }, envelope: { x: 150, y: 0, width: 200, height: 120 } }
  const landing = planBoundedZoneLanding({
    systemId: north.id,
    anchor,
    displayedFrame: { x: 0, y: 0, width: 175, height: 120 },
    target: { x: 100, y: 110 },
    relativeBounds: { x: -10, y: -10, width: 20, height: 50 },
    fixedFrames: [{ ...east, envelope: { x: 175, y: 0, width: 175, height: 120 } }],
    authoredFrames: [north, east],
  })
  expect(landing?.frame.width).toBe(175)
  expect(landing?.frame.height).toBeGreaterThan(150)
  expect(landing?.authoredFrame.width).toBe(200)
})
