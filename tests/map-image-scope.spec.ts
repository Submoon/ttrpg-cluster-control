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
  continuousMapNameLabelFramePosition,
  continuousMapNameLabels,
  type ContinuousMapNameProjection,
} from '../utils/continuous-map-name-labels'
import { continuousMapNameTransitionProgress, continuousMapTextScale } from '../utils/continuous-map-projection'

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

test('continuous system names ease into frame corners and transformed text has a screen-size cap @pure', { tag: '@pure' }, () => {
  const frame = { x: 40, y: 30, width: 100, height: 80 }
  const camera = { x: 10, y: 20, k: 1.7 }
  const label = { x: 300, y: 250, width: 100 }
  const halfway = continuousMapNameTransitionProgress(frame, camera.k, 1)
  const halfwayPosition = continuousMapNameLabelFramePosition(label, frame, camera, 1, halfway)
  const finalPosition = continuousMapNameLabelFramePosition(label, frame, camera, 1, 1)

  expect(halfway).toBeCloseTo(.5)
  expect(halfwayPosition.x).toBeCloseTo(220)
  expect(halfwayPosition.y).toBeCloseTo(166.5)
  expect(finalPosition.x).toBeCloseTo(140)
  expect(finalPosition.y).toBeCloseTo(83)
  expect(continuousMapTextScale(5.6, 20, 28)).toBeCloseTo(.25)
  expect(continuousMapTextScale(.2, 20, 28)).toBe(1)
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
