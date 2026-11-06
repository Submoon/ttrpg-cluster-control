import { expect, test } from './fixtures'
import {
  createLocalWorkspace,
  createOrbit,
  createSystemObject,
  defaultObjectFieldSettings,
  exportJumpCluster,
  exportStarSystem,
  isPublicationMode,
  prepareJsonImport,
  replaceWorkspaceSystem,
  restoreLocalWorkspace,
  updateChartDetails,
  updateSystemObject,
} from '../domain/workspace'
import type { SystemObjectChanges } from '../domain/workspace'
import { createWorkspaceSnapshot } from '../utils/workspace-storage'

test('new objects start at Known type publication @pure', () => {
  const system = createLocalWorkspace('Kestrel Reach', 'Vesper').cluster.systems[0]!

  expect(createSystemObject(system, 'planet')).toHaveProperty('publication', 'known-type')
})

test('a new system primary star starts at Known type publication @pure', () => {
  const system = createLocalWorkspace('Kestrel Reach', 'Vesper').cluster.systems[0]!

  expect(system.objects[0]).toHaveProperty('publication', 'known-type')
})

test('version 2 workspaces migrate object publication to Hidden and preserve chart publication @pure', () => {
  const current = createLocalWorkspace('Kestrel Reach', 'Vesper')
  const legacy = structuredClone(current) as unknown as Record<string, unknown>
  legacy.version = 2
  const cluster = legacy.cluster as {
    playerTitle: string
    systems: Array<{ publication: string; objects: Array<Record<string, unknown>> }>
  }
  cluster.playerTitle = 'Aster Reach'
  cluster.systems[0]!.publication = 'revealed'
  for (const object of cluster.systems[0]!.objects) delete object.publication

  const restored = restoreLocalWorkspace(legacy)

  expect(restored).toMatchObject({
    version: 4,
    cluster: {
      playerTitle: 'Aster Reach',
      systems: [{ publication: 'revealed', objects: [{ publication: 'hidden' }] }],
    },
  })
})

test('version 2 workspaces reject missing or malformed system publication metadata @pure', () => {
  const current = createLocalWorkspace('Kestrel Reach', 'Vesper')
  const asVersionTwo = (): Record<string, unknown> => {
    const legacy = structuredClone(current) as unknown as Record<string, unknown>
    legacy.version = 2
    const cluster = legacy.cluster as {
      systems: Array<{ objects: Array<Record<string, unknown>> }>
    }
    for (const object of cluster.systems[0]!.objects) delete object.publication
    return legacy
  }

  const missingSystemPublication = asVersionTwo()
  const missingPublicationCluster = missingSystemPublication.cluster as {
    systems: Array<Record<string, unknown>>
  }
  delete missingPublicationCluster.systems[0]?.publication

  const malformedSystemPublication = asVersionTwo()
  const malformedPublicationCluster = malformedSystemPublication.cluster as {
    systems: Array<Record<string, unknown>>
  }
  malformedPublicationCluster.systems[0]!.publication = 'classified'

  const missingPlayerTitle = asVersionTwo()
  const titleCluster = missingPlayerTitle.cluster as Record<string, unknown>
  delete titleCluster.playerTitle

  expect(restoreLocalWorkspace(missingSystemPublication)).toBeNull()
  expect(restoreLocalWorkspace(malformedSystemPublication)).toBeNull()
  expect(restoreLocalWorkspace(missingPlayerTitle)).toBeNull()
})

test('object edits validate and preserve their saved publication mode @pure', () => {
  const system = createLocalWorkspace('Kestrel Reach', 'Vesper').cluster.systems[0]!
  const star = system.objects[0]!
  const changed = updateSystemObject(
    system,
    star.id,
    { publication: 'unknown' },
    defaultObjectFieldSettings(),
  )

  expect(isPublicationMode('hidden')).toBe(true)
  expect(isPublicationMode('unknown')).toBe(true)
  expect(isPublicationMode('known-type')).toBe(true)
  expect(isPublicationMode('revealed')).toBe(true)
  expect(isPublicationMode('classified')).toBe(false)
  expect(changed.objects[0]).toMatchObject({ id: star.id, publication: 'unknown' })
  expect(system.objects[0]?.publication).toBe('known-type')

  const invalid = { publication: 'classified' } as unknown as SystemObjectChanges
  expect(() => updateSystemObject(system, star.id, invalid, defaultObjectFieldSettings()))
    .toThrow(/valid object publication mode/)
})

test('version 4 object publication survives snapshots and full-map imports with remapped Orbit references @pure', () => {
  const initial = createLocalWorkspace('Source Reach', 'Iria')
  const system = initial.cluster.systems[0]!
  const star = system.objects[0]!
  const orbit = createOrbit(system, star.id)
  const systemWithOrbit = { ...system, orbits: [orbit] }
  const planet = createSystemObject(systemWithOrbit, 'planet', orbit.id)
  const systemWithPlanet = {
    ...systemWithOrbit,
    objects: [...systemWithOrbit.objects, planet],
  }
  const publishedSystem = updateSystemObject(
    systemWithPlanet,
    planet.id,
    { publication: 'revealed' },
    initial.objectFieldSettings,
  )
  const withObjects = replaceWorkspaceSystem(initial, publishedSystem)
  const source = updateChartDetails(withObjects, system.id, {
    clusterName: withObjects.cluster.name,
    systemName: system.name,
    playerTitle: 'Source Player Title',
    publication: 'revealed',
  })

  const snapshot = createWorkspaceSnapshot(source)
  const restored = restoreLocalWorkspace(snapshot)
  expect(snapshot.version).toBe(4)
  expect(restored?.cluster.systems[0]?.objects[1]?.publication).toBe('revealed')

  const destinationStart = createLocalWorkspace('Destination Reach', 'Vesper')
  const destination = updateChartDetails(destinationStart, destinationStart.cluster.systems[0]!.id, {
    clusterName: destinationStart.cluster.name,
    systemName: 'Vesper',
    playerTitle: 'Destination Player Title',
    publication: 'known-type',
  })
  const clusterExport = exportJumpCluster(source)
  const importedCurrent = prepareJsonImport(destination, clusterExport)
  const copiedSystem = importedCurrent.workspace.cluster.systems[1]!
  const copiedPlanet = copiedSystem.objects.find(object => object.subtype === 'planet')!
  expect(clusterExport.version).toBe(4)
  expect(copiedSystem.publication).toBe('revealed')
  expect(copiedPlanet.publication).toBe('revealed')
  expect(copiedPlanet.id).not.toBe(planet.id)
  expect(copiedPlanet.placement).toEqual({ kind: 'orbit', orbitId: copiedSystem.orbits[0]?.id })
  expect(copiedSystem.orbits[0]?.id).not.toBe(orbit.id)
  expect(importedCurrent.workspace.cluster.playerTitle).toBe('Destination Player Title')

  const systemExport = exportStarSystem(source, system.id)
  const importedStandalone = prepareJsonImport(destination, systemExport)
  const standaloneSystem = importedStandalone.workspace.cluster.systems[1]!
  expect(systemExport.version).toBe(4)
  expect(standaloneSystem.objects.find(object => object.subtype === 'planet')?.publication).toBe('revealed')
  expect(standaloneSystem.objects.find(object => object.subtype === 'planet')?.placement)
    .toEqual({ kind: 'orbit', orbitId: standaloneSystem.orbits[0]?.id })
  expect(importedStandalone.workspace.cluster.playerTitle).toBe('Destination Player Title')

  const legacyV2 = structuredClone(clusterExport) as unknown as {
    version: number
    cluster: { systems: Array<{ objects: Array<Record<string, unknown>> }> }
  }
  legacyV2.version = 2
  for (const legacySystem of legacyV2.cluster.systems) {
    for (const object of legacySystem.objects) delete object.publication
  }
  const importedV2 = prepareJsonImport(destination, legacyV2)
  const copiedV2 = importedV2.workspace.cluster.systems[1]!
  expect(copiedV2.publication).toBe('revealed')
  expect(copiedV2.objects.every(object => object.publication === 'hidden')).toBe(true)
  expect(importedV2.workspace.cluster.playerTitle).toBe('Destination Player Title')
})
