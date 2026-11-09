import { expect, test } from '@playwright/test'
import { createLocalWorkspace, replaceWorkspaceSystem, type LocalWorkspace, type StarSystem, type SystemObject } from '../domain/workspace'
import {
  applySelectedObjectTranslation,
  planSelectedObjectTranslation,
  prepareSelectedObjectTranslation,
} from '../utils/selected-object-placement'
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

test('a prepared drag snaps near the rotated Orbit edge and rejects points beyond the hit tolerance @pure', () => {
  const base = createLocalWorkspace('Kestrel Reach', 'Vesper')
  const system = base.cluster.systems[0]!
  const firstId = 'first'
  const secondId = 'second'
  const workspace = replaceWorkspaceSystem(base, {
    ...system,
    objects: [
      object(firstId, { kind: 'system', x: 0.5, y: 0.5 }),
      object(secondId, { kind: 'system', x: 0.15, y: 0.3 }),
    ],
    orbits: [{ id: freeOrbitId, hostId: null, center: { x: 0.5, y: 0.5 }, order: 1 }],
  })
  workspace.layout.orbitRadii[freeOrbitId] = { horizontal: 120, vertical: 40 }
  workspace.layout.orbitRotations[freeOrbitId] = 45
  const plan = prepareSelectedObjectTranslation(workspace, system.id, [firstId, secondId])!

  // The rightmost point on this ellipse has a horizontal outward normal.
  const edgeX = Math.sqrt((120 ** 2 + 40 ** 2) / 2)
  const edgeY = (120 ** 2 - 40 ** 2) / (2 * edgeX)
  const nearDelta = { x: edgeX + 15.99, y: edgeY }
  const near = plan(nearDelta)!
  expect(near.arrivingObjectIds).toEqual(new Set([firstId]))
  expect(near.changes.find(change => change.objectId === firstId)?.nextPlacement)
    .toEqual({ kind: 'orbit', orbitId: freeOrbitId })
  expect(near.positions.get(firstId)?.x).toBeCloseTo(480 + edgeX, 3)
  expect(near.positions.get(firstId)?.y).toBeCloseTo(280 + edgeY, 3)

  const exactDelta = { x: edgeX + 5e-8, y: edgeY }
  const exact = plan(exactDelta)!
  expect(exact.arrivingObjectIds).toEqual(new Set([firstId]))
  expect(exact.positions.get(firstId)).toEqual({ x: 480 + exactDelta.x, y: 280 + exactDelta.y })

  const farDelta = { x: edgeX + 16.01, y: edgeY }
  const far = plan(farDelta)!
  expect(far.arrivingObjectIds.size).toBe(0)
  expect(far.positions.get(firstId)).toEqual({ x: 480 + farDelta.x, y: 280 + farDelta.y })
  expect(plan(nearDelta)).toEqual(near)
})

test('a prepared drag includes the hit boundary and keeps system Orbit order for equal distances @pure', () => {
  const base = createLocalWorkspace('Kestrel Reach', 'Vesper')
  const system = base.cluster.systems[0]!
  const objectId = 'free-object'
  const center = { x: 0.5, y: 0.5 }
  const workspace = replaceWorkspaceSystem(base, {
    ...system,
    objects: [object(objectId, { kind: 'system', ...center })],
    orbits: [
      { id: orbitId, hostId: null, center, order: 2 },
      { id: crossingOrbitId, hostId: null, center, order: 1 },
    ],
  })
  workspace.layout.orbitRadii[orbitId] = { horizontal: 60, vertical: 60 }
  workspace.layout.orbitRadii[crossingOrbitId] = { horizontal: 40, vertical: 40 }
  const plan = prepareSelectedObjectTranslation(workspace, system.id, [objectId])!

  for (const x of [50, 76]) {
    const translated = plan({ x, y: 0 })!
    expect(translated.changes[0]?.nextPlacement).toEqual({ kind: 'orbit', orbitId })
    expect(translated.positions.get(objectId)).toEqual({ x: 540, y: 280 })
  }
  expect(plan({ x: 0, y: 0 })?.updates).toEqual([])
})

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

  const offOrbit = planSelectedObjectTranslation(workspace, systemId, [planetId], { x: 0, y: -241 })
  expect(offOrbit).not.toBeNull()
  expect(offOrbit!.changes.find(change => change.objectId === planetId)?.nextPlacement)
    .toEqual({ kind: 'system', ...toNormalizedMapPoint({ x: 480, y: 159 }) })
  expect(offOrbit!.departingObjectIds.has(planetId)).toBe(true)
})

test('attaches two selected members whose common translation reaches exact points on a different Orbit @pure', () => {
  const fixture = createFixture()
  const system = fixture.cluster.systems[0]!
  const freeObjectId = 'free-object'
  const workspace = replaceWorkspaceSystem(fixture, {
    ...system,
    objects: [...system.objects, object(freeObjectId, {
      kind: 'system',
      ...toNormalizedMapPoint({ x: 507, y: 400 + 50 * Math.sqrt(3) }),
    })],
  })
  const plan = planSelectedObjectTranslation(workspace, system.id, [planetId, freeObjectId], { x: -54, y: -120 })

  expect(plan).not.toBeNull()
  expect(plan!.changes.find(change => change.objectId === planetId)?.nextPlacement)
    .toEqual({ kind: 'orbit', orbitId: crossingOrbitId })
  expect(plan!.departingObjectIds).toEqual(new Set([planetId]))
  expect(plan!.arrivingObjectIds).toEqual(new Set([planetId, freeObjectId]))
  const applied = applySelectedObjectTranslation(workspace, system.id, plan!)
  expect(applied.layout.objectAngles[planetId]).toBeCloseTo(Math.PI / 2)
  expect(applied.layout.objectAngles[freeObjectId]).toBeCloseTo(Math.PI / 6)
  expect(projectedPositions(applied).get(planetId)).toEqual(plan!.positions.get(planetId))
})

test('keeps the current Orbit when the group snap reaches an intersection @pure', () => {
  const base = createLocalWorkspace('Kestrel Reach', 'Vesper')
  const system = base.cluster.systems[0]!
  const freeObjectId = 'free-object'
  const workspace = replaceWorkspaceSystem(base, {
    ...system,
    objects: [
      object(planetId, { kind: 'orbit', orbitId }),
      object(freeObjectId, { kind: 'system', x: 0.85, y: 0.8 }),
    ],
    orbits: [
      { id: orbitId, hostId: null, center: toNormalizedMapPoint({ x: 480, y: 280 }), order: 1 },
      { id: crossingOrbitId, hostId: null, center: toNormalizedMapPoint({ x: 540, y: 280 }), order: 2 },
    ],
  })
  workspace.layout.orbitRadii = {
    [orbitId]: { horizontal: 60, vertical: 60 },
    [crossingOrbitId]: { horizontal: 60, vertical: 60 },
  }
  workspace.layout.objectAngles[planetId] = 0

  const intersectionHeight = Math.sqrt(60 ** 2 - 30 ** 2)
  const plan = planSelectedObjectTranslation(workspace, system.id, [planetId, freeObjectId], {
    x: -33,
    y: 1.1 * intersectionHeight,
  })!

  expect(plan.positions.get(planetId)?.x).toBeCloseTo(510, 9)
  expect(plan.positions.get(planetId)?.y).toBeCloseTo(280 + intersectionHeight, 9)
  expect(plan.changes.find(change => change.objectId === planetId)?.nextPlacement)
    .toEqual({ kind: 'orbit', orbitId })
  expect(plan.departingObjectIds.size).toBe(0)
  expect(plan.arrivingObjectIds.size).toBe(0)
})

test('snaps the whole selection when a free member reaches a fixed Orbit and preserves its occupants @pure', () => {
  const fixture = createFixture()
  const system = fixture.cluster.systems[0]!
  const freeObjectId = 'free-object'
  const workspace = replaceWorkspaceSystem(fixture, {
    ...system,
    objects: [...system.objects, object(freeObjectId, { kind: 'system', x: 0.75, y: 0.5 })],
  })
  const before = projectedPositions(workspace)
  const plan = planSelectedObjectTranslation(workspace, system.id, [planetId, freeObjectId], { x: 66, y: 0 })!
  expect(plan.arrivingObjectIds).toEqual(new Set([freeObjectId]))
  expect(plan.changes.find(change => change.objectId === freeObjectId)?.nextPlacement)
    .toEqual({ kind: 'orbit', orbitId: freeOrbitId })

  const applied = applySelectedObjectTranslation(workspace, system.id, plan)
  const after = projectedPositions(applied)
  for (const objectId of [planetId, moonId, freeObjectId]) {
    const original = before.get(objectId)!
    const position = after.get(objectId)!
    const preview = plan.positions.get(objectId)!
    expect(position.x).toBeCloseTo(preview.x, 9)
    expect(position.y).toBeCloseTo(preview.y, 9)
    expect(position.x - original.x).toBeCloseTo(60, 3)
    expect(position.y - original.y).toBeCloseTo(0, 3)
  }
  expect(applied.layout.objectAngles[freeObjectId]).toBeCloseTo(0)
  expect(after.get('free-orbit-occupant')).toEqual(before.get('free-orbit-occupant'))
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
  const plan = planSelectedObjectTranslation(workspace, systemId, [planetId, moonId], { x: -90, y: -120 })

  expect(plan).not.toBeNull()
  expect(plan!.movedObjectIds).toEqual([planetId, moonId])
  expect(plan!.positions.get(planetId)).toEqual({ x: 390, y: 280 })
  expect(plan!.positions.get(moonId)).toEqual({
    x: before.get(moonId)!.x - 90,
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
