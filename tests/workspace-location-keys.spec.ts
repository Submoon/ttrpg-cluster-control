import { expect, test } from '@playwright/test'
import {
  addStarSystem,
  applySystemObjectTransfer,
  createLocalWorkspace,
  createSystemObject,
  exportJumpCluster,
  exportStarSystem,
  isLocalWorkspace,
  prepareJsonImport,
  restoreJumpClusterBackup,
  restoreLocalWorkspace,
  updateWorkspaceObject,
} from '../domain/workspace'
import { jsonImportReviewEffects } from '../domain/workspace-json-import'
import { objectDraftValuesFor } from '../composables/editor-workflows/entity-draft-values'
import { validateObjectDraft } from '../composables/editor-workflows/entity-draft-validation'

test('a complete backup preserves only existing legacy duplicate key assignments @pure', () => {
  const workspace = addStarSystem(createLocalWorkspace('Kestrel Reach', 'Vesper'), 'Harrow').workspace
  const legacy = {
    ...workspace,
    version: 5,
    cluster: {
      ...workspace.cluster,
      systems: workspace.cluster.systems.map(system => ({
        ...system,
        objects: [{ ...createSystemObject(system, 'planet'), locationKey: 'PL-01' }],
      })),
    },
  }
  const restored = restoreLocalWorkspace(legacy)!
  const [first, second] = restored.cluster.systems
  expect(restoreJumpClusterBackup({
    format: 'ttrpg-cluster-control-map',
    type: 'cluster',
    version: 5,
    cluster: legacy.cluster,
    objectFieldSettings: legacy.objectFieldSettings,
    layout: { ...legacy.layout, version: 1 },
  }).cluster).toEqual(restored.cluster)
  const firstObject = first!.objects[0]!
  const secondObject = second!.objects[0]!

  expect(isLocalWorkspace({ ...legacy, version: restored.version })).toBe(false)
  expect(isLocalWorkspace(restored)).toBe(true)
  const forgedCopy = {
    ...restored,
    cluster: {
      ...restored.cluster,
      systems: [
        { ...first!, objects: [firstObject, { ...firstObject, id: 'copied-object' }] },
        second!,
      ],
    },
  }
  expect(restoreLocalWorkspace(forgedCopy)).toBeNull()
  const edited = updateWorkspaceObject(restored, first!.id, firstObject.id, { name: 'Iria' })
  const rekeyTarget = edited.cluster.systems[0]!.objects[0]!
  const originalDraft = objectDraftValuesFor(rekeyTarget, edited.objectFieldSettings)
  expect(validateObjectDraft(edited, edited.cluster.systems[0]!, rekeyTarget, originalDraft, originalDraft).errors)
    .toEqual({})

  const backup = exportJumpCluster(edited)
  const v6Cluster = { ...backup.cluster }
  Reflect.deleteProperty(v6Cluster, 'routeContents')
  const fromV6 = restoreJumpClusterBackup({ ...backup, version: 6, cluster: v6Cluster })
  expect(fromV6.cluster.systems).toEqual(edited.cluster.systems)
  expect(fromV6.cluster.routeContents).toEqual({})
  expect(() => restoreJumpClusterBackup({
    ...backup,
    layout: { ...backup.layout, orbitRotations: undefined },
  })).toThrow(/valid version 1 through 7 Jump Cluster JSON backup/)
  const roundTrip = restoreJumpClusterBackup(JSON.parse(JSON.stringify(backup)))
  expect(roundTrip.cluster.systems.flatMap(system => system.objects.map(object => [object.id, object.locationKey])))
    .toEqual([[firstObject.id, 'PL-01'], [secondObject.id, 'PL-01']])

  const transferred = applySystemObjectTransfer(roundTrip, {
    sourceSystemId: first!.id,
    rootObjectId: firstObject.id,
    destinationSystemId: second!.id,
    placement: { kind: 'system', x: 0.7, y: 0.7 },
  })
  expect(transferred.cluster.systems[1]!.objects.map(object => object.locationKey)).toEqual(['PL-01', 'PL-01'])
  expect(isLocalWorkspace(transferred)).toBe(true)
  const copied = prepareJsonImport(roundTrip, exportStarSystem(transferred, second!.id))
  expect(copied.summary.locationKeyReplacements.map(replacement => replacement.replacementKey)).toEqual(['PL-02', 'PL-03'])

  const rekeyed = updateWorkspaceObject(roundTrip, first!.id, firstObject.id, { locationKey: 'PL-02' })
  expect(isLocalWorkspace(rekeyed)).toBe(true)
  expect(() => updateWorkspaceObject(rekeyed, first!.id, firstObject.id, { locationKey: 'PL-01' }))
    .toThrow('Location key "PL-01" is already used in this Jump Cluster.')
})

test('a reviewed standalone copy reserves destination and reusable incoming keys Cluster-wide @pure', () => {
  const destination = addStarSystem(createLocalWorkspace('Kestrel Reach', 'Vesper'), 'Harrow').workspace
  const occupied = destination.cluster.systems[1]!
  occupied.objects = [{ ...createSystemObject(occupied, 'planet'), locationKey: 'PL-01' }]
  const source = createLocalWorkspace('Incoming Reach', 'Iria')
  const incoming = source.cluster.systems[0]!
  incoming.objects = [
    { ...createSystemObject(incoming, 'planet'), name: 'Iria', locationKey: 'PL-01', description: 'See PL-01.' },
    { ...createSystemObject(incoming, 'planet'), locationKey: 'PL-02' },
  ]

  const [local, remote] = destination.cluster.systems
  const target = { ...createSystemObject(local!, 'planet'), locationKey: 'PL-02' }
  const editSystem = { ...local!, objects: [...local!.objects, target] }
  const editorWorkspace = { ...destination, cluster: { ...destination.cluster, systems: [editSystem, remote!] } }
  const original = objectDraftValuesFor(target, destination.objectFieldSettings)
  const invalidDraft = { ...original, locationKey: remote!.objects[0]!.locationKey }
  expect(validateObjectDraft(editorWorkspace, editSystem, target, original, invalidDraft).errors.locationKey)
    .toBe('Location key "PL-01" is already used in this Jump Cluster.')

  const standalone = exportStarSystem(source, incoming.id)
  const prepared = prepareJsonImport(destination, standalone)
  expect(prepared.summary.locationKeyReplacements).toEqual([
    { name: 'Iria', system: 'Iria', originalKey: 'PL-01', replacementKey: 'PL-03' },
  ])
  expect(prepared.workspace.cluster.systems[1]!.objects[0]!.locationKey).toBe('PL-01')
  expect(prepared.workspace.cluster.systems[2]!.objects.map(object => object.locationKey)).toEqual(['PL-03', 'PL-02'])
  expect(prepared.workspace.cluster.systems[2]!.objects[0]!.description).toBe('See PL-01.')

  const latest = updateWorkspaceObject(destination, occupied.id, occupied.objects[0]!.id, { locationKey: 'PL-03' })
  const updated = prepareJsonImport(latest, standalone)
  expect(updated.summary.locationKeyReplacements).toEqual([])
  expect(jsonImportReviewEffects(latest, standalone, updated).signature)
    .not.toBe(jsonImportReviewEffects(destination, standalone, prepared).signature)
})
