import { expect, test } from '@playwright/test'
import {
  createLocalWorkspace,
  replaceWorkspaceSystem,
  updateWorkspaceObject,
  type LocalWorkspace,
  type StarSystem,
  type SystemObject,
} from '../domain/workspace'
import { objectPositions } from '../utils/system-map-geometry'

interface PlacementFixture {
  workspace: LocalWorkspace
  system: StarSystem
  sourceOrbitId: string
  destinationOrbitId: string
  movedObjectId: string
  unaffectedObjectIds: string[]
}

function createPlacementFixture(): PlacementFixture {
  const workspace = createLocalWorkspace('Kestrel Reach', 'Vesper')
  const baseSystem = workspace.cluster.systems[0]!
  const host = baseSystem.objects[0]!
  const sourceOrbitId = 'orbit-source'
  const destinationOrbitId = 'orbit-destination'
  const object = (
    id: string,
    name: string,
    orbitId: string,
  ): SystemObject => ({
    id,
    family: 'CelestialBody',
    subtype: 'planet',
    locationKey: id,
    name,
    description: '',
    placement: { kind: 'orbit', orbitId },
  })
  const system: StarSystem = {
    ...baseSystem,
    orbits: [
      { id: sourceOrbitId, hostId: host.id, order: 1 },
      { id: destinationOrbitId, hostId: host.id, order: 2 },
    ],
    objects: [
      ...baseSystem.objects,
      object('old-planet', 'Old Planet', sourceOrbitId),
      object('old-moon', 'Old Moon', sourceOrbitId),
      object('new-planet', 'New Planet', destinationOrbitId),
      object('new-moon', 'New Moon', destinationOrbitId),
    ],
  }
  const preparedWorkspace = replaceWorkspaceSystem(workspace, system)
  const withSavedAngles: LocalWorkspace = {
    ...preparedWorkspace,
    layout: {
      ...preparedWorkspace.layout,
      objectAngles: {
        'old-planet': 0.2,
        'new-moon': 2.4,
      },
    },
  }

  return {
    workspace: withSavedAngles,
    system,
    sourceOrbitId,
    destinationOrbitId,
    movedObjectId: 'old-planet',
    unaffectedObjectIds: ['old-moon', 'new-planet', 'new-moon'],
  }
}

function projectedPositions(workspace: LocalWorkspace, system: StarSystem): Map<string, { x: number; y: number }> {
  return objectPositions(system, {
    objectAngles: workspace.layout.objectAngles,
    orbitRadii: workspace.layout.orbitRadii,
    orbitRotations: workspace.layout.orbitRotations,
  })
}

function expectUnchangedPositions(
  before: Map<string, { x: number; y: number }>,
  after: Map<string, { x: number; y: number }>,
  objectIds: string[],
): void {
  for (const objectId of objectIds) {
    expect(after.get(objectId), `position for ${objectId}`).toEqual(before.get(objectId))
  }
}

test('moving an object preserves effective angles for unaffected source and destination occupants', () => {
  const fixture = createPlacementFixture()
  const before = projectedPositions(fixture.workspace, fixture.system)

  const after = updateWorkspaceObject(
    fixture.workspace,
    fixture.system.id,
    fixture.movedObjectId,
    { placement: { kind: 'system', x: 0.65, y: 0.35 } },
  )
  const updatedSystem = after.cluster.systems[0]!
  const projectedAfter = projectedPositions(after, updatedSystem)

  expectUnchangedPositions(before, projectedAfter, fixture.unaffectedObjectIds)
  expect(after.layout.objectAngles['old-planet']).toBeUndefined()
  expect(after.layout.objectAngles['old-moon']).toBeDefined()
  expect(after.layout.objectAngles['new-moon']).toBe(2.4)
  expect(fixture.workspace.layout.objectAngles['old-moon']).toBeUndefined()
})

test('moving between Orbits honors an explicit angle and keeps both sibling groups in place', () => {
  const fixture = createPlacementFixture()
  const before = projectedPositions(fixture.workspace, fixture.system)
  const chosenAngle = 1.15

  const after = updateWorkspaceObject(
    fixture.workspace,
    fixture.system.id,
    fixture.movedObjectId,
    { placement: { kind: 'orbit', orbitId: fixture.destinationOrbitId } },
    { angle: chosenAngle },
  )
  const updatedSystem = after.cluster.systems[0]!
  const projectedAfter = projectedPositions(after, updatedSystem)

  expectUnchangedPositions(before, projectedAfter, fixture.unaffectedObjectIds)
  expect(after.layout.objectAngles[fixture.movedObjectId]).toBe(chosenAngle)
  expect(after.layout.objectAngles['old-moon']).toBeDefined()
  expect(after.layout.objectAngles['new-planet']).toBeDefined()
  expect(after.layout.objectAngles['new-moon']).toBe(2.4)
  expect(updatedSystem.objects.find(object => object.id === fixture.movedObjectId)?.placement)
    .toEqual({ kind: 'orbit', orbitId: fixture.destinationOrbitId })
})

test('metadata-only edits preserve layout without materializing default angles', () => {
  const fixture = createPlacementFixture()

  const after = updateWorkspaceObject(
    fixture.workspace,
    fixture.system.id,
    fixture.movedObjectId,
    { name: 'Old Planet Renamed' },
  )

  expect(after.cluster.systems[0]?.objects.find(object => object.id === fixture.movedObjectId)?.name)
    .toBe('Old Planet Renamed')
  expect(after.layout).toEqual(fixture.workspace.layout)
})
