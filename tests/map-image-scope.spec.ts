import { expect, test } from '@playwright/test'
import type { Point } from '../domain/workspace'
import {
  incidentRoutesForMapImage,
  mapImageBounds,
  mapImageScopeFrame,
  trimMapImageRoute,
} from '../utils/map-image-scope'

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
