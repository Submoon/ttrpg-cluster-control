import { expect, test } from '@playwright/test'
import {
  addStarSystem, createLocalWorkspace, createOrbit, type LocalWorkspace, type SystemObject,
} from '../domain/workspace'
import {
  createWorkspaceHistoryCoordinator,
  type WorkspaceHistoryCoordinator,
  type WorkspaceMutationRequest,
} from '../composables/editor-workflows/workspace-mutations'
import { createWorkspaceSnapshot } from '../utils/workspace-storage'

function createHistory(workspace: LocalWorkspace): {
  history: WorkspaceHistoryCoordinator
  get workspace(): LocalWorkspace
  dispose(): void
} {
  let applied = createWorkspaceSnapshot(workspace)
  let revision = 0
  const history = createWorkspaceHistoryCoordinator({
    getWorkspace: () => applied,
    getRevision: () => revision,
    publishWorkspace: next => {
      applied = createWorkspaceSnapshot(next)
      revision += 1
      return { durable: Promise.resolve() }
    },
    getTraversalBlockReason: () => null,
    confirmCapacity: async () => false,
  })
  return {
    history,
    get workspace() { return applied },
    dispose: () => history.dispose(),
  }
}

function renameObjectRequest(systemId: string, objectId: string, name: string): WorkspaceMutationRequest {
  return {
    action: { kind: 'rename', label: `Rename object to ${name}`, target: { kind: 'object', id: objectId, systemId } },
    prepare: workspace => ({
      ...workspace,
      cluster: {
        ...workspace.cluster,
        systems: workspace.cluster.systems.map(system => system.id === systemId
          ? {
              ...system,
              objects: system.objects.map(object => object.id === objectId ? { ...object, name } : object),
            }
          : system),
      },
    }),
  }
}

function renameSystemRequest(systemId: string, name: string): WorkspaceMutationRequest {
  return {
    action: { kind: 'rename', label: `Rename star system to ${name}`, target: { kind: 'system', id: systemId } },
    prepare: workspace => ({
      ...workspace,
      cluster: {
        ...workspace.cluster,
        systems: workspace.cluster.systems.map(system => system.id === systemId ? { ...system, name } : system),
      },
    }),
  }
}

function rotateOrbitRequest(systemId: string, orbitId: string, rotation: number): WorkspaceMutationRequest {
  return {
    action: { kind: 'rotate', label: 'Rotate Orbit 1', target: { kind: 'orbit', id: orbitId, systemId } },
    prepare: workspace => ({
      ...workspace,
      layout: { ...workspace.layout, orbitRotations: { ...workspace.layout.orbitRotations, [orbitId]: rotation } },
    }),
  }
}

async function apply(history: WorkspaceHistoryCoordinator, request: WorkspaceMutationRequest): Promise<void> {
  const result = await history.execute(request)
  if (result.status !== 'applied') throw new Error(`Expected an applied action, received ${result.status}.`)
  await result.durable
}

test('history keeps duplicate object names distinct by system and preserves context captured at application @pure', async () => {
  const initial = createLocalWorkspace('Kestrel Reach', 'Vesper')
  const added = addStarSystem(initial, 'Vesper Two')
  const firstSystem = initial.cluster.systems[0]
  const secondSystem = added.system
  const firstObject = firstSystem?.objects[0]
  const secondObject = secondSystem.objects[0]
  if (!firstSystem || !secondSystem || !firstObject || !secondObject) {
    throw new Error('The workspace fixture is missing its systems or initial objects.')
  }

  const duplicateNames: LocalWorkspace = {
    ...added.workspace,
    cluster: {
      ...added.workspace.cluster,
      systems: added.workspace.cluster.systems.map(system => ({
        ...system,
        objects: system.objects.map(object => object.id === firstObject.id || object.id === secondObject.id
          ? { ...object, name: 'Beacon' }
          : object),
      })),
    },
  }
  const [firstOrbit, secondOrbit] = duplicateNames.cluster.systems.map((system) => {
    const host = system.objects.find(object => object.name === 'Beacon')
    if (!host) throw new Error('A duplicate-name system is missing its Orbit host.')
    return createOrbit(system, host.id)
  })
  if (!firstOrbit || !secondOrbit) throw new Error('The workspace fixture is missing an Orbit in each system.')
  const workspaceWithOrbits: LocalWorkspace = {
    ...duplicateNames,
    cluster: {
      ...duplicateNames.cluster,
      systems: duplicateNames.cluster.systems.map((system, index) => ({
        ...system,
        orbits: [index === 0 ? firstOrbit : secondOrbit],
      })),
    },
  }
  const harness = createHistory(workspaceWithOrbits)

  await apply(harness.history, renameObjectRequest(firstSystem.id, firstObject.id, 'Beacon Prime'))
  await apply(harness.history, renameObjectRequest(secondSystem.id, secondObject.id, 'Beacon Prime'))
  await apply(harness.history, rotateOrbitRequest(firstSystem.id, firstOrbit.id, 12))
  await apply(harness.history, rotateOrbitRequest(secondSystem.id, secondOrbit.id, 12))
  await apply(harness.history, renameSystemRequest(firstSystem.id, 'Vesper Prime'))

  expect(harness.history.getEntries()).toMatchObject([
    { action: { contextLabel: 'Beacon Prime · Vesper' }, applied: true },
    { action: { contextLabel: 'Beacon Prime · Vesper Two' }, applied: true },
    { action: { label: 'Rotate Orbit 1', contextLabel: 'Orbit 1 around Beacon Prime · Vesper' }, applied: true },
    { action: { label: 'Rotate Orbit 1', contextLabel: 'Orbit 1 around Beacon Prime · Vesper Two' }, applied: true },
    { action: { contextLabel: 'Vesper Prime · Kestrel Reach' }, applied: true },
  ])

  harness.dispose()
})

test('route context retains endpoint, system, level and cluster details within the descriptor bound @pure', async () => {
  const clusterName = 'C'.repeat(80)
  const firstSystemName = 'S'.repeat(80)
  const secondSystemName = 'T'.repeat(80)
  const initial = createLocalWorkspace(clusterName, firstSystemName)
  const added = addStarSystem(initial, secondSystemName)
  const firstSystem = initial.cluster.systems[0]
  const secondSystem = added.system
  if (!firstSystem || !secondSystem) throw new Error('The workspace fixture is missing a route system.')
  const firstPoint: SystemObject = {
    id: crypto.randomUUID(), family: 'JumpPoint', subtype: 'jump-point', locationKey: 'J1',
    name: 'A'.repeat(80), description: '', placement: { kind: 'system', x: 0.3, y: 0.5 },
  }
  const secondPoint: SystemObject = {
    id: crypto.randomUUID(), family: 'JumpPoint', subtype: 'jump-point', locationKey: 'J2',
    name: 'B'.repeat(80), description: '', placement: { kind: 'system', x: 0.7, y: 0.5 },
  }
  const route = {
    id: crypto.randomUUID(), jumpLevel: 1, fromPointId: firstPoint.id, toPointId: secondPoint.id,
  }
  const workspace: LocalWorkspace = {
    ...added.workspace,
    cluster: {
      ...added.workspace.cluster,
      systems: added.workspace.cluster.systems.map(system => ({
        ...system,
        objects: [...system.objects, ...(system.id === firstSystem.id ? [firstPoint] : [secondPoint])],
      })),
      routes: [route],
    },
  }
  const harness = createHistory(workspace)

  await apply(harness.history, {
    action: { kind: 'update', label: 'Update Jump Route', target: { kind: 'route', id: route.id } },
    prepare: current => ({
      ...current,
      cluster: {
        ...current.cluster,
        routes: current.cluster.routes.map(candidate => candidate.id === route.id
          ? { ...candidate, jumpLevel: 2 }
          : candidate),
      },
    }),
  })

  const contextLabel = harness.history.getEntries()[0]?.action.contextLabel
  expect(contextLabel).toBe(`${'A'.repeat(31)}… (${ 'S'.repeat(31) }…) → ${'B'.repeat(31)}… (${ 'T'.repeat(31) }…) · Level 2 · ${'C'.repeat(31)}…`)
  expect(contextLabel?.length).toBeLessThanOrEqual(200)
  harness.dispose()
})
