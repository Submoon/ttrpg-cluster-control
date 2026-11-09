import { expect, test } from '@playwright/test'
import { createLocalWorkspace, replaceWorkspaceSystem, type LocalWorkspace, type StarSystem, type SystemObject } from '../domain/workspace'
import { applySelectedObjectTranslation, planSelectedObjectTranslation } from '../utils/selected-object-placement'
import { objectPositions, toNormalizedMapPoint } from '../utils/system-map-geometry'

const orbitId = 'orbit-hosted'
const nestedOrbitId = 'orbit-nested'
const crossingOrbitId = 'orbit-crossing'
const freeOrbitId = 'orbit-unoccupied'
const hostId = 'host'
const planetId = 'planet'
const siblingId = 'sibling'
const moonId = 'moon'

function object(id: string, placement: SystemObject['placement'], subtype = 'planet'): SystemObject {
  return {
    id,
    publication: 'revealed',
    family: 'CelestialBody',
    subtype,
    locationKey: id,
    name: id,
    description: '',
    playerText: '',
    playerFieldMasks: [],
    placement,
  }
}

function createFixture(): LocalWorkspace {
  const base = createLocalWorkspace('Kestrel Reach', 'Vesper')
  const baseSystem = base.cluster.systems[0]!
  const system: StarSystem = {
    ...baseSystem,
    objects: [
      object(hostId, { kind: 'system', x: 0.5, y: 0.5 }, 'star'),
      object(planetId, { kind: 'orbit', orbitId }),
      object(siblingId, { kind: 'orbit', orbitId }),
      object(moonId, { kind: 'orbit', orbitId: nestedOrbitId }),
      object('free-orbit-occupant', { kind: 'orbit', orbitId: freeOrbitId }),
    ],
    orbits: [
      { id: orbitId, hostId, order: 1 },
      { id: nestedOrbitId, hostId: planetId, order: 1 },
      { id: crossingOrbitId, hostId, order: 2 },
      { id: freeOrbitId, hostId: null, center: { x: 0.75, y: 0.5 }, order: 3 },
    ],
  }
  const replaced = replaceWorkspaceSystem(base, system)
  return {
    ...replaced,
    layout: {
      ...replaced.layout,
      orbitRadii: {
        ...replaced.layout.orbitRadii,
        [orbitId]: { horizontal: 120, vertical: 55 },
        [nestedOrbitId]: { horizontal: 24, vertical: 16 },
        [crossingOrbitId]: { horizontal: 100, vertical: 54 },
        [freeOrbitId]: { horizontal: 60, vertical: 35 },
      },
      orbitRotations: {
        ...replaced.layout.orbitRotations,
        [orbitId]: 90,
        [crossingOrbitId]: 90,
      },
      objectAngles: { ...replaced.layout.objectAngles, [planetId]: 0 },
    },
  }
}

function projectedPositions(workspace: LocalWorkspace): Map<string, { x: number; y: number }> {
  const system = workspace.cluster.systems[0]!
  return objectPositions(system, {
    objectAngles: workspace.layout.objectAngles,
    orbitRadii: workspace.layout.orbitRadii,
    orbitRotations: workspace.layout.orbitRotations,
  })
}

test('keeps an orbital object attached only when its exact translated point lies on its current rotated Orbit @pure', () => {
  const workspace = createFixture()
  const systemId = workspace.cluster.systems[0]!.id
  const target = { x: 425, y: 280 }
  const onOrbit = planSelectedObjectTranslation(workspace, systemId, [planetId], {
    x: target.x - 480,
    y: target.y - 400,
  })

  expect(onOrbit).not.toBeNull()
  expect(onOrbit!.positions.get(planetId)).toEqual(target)
  expect(onOrbit!.changes.find(change => change.objectId === planetId)?.nextPlacement)
    .toEqual({ kind: 'orbit', orbitId })
  expect(onOrbit!.departingObjectIds.has(planetId)).toBe(false)
  const appliedOnOrbit = applySelectedObjectTranslation(workspace, systemId, onOrbit!)
  expect(appliedOnOrbit.layout.objectAngles[planetId]).toBeCloseTo(Math.PI / 2)

  const offOrbit = planSelectedObjectTranslation(workspace, systemId, [planetId], { x: -54, y: -120 })
  expect(offOrbit).not.toBeNull()
  expect(offOrbit!.changes.find(change => change.objectId === planetId)?.nextPlacement)
    .toEqual({ kind: 'system', ...toNormalizedMapPoint({ x: 426, y: 280 }) })
  expect(offOrbit!.departingObjectIds.has(planetId)).toBe(true)
})

test('does not attach a fixed-Orbit departure to a different Orbit at the target point @pure', () => {
  const workspace = createFixture()
  const systemId = workspace.cluster.systems[0]!.id
  const plan = planSelectedObjectTranslation(workspace, systemId, [planetId], { x: -54, y: -120 })

  expect(plan).not.toBeNull()
  expect(plan!.changes.find(change => change.objectId === planetId)?.nextPlacement.kind).toBe('system')
  expect(plan!.departingObjectIds).toEqual(new Set([planetId]))
  const crossingOrbit = workspace.cluster.systems[0]!.orbits.find(candidate => candidate.id === crossingOrbitId)!
  expect(crossingOrbit.hostId).toBe(hostId)
})

test('keeps an occupant on an unoccupied-center Orbit only at an exact point on its fixed ellipse @pure', () => {
  const workspace = createFixture()
  const systemId = workspace.cluster.systems[0]!.id
  const occupantId = 'free-orbit-occupant'
  const before = projectedPositions(workspace)
  expect(before.get(occupantId)).toEqual({ x: 688, y: 245 })

  const onEllipse = planSelectedObjectTranslation(workspace, systemId, [occupantId], { x: 60, y: 35 })
  expect(onEllipse?.positions.get(occupantId)).toEqual({ x: 748, y: 280 })
  expect(onEllipse?.changes.find(change => change.objectId === occupantId)?.nextPlacement)
    .toEqual({ kind: 'orbit', orbitId: freeOrbitId })
  const appliedOnEllipse = applySelectedObjectTranslation(workspace, systemId, onEllipse!)
  expect(appliedOnEllipse.layout.objectAngles[occupantId]).toBe(0)

  const offEllipse = planSelectedObjectTranslation(workspace, systemId, [occupantId], { x: 61, y: 35 })
  expect(offEllipse?.positions.get(occupantId)).toEqual({ x: 749, y: 280 })
  expect(offEllipse?.departingObjectIds).toEqual(new Set([occupantId]))
  expect(offEllipse?.changes.find(change => change.objectId === occupantId)?.nextPlacement).toEqual({
    kind: 'system',
    x: (749 - 64) / 832,
    y: (280 - 72) / 416,
  })
})

test('carries nested descendants once when their selected host leaves its fixed Orbit and preserves implicit siblings @pure', () => {
  const workspace = createFixture()
  const systemId = workspace.cluster.systems[0]!.id
  const before = projectedPositions(workspace)
  const plan = planSelectedObjectTranslation(workspace, systemId, [planetId, moonId], { x: -54, y: -120 })

  expect(plan).not.toBeNull()
  expect(plan!.movedObjectIds).toEqual([planetId, moonId])
  expect(plan!.positions.get(planetId)).toEqual({ x: 426, y: 280 })
  expect(plan!.positions.get(moonId)).toEqual({
    x: before.get(moonId)!.x - 54,
    y: before.get(moonId)!.y - 120,
  })
  expect(plan!.departingObjectIds).toEqual(new Set([planetId]))
  const appliedWorkspace = applySelectedObjectTranslation(workspace, systemId, plan!)
  expect(appliedWorkspace.layout.objectAngles[siblingId]).toBeDefined()
  const after = projectedPositions(appliedWorkspace)
  expect(after.get(siblingId)).toEqual(before.get(siblingId))
  expect(after.get(moonId)).toEqual(plan!.positions.get(moonId))
  expect(workspace.layout.objectAngles[siblingId]).toBeUndefined()
})

test('moves descendants once with a selected ancestor and keeps the ancestor Orbit center fixed only when its host is fixed @pure', () => {
  const workspace = createFixture()
  const systemId = workspace.cluster.systems[0]!.id
  const before = projectedPositions(workspace)
  const delta = { x: 12, y: -7 }
  const plan = planSelectedObjectTranslation(workspace, systemId, [hostId, planetId], delta)

  expect(plan).not.toBeNull()
  expect(plan!.movedObjectIds).toEqual([hostId, planetId, siblingId, moonId])
  for (const objectId of plan!.movedObjectIds) {
    expect(plan!.positions.get(objectId)).toEqual({
      x: before.get(objectId)!.x + delta.x,
      y: before.get(objectId)!.y + delta.y,
    })
  }
  expect(plan!.departingObjectIds.size).toBe(0)
})
