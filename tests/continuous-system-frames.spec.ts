import { expect, test } from '@playwright/test'
import { continuousSystemFrames, type ContinuousSystemFrameInput } from '../utils/continuous-system-frames'

function expectAnchorsRemainInFrames(
  systems: readonly ContinuousSystemFrameInput[],
  frames: ReadonlyMap<string, { x: number; y: number; width: number; height: number }>,
): void {
  for (const system of systems) {
    const frame = frames.get(system.id)
    if (!frame) throw new Error(`The frame for ${system.id} is missing.`)
    expect(system.anchor.x).toBeGreaterThanOrEqual(frame.x)
    expect(system.anchor.x).toBeLessThanOrEqual(frame.x + frame.width)
    expect(system.anchor.y).toBeGreaterThanOrEqual(frame.y)
    expect(system.anchor.y).toBeLessThanOrEqual(frame.y + frame.height)
  }
}

test('continuous system frames split asymmetric overlap at the clamped anchor midpoint @pure', { tag: '@pure' }, () => {
  const systems: ContinuousSystemFrameInput[] = [
    { id: 'west', anchor: { x: 80, y: 40 }, envelope: { x: 0, y: 0, width: 100, height: 80 } },
    { id: 'east', anchor: { x: 20, y: 40 }, envelope: { x: 20, y: 10, width: 100, height: 80 } },
  ]

  const frames = continuousSystemFrames(systems)
  expect(frames.get('west')).toEqual({ x: 50, y: 0, width: 50, height: 80 })
  expect(frames.get('east')).toEqual({ x: 20, y: 10, width: 30, height: 80 })
  expectAnchorsRemainInFrames(systems, frames)
})

test('continuous system frames are independent of input order and aggregate caps from original rectangles @pure', { tag: '@pure' }, () => {
  const systems: ContinuousSystemFrameInput[] = [
    { id: 'middle', anchor: { x: 0, y: 40 }, envelope: { x: -100, y: 0, width: 200, height: 80 } },
    { id: 'west', anchor: { x: -50, y: 40 }, envelope: { x: -150, y: 0, width: 200, height: 80 } },
    { id: 'east', anchor: { x: 50, y: 40 }, envelope: { x: 20, y: 0, width: 200, height: 80 } },
  ]

  const frames = continuousSystemFrames(systems)
  const reversedFrames = continuousSystemFrames([...systems].reverse())
  const entriesById = (value: ReadonlyMap<string, unknown>) => [...value]
    .sort(([left], [right]) => left < right ? -1 : left === right ? 0 : 1)
  expect(entriesById(reversedFrames)).toEqual(entriesById(frames))
  expect(frames.get('middle')).toEqual({ x: -25, y: 0, width: 50, height: 80 })
  expect(frames.get('west')).toEqual({ x: -150, y: 0, width: 125, height: 80 })
  expect(frames.get('east')).toEqual({ x: 25, y: 0, width: 195, height: 80 })
  expectAnchorsRemainInFrames(systems, frames)
})

test('continuous system frames split on y when anchors are vertically separated and accept edge contact @pure', { tag: '@pure' }, () => {
  const systems: ContinuousSystemFrameInput[] = [
    { id: 'top', anchor: { x: 50, y: 10 }, envelope: { x: 0, y: 0, width: 100, height: 80 } },
    { id: 'bottom', anchor: { x: 50, y: 70 }, envelope: { x: 10, y: 20, width: 80, height: 80 } },
    { id: 'edge-contact', anchor: { x: 150, y: 40 }, envelope: { x: 100, y: 0, width: 60, height: 80 } },
  ]

  const frames = continuousSystemFrames(systems)
  expect(frames.get('top')).toEqual({ x: 0, y: 0, width: 100, height: 40 })
  expect(frames.get('bottom')).toEqual({ x: 10, y: 40, width: 80, height: 60 })
  expect(frames.get('edge-contact')).toEqual(systems[2]?.envelope)
  expectAnchorsRemainInFrames(systems, frames)

  const disjoint = [
    { id: 'far-west', anchor: { x: 20, y: 20 }, envelope: { x: 0, y: 0, width: 40, height: 40 } },
    { id: 'far-east', anchor: { x: 180, y: 20 }, envelope: { x: 150, y: 0, width: 60, height: 40 } },
  ] satisfies ContinuousSystemFrameInput[]
  const disjointFrames = continuousSystemFrames(disjoint)
  expect(disjointFrames.get('far-west')).toEqual(disjoint[0]?.envelope)
  expect(disjointFrames.get('far-east')).toEqual(disjoint[1]?.envelope)
})

test('continuous system frames use ID order for coincident anchors without moving either anchor @pure', { tag: '@pure' }, () => {
  const systems: ContinuousSystemFrameInput[] = [
    { id: 'c', anchor: { x: 50, y: 50 }, envelope: { x: 20, y: 20, width: 80, height: 80 } },
    { id: 'a', anchor: { x: 50, y: 50 }, envelope: { x: 0, y: 0, width: 100, height: 100 } },
    { id: 'b', anchor: { x: 50, y: 50 }, envelope: { x: 10, y: 10, width: 90, height: 90 } },
  ]

  const frames = continuousSystemFrames(systems)
  expect(frames.get('a')).toEqual({ x: 0, y: 0, width: 50, height: 100 })
  expect(frames.get('b')).toEqual({ x: 50, y: 10, width: 0, height: 90 })
  expect(frames.get('c')).toEqual({ x: 50, y: 20, width: 50, height: 80 })
  expectAnchorsRemainInFrames(systems, frames)
})
