import { expect, test } from '@playwright/test'
import type { JumpCluster, JumpPointReference, JumpRoute, StarSystem } from '../domain/workspace'
import {
  CLUSTER_SCENE_COORDINATE_LIMIT,
  clusterRouteGeometry,
  hasSafeClusterSceneBounds,
  isSafeClusterScenePoint,
} from '../utils/cluster-map-geometry'

test('unresolved route geometry uses its saved scene target without clamping it', { tag: '@pure' }, () => {
  const fromSystem = { id: 'system-a', name: 'Aster', objects: [], orbits: [] }
  const fromPoint = {
    id: 'point-a',
    family: 'JumpPoint',
    subtype: 'jump-point',
    locationKey: 'JP1',
    name: 'North Gate',
    description: '',
    placement: { kind: 'system', x: 0.5, y: 0.5 },
  } as const
  const jumpPoints = new Map<string, JumpPointReference>([
    [fromPoint.id, { point: fromPoint, system: fromSystem }],
  ])
  const route: JumpRoute = {
    id: 'route-a',
    fromPointId: fromPoint.id,
    toPointId: null,
    unresolvedExit: 'Rim',
    jumpLevel: 2,
  }

  const geometry = clusterRouteGeometry(
    route,
    0,
    jumpPoints,
    { [fromSystem.id]: { x: 0.5, y: 0.5 } },
    undefined,
    { [route.id]: { x: 1200, y: 900 } },
  )

  expect(geometry.exitPoint).toEqual({ x: 1200, y: 900 })
  expect(geometry.path.endsWith('1200 900')).toBe(true)
  expect(geometry.labelX).toBeGreaterThan(860)
})

test('scene geometry accepts distant points but rejects renderer-clamped coordinates and aggregate spans', { tag: '@pure' }, () => {
  const fromSystem: StarSystem = { id: 'system-a', name: 'Aster', objects: [], orbits: [] }
  const fromPoint = {
    id: 'point-a',
    family: 'JumpPoint',
    subtype: 'jump-point',
    locationKey: 'JP1',
    name: 'North Gate',
    description: '',
    placement: { kind: 'system', x: 0.5, y: 0.5 },
  } as const
  fromSystem.objects.push(fromPoint)
  const firstRoute: JumpRoute = {
    id: 'route-a',
    fromPointId: fromPoint.id,
    toPointId: null,
    unresolvedExit: 'Rim',
    jumpLevel: 2,
  }
  const secondRoute: JumpRoute = { ...firstRoute, id: 'route-b', unresolvedExit: 'Far Side' }
  const cluster: JumpCluster = {
    id: 'cluster-a',
    name: 'Aster Reach',
    systems: [fromSystem],
    routes: [firstRoute, secondRoute],
  }
  const systemPositions = { [fromSystem.id]: { x: 0.5, y: 0.5 } }
  const oneDistantExit = { [firstRoute.id]: { x: 8_500_000, y: 900 } }
  const oppositeDistantExits = {
    [firstRoute.id]: { x: -8_500_000, y: 900 },
    [secondRoute.id]: { x: 8_500_000, y: 900 },
  }

  expect(isSafeClusterScenePoint({ x: CLUSTER_SCENE_COORDINATE_LIMIT - 300, y: -8_500_000 })).toBe(true)
  expect(isSafeClusterScenePoint({ x: 20_000_000, y: 0 })).toBe(false)
  expect(hasSafeClusterSceneBounds(cluster, systemPositions, oneDistantExit)).toBe(true)
  expect(hasSafeClusterSceneBounds(cluster, systemPositions, oppositeDistantExits)).toBe(false)
})

test('scene safety includes the rendered width of the longest unresolved-exit label', { tag: '@pure' }, () => {
  const point = {
    id: 'point-a',
    family: 'JumpPoint',
    subtype: 'jump-point',
    locationKey: 'JP1',
    name: 'North Gate',
    description: '',
    placement: { kind: 'system', x: 0.5, y: 0.5 },
  } as const
  const system: StarSystem = {
    id: 'system-a',
    name: 'Aster',
    objects: [point],
    orbits: [],
  }
  const route: JumpRoute = {
    id: 'route-a',
    fromPointId: point.id,
    toPointId: null,
    unresolvedExit: 'X'.repeat(80),
    jumpLevel: 2,
  }
  const cluster: JumpCluster = {
    id: 'cluster-a',
    name: 'Aster Reach',
    systems: [system],
    routes: [route],
  }

  expect(hasSafeClusterSceneBounds(cluster, { [system.id]: { x: 0.5, y: 0.5 } }, {
    [route.id]: { x: -CLUSTER_SCENE_COORDINATE_LIMIT + 1000, y: 280 },
  })).toBe(false)
})
