import { expect, test } from '@playwright/test'
import type { JumpCluster, JumpPointReference, JumpRoute, StarSystem } from '../domain/workspace'
import {
  CLUSTER_SCENE_COORDINATE_LIMIT,
  clusterRouteGeometry,
  clusterRouteLabelWidth,
  clusterUnresolvedExitLabelGeometry,
  hasSafeClusterSceneBounds,
  isSafeClusterScenePoint,
} from '../utils/cluster-map-geometry'

function clusterForRoutes(
  routes: readonly JumpRoute[],
  jumpPoints: ReadonlyMap<string, JumpPointReference>,
): JumpCluster {
  const systems = [...new Map([...jumpPoints.values()].map(reference => [reference.system.id, reference.system])).values()]
  return { id: 'cluster-test', name: 'Test Cluster', systems, routes: [...routes] }
}

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
    clusterForRoutes([route], jumpPoints),
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
  ) => clusterRouteGeometry(
    route,
    clusterForRoutes(currentRoutes, jumpPoints),
    jumpPoints,
    systemPositions,
    sourcePreview,
    savedTargets,
  ).exitPoint

  const firstTarget = targetFor(first)
  expect(firstTarget).toEqual({ x: 615, y: 280 })
  expect(targetFor(interveningOtherSystem)).toEqual({ x: 983, y: 280 })
  expect(remaining.map(route => targetFor(route))).toEqual([
    { x: 615, y: 344 },
    { x: 615, y: 216 },
    { x: 615, y: 408 },
    { x: 615, y: 152 },
    { x: 795, y: 280 },
  ])

  const withoutInterleaving = [first, ...remaining]
  expect(targetFor(remaining[0]!, withoutInterleaving)).toEqual({ x: 615, y: 344 })
  expect(targetFor(remaining[4]!, withoutInterleaving)).toEqual({ x: 795, y: 280 })
  expect(targetFor(remaining[0]!, routes, undefined, { [first.id]: { x: -1800, y: 7000 } }))
    .toEqual({ x: 615, y: 344 })

  const cluster = clusterForRoutes(routes, jumpPoints)
  const firstGeometry = clusterRouteGeometry(first, cluster, jumpPoints, systemPositions)
  const anchoredFirstGeometry = clusterRouteGeometry(
    first,
    cluster,
    jumpPoints,
    systemPositions,
    undefined,
    { [first.id]: firstTarget! },
  )
  expect(anchoredFirstGeometry).toEqual(firstGeometry)
  expect(firstGeometry.labelX).toBe(668)
  expect(firstGeometry.labelY).toBe(272)
  expect(clusterUnresolvedExitLabelGeometry('Rim', firstTarget!, { x: 480, y: 280 })).toMatchObject({
    x: 605,
    y: 334,
    left: 521,
    right: 605,
    anchor: 'end',
  })
})

test('adjacent-row captions clear endpoint badges horizontally', { tag: '@pure' }, () => {
  const system: StarSystem = { id: 'system-a', name: 'Aster', objects: [], orbits: [] }
  const point = {
    id: 'point-a',
    family: 'JumpPoint',
    subtype: 'jump-point',
    locationKey: 'JP1',
    name: 'North Gate',
    description: '',
    placement: { kind: 'system', x: 0.5, y: 0.5 },
  } as const
  const jumpPoints = new Map<string, JumpPointReference>([[point.id, { point, system }]])
  const first: JumpRoute = {
    id: 'route-first',
    fromPointId: point.id,
    toPointId: null,
    unresolvedExit: 'First',
    jumpLevel: 2,
  }
  const second = { ...first, id: 'route-second', unresolvedExit: 'Second' }
  const cluster = clusterForRoutes([first, second], jumpPoints)
  const systemPositions = { [system.id]: { x: 0.5, y: 0.5 } }
  const firstGeometry = clusterRouteGeometry(first, cluster, jumpPoints, systemPositions)
  const secondGeometry = clusterRouteGeometry(second, cluster, jumpPoints, systemPositions)
  const captionRight = firstGeometry.exitLabel!.right
  const nextBadgeLeft = secondGeometry.labelX - clusterRouteLabelWidth(second) / 2

  expect(firstGeometry.exitLabel?.y).toBe(334)
  expect(secondGeometry.labelY - firstGeometry.labelY).toBe(64)
  expect(nextBadgeLeft - captionRight).toBe(24)
})

test('negative-row endpoint captions stay above their source card', { tag: '@pure' }, () => {
  const system: StarSystem = { id: 'system-a', name: 'Aster', objects: [], orbits: [] }
  const point = {
    id: 'point-a',
    family: 'JumpPoint',
    subtype: 'jump-point',
    locationKey: 'JP1',
    name: 'North Gate',
    description: '',
    placement: { kind: 'system', x: 0.5, y: 0.5 },
  } as const
  const jumpPoints = new Map<string, JumpPointReference>([[point.id, { point, system }]])
  const first: JumpRoute = {
    id: 'route-first',
    fromPointId: point.id,
    toPointId: null,
    unresolvedExit: 'First',
    jumpLevel: 2,
  }
  const routes = [first, { ...first, id: 'route-second' }, { ...first, id: 'route-negative' }]
  const cluster = clusterForRoutes(routes, jumpPoints)
  const geometry = clusterRouteGeometry(routes[2]!, cluster, jumpPoints, { [system.id]: { x: 0.5, y: 0.5 } })
  const sourceCardTop = 280 - 38
  const captionBottom = geometry.exitLabel!.y + 2

  expect(geometry.exitPoint).toEqual({ x: 615, y: 216 })
  expect(geometry.exitLabel).toMatchObject({ x: 605, y: 162, anchor: 'end' })
  expect(captionBottom).toBeLessThan(sourceCardTop)
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

  const cluster = clusterForRoutes(routes, jumpPoints)
  expect(clusterRouteGeometry(route, cluster, jumpPoints, systemPositions, sourcePreview).exitPoint)
    .toEqual({ x: 835, y: 300 })
  expect(clusterRouteGeometry(route, cluster, jumpPoints, systemPositions, sourcePreview, manualTarget).exitPoint)
    .toEqual(manualTarget[route.id])
  expect(clusterRouteGeometry(route, cluster, jumpPoints, systemPositions, sourcePreview, manualTarget, temporaryTarget).exitPoint)
    .toEqual({ x: 1111, y: 2222 })
})

test('a far saved target leaves an unrelated automatic route geometry unchanged', { tag: '@pure' }, () => {
  const system: StarSystem = { id: 'system-a', name: 'Aster', objects: [], orbits: [] }
  const point = {
    id: 'point-a',
    family: 'JumpPoint',
    subtype: 'jump-point',
    locationKey: 'JP1',
    name: 'North Gate',
    description: '',
    placement: { kind: 'system', x: 0.5, y: 0.5 },
  } as const
  const jumpPoints = new Map<string, JumpPointReference>([[point.id, { point, system }]])
  const automaticRoute: JumpRoute = {
    id: 'route-automatic',
    fromPointId: point.id,
    toPointId: null,
    unresolvedExit: 'Rim',
    jumpLevel: 2,
  }
  const savedSibling: JumpRoute = { ...automaticRoute, id: 'route-saved', unresolvedExit: 'Far Side' }
  const cluster = clusterForRoutes([automaticRoute, savedSibling], jumpPoints)
  const savedTargets = {
    [savedSibling.id]: { x: CLUSTER_SCENE_COORDINATE_LIMIT / 2, y: 280 },
  }

  const systemPositions = { [system.id]: { x: 0.5, y: 0.5 } }
  const initialGeometry = clusterRouteGeometry(automaticRoute, cluster, jumpPoints, systemPositions)
  const afterSiblingMove = clusterRouteGeometry(
    automaticRoute,
    cluster,
    jumpPoints,
    systemPositions,
    undefined,
    savedTargets,
  )
  expect(afterSiblingMove).toEqual(initialGeometry)
  expect(afterSiblingMove.exitPoint).toEqual({ x: 615, y: 280 })
})

test('automatic targets near an ordinary off-canvas origin remain compact', { tag: '@pure' }, () => {
  const system: StarSystem = { id: 'system-a', name: 'Aster', objects: [], orbits: [] }
  const point = {
    id: 'point-a',
    family: 'JumpPoint',
    subtype: 'jump-point',
    locationKey: 'JP1',
    name: 'North Gate',
    description: '',
    placement: { kind: 'system', x: 0.5, y: 0.5 },
  } as const
  const jumpPoints = new Map<string, JumpPointReference>([[point.id, { point, system }]])
  const route: JumpRoute = {
    id: 'route-a',
    fromPointId: point.id,
    toPointId: null,
    unresolvedExit: 'Rim',
    jumpLevel: 2,
  }
  const offCanvasThousands = { [system.id]: { x: (12_000 - 112) / 736, y: (-2_800 - 96) / 368 } }

  const exitPoint = clusterRouteGeometry(route, clusterForRoutes([route], jumpPoints), jumpPoints, offCanvasThousands).exitPoint
  expect(exitPoint?.x).toBeCloseTo(12_135, 8)
  expect(exitPoint?.y).toBeCloseTo(-2_800, 8)
})

test('extreme but representable automatic origins keep the near-source defaults', { tag: '@pure' }, () => {
  const system: StarSystem = { id: 'system-a', name: 'Aster', objects: [], orbits: [] }
  const point = {
    id: 'point-a',
    family: 'JumpPoint',
    subtype: 'jump-point',
    locationKey: 'JP1',
    name: 'North Gate',
    description: '',
    placement: { kind: 'system', x: 0.5, y: 0.5 },
  } as const
  const jumpPoints = new Map<string, JumpPointReference>([[point.id, { point, system }]])
  const route: JumpRoute = {
    id: 'route-a',
    fromPointId: point.id,
    toPointId: null,
    unresolvedExit: 'Rim',
    jumpLevel: 2,
  }
  const secondRoute = { ...route, id: 'route-b', unresolvedExit: 'Far Side' }
  const cluster = clusterForRoutes([route, secondRoute], jumpPoints)
  const farButSafe = { [system.id]: { x: (CLUSTER_SCENE_COORDINATE_LIMIT / 2 - 112) / 736, y: 0.5 } }

  const firstGeometry = clusterRouteGeometry(route, cluster, jumpPoints, farButSafe)
  const secondGeometry = clusterRouteGeometry(secondRoute, cluster, jumpPoints, farButSafe)
  expect(firstGeometry.exitPoint)
    .toEqual({ x: CLUSTER_SCENE_COORDINATE_LIMIT / 2 + 135, y: 280 })
  expect(secondGeometry.exitPoint)
    .toEqual({ x: CLUSTER_SCENE_COORDINATE_LIMIT / 2 + 135, y: 344 })
  expect(firstGeometry.exitLabel).toMatchObject({
    x: CLUSTER_SCENE_COORDINATE_LIMIT / 2 + 125,
    y: 334,
    anchor: 'end',
  })
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

test('baseline-safe long labels remain restorable near the renderer boundary', { tag: '@pure' }, () => {
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
    [route.id]: { x: CLUSTER_SCENE_COORDINATE_LIMIT - 600, y: 280 },
  })).toBe(true)
})
