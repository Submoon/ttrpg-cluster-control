import { expect, test } from './fixtures'
import { createWorkspaceSnapshot } from '../utils/workspace-storage'
import {
  addStarSystem,
  createLocalWorkspace,
  exportJumpCluster,
  exportStarSystem,
  isLocalWorkspace,
  prepareJsonImport,
  restoreLocalWorkspace,
  updateChartDetails,
} from '../domain/workspace'

test('new systems start with known-type publication and a generic player title @pure', () => {
  const workspace = createLocalWorkspace('Kestrel Reach', 'Vesper')
  const added = addStarSystem(workspace, 'Harrow')

  expect(workspace.cluster.systems[0]?.publication).toBe('known-type')
  expect(added.system.publication).toBe('known-type')
  expect(workspace.cluster.playerTitle).toBe('Player Jump Cluster')
})

test('chart details update publication and public names without rewriting map contents @pure', () => {
  const workspace = createLocalWorkspace('Kestrel Reach', 'Vesper')
  const system = workspace.cluster.systems[0]!
  const changed = updateChartDetails(workspace, system.id, {
    clusterName: ' Kestrel Reach Prime ',
    systemName: ' Vesper Prime ',
    playerTitle: ' The Night Map ',
    publication: 'revealed',
  })

  expect(changed.cluster.name).toBe('Kestrel Reach Prime')
  expect(changed.cluster.playerTitle).toBe('The Night Map')
  expect(changed.cluster.systems[0]).toMatchObject({ id: system.id, name: 'Vesper Prime', publication: 'revealed' })
  expect(changed.cluster.systems[0]?.objects).toEqual(system.objects)
  expect(changed.cluster.systems[0]?.orbits).toEqual(system.orbits)
  expect(changed.layout).toEqual(workspace.layout)
  expect(workspace.cluster.systems[0]).toEqual(system)
  expect(workspace.cluster.name).toBe('Kestrel Reach')
})

test('legacy local workspaces restore with hidden publication and a generic player title @pure', () => {
  const current = createLocalWorkspace('Private Cluster Name', 'Secret System Name')
  const legacy = structuredClone(current) as unknown as Record<string, unknown>
  delete legacy.version
  const cluster = legacy.cluster as { playerTitle?: string; systems: Array<Record<string, unknown>> }
  delete cluster.playerTitle
  delete cluster.systems[0]?.publication

  expect(isLocalWorkspace(legacy)).toBe(false)
  const restored = restoreLocalWorkspace(legacy)

  expect(restored).toMatchObject({ version: 4, cluster: { playerTitle: 'Player Jump Cluster' } })
  expect(restored?.cluster.systems[0]?.publication).toBe('hidden')
  expect(restored?.cluster.systems[0]?.objects[0]?.publication).toBe('hidden')
  expect(restored?.cluster.name).toBe('Private Cluster Name')
  expect(restored?.cluster.systems[0]?.name).toBe('Secret System Name')
})

test('version 4 workspaces reject missing publication fields and unsupported versions @pure', () => {
  const workspace = createLocalWorkspace('Kestrel Reach', 'Vesper')
  const missingMode = structuredClone(workspace) as unknown as Record<string, unknown>
  const cluster = missingMode.cluster as { systems: Array<Record<string, unknown>> }
  delete cluster.systems[0]?.publication
  const missingObjectMode = structuredClone(workspace) as unknown as Record<string, unknown>
  const objectCluster = missingObjectMode.cluster as {
    systems: Array<{ objects: Array<Record<string, unknown>> }>
  }
  delete objectCluster.systems[0]?.objects[0]?.publication
  const malformedObjectMode = structuredClone(workspace) as unknown as Record<string, unknown>
  const malformedObjectCluster = malformedObjectMode.cluster as {
    systems: Array<{ objects: Array<Record<string, unknown>> }>
  }
  malformedObjectCluster.systems[0]!.objects[0]!.publication = 'classified'

  expect(isLocalWorkspace(workspace)).toBe(true)
  expect(isLocalWorkspace(missingMode)).toBe(false)
  expect(isLocalWorkspace(missingObjectMode)).toBe(false)
  expect(isLocalWorkspace(malformedObjectMode)).toBe(false)
  expect(restoreLocalWorkspace(missingObjectMode)).toBeNull()
  expect(restoreLocalWorkspace(malformedObjectMode)).toBeNull()
  expect(restoreLocalWorkspace({ ...workspace, version: 5 })).toBeNull()
  expect(restoreLocalWorkspace({ ...workspace, version: 1 })).toBeNull()
  expect(restoreLocalWorkspace({
    ...workspace,
    cluster: { ...workspace.cluster, playerTitle: '  ' },
  })).toBeNull()
  expect(restoreLocalWorkspace({
    ...workspace,
    layout: { ...workspace.layout, orbitRotations: undefined as never },
  })).toBeNull()
  expect(restoreLocalWorkspace({
    ...workspace,
    cluster: {
      ...workspace.cluster,
      systems: [{ ...workspace.cluster.systems[0]!, publication: 'classified' as never }],
    },
  })).toBeNull()
})

test('version 4 exports and independent imports preserve publication while v1/v2 imports use safe object defaults @pure', () => {
  const source = createLocalWorkspace('Source Reach', 'Iria')
  const sourceSystem = source.cluster.systems[0]!
  const published = updateChartDetails(source, sourceSystem.id, {
    clusterName: source.cluster.name,
    systemName: sourceSystem.name,
    playerTitle: 'Aster Reach',
    publication: 'revealed',
  })
  const clusterExport = exportJumpCluster(published)
  const systemExport = exportStarSystem(published, sourceSystem.id)
  const savedSnapshot = createWorkspaceSnapshot(published)

  expect(clusterExport.version).toBe(4)
  expect(clusterExport.layout.version).toBe(1)
  expect(clusterExport.cluster.playerTitle).toBe('Aster Reach')
  expect(systemExport.version).toBe(4)
  expect(systemExport.system.publication).toBe('revealed')
  expect(savedSnapshot.cluster.playerTitle).toBe('Aster Reach')
  expect(savedSnapshot.cluster.systems[0]?.publication).toBe('revealed')

  const initialDestination = createLocalWorkspace('Destination Reach', 'Vesper')
  const destination = updateChartDetails(
    initialDestination,
    initialDestination.cluster.systems[0]!.id,
    { clusterName: 'Destination Reach', systemName: 'Vesper', playerTitle: 'Safe Copy', publication: 'known-type' },
  )
  const imported = prepareJsonImport(destination, clusterExport)
  const copiedSystem = imported.workspace.cluster.systems[1]
  expect(imported.workspace.cluster.playerTitle).toBe('Safe Copy')
  expect(copiedSystem?.publication).toBe('revealed')
  expect(copiedSystem?.objects[0]?.publication).toBe('known-type')
  expect(copiedSystem?.id).not.toBe(sourceSystem.id)

  const legacyV2 = JSON.parse(JSON.stringify(clusterExport)) as {
    version: number
    cluster: { playerTitle?: string; systems: Array<{ publication?: string; objects: Array<{ publication?: string }> }> }
  }
  legacyV2.version = 2
  for (const system of legacyV2.cluster.systems) {
    for (const object of system.objects) delete object.publication
  }
  const importedV2 = prepareJsonImport(destination, legacyV2)
  expect(importedV2.workspace.cluster.playerTitle).toBe('Safe Copy')
  expect(importedV2.workspace.cluster.systems[1]?.publication).toBe('revealed')
  expect(importedV2.workspace.cluster.systems[1]?.objects[0]?.publication).toBe('hidden')

  const legacy = JSON.parse(JSON.stringify(clusterExport)) as {
    version: number
    cluster: { playerTitle?: string; systems: Array<{ publication?: string; objects: Array<{ publication?: string }> }> }
  }
  legacy.version = 1
  delete legacy.cluster.playerTitle
  for (const system of legacy.cluster.systems) {
    delete system.publication
    for (const object of system.objects) delete object.publication
  }
  const importedLegacy = prepareJsonImport(destination, legacy)
  expect(importedLegacy.workspace.cluster.playerTitle).toBe('Safe Copy')
  expect(importedLegacy.workspace.cluster.systems[1]?.publication).toBe('hidden')

  const legacySystem = JSON.parse(JSON.stringify(systemExport)) as {
    version: number
    system: { publication?: string; objects: Array<{ publication?: string }> }
  }
  legacySystem.version = 1
  legacySystem.system.publication = 'revealed'
  for (const object of legacySystem.system.objects) delete object.publication
  const importedLegacySystem = prepareJsonImport(destination, legacySystem)
  expect(importedLegacySystem.workspace.cluster.systems[1]?.publication).toBe('hidden')
  expect(importedLegacySystem.workspace.cluster.systems[1]?.objects[0]?.publication).toBe('hidden')

  const malformedV2 = JSON.parse(JSON.stringify(systemExport)) as {
    version: number
    system: { publication?: string }
  }
  malformedV2.version = 2
  delete malformedV2.system.publication
  expect(() => prepareJsonImport(destination, malformedV2)).toThrow(/version 1, version 2, version 3, or version 4/)

  const malformedV2Cluster = JSON.parse(JSON.stringify(clusterExport)) as {
    version: number
    cluster: { playerTitle?: string; systems: Array<{ publication?: string }> }
  }
  malformedV2Cluster.version = 2
  delete malformedV2Cluster.cluster.playerTitle
  expect(() => prepareJsonImport(destination, malformedV2Cluster)).toThrow(/version 1, version 2, version 3, or version 4/)

  const invalidV2SystemPublication = JSON.parse(JSON.stringify(clusterExport)) as {
    version: number
    cluster: { systems: Array<{ publication?: string; objects: Array<Record<string, unknown>> }> }
  }
  invalidV2SystemPublication.version = 2
  invalidV2SystemPublication.cluster.systems[0]!.publication = 'classified'
  for (const object of invalidV2SystemPublication.cluster.systems[0]!.objects) {
    delete object.publication
  }
  expect(() => prepareJsonImport(destination, invalidV2SystemPublication))
    .toThrow(/version 1, version 2, version 3, or version 4/)

  const malformedV3Object = JSON.parse(JSON.stringify(clusterExport)) as {
    version: number
    cluster: { systems: Array<{ objects: Array<Record<string, unknown>> }> }
  }
  malformedV3Object.version = 3
  delete malformedV3Object.cluster.systems[0]?.objects[0]?.publication
  expect(() => prepareJsonImport(destination, malformedV3Object)).toThrow(/version 1, version 2, version 3, or version 4/)

  const invalidV3Object = JSON.parse(JSON.stringify(clusterExport)) as {
    version: number
    cluster: { systems: Array<{ objects: Array<Record<string, unknown>> }> }
  }
  invalidV3Object.version = 3
  invalidV3Object.cluster.systems[0]!.objects[0]!.publication = 'classified'
  expect(() => prepareJsonImport(destination, invalidV3Object)).toThrow(/version 1, version 2, version 3, or version 4/)
})
