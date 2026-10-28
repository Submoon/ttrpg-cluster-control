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
    [route],
    jumpPoints,
    { [fromSystem.id]: { x: 0.5, y: 0.5 } },
    undefined,
    { [route.id]: { x: 1200, y: 900 } },
  )

  expect(geometry.exitPoint).toEqual({ x: 1200, y: 900 })
  expect(geometry.path.endsWith('1200 900')).toBe(true)
  expect(geometry.labelX).toBeGreaterThan(860)
})

test('automatic unresolved targets stay near each origin and spread across all of its Jump Points', { tag: '@pure' }, () => {
  const leftSystem: StarSystem = { id: 'system-left', name: 'Left', objects: [], orbits: [] }
  const rightSystem: StarSystem = { id: 'system-right', name: 'Right', objects: [], orbits: [] }
  const leftPointA = {
    id: 'point-left-a',
    family: 'JumpPoint',
    subtype: 'jump-point',
    locationKey: 'JP1',
    name: 'North Gate',
    description: '',
    placement: { kind: 'system', x: 0.5, y: 0.5 },
  } as const
  const leftPointB = { ...leftPointA, id: 'point-left-b', locationKey: 'JP2', name: 'South Gate' } as const
  const rightPoint = { ...leftPointA, id: 'point-right', locationKey: 'JP1' } as const
  const destinationPoint = { ...leftPointA, id: 'point-known', locationKey: 'JP9' } as const
  const jumpPoints = new Map<string, JumpPointReference>([
    [leftPointA.id, { point: leftPointA, system: leftSystem }],
    [leftPointB.id, { point: leftPointB, system: leftSystem }],
    [rightPoint.id, { point: rightPoint, system: rightSystem }],
    [destinationPoint.id, { point: destinationPoint, system: rightSystem }],
  ])
  const unresolved = (id: string, fromPointId: string): JumpRoute => ({
    id,
    fromPointId,
    toPointId: null,
    unresolvedExit: id,
    jumpLevel: 2,
  })
  const first = unresolved('route-left-first', leftPointA.id)
  const interveningOtherSystem = unresolved('route-right-interleaved', rightPoint.id)
  const interveningResolvedRoute: JumpRoute = {
    id: 'route-known-interleaved',
    fromPointId: leftPointA.id,
    toPointId: destinationPoint.id,
    jumpLevel: 3,
  }
  const remaining = [
    unresolved('route-left-second', leftPointB.id),
    unresolved('route-left-third', leftPointA.id),
    unresolved('route-left-fourth', leftPointB.id),
    unresolved('route-left-fifth', leftPointA.id),
    unresolved('route-left-sixth', leftPointB.id),
  ]
  const routes = [first, interveningOtherSystem, interveningResolvedRoute, ...remaining]
  const systemPositions = {
    [leftSystem.id]: { x: 0.5, y: 0.5 },
    [rightSystem.id]: { x: 1, y: 0.5 },
  }
  const targetFor = (
    route: JumpRoute,
    currentRoutes = routes,
    sourcePreview?: ReadonlyMap<string, { x: number; y: number }>,
    savedTargets?: Readonly<Record<string, { x: number; y: number }>>,
  ) => clusterRouteGeometry(route, currentRoutes, jumpPoints, systemPositions, sourcePreview, savedTargets).exitPoint

  const firstTarget = targetFor(first)
  expect(firstTarget).toEqual({ x: 660, y: 280 })
  expect(targetFor(interveningOtherSystem)).toEqual({ x: 1028, y: 280 })
  expect(remaining.map(route => targetFor(route))).toEqual([
    { x: 660, y: 344 },
    { x: 660, y: 216 },
    { x: 660, y: 408 },
    { x: 660, y: 152 },
    { x: 840, y: 280 },
  ])

  const withoutInterleaving = [first, ...remaining]
  expect(targetFor(remaining[0]!, withoutInterleaving)).toEqual({ x: 660, y: 344 })
  expect(targetFor(remaining[4]!, withoutInterleaving)).toEqual({ x: 840, y: 280 })
  expect(targetFor(remaining[0]!, routes, undefined, { [first.id]: { x: -1800, y: 7000 } }))
    .toEqual({ x: 660, y: 344 })
})

test('automatic targets follow source previews while manual and temporary target positions retain priority', { tag: '@pure' }, () => {
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
  const routes = [route]
  const systemPositions = { [fromSystem.id]: { x: 0.5, y: 0.5 } }
  const sourcePreview = new Map([[fromSystem.id, { x: 700, y: 300 }]])
  const manualTarget = { [route.id]: { x: -1800, y: 7000 } }
  const temporaryTarget = new Map([[route.id, { x: 1111, y: 2222 }]])

  expect(clusterRouteGeometry(route, routes, jumpPoints, systemPositions, sourcePreview).exitPoint)
    .toEqual({ x: 880, y: 300 })
  expect(clusterRouteGeometry(route, routes, jumpPoints, systemPositions, sourcePreview, manualTarget).exitPoint)
    .toEqual(manualTarget[route.id])
  expect(clusterRouteGeometry(route, routes, jumpPoints, systemPositions, sourcePreview, manualTarget, temporaryTarget).exitPoint)
    .toEqual({ x: 1111, y: 2222 })
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
