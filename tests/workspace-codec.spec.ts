import { expect, test } from './fixtures'
import { createWorkspaceWithPrimaryStar } from './support/primary-star-fixture'
import { projectRouteObjects } from '../utils/route-object-geometry'
import { projectPlayerCluster } from '../domain/player-projection'
import { workspaceWithRouteObjects } from './support/route-objects-fixture'
import {
  addStarSystem,
  createJumpRoute,
  createLocalWorkspace,
  createSystemObject,
  exportJumpCluster,
  exportStarSystem,
  prepareJsonImport,
  restoreJumpClusterBackup,
  restoreLocalWorkspace,
  updateWorkspaceObject,
  type CustomFieldDefinition,
  type LocalWorkspace,
  type StarSystem,
  routeContentsFor,
  planMapEntityDeletion,
  replaceWorkspaceSystem,
  updateWorkspaceRouteObject,
  updateCustomFieldOptions,
  addCustomFieldDefinition,
  removeCustomFieldDefinition,
} from '../domain/workspace'

test('an initial and added Zone begin empty and can host catalogue entries and routes @pure', () => {
  const initial = createLocalWorkspace('Kestrel Reach', 'Vesper')
  const first = initial.cluster.systems[0]!
  const { workspace, system: second } = addStarSystem(initial)

  expect(first).toMatchObject({ name: 'Vesper', objects: [], orbits: [] })
  expect(second).toMatchObject({ name: 'New Zone 2', objects: [], orbits: [] })
  expect(createSystemObject(first, 'star')).toMatchObject({ family: 'CelestialBody', subtype: 'star' })
  expect(createSystemObject(second, 'station')).toMatchObject({ family: 'Installation', subtype: 'station' })
  expect(createJumpRoute(workspace.cluster, {
    jumpLevel: 1,
    fromSystemId: first.id,
    fromPointId: null,
    toSystemId: second.id,
    toPointId: null,
  })).toMatchObject({ fromSystemId: first.id, toSystemId: second.id })
})

function workspaceForPortableExports(): LocalWorkspace {
  const initial = createWorkspaceWithPrimaryStar('Kestrel Reach', 'Vesper')
  const firstSystem = initial.cluster.systems[0]
  const primaryStar = firstSystem?.objects[0]
  if (!firstSystem || !primaryStar) throw new Error('The fixture is missing its initial Primary Star.')

  const field: CustomFieldDefinition = {
    id: 'portable-survey-notes',
    name: 'Survey notes',
    type: 'text',
    playerShared: false,
  }
  const primaryOrbit = { id: 'portable-primary-orbit', hostId: primaryStar.id, order: 1 } as const
  const freeOrbit = {
    id: 'portable-free-orbit',
    hostId: null,
    center: { x: 0.2, y: 0.8 },
    order: 1,
  } as const
  const planet = {
    id: 'portable-iria',
    family: 'CelestialBody',
    subtype: 'planet',
    locationKey: 'PL-01',
    name: 'Iria',
    description: '',
    publication: 'known-type',
    playerText: '',
    playerFieldMasks: [] as string[],
    placement: { kind: 'orbit', orbitId: primaryOrbit.id },
    customFieldValues: { [field.id]: 'Public survey record.' },
  } as const
  const moon = {
    id: 'portable-nix',
    family: 'CelestialBody',
    subtype: 'moon',
    locationKey: 'MO-01',
    name: 'Nix',
    description: '',
    publication: 'known-type',
    playerText: '',
    playerFieldMasks: [] as string[],
    placement: { kind: 'orbit', orbitId: freeOrbit.id },
  } as const
  const origin = {
    id: 'portable-origin-point',
    family: 'JumpPoint',
    subtype: 'jump-point',
    locationKey: 'JP-01',
    name: 'Vesper Departure',
    description: '',
    publication: 'known-type',
    playerText: '',
    playerFieldMasks: [] as string[],
    placement: { kind: 'system', x: 0.75, y: 0.5 },
  } as const
  const first: StarSystem = {
    ...firstSystem,
    objects: [...firstSystem.objects, planet, moon, origin],
    orbits: [primaryOrbit, freeOrbit],
  }

  const betaStar = {
    id: 'portable-beta-star',
    family: 'CelestialBody',
    subtype: 'star',
    locationKey: 'STAR-02',
    name: 'Beta Star',
    description: '',
    publication: 'known-type',
    playerText: '',
    playerFieldMasks: [] as string[],
    placement: { kind: 'system', x: 0.5, y: 0.5 },
  } as const
  const destination = {
    id: 'portable-destination-point',
    family: 'JumpPoint',
    subtype: 'jump-point',
    locationKey: 'JP-02',
    name: 'Harrow Arrival',
    description: '',
    publication: 'known-type',
    playerText: '',
    playerFieldMasks: [] as string[],
    placement: { kind: 'system', x: 0.75, y: 0.5 },
  } as const
  const betaOrbit = { id: 'portable-beta-orbit', hostId: betaStar.id, order: 1 } as const
  const betaPlanet = {
    id: 'portable-beta-planet',
    family: 'CelestialBody',
    subtype: 'planet',
    locationKey: 'PL-02',
    name: 'Harrow',
    description: '',
    publication: 'known-type',
    playerText: '',
    playerFieldMasks: [] as string[],
    placement: { kind: 'orbit', orbitId: betaOrbit.id },
  } as const
  const second: StarSystem = {
    id: 'portable-beta-system',
    name: 'Harrow',
    publication: 'known-type',
    objects: [betaStar, destination, betaPlanet],
    orbits: [betaOrbit],
  }
  const route = {
    id: 'portable-known-route',
    name: 'Known lane',
    playerShared: false,
    jumpLevel: 8,
    fromSystemId: first.id,
    fromPointId: origin.id,
    toSystemId: second.id,
    toPointId: destination.id,
  } as const
  const unresolvedRoute = {
    id: 'portable-unresolved-route',
    name: 'Outer lane',
    playerShared: false,
    jumpLevel: 12,
    fromSystemId: second.id,
    fromPointId: destination.id,
    toSystemId: null,
    toPointId: null,
    unresolvedExit: 'The Quiet Expanse',
  } as const

  return {
    ...initial,
    cluster: {
      ...initial.cluster,
      systems: [first, second],
      routes: [route, unresolvedRoute],
    },
    layout: {
      systemPositions: {
        [first.id]: { x: 0.24, y: 0.71 },
        [second.id]: { x: 0.82, y: 0.28 },
      },
      unresolvedExitPositions: { [unresolvedRoute.id]: { x: 1250, y: -340 } },
      orbitRadii: {
        [primaryOrbit.id]: { horizontal: 140, vertical: 90 },
        [freeOrbit.id]: { horizontal: 67, vertical: 54 },
        [betaOrbit.id]: { horizontal: 126, vertical: 108 },
      },
      orbitRotations: {
        [primaryOrbit.id]: 36,
        [freeOrbit.id]: 212,
        [betaOrbit.id]: 95,
      },
      objectAngles: {
        [planet.id]: 2.23,
        [moon.id]: 5.18,
        [betaPlanet.id]: 1.75,
      },
    },
    objectFieldSettings: {
      ...initial.objectFieldSettings,
      customFields: [field],
    },
  }
}

test('Cluster JSON export contains the complete portable campaign projection @pure', () => {
  const workspace = workspaceForPortableExports()

  const exported = exportJumpCluster(workspace)

  expect(exported).toEqual({
    format: 'ttrpg-cluster-control-map',
    version: 7,
    type: 'cluster',
    cluster: workspace.cluster,
    objectFieldSettings: workspace.objectFieldSettings,
    layout: { version: 1, ...workspace.layout },
  })
  expect(exported.layout).not.toHaveProperty('zoom')
  expect(exported.layout).not.toHaveProperty('pan')
  expect(exported).not.toHaveProperty('selectedSystemId')
  expect(exported).not.toHaveProperty('selectedObjectId')
})

test('complete backup restore preserves portable Cluster data and creates a fresh local identity @pure', () => {
  const source = workspaceForPortableExports()
  const backup = exportJumpCluster(source)

  const restored = restoreJumpClusterBackup(backup)

  expect(restored.id).not.toBe(source.id)
  expect(restored.cluster).toEqual(source.cluster)
  expect(restored.objectFieldSettings).toEqual(source.objectFieldSettings)
  expect(restored.layout).toEqual(source.layout)
})

test('complete backup restore preserves optional marker colors and rejects malformed colors @pure', () => {
  const source = workspaceForPortableExports()
  const firstSystem = source.cluster.systems[0]!
  const firstObject = firstSystem.objects[0]!
  const markerColor = '#aBcD09'
  const coloredWorkspace = {
    ...source,
    cluster: {
      ...source.cluster,
      systems: source.cluster.systems.map(system => system.id !== firstSystem.id
        ? system
        : {
            ...system,
            objects: system.objects.map(object => object.id === firstObject.id
              ? { ...object, markerColor }
              : object),
          }),
    },
  }
  const backup = exportJumpCluster(coloredWorkspace)

  expect(restoreJumpClusterBackup(backup).cluster.systems[0]?.objects[0]?.markerColor).toBe(markerColor)
  const standalone = exportStarSystem(coloredWorkspace, firstSystem.id)
  const importedStandalone = prepareJsonImport(source, standalone)
  const importedSystem = importedStandalone.workspace.cluster.systems.find(system =>
    system.id === importedStandalone.addedSystemIds[0],
  )
  expect(importedSystem?.objects.find(object => object.name === firstObject.name)?.markerColor).toBe(markerColor)

  const malformedBackup = {
    ...backup,
    cluster: {
      ...backup.cluster,
      systems: backup.cluster.systems.map(system => system.id !== firstSystem.id
        ? system
        : {
            ...system,
            objects: system.objects.map(object => object.id === firstObject.id
              ? { ...object, markerColor: 'purple' }
              : object),
          }),
    },
  }
  expect(() => restoreJumpClusterBackup(malformedBackup)).toThrow(/valid/i)

  const legacyBackup = { ...exportJumpCluster(source), version: 3 }
  const legacyObject = restoreJumpClusterBackup(legacyBackup).cluster.systems[0]?.objects[0]
  expect(legacyObject).not.toHaveProperty('markerColor')
})

test('complete backup restore applies supported legacy migrations and rejects standalone systems @pure', () => {
  const source = workspaceForPortableExports()
  const backup = exportJumpCluster(source)
  const legacy = {
    ...backup,
    version: 3,
    cluster: {
      ...backup.cluster,
      playerTitle: 'Legacy player title',
      systems: backup.cluster.systems.map(system => ({
        ...system,
        objects: system.objects.map(object => ({
          ...object,
          playerText: '',
          playerFieldMasks: [],
        })),
      })),
    },
    objectFieldSettings: {
      ...backup.objectFieldSettings,
      customFields: backup.objectFieldSettings.customFields.map(field => ({ ...field, playerShared: false })),
    },
  }

  const restored = restoreJumpClusterBackup(legacy)

  expect(restored.cluster.playerTitle).toBe('Legacy player title')
  expect(() => restoreJumpClusterBackup(exportStarSystem(source, source.cluster.systems[0]!.id)))
    .toThrow(/Jump Cluster JSON backup/i)
  expect(() => restoreJumpClusterBackup({ type: 'player-document' }))
    .toThrow(/Jump Cluster JSON backup/i)
})

test('complete version 1 backup restore keeps legacy ellipse-only Orbit radii @pure', () => {
  const backup = exportJumpCluster(workspaceForPortableExports())
  const { orbitRadii, ...legacyLayout } = backup.layout
  const legacyRoutes = backup.cluster.routes.map(route => {
    const legacyRoute: Record<string, unknown> = { ...route }
    delete legacyRoute.fromSystemId
    delete legacyRoute.toSystemId
    return legacyRoute
  })
  const legacyVersionOne = {
    ...backup,
    version: 1,
    cluster: { ...backup.cluster, routes: legacyRoutes },
    layout: {
      ...legacyLayout,
      orbitEllipseRadii: orbitRadii,
    },
  }

  const restored = restoreJumpClusterBackup(legacyVersionOne)

  expect(restored.layout.orbitRadii).toEqual(orbitRadii)
})

test('standalone JSON export carries shared definitions and only its system layout @pure', () => {
  const workspace = workspaceForPortableExports()
  const system = workspace.cluster.systems[0]
  if (!system) throw new Error('The fixture is missing its first Star System.')

  const exported = exportStarSystem(workspace, system.id)

  expect(exported).toEqual({
    format: 'ttrpg-cluster-control-map',
    version: 5,
    type: 'system',
    system,
    objectFieldSettings: workspace.objectFieldSettings,
    layout: {
      version: 1,
      orbitRadii: {
        'portable-primary-orbit': { horizontal: 140, vertical: 90 },
        'portable-free-orbit': { horizontal: 67, vertical: 54 },
      },
      orbitRotations: {
        'portable-primary-orbit': 36,
        'portable-free-orbit': 212,
      },
      objectAngles: {
        'portable-iria': 2.23,
        'portable-nix': 5.18,
      },
    },
  })
  expect(exported.objectFieldSettings).toEqual(workspace.objectFieldSettings)
  expect(exported).not.toHaveProperty('cluster')
  expect(exported).not.toHaveProperty('routes')
  expect(exported.layout).not.toHaveProperty('systemPositions')
  expect(exported.layout).not.toHaveProperty('unresolvedExitPositions')
  expect(() => exportStarSystem(workspace, 'missing-system'))
    .toThrow('The selected Zone no longer exists.')
})

test('legacy Zone positions survive hydration, a complete backup, and an independent Cluster copy @pure', () => {
  const initial = createLocalWorkspace('Legacy layout', 'Remote relay')
  const zone = initial.cluster.systems[0]!
  const vessel = {
    ...createSystemObject(zone, 'vessel', undefined, zone.objects),
    placement: { kind: 'system' as const, x: 1.35, y: 0.5 },
  }
  const legacy = {
    ...initial,
    version: 5,
    cluster: { ...initial.cluster, systems: [{ ...zone, objects: [...zone.objects, vessel] }] },
    layout: { ...initial.layout, systemFrames: { [zone.id]: { left: 60, right: 60, top: 44, bottom: 44 } } },
  }
  const hydrated = restoreLocalWorkspace(legacy)
  if (!hydrated) throw new Error('A supported older workspace must hydrate.')
  const restoredVessel = hydrated.cluster.systems[0]?.objects.find(object => object.id === vessel.id)
  expect(restoredVessel?.placement).toEqual(vessel.placement)
  expect(restoredVessel?.legacyZonePlacement).toMatchObject({ systemId: zone.id, orbitId: null })

  const olderBackup = { ...exportJumpCluster(hydrated), version: 5, cluster: legacy.cluster }
  expect(restoreJumpClusterBackup(olderBackup).cluster).toEqual(hydrated.cluster)
  const backup = JSON.parse(JSON.stringify(exportJumpCluster(hydrated))) as unknown
  const restored = restoreJumpClusterBackup(backup)
  expect(restored.cluster).toEqual(hydrated.cluster)
  const copy = prepareJsonImport(initial, backup)
  const copiedZone = copy.workspace.cluster.systems.find(system => system.id === copy.addedSystemIds[0])
  const copiedVessel = copiedZone?.objects.find(object => object.family === 'Vessel')
  expect(copiedVessel?.placement).toEqual(vessel.placement)
  expect(copiedVessel?.legacyZonePlacement).toMatchObject({ systemId: copiedZone?.id, orbitId: null })
  expect(exportStarSystem(hydrated, zone.id).system.objects.find(object => object.id === vessel.id))
    .not.toHaveProperty('legacyZonePlacement')

  const malformed = updateWorkspaceObject(hydrated, zone.id, vessel.id, {
    placement: { kind: 'system', x: 1.55, y: 0.5 },
  })
  expect(restoreLocalWorkspace(malformed)).toBeNull()
  expect(() => restoreJumpClusterBackup(exportJumpCluster(malformed))).toThrow(/valid/)
})

test('complete backups preserve hosted route branches and keep standalone Zone files local @pure', () => {
  const { workspace, route, root, occupant, orbit } = workspaceWithRouteObjects()
  const stored = restoreLocalWorkspace(JSON.parse(JSON.stringify(workspace)))
  expect(stored?.cluster.routeContents[route.id]?.objects.map(object => object.id)).toEqual([root.id, occupant.id])
  if (!stored) throw new Error('Expected a valid route branch.')

  const restored = restoreJumpClusterBackup(JSON.parse(JSON.stringify(exportJumpCluster(stored))))
  expect(restored.cluster.routeContents[route.id]).toEqual({
    objects: [root, occupant],
    orbits: [orbit],
  })
  expect(restored.layout.orbitRadii[orbit.id]).toEqual({ horizontal: 92, vertical: 45 })
  expect(restored.layout.orbitRotations[orbit.id]).toBe(90)
  expect(restored.layout.objectAngles[occupant.id]).toBe(0)
  expect(restored.cluster.systems.map(system => system.objects)).toEqual([[], []])

  const standalone = exportStarSystem(restored, route.fromSystemId)
  expect(standalone.version).toBe(5)
  expect(standalone.layout.orbitRadii).toEqual({})
  expect(JSON.stringify(standalone)).not.toContain(root.id)
})

test('route branches require exclusive current placement and globally valid relationships @pure', () => {
  const { workspace, route, root, orbit, occupant } = workspaceWithRouteObjects()
  const { routeContents: contents, ...withoutContents } = workspace.cluster
  const candidate = (branch: unknown) => ({
    ...workspace,
    cluster: { ...workspace.cluster, routeContents: { [route.id]: branch } },
  })
  expect(restoreLocalWorkspace({ ...workspace, cluster: withoutContents })).toBeNull()
  expect(restoreLocalWorkspace({ ...workspace, cluster: { ...workspace.cluster, routeContents: { missing: contents[route.id] } } })).toBeNull()
  for (const progression of [NaN, Infinity, -0.0001, 1.0001, '0.25']) {
    expect(restoreLocalWorkspace(candidate({
      objects: [{ ...root, placement: { kind: 'route', progression } }, occupant],
      orbits: [orbit],
    }))).toBeNull()
  }
  for (const placement of [
    { kind: 'system', x: 0.2, y: 0.3 },
    { kind: 'orbit', orbitId: orbit.id },
    { kind: 'route', progression: 0.2, routeId: 'other-route' },
  ]) {
    expect(restoreLocalWorkspace(candidate({
      objects: [{ ...root, placement }, occupant],
      orbits: [orbit],
    }))).toBeNull()
  }
  expect(restoreLocalWorkspace(candidate({
    objects: [{ ...root, id: route.fromSystemId }, occupant],
    orbits: [{ ...orbit, hostId: route.fromSystemId }],
  }))).toBeNull()
  expect(restoreLocalWorkspace(candidate({
    objects: [root, { ...occupant, locationKey: root.locationKey }],
    orbits: [orbit],
  }))).toBeNull()
  expect(restoreLocalWorkspace(candidate({
    objects: [root, occupant],
    orbits: [{ ...orbit, hostId: null, center: { x: 0, y: 0 } }],
  }))).toBeNull()
  expect(restoreLocalWorkspace({ ...workspace, version: 6 })).toBeNull()

  const old = createLocalWorkspace('Previous Atlas', 'Vesper')
  const legacyCluster = { ...old.cluster }
  Reflect.deleteProperty(legacyCluster, 'routeContents')
  const v6 = { ...old, version: 6, cluster: legacyCluster }
  expect(restoreLocalWorkspace(v6)?.cluster.routeContents).toEqual({})
  expect(restoreJumpClusterBackup({ ...exportJumpCluster(old), version: 6, cluster: legacyCluster }).cluster.routeContents)
    .toEqual({})
})

test('route object context supports unusual route IDs and preserves private authored data during unrelated operations @pure', () => {
  const { workspace, route, root, branch } = workspaceWithRouteObjects()
  const oddId = '__proto__'
  const occupied = { ...route, id: oddId }
  workspace.cluster.routes = [occupied]
  workspace.cluster.routeContents = { [oddId]: branch }
  expect(routeContentsFor(workspace.cluster, 'constructor')).toBeUndefined()
  const source = restoreJumpClusterBackup(JSON.parse(JSON.stringify(exportJumpCluster(workspace))))
  const updated = updateWorkspaceRouteObject(source, oddId, root.id, { name: 'Private updated vessel' })
  expect(routeContentsFor(updated.cluster, oddId)?.objects[0]?.name).toBe('Private updated vessel')

  const deleted = planMapEntityDeletion(updated, { kind: 'route', routeId: oddId }).workspace
  expect(routeContentsFor(deleted.cluster, oddId)).toBeUndefined()
  const modifiedZone = { ...updated.cluster.systems[0]!, name: 'Renamed Vesper' }
  expect(replaceWorkspaceSystem(updated, modifiedZone).layout).toEqual(updated.layout)
  expect(() => prepareJsonImport(source, exportJumpCluster(updated))).toThrow(/open this complete Jump Cluster as a backup/i)
  expect(JSON.stringify(projectPlayerCluster(updated))).not.toMatch(/route-vessel|Private updated vessel|Private expedition log/)
})

test('a hosted route occupant uses the shared scene scale and effective ellipse geometry @pure', () => {
  const { workspace, root, occupant, orbit, branch } = workspaceWithRouteObjects()
  // This cubic is x = 160t and y = 96t(1 - t); at t = 1/4 it reaches (40, 18).
  const projected = projectRouteObjects(branch, {
    start: { x: 0, y: 0 },
    control1: { x: 160 / 3, y: 32 },
    control2: { x: 320 / 3, y: 32 },
    end: { x: 160, y: 0 },
  }, workspace.layout)
  expect(projected.positions.get(root.id)).toEqual({ x: 40, y: 18 })
  expect(projected.positions.get(occupant.id)?.x).toBeCloseTo(40, 12)
  expect(projected.positions.get(occupant.id)?.y).toBeCloseTo(36.4, 12)
  expect(projected.orbits).toMatchObject([{
    id: orbit.id, center: { x: 40, y: 18 }, vertical: 9, rotation: 90,
  }])
  expect(projected.orbits[0]?.horizontal).toBeCloseTo(18.4, 12)
})

test('Field updates review and preserve route assignments through the shared catalogue inventory @pure', () => {
  const { workspace, route, root } = workspaceWithRouteObjects()
  const withField = addCustomFieldDefinition(workspace, 'Affiliation', 'single-select', ['Survey', 'Patrol'])
  const affiliation = withField.objectFieldSettings.customFields[0]!
  const assigned = updateWorkspaceRouteObject(withField, route.id, root.id, {
    customFieldValues: { [affiliation.id]: 'Survey' },
    playerFieldMasks: [affiliation.id],
  })
  expect(() => updateCustomFieldOptions(assigned, affiliation.id, ['Patrol']))
    .toThrow('Cannot remove "Survey" while it is assigned to Survey vessel.')
  const cleared = updateCustomFieldOptions(assigned, affiliation.id, ['Patrol'], true)
  const afterRemoval = removeCustomFieldDefinition(cleared, affiliation.id)
  const backup = restoreJumpClusterBackup(exportJumpCluster(afterRemoval))
  expect(routeContentsFor(backup.cluster, route.id)?.objects[0]).toEqual({ ...root, customFieldValues: {} })
})
