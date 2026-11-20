import { expect, test } from '@playwright/test'
import {
  continuousMapRoundedFrameContains,
  planContinuousMapElasticPlacement,
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
    target: { x: 240, y: 60 },
    fixedFrames: [],
    pixelsPerSceneUnit: 1,
  })

  expect(preview).toBeNull()
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

test('a drop outside the elastic stretch budget cannot enlarge the authored frame @pure', { tag: '@pure' }, () => {
  const preview = planContinuousMapElasticPlacement({
    systemId: 'source',
    anchor,
    displayedFrame: frame,
    preferredFrame: frame,
    target: { x: 232.9, y: 60 },
    fixedFrames: [],
    pixelsPerSceneUnit: 1,
  })

  expect(preview).not.toBeNull()
  expect(preview?.acceptsDrop).toBe(false)
})
