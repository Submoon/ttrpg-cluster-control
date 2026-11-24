import { expect, test } from '@playwright/test'
import type { Point } from '../domain/workspace'
import {
  effectiveWardenMapImageScope,
  incidentRoutesForMapImage,
  mapImageContextKey,
  mapImageBounds,
  mapImageScopeFrame,
  trimMapImageRoute,
} from '../utils/map-image-scope'
import {
  CONTINUOUS_SYSTEM_RESIZE_HANDLE_PIXELS,
  continuousMapNameLabelFramePosition,
  continuousMapNameLabels,
  type ContinuousMapNameProjection,
} from '../utils/continuous-map-name-labels'
import { continuousMapTextScale } from '../utils/continuous-map-projection'

test('selected-system image scopes include both incident directions and leave unrelated routes out @pure', { tag: '@pure' }, () => {
  const routes = [
    { id: 'outgoing', fromSystemId: 'aster', toSystemId: 'borealis' },
    { id: 'incoming', fromSystemId: 'cygnus', toSystemId: 'aster' },
    { id: 'exit', fromSystemId: 'aster', toSystemId: null },
    { id: 'unrelated', fromSystemId: 'borealis', toSystemId: 'cygnus' },
  ]

  expect(incidentRoutesForMapImage(routes, 'aster').map(route => route.id))
    .toEqual(['outgoing', 'incoming', 'exit'])
})

test('selected-system frames use only the owner envelope and fixed route gutters @pure', { tag: '@pure' }, () => {
  const ownerEnvelope = { x: 10, y: 20, width: 120, height: 80 }
  const localOutwardPrefix = { x: 0, y: 0, width: 60, height: 24 }
  const frame = mapImageScopeFrame('system', {
    overview: { x: -900, y: -100, width: 4000, height: 4000 },
    selectedSystem: ownerEnvelope,
    viewport: { x: 50, y: 60, width: 960, height: 560 },
    selectedSystemRouteGutter: 64,
    padding: 24,
  })

  expect(frame).toEqual({ x: -78, y: -68, width: 296, height: 256 })
  expect(mapImageBounds([ownerEnvelope, localOutwardPrefix])).toEqual({ x: 0, y: 0, width: 130, height: 100 })
})

test('incoming route prefixes start at the selected endpoint and stay bounded when the remote end moves @pure', { tag: '@pure' }, () => {
  const selectedEndpoint: Point = { x: 12, y: 8 }
  const first = trimMapImageRoute({
    start: { x: -800, y: -500 },
    control1: { x: -500, y: -200 },
    control2: { x: -200, y: 100 },
    end: selectedEndpoint,
  }, 'end', 40)
  const movedRemoteEnd = trimMapImageRoute({
    start: { x: -8000, y: -5000 },
    control1: { x: -5000, y: -2000 },
    control2: { x: -2000, y: 1000 },
    end: selectedEndpoint,
  }, 'end', 40)

  expect(first.start).toEqual(selectedEndpoint)
  expect(movedRemoteEnd.start).toEqual(selectedEndpoint)
  expect(first.length).toBeLessThanOrEqual(40.1)
  expect(movedRemoteEnd.length).toBeLessThanOrEqual(40.1)
  expect(first.end.x).toBeLessThan(selectedEndpoint.x)
  expect(first.end.y).toBeGreaterThan(selectedEndpoint.y)
})

test('automatic Cluster names distribute coincident anchors into readable bounds @pure', { tag: '@pure' }, () => {
  const projections: ContinuousMapNameProjection[] = Array.from({ length: 6 }, (_, index) => ({
    id: `system-${index}`,
    name: 'Same Width',
    anchor: { x: 0, y: 0 },
    envelope: { x: -60, y: -44, width: 120, height: 88 },
  }))
  const labels = continuousMapNameLabels({
    projections,
    viewport: { x: 800, y: 600, k: 1 },
    viewportRect: { x: 0, y: 0, width: 1600, height: 1200 },
    svgPixelScale: 1,
  })

  expect(labels).toHaveLength(projections.length)
  expect(new Set(labels.map(label => `${label.x}:${label.y}`)).size).toBe(projections.length)
  for (let leftIndex = 0; leftIndex < labels.length; leftIndex++) {
    const left = labels[leftIndex]!
    expect(left.x - left.width / 2).toBeGreaterThanOrEqual(8)
    expect(left.x + left.width / 2).toBeLessThanOrEqual(1592)
    expect(left.y).toBeGreaterThanOrEqual(8)
    expect(left.y + left.height).toBeLessThanOrEqual(1192)
    for (const right of labels.slice(leftIndex + 1)) {
      const overlapWidth = Math.max(0, Math.min(left.x + left.width / 2, right.x + right.width / 2)
        - Math.max(left.x - left.width / 2, right.x - right.width / 2))
      const overlapHeight = Math.max(0, Math.min(left.y + left.height, right.y + right.height)
        - Math.max(left.y, right.y))
      expect(overlapWidth * overlapHeight).toBe(0)
    }
  }
})

test('overview system names are centered on the displayed frame @pure', { tag: '@pure' }, () => {
  const frame = { x: 120, y: 70, width: 260, height: 180 }
  const label = continuousMapNameLabels({
    projections: [{
      id: 'system',
      name: 'Vesper',
      anchor: { x: 200, y: 160 },
      envelope: frame,
    }],
    viewport: { x: 20, y: 40, k: 1.2 },
    viewportRect: { x: 0, y: 0, width: 960, height: 560 },
    svgPixelScale: 1,
  })[0]

  expect(label).toBeDefined()
  expect(label?.x).toBeCloseTo(20 + (frame.x + frame.width / 2) * 1.2)
  expect(label?.y).toBeCloseTo(40 + (frame.y + frame.height / 2) * 1.2 - label!.height / 2)
  expect(label?.height).toBe(36)
  expect(label?.hasLeader).toBe(true)
})

test('preview name culling uses an already translated anchor and frame only once @pure', { tag: '@pure' }, () => {
  const labels = continuousMapNameLabels({
    projections: [{
      id: 'previewed-system',
      name: 'Previewed System',
      anchor: { x: 200, y: 50 },
      envelope: { x: 150, y: 20, width: 20, height: 20 },
    }],
    viewport: { x: 0, y: 0, k: 1 },
    viewportRect: { x: 0, y: 0, width: 100, height: 100 },
    svgPixelScale: 1,
  })

  expect(labels.map(label => label.id)).toEqual(['previewed-system'])
  expect(labels[0]?.anchorX).toBe(200)
})

test('continuous system names ease into frame corners and transformed text has a screen-size cap @pure', { tag: '@pure' }, () => {
  const frame = { x: 40, y: 30, width: 100, height: 80 }
  const camera = { x: 10, y: 20, k: 1.7 }
  const label = { x: 300, y: 250, width: 100 }
  const halfwayPosition = continuousMapNameLabelFramePosition(label, frame, camera, 1, .5)
  const finalPosition = continuousMapNameLabelFramePosition(label, frame, camera, 1, 1)

  expect(halfwayPosition.x).toBeCloseTo(220)
  expect(halfwayPosition.y).toBeCloseTo(166.5)
  expect(finalPosition.x).toBeCloseTo(140)
  expect(finalPosition.y).toBeCloseTo(83)
  expect(continuousMapTextScale(5.6, 20, 28)).toBeCloseTo(.25)
  expect(continuousMapTextScale(.2, 20, 28)).toBe(1)
})

test('a Move name clears the top-left resize hit area without changing its frame-top alignment @pure', { tag: '@pure' }, () => {
  const frame = { x: 40, y: 30, width: 100, height: 80 }
  const camera = { x: 10, y: 20, k: 1.7 }
  const viewportRect = { x: 0, y: 0, width: 1000, height: 600 }
  const label = { x: 300, y: 250, width: 100 }
  const position = continuousMapNameLabelFramePosition(
    label,
    frame,
    camera,
    1,
    1,
    viewportRect,
    12,
    CONTINUOUS_SYSTEM_RESIZE_HANDLE_PIXELS,
  )
  const cornerInset = 18 * (1 - Math.SQRT1_2)
  const handleCenterX = camera.x + (frame.x + cornerInset) * camera.k
  const handleRight = handleCenterX + CONTINUOUS_SYSTEM_RESIZE_HANDLE_PIXELS / 2

  expect(position.x - label.width / 2 - handleRight).toBeCloseTo(6)
  expect(position.y).toBeCloseTo(camera.y + frame.y * camera.k + 12)
})

test('a Move name stays inside a frame near the viewport edge and clears every resize target during its glide @pure', { tag: '@pure' }, () => {
  const frame = { x: 113.25, y: 38.5, width: 200, height: 150 }
  const camera = { x: 0, y: 0, k: 4 }
  const viewportRect = { x: 0, y: 0, width: 600, height: 400 }
  const label = { x: 542, y: 356, width: 100 }
  const frameLeft = camera.x + frame.x * camera.k
  const frameTop = camera.y + frame.y * camera.k
  const frameRight = camera.x + (frame.x + frame.width) * camera.k
  const frameBottom = camera.y + (frame.y + frame.height) * camera.k
  const cornerInset = 18 * (1 - Math.SQRT1_2) * camera.k
  const halfHandle = CONTINUOUS_SYSTEM_RESIZE_HANDLE_PIXELS / 2
  const targets = [
    { x: frameLeft + cornerInset, y: frameTop + cornerInset },
    { x: frameRight - cornerInset, y: frameTop + cornerInset },
    { x: frameLeft + cornerInset, y: frameBottom - cornerInset },
    { x: frameRight - cornerInset, y: frameBottom - cornerInset },
  ]

  for (const progress of [0, .25, .5, .75, 1]) {
    const position = continuousMapNameLabelFramePosition(
      label,
      frame,
      camera,
      1,
      progress,
      viewportRect,
      12,
      CONTINUOUS_SYSTEM_RESIZE_HANDLE_PIXELS,
    )
    const left = position.x - label.width / 2
    const right = position.x + label.width / 2
    const bottom = position.y + 36
    for (const target of targets) {
      const overlaps = left < target.x + halfHandle && right > target.x - halfHandle
        && position.y < target.y + halfHandle && bottom > target.y - halfHandle
      expect(overlaps).toBe(false)
    }
    expect(left).toBeGreaterThanOrEqual(viewportRect.x)
    expect(right).toBeLessThanOrEqual(viewportRect.x + viewportRect.width)
    expect(position.y).toBeGreaterThanOrEqual(frameTop)
    expect(bottom).toBeLessThanOrEqual(frameBottom)
  }
})

test('a long Move name moves below corner targets to remain inside a narrow frame @pure', { tag: '@pure' }, () => {
  const frame = { x: 20, y: 20, width: 300, height: 300 }
  const camera = { x: 0, y: 0, k: 1 }
  const viewportRect = { x: 0, y: 0, width: 500, height: 400 }
  const label = { x: 250, y: 180, width: 270 }
  const position = continuousMapNameLabelFramePosition(
    label,
    frame,
    camera,
    1,
    1,
    viewportRect,
    12,
    CONTINUOUS_SYSTEM_RESIZE_HANDLE_PIXELS,
  )
  const frameTop = camera.y + frame.y * camera.k
  const frameBottom = camera.y + (frame.y + frame.height) * camera.k

  expect(position.y).toBeGreaterThan(frameTop + 12)
  expect(position.x - label.width / 2).toBeGreaterThanOrEqual(camera.x + frame.x * camera.k + 12)
  expect(position.x + label.width / 2).toBeLessThanOrEqual(camera.x + (frame.x + frame.width) * camera.k - 12)
  expect(position.y + 36).toBeLessThanOrEqual(frameBottom - 12)
})

test('a Move name avoids resize targets when the detail glide crosses a corner @pure', { tag: '@pure' }, () => {
  const frame = { x: 20, y: 20, width: 300, height: 300 }
  const camera = { x: 0, y: 0, k: 1 }
  const viewportRect = { x: 0, y: 0, width: 500, height: 400 }
  const label = { x: 70, y: 100, width: 100 }
  const cornerInset = 18 * (1 - Math.SQRT1_2)
  const halfHandle = CONTINUOUS_SYSTEM_RESIZE_HANDLE_PIXELS / 2
  const topLeftHandle = {
    x: camera.x + (frame.x + cornerInset) * camera.k,
    y: camera.y + (frame.y + cornerInset) * camera.k,
  }

  for (const progress of [0, .7, .8, .9, 1]) {
    const position = continuousMapNameLabelFramePosition(
      label,
      frame,
      camera,
      1,
      progress,
      viewportRect,
      12,
      CONTINUOUS_SYSTEM_RESIZE_HANDLE_PIXELS,
    )
    const overlaps = position.x - label.width / 2 < topLeftHandle.x + halfHandle
      && position.x + label.width / 2 > topLeftHandle.x - halfHandle
      && position.y < topLeftHandle.y + halfHandle
      && position.y + 36 > topLeftHandle.y - halfHandle

    expect(overlaps).toBe(false)
  }
})

test('a Move name stays viewport-clamped and moves above the handle only when the right-side fit fails @pure', { tag: '@pure' }, () => {
  const frame = { x: 150, y: 30, width: 100, height: 80 }
  const camera = { x: 10, y: 20, k: 1.7 }
  const viewportRect = { x: 0, y: 0, width: 360, height: 220 }
  const label = { x: 300, y: 250, width: 100 }
  const position = continuousMapNameLabelFramePosition(
    label,
    frame,
    camera,
    1,
    1,
    viewportRect,
    12,
    CONTINUOUS_SYSTEM_RESIZE_HANDLE_PIXELS,
  )

  expect(position.x).toBe(302)
  expect(position.x - label.width / 2).toBeGreaterThanOrEqual(8)
  expect(position.x + label.width / 2).toBeLessThanOrEqual(352)
  expect(position.y).toBeLessThan(camera.y + frame.y * camera.k + 12)
})

test('a detailed system name stays inside the viewport when its rounded frame corner is offscreen @pure', { tag: '@pure' }, () => {
  const frame = { x: 40, y: 30, width: 100, height: 80 }
  const camera = { x: -180, y: -140, k: 2 }
  const viewportRect = { x: 0, y: 0, width: 360, height: 220 }
  const label = { x: 90, y: 26, width: 100 }

  expect(continuousMapNameLabelFramePosition(label, frame, camera, 1, 1, viewportRect)).toEqual({ x: 58, y: 8 })
  expect(continuousMapNameLabelFramePosition(label, frame, camera, 1, .5, viewportRect)).toEqual({ x: 74, y: 17 })
})

test('Warden image scope falls back without an owner and viewport requests fence their full context @pure', { tag: '@pure' }, () => {
  const snapshot = {
    clusterId: 'cluster',
    viewport: { x: 10, y: 20, k: 2 },
    viewportRect: { x: 0, y: 0, width: 960, height: 560 },
    svgPixelScale: 1.5,
    detailSystemIds: ['vesper'],
    dimmedObjectIds: ['star'],
    selectedRouteId: null as string | null,
  }
  const clusterKey = mapImageContextKey('cluster', snapshot)
  const movedContext = {
    ...snapshot,
    viewport: { ...snapshot.viewport, x: 44 },
    detailSystemIds: ['harrow'],
    dimmedObjectIds: ['moon'],
    selectedRouteId: 'route',
  }

  expect(effectiveWardenMapImageScope('system', null)).toBe('cluster')
  expect(effectiveWardenMapImageScope('system', 'vesper')).toBe('system')
  expect(effectiveWardenMapImageScope('system', null, false)).toBe('system')
  expect(effectiveWardenMapImageScope('viewport', null)).toBe('viewport')
  expect(mapImageContextKey('cluster', movedContext)).toBe(clusterKey)
  expect(mapImageContextKey('system', movedContext)).toBe(mapImageContextKey('system', snapshot))
  expect(mapImageContextKey('viewport', movedContext)).not.toBe(mapImageContextKey('viewport', snapshot))
  expect(mapImageContextKey('viewport', { ...snapshot, selectedRouteId: 'route' }))
    .not.toBe(mapImageContextKey('viewport', snapshot))
  expect(mapImageContextKey('viewport', { ...snapshot, viewportRect: { ...snapshot.viewportRect, width: 800 } }))
    .not.toBe(mapImageContextKey('viewport', snapshot))
})
