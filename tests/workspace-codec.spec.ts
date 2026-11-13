import { expect, test } from './fixtures'
import {
  createLocalWorkspace,
  exportJumpCluster,
  exportStarSystem,
  restoreJumpClusterBackup,
  type CustomFieldDefinition,
  type LocalWorkspace,
  type StarSystem,
} from '../domain/workspace'

function workspaceForPortableExports(): LocalWorkspace {
  const initial = createLocalWorkspace('Kestrel Reach', 'Vesper')
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
    locationKey: 'A',
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
    locationKey: 'PL-01',
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
    fromPointId: origin.id,
    toPointId: destination.id,
  } as const
  const unresolvedRoute = {
    id: 'portable-unresolved-route',
    name: 'Outer lane',
    playerShared: false,
    jumpLevel: 12,
    fromPointId: destination.id,
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
    version: 4,
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

test('standalone JSON export carries shared definitions and only its system layout @pure', () => {
  const workspace = workspaceForPortableExports()
  const system = workspace.cluster.systems[0]
  if (!system) throw new Error('The fixture is missing its first Star System.')

  const exported = exportStarSystem(workspace, system.id)

  expect(exported).toEqual({
    format: 'ttrpg-cluster-control-map',
    version: 4,
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
    .toThrow('The selected star system no longer exists.')
})
