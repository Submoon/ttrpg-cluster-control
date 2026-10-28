import { expect, test } from '@playwright/test'
import {
  addStarSystem,
  createLocalWorkspace,
  exportJumpCluster,
  planMapEntityDeletion,
  prepareJsonImport,
  replaceWorkspaceSystem,
  restoreLocalWorkspace,
} from '../domain/workspace'
import { CLUSTER_SCENE_COORDINATE_LIMIT } from '../utils/cluster-map-geometry'

function unresolvedWorkspace() {
  const workspace = createLocalWorkspace('Kestrel Reach', 'Vesper')
  const point = {
    id: 'point-a',
    family: 'JumpPoint',
    subtype: 'jump-point',
    locationKey: 'JP1',
    name: 'North Gate',
    description: '',
    placement: { kind: 'system', x: 0.5, y: 0.5 },
  } as const
  const route = {
    id: 'route-a',
    fromPointId: point.id,
    toPointId: null,
    unresolvedExit: 'Rim',
    jumpLevel: 2,
  } as const
  return {
    point,
    route,
    workspace: {
      ...workspace,
      cluster: {
        ...workspace.cluster,
        systems: workspace.cluster.systems.map(system => ({ ...system, objects: [...system.objects, point] })),
        routes: [route],
      },
      layout: {
        ...workspace.layout,
        unresolvedExitPositions: { [route.id]: { x: 1250, y: -340 } },
      },
    },
  }
}

test('manual unresolved-exit positions survive workspace restoration and Cluster export', { tag: '@pure' }, () => {
  const { workspace: source, route } = unresolvedWorkspace()

  const restored = restoreLocalWorkspace(source)

  expect(restored?.layout.unresolvedExitPositions).toEqual({ [route.id]: { x: 1250, y: -340 } })
  expect(restored && exportJumpCluster(restored).layout.unresolvedExitPositions)
    .toEqual({ [route.id]: { x: 1250, y: -340 } })
})

test('workspace validation rejects orphaned, resolved, malformed, and numerically unsafe target positions', { tag: '@pure' }, () => {
  const { workspace, route } = unresolvedWorkspace()
  const withoutTarget = { ...workspace, layout: { ...workspace.layout, unresolvedExitPositions: {} } }
  const destination = {
    ...workspace.cluster.systems[0]!.objects[0]!,
    id: 'point-b',
    family: 'JumpPoint',
    subtype: 'jump-point',
    locationKey: 'JP2',
    name: 'South Gate',
  }

  expect(restoreLocalWorkspace({
    ...workspace,
    layout: { ...workspace.layout, unresolvedExitPositions: { 'missing-route': { x: 10, y: 20 } } },
  })).toBeNull()
  expect(restoreLocalWorkspace({
    ...workspace,
    cluster: {
      ...workspace.cluster,
      systems: workspace.cluster.systems.map(system => ({ ...system, objects: [...system.objects, destination] })),
      routes: [{ ...route, toPointId: destination.id, unresolvedExit: undefined }],
    },
  })).toBeNull()
  expect(restoreLocalWorkspace({
    ...workspace,
    layout: { ...workspace.layout, unresolvedExitPositions: { [route.id]: { x: Number.NaN, y: 10 } } },
  })).toBeNull()
  expect(restoreLocalWorkspace({
    ...workspace,
    layout: { ...workspace.layout, unresolvedExitPositions: { [route.id]: { x: Number.MAX_VALUE, y: 0 } } },
  })).toBeNull()
  expect(restoreLocalWorkspace(withoutTarget)?.layout.unresolvedExitPositions).toEqual({})
})

test('workspace validation rejects finite exit anchors whose shared scene bounds are not representable', { tag: '@pure' }, () => {
  const { workspace, route } = unresolvedWorkspace()
  const secondRoute = { ...route, id: 'route-b', unresolvedExit: 'Far Side' }
  const oppositeFiniteExits = {
    ...workspace,
    cluster: { ...workspace.cluster, routes: [route, secondRoute] },
    layout: {
      ...workspace.layout,
      unresolvedExitPositions: {
        [route.id]: { x: -8_500_000, y: 0 },
        [secondRoute.id]: { x: 8_500_000, y: 0 },
      },
    },
  }
  const imported = exportJumpCluster(oppositeFiniteExits)

  expect(restoreLocalWorkspace(oppositeFiniteExits)).toBeNull()
  expect(() => prepareJsonImport(createLocalWorkspace('Other Reach', 'Other system'), imported))
    .toThrow('Choose a valid version 1 Jump Cluster or star system JSON export.')
})

test('workspace validation rejects finite coordinates outside the SVG renderer numeric range', { tag: '@pure' }, () => {
  const { workspace, route } = unresolvedWorkspace()
  const rendererClamped = {
    ...workspace,
    layout: {
      ...workspace.layout,
      unresolvedExitPositions: { [route.id]: { x: 20_000_000, y: 0 } },
    },
  }

  expect(restoreLocalWorkspace(rendererClamped)).toBeNull()
})

test('workspace admission includes the longest unresolved label at the renderer boundary', { tag: '@pure' }, () => {
  const { workspace, route } = unresolvedWorkspace()
  const system = workspace.cluster.systems[0]!
  const longLabelWorkspace = {
    ...workspace,
    cluster: {
      ...workspace.cluster,
      routes: [{ ...route, unresolvedExit: 'X'.repeat(80) }],
    },
    layout: {
      ...workspace.layout,
      systemPositions: { ...workspace.layout.systemPositions, [system.id]: { x: 0.5, y: 0.5 } },
      unresolvedExitPositions: {
        [route.id]: { x: -CLUSTER_SCENE_COORDINATE_LIMIT + 1000, y: 280 },
      },
    },
  }

  expect(restoreLocalWorkspace(longLabelWorkspace)).toBeNull()
})

test('append import remaps each unresolved target to its independent route identity', { tag: '@pure' }, () => {
  const { workspace, route } = unresolvedWorkspace()
  const exported = exportJumpCluster(workspace)
  const destination = createLocalWorkspace('Other Reach', 'Other system')
  const firstImport = prepareJsonImport(destination, exported).workspace
  const firstRoute = firstImport.cluster.routes[0]
  const secondImport = prepareJsonImport(firstImport, exported).workspace
  const secondRoute = secondImport.cluster.routes.find(candidate => candidate.id !== firstRoute?.id)

  expect(firstRoute?.id).not.toBe(route.id)
  expect(firstRoute && secondImport.layout.unresolvedExitPositions?.[firstRoute.id])
    .toEqual({ x: 1250, y: -340 })
  expect(secondRoute?.id).not.toBe(firstRoute?.id)
  expect(secondRoute && secondImport.layout.unresolvedExitPositions?.[secondRoute.id])
    .toEqual({ x: 1250, y: -340 })
  expect(secondImport.layout.unresolvedExitPositions?.[route.id]).toBeUndefined()
})

test('dependent Jump Point deletion removes its route target layout', { tag: '@pure' }, () => {
  const { workspace, route, point } = unresolvedWorkspace()
  const { workspace: withSecondSystem } = addStarSystem(workspace, 'Harrow')
  const plan = planMapEntityDeletion(withSecondSystem, {
    kind: 'object',
    systemId: workspace.cluster.systems[0]!.id,
    objectId: point.id,
  })
  const replacement = replaceWorkspaceSystem(plan.workspace, plan.workspace.cluster.systems[0]!)

  expect(plan.removedRouteIds).toContain(route.id)
  expect(plan.workspace.layout.unresolvedExitPositions?.[route.id]).toBeUndefined()
  expect(replacement.layout.unresolvedExitPositions?.[route.id]).toBeUndefined()
})
