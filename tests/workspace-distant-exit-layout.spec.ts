import { expect, test } from '@playwright/test'
import {
  createLocalWorkspace,
  exportJumpCluster,
  moveUnresolvedExitTarget,
  prepareJsonImport,
  restoreLocalWorkspace,
} from '../domain/workspace'

test('negative distant exit positions survive workspace restore and route-remapped Cluster interchange', { tag: '@pure' }, () => {
  const workspace = createLocalWorkspace('Source Reach', 'Vesper')
  const system = workspace.cluster.systems[0]
  if (!system) throw new Error('The source workspace has no Star System.')
  const point = {
    id: 'distant-exit-point',
    family: 'JumpPoint',
    subtype: 'jump-point',
    locationKey: 'JP1',
    name: 'North Gate',
    description: '',
    placement: { kind: 'system', x: 0.5, y: 0.5 },
  } as const
  const route = {
    id: 'distant-exit-route',
    fromPointId: point.id,
    toPointId: null,
    unresolvedExit: 'Rim',
    jumpLevel: 2,
  } as const
  const withRoute = {
    ...workspace,
    cluster: {
      ...workspace.cluster,
      systems: workspace.cluster.systems.map(candidate => candidate.id === system.id
        ? { ...candidate, objects: [...candidate.objects, point] }
        : candidate),
      routes: [route],
    },
  }
  const position = { x: -1800, y: 7000 }
  const positioned = moveUnresolvedExitTarget(withRoute, route.id, position)
  const restored = restoreLocalWorkspace(JSON.parse(JSON.stringify(positioned)))

  expect(restored?.layout.unresolvedExitPositions?.[route.id]).toEqual(position)
  if (!restored) throw new Error('The positioned workspace did not restore.')

  const imported = prepareJsonImport(
    createLocalWorkspace('Destination Reach', 'Other System'),
    exportJumpCluster(restored),
  ).workspace
  const importedRoute = imported.cluster.routes.find(candidate => candidate.toPointId === null)
  if (!importedRoute) throw new Error('The appended Cluster copy lost its unresolved route.')
  expect(importedRoute.id).not.toBe(route.id)
  expect(imported.layout.unresolvedExitPositions?.[importedRoute.id]).toEqual(position)
})
