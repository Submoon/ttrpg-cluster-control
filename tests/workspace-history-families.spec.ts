import { expect, test } from './fixtures'
import { computed, ref } from 'vue'
import {
  addStarSystem,
  createJumpRoute,
  createLocalWorkspace,
  createOrbit,
  createSystemObject,
  exportJumpCluster,
  exportStarSystem,
  isLocalWorkspace,
  planMapEntityDeletion,
  prepareJsonImport,
  removeCustomFieldDefinition,
  updateCustomFieldApplicability,
  updateCustomFieldType,
  type LocalWorkspace,
} from '../domain/workspace'
import { createWorkspaceHistoryCoordinator } from '../composables/editor-workflows/workspace-mutations'
import type { WorkspaceHistoryCapacityDetails } from '../composables/editor-workflows/workspace-mutations'
import { useWorkspaceFiles } from '../composables/useWorkspaceFiles'
import { createWorkspaceSnapshot } from '../utils/workspace-storage'
import {
  waitForWorkspaceSaved,
  addClusterSystem,
  captureMapExportBlobs,
  createSingleSystemWorkspace,
  downloadJson,
  editFieldDefinition,
  importReviewDialog,
  jsonMapImportInput,
  openFieldDefinitionDialog,
  openWorkspaceHierarchy,
  resolveImportReview,
  returnToClusterMap,
  setWorkspaceMapMode,
  setJsonFile,
} from './helpers'

function fakeImportInput(content: string): { event: Event; restore(): void } {
  const previousDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'HTMLInputElement')
  class TestInput {
    value = 'map.json'
    files = [{ text: async () => content }]
  }
  Object.defineProperty(globalThis, 'HTMLInputElement', {
    configurable: true,
    value: TestInput,
  })
  return {
    event: { target: new TestInput() } as unknown as Event,
    restore: () => {
      if (previousDescriptor) Object.defineProperty(globalThis, 'HTMLInputElement', previousDescriptor)
      else Reflect.deleteProperty(globalThis, 'HTMLInputElement')
    },
  }
}

function makeFileActions(initial: LocalWorkspace, options: {
  maxBytes?: number
  confirmCapacity?: (details: WorkspaceHistoryCapacityDetails, signal: AbortSignal) => Promise<boolean>
  resolveImportDefinitionChanges?: (fieldIds: string[]) => Promise<boolean>
} = {}) {
  const workspace = ref<LocalWorkspace | null>(createWorkspaceSnapshot(initial))
  let revision = 0
  const history = createWorkspaceHistoryCoordinator({
    getWorkspace: () => workspace.value,
    getRevision: () => revision,
    publishWorkspace: next => {
      workspace.value = createWorkspaceSnapshot(next)
      revision += 1
      return { durable: Promise.resolve() }
    },
    getTraversalBlockReason: () => null,
    confirmCapacity: options.confirmCapacity ?? (async () => false),
    limits: { maxBytes: options.maxBytes ?? 33_554_432 },
  })
  const files = useWorkspaceFiles({
    workspace,
    selectedSystem: computed(() => workspace.value?.cluster.systems[0]),
    mutations: history,
    getCurrentMapImage: () => null,
    getFieldDefinitionImportConflict: () => null,
    resolveImportDefinitionChanges: options.resolveImportDefinitionChanges ?? (async () => true),
  })
  return {
    workspace,
    history,
    files,
    get revision() { return revision },
    replaceWorkspace(next: LocalWorkspace) {
      workspace.value = createWorkspaceSnapshot(next)
      revision += 1
    },
  }
}

function makeCascadeWorkspace(): LocalWorkspace {
  let workspace = createLocalWorkspace('Kestrel Reach', 'A')
  const systemA = workspace.cluster.systems[0]!
  const systemBResult = addStarSystem(workspace, 'B')
  workspace = systemBResult.workspace
  const systemB = systemBResult.system

  const star = systemA.objects[0]!
  let system = systemA
  const host = { ...createSystemObject(system, 'planet'), name: 'Herma' }
  system = { ...system, objects: [...system.objects, host] }
  const outer = createOrbit(system, host.id)
  const outerSibling = createOrbit({ ...system, orbits: [outer] }, host.id)
  system = { ...system, orbits: [outer, outerSibling] }

  const branch = { ...createSystemObject(system, 'planet', outer.id), name: 'Iria' }
  system = { ...system, objects: [...system.objects, branch] }
  const inner = createOrbit(system, branch.id)
  system = { ...system, orbits: [...system.orbits, inner] }
  const station = { ...createSystemObject(system, 'station', inner.id), name: 'Relay Station' }
  system = { ...system, objects: [...system.objects, station] }
  const lostPoint = { ...createSystemObject(system, 'jump-point', inner.id), name: 'Lost Gate', jumpStationId: station.id }
  system = { ...system, objects: [...system.objects, lostPoint] }
  const survivingPoint = {
    ...createSystemObject(system, 'jump-point'),
    name: 'Surviving Gate',
    jumpStationId: station.id,
  }
  system = { ...system, objects: [...system.objects, survivingPoint] }

  const destination = { ...createSystemObject(systemB, 'jump-point'), name: 'B Gate' }
  systemB.objects.push(destination)
  const systemsWithEntities = workspace.cluster.systems.map(candidate =>
    candidate.id === system.id ? system : candidate.id === systemB.id ? systemB : candidate)
  const clusterWithEntities = { ...workspace.cluster, systems: systemsWithEntities }
  workspace = {
    ...workspace,
    cluster: {
      ...workspace.cluster,
      systems: systemsWithEntities,
      routes: [
        createJumpRoute(clusterWithEntities, 1, lostPoint.id, destination.id),
        createJumpRoute(clusterWithEntities, 2, survivingPoint.id, destination.id),
      ],
    },
    layout: {
      ...workspace.layout,
      orbitRadii: {
        [outer.id]: { horizontal: 180, vertical: 150 },
        [outerSibling.id]: { horizontal: 260, vertical: 230 },
        [inner.id]: { horizontal: 70, vertical: 60 },
      },
      orbitRotations: { [outer.id]: 23, [inner.id]: 17 },
      objectAngles: { [branch.id]: 0.7, [station.id]: 1.1, [lostPoint.id]: 2.2 },
    },
  }
  if (!star || !isLocalWorkspace(workspace)) throw new Error('The deletion round-trip fixture is invalid.')
  return createWorkspaceSnapshot(workspace)
}

function makeFieldWorkspace(): LocalWorkspace {
  const workspace = createLocalWorkspace('Kestrel Reach', 'Vesper')
  const system = workspace.cluster.systems[0]!
  const object = system.objects[0]!
  const customFields = [
    { id: 'notes', name: 'Campaign notes', type: 'text' as const },
    { id: 'threat', name: 'Threat', type: 'number' as const },
    { id: 'known', name: 'Known', type: 'boolean' as const },
  ]
  return createWorkspaceSnapshot({
    ...workspace,
    cluster: {
      ...workspace.cluster,
      systems: [{
        ...system,
        objects: [{
          ...object,
          customFieldValues: { notes: '', threat: 0, known: false },
        }],
      }],
    },
    objectFieldSettings: { ...workspace.objectFieldSettings, customFields },
  })
}

function makeHistory(initial: LocalWorkspace) {
  let current = createWorkspaceSnapshot(initial)
  let revision = 0
  const history = createWorkspaceHistoryCoordinator({
    getWorkspace: () => current,
    getRevision: () => revision,
    publishWorkspace: (next) => {
      current = createWorkspaceSnapshot(next)
      revision += 1
      return { durable: Promise.resolve() }
    },
    getTraversalBlockReason: () => null,
    confirmCapacity: async () => false,
  })
  return {
    history,
    get current() { return current },
    dispose: () => history.dispose(),
  }
}

test('Orbit deletion round-trips its nested cascade, station links, routes, order and geometry through workspace history @pure', async () => {
  const initial = makeCascadeWorkspace()
  const system = initial.cluster.systems[0]!
  const host = system.objects.find(object => object.name === 'Herma')!
  const outer = system.orbits.find(orbit => orbit.hostId === host.id && orbit.order === 1)!
  const before = createWorkspaceSnapshot(initial)
  const harness = makeHistory(initial)
  const action = {
    kind: 'delete' as const,
    label: 'Delete Orbit 1 around Herma',
    target: { kind: 'orbit' as const, id: outer.id, systemId: system.id },
    parent: { kind: 'object' as const, id: host.id, systemId: system.id },
  }

  const applied = await harness.history.execute({
    action,
    prepare: current => {
      const next = planMapEntityDeletion(current, { kind: 'orbit', systemId: system.id, orbitId: outer.id }).workspace
      if (!isLocalWorkspace(next)) throw new Error('The deletion did not produce a valid workspace.')
      return next
    },
  })
  expect(applied.status).toBe('applied')
  if (applied.status !== 'applied') throw new Error('The reviewed deletion was not applied.')
  await applied.durable

  const deletion = harness.current
  const survivingSystem = deletion.cluster.systems.find(candidate => candidate.id === system.id)!
  expect(survivingSystem.objects.map(object => object.name)).toEqual(['Primary Star', 'Herma', 'Surviving Gate'])
  expect(survivingSystem.orbits).toEqual([{ ...system.orbits[1], order: 1 }])
  expect(deletion.cluster.routes.map(route => route.fromPointId)).toEqual([
    system.objects.find(object => object.name === 'Surviving Gate')!.id,
  ])
  expect(survivingSystem.objects.find(object => object.name === 'Surviving Gate')?.jumpStationId).toBeNull()
  expect(deletion.layout).toEqual({
    ...before.layout,
    orbitRadii: { [system.orbits[1]!.id]: before.layout.orbitRadii[system.orbits[1]!.id]! },
    orbitRotations: {},
    objectAngles: {},
  })

  const undone = await harness.history.undo()
  expect(undone.status).toBe('applied')
  if (undone.status === 'applied') await undone.durable
  expect(harness.current).toEqual(before)

  const redone = await harness.history.redo()
  expect(redone.status).toBe('applied')
  if (redone.status === 'applied') await redone.durable
  expect(harness.current).toEqual(deletion)
  expect(harness.current.cluster.systems[0]?.objects.find(object => object.name === 'Lost Gate')).toBeUndefined()
  harness.dispose()
})

test('destructive Fields changes restore empty, zero and false values with the same definition on Undo and Redo @pure', async () => {
  const initial = makeFieldWorkspace()
  const before = createWorkspaceSnapshot(initial)
  const harness = makeHistory(initial)
  const execute = async (
    fieldId: string,
    label: string,
    prepare: (workspace: LocalWorkspace) => LocalWorkspace,
  ) => {
    const result = await harness.history.execute({
      action: {
        kind: 'update',
        label,
        target: { kind: 'field', id: fieldId },
        parent: { kind: 'cluster', id: initial.cluster.id },
      },
      prepare: current => {
        const next = prepare(current)
        if (!isLocalWorkspace(next)) throw new Error('The field change did not produce a valid workspace.')
        return next
      },
    })
    expect(result.status).toBe('applied')
    if (result.status !== 'applied') throw new Error('The field change was not applied.')
    await result.durable
  }

  await execute('threat', 'Change Threat type', workspace =>
    updateCustomFieldType(workspace, 'threat', 'text', [], true))
  expect(harness.current.cluster.systems[0]?.objects[0]?.customFieldValues).toEqual({ notes: '', known: false })
  await execute('notes', 'Delete Campaign notes', workspace =>
    removeCustomFieldDefinition(workspace, 'notes'))
  expect(harness.current.cluster.systems[0]?.objects[0]?.customFieldValues).toEqual({ known: false })

  for (const expected of [
    { notes: '', known: false },
    { notes: '', threat: 0, known: false },
  ]) {
    const undone = await harness.history.undo()
    expect(undone.status).toBe('applied')
    if (undone.status === 'applied') await undone.durable
    expect(harness.current.cluster.systems[0]?.objects[0]?.customFieldValues).toEqual(expected)
  }
  expect(harness.current.objectFieldSettings.customFields).toEqual(before.objectFieldSettings.customFields)
  expect(harness.current).toEqual(before)

  for (const expected of [
    { notes: '', known: false },
    { known: false },
  ]) {
    const redone = await harness.history.redo()
    expect(redone.status).toBe('applied')
    if (redone.status === 'applied') await redone.durable
    expect(harness.current.cluster.systems[0]?.objects[0]?.customFieldValues).toEqual(expected)
  }
  harness.dispose()
})

test('cluster import keeps its remapped copy and shared options on one exact history edge, while export preserves Redo @pure', async () => {
  const initial = makeFieldWorkspace()
  const source = addStarSystem(createLocalWorkspace('Far Reach', 'Iria'), 'Far Vesper').workspace
  const sourceOriginSystem = source.cluster.systems[0]!
  const sourceSystem = source.cluster.systems[1]!
  const sourceOrigin = { ...createSystemObject(sourceOriginSystem, 'jump-point'), name: 'Alpha Gate' }
  const sourceStation = {
    ...createSystemObject(sourceSystem, 'station'),
    name: 'Relay Station',
    customFieldValues: { 'incoming-notes': 'Arrived with the copy.' },
  }
  const sourceJumpPoint = { ...createSystemObject({ ...sourceSystem, objects: [...sourceSystem.objects, sourceStation] }, 'jump-point'), name: 'Beta Gate' }
  const sourceCluster = {
    ...source.cluster,
    systems: source.cluster.systems.map(system => system.id === sourceSystem.id
      ? { ...system, objects: [...system.objects, sourceStation, sourceJumpPoint] }
      : system.id === sourceOriginSystem.id
        ? { ...system, objects: [...system.objects, sourceOrigin] }
        : system),
  }
  const sourceWithPoints = {
    ...source,
    cluster: sourceCluster,
  }
  const sourceWithRoute = {
    ...sourceWithPoints,
    cluster: {
      ...sourceWithPoints.cluster,
      routes: [createJumpRoute(sourceWithPoints.cluster, 4, sourceOrigin.id, sourceJumpPoint.id)],
    },
  }
  const sourceWithSettings = {
    ...sourceWithRoute,
    objectFieldSettings: {
      ...source.objectFieldSettings,
      atmosphereOptions: [...source.objectFieldSettings.atmosphereOptions, 'Cryogenic'],
      customFields: [{
        id: 'incoming-notes', name: 'Campaign notes', type: 'text' as const,
        applicability: [{ kind: 'category' as const, family: 'Installation' as const }],
      }],
    },
    layout: { ...source.layout, systemPositions: { ...source.layout.systemPositions, [sourceSystem.id]: { x: 0.82, y: 0.27 } } },
  }
  const before = createWorkspaceSnapshot(initial)
  before.objectFieldSettings.customFields[0]!.applicability = [
    { kind: 'category', family: 'CelestialBody' },
  ]
  const validatedBefore = createWorkspaceSnapshot(before)
  const exportedBefore = exportJumpCluster(validatedBefore)
  const sourceExport = exportJumpCluster(sourceWithSettings)
  const harness = makeHistory(validatedBefore)
  const applied = await harness.history.execute({
    action: {
      kind: 'import', label: 'Import independent copy',
      target: { kind: 'cluster', id: initial.cluster.id },
    },
    prepare: current => {
      const next = prepareJsonImport(current, sourceExport).workspace
      if (!isLocalWorkspace(next)) throw new Error('The import did not produce a valid workspace.')
      return next
    },
  })
  expect(applied.status).toBe('applied')
  if (applied.status !== 'applied') throw new Error('The import was not applied.')
  await applied.durable

  const imported = createWorkspaceSnapshot(harness.current)
  const importedSystem = imported.cluster.systems.find(system => system.name === 'Far Vesper')!
  const importedPoint = importedSystem.objects.find(object => object.name === 'Beta Gate')!
  expect(importedSystem.id).not.toBe(sourceSystem.id)
  expect(importedPoint.id).not.toBe(sourceJumpPoint.id)
  expect(imported.objectFieldSettings.atmosphereOptions).toContain('Cryogenic')
  expect(imported.cluster.routes).toHaveLength(1)
  const importedRoute = imported.cluster.routes[0]!
  expect(importedRoute.fromPointId).toBe(imported.cluster.systems.find(system => system.name === 'Iria')!
    .objects.find(object => object.name === 'Alpha Gate')!.id)
  expect(importedRoute.toPointId).toBe(importedPoint.id)
  expect(imported.objectFieldSettings.customFields[0]?.applicability).toEqual([
    { kind: 'category', family: 'CelestialBody' },
    { kind: 'category', family: 'Installation' },
  ])
  expect(importedSystem.objects.find(object => object.name === 'Relay Station')?.customFieldValues)
    .toEqual({ [imported.objectFieldSettings.customFields[0]!.id]: 'Arrived with the copy.' })
  expect(imported.layout.systemPositions[importedSystem.id]).toEqual({ x: 0.82, y: 0.27 })

  const undone = await harness.history.undo()
  expect(undone.status).toBe('applied')
  if (undone.status === 'applied') await undone.durable
  expect(harness.current).toEqual(validatedBefore)
  expect(exportJumpCluster(harness.current)).toEqual(exportedBefore)

  // Creating a portable projection while Redo is available does not traverse or replace the timeline.
  const exportedDuringRedo = exportJumpCluster(harness.current)
  expect(exportedDuringRedo).toEqual(exportedBefore)
  expect(harness.history.getStatus().redoDepth).toBe(1)
  const redone = await harness.history.redo()
  expect(redone.status).toBe('applied')
  if (redone.status === 'applied') await redone.durable
  expect(harness.current).toEqual(imported)
  harness.dispose()
})

test('standalone-system import can be undone and redone without adding its copied data to Cluster routes @pure', async () => {
  const initial = createWorkspaceSnapshot(createLocalWorkspace('Kestrel Reach', 'Vesper'))
  const source = createWorkspaceSnapshot(addStarSystem(initial, 'Distant Reach').workspace)
  const standalone = exportStarSystem(source, source.cluster.systems[1]!.id)
  const before = createWorkspaceSnapshot(initial)
  const harness = makeHistory(initial)
  const applied = await harness.history.execute({
    action: {
      kind: 'import', label: 'Import independent copy',
      target: { kind: 'cluster', id: initial.cluster.id },
    },
    prepare: current => {
      const next = prepareJsonImport(current, standalone).workspace
      if (!isLocalWorkspace(next)) throw new Error('The standalone import did not produce a valid workspace.')
      return next
    },
  })
  expect(applied.status).toBe('applied')
  if (applied.status !== 'applied') throw new Error('The standalone import was not applied.')
  await applied.durable
  const imported = createWorkspaceSnapshot(harness.current)
  expect(imported.cluster.systems).toHaveLength(2)
  expect(imported.cluster.routes).toEqual([])
  expect(imported.cluster.systems[1]?.id).not.toBe(standalone.system.id)
  expect(imported.cluster.systems[1]?.objects[0]?.id).not.toBe(standalone.system.objects[0]?.id)

  const undone = await harness.history.undo()
  expect(undone.status).toBe('applied')
  if (undone.status === 'applied') await undone.durable
  expect(harness.current).toEqual(before)
  const redone = await harness.history.redo()
  expect(redone.status).toBe('applied')
  if (redone.status === 'applied') await redone.durable
  expect(harness.current).toEqual(imported)
  harness.dispose()
})

test('an import reopens consequence review when shared Fields change while draft resolution is awaited @pure', async () => {
  const initial = createLocalWorkspace('Kestrel Reach', 'Vesper')
  initial.objectFieldSettings.customFields = [{
    id: 'shared-notes', name: 'Campaign notes', type: 'text',
    applicability: [{ kind: 'category', family: 'CelestialBody' }],
  }]
  const source = createLocalWorkspace('Far Reach', 'Iria')
  const sourceSystem = source.cluster.systems[0]!
  const station = {
    ...createSystemObject(sourceSystem, 'station'),
    name: 'Relay Station',
    customFieldValues: { 'incoming-notes': 'Station field value.' },
  }
  const sourceMap = {
    ...source,
    cluster: {
      ...source.cluster,
      systems: [{ ...sourceSystem, objects: [...sourceSystem.objects, station] }],
    },
    objectFieldSettings: {
      ...source.objectFieldSettings,
      customFields: [{
        id: 'incoming-notes', name: 'Campaign notes', type: 'text' as const,
        applicability: [{ kind: 'category' as const, family: 'Installation' as const }],
      }],
    },
  }

  let resolverCalls = 0
  const harness = makeFileActions(initial, {
    resolveImportDefinitionChanges: async (fieldIds) => {
      resolverCalls += 1
      expect(fieldIds).toEqual(['shared-notes'])
      const changedDefinition = await harness.history.execute({
        action: {
          kind: 'update', label: 'Change Campaign notes applicability',
          target: { kind: 'field', id: 'shared-notes' },
          parent: { kind: 'cluster', id: initial.cluster.id },
        },
        prepare: current => updateCustomFieldApplicability(current, 'shared-notes', [
          { kind: 'category', family: 'Installation' },
        ]),
      })
      expect(changedDefinition.status).toBe('applied')
      if (changedDefinition.status === 'applied') await changedDefinition.durable
      return true
    },
  })
  const input = fakeImportInput(JSON.stringify(exportJumpCluster(sourceMap)))

  try {
    await harness.files.importJsonFile(input.event)
    expect(harness.files.importReview.value.open).toBe(true)
    const importAttempt = harness.files.confirmJsonImport()
    await importAttempt
    expect(resolverCalls).toBe(1)
    expect(harness.workspace.value?.cluster.systems).toHaveLength(1)
    expect(harness.workspace.value?.objectFieldSettings.customFields[0]?.applicability)
      .toEqual([{ kind: 'category', family: 'Installation' }])
    expect(harness.files.importReview.value).toMatchObject({
      open: true,
      confirming: false,
      error: 'The workspace changed while resolving a draft. Review the updated effects before importing.',
    })

    await harness.files.confirmJsonImport()
    expect(resolverCalls).toBe(1)
    expect(harness.files.importReview.value.open).toBe(false)
    const importedSystem = harness.workspace.value?.cluster.systems.find(system => system.name === 'Iria')
    expect(importedSystem?.objects.find(object => object.name === 'Relay Station')?.customFieldValues)
      .toEqual({ 'shared-notes': 'Station field value.' })
    expect(harness.history.getStatus()).toMatchObject({ undoDepth: 2, redoDepth: 0 })

    const undoImport = await harness.history.undo()
    expect(undoImport.status).toBe('applied')
    if (undoImport.status === 'applied') await undoImport.durable
    expect(harness.workspace.value?.cluster.systems).toHaveLength(1)
    const undoFieldChange = await harness.history.undo()
    expect(undoFieldChange.status).toBe('applied')
    if (undoFieldChange.status === 'applied') await undoFieldChange.durable
    expect(harness.workspace.value?.objectFieldSettings.customFields[0]?.applicability)
      .toEqual([{ kind: 'category', family: 'CelestialBody' }])
  } finally {
    input.restore()
    harness.history.dispose()
  }
})

test('an import capacity cancellation keeps the reviewed copy available without publishing it @pure', async () => {
  let settleCapacity: ((accepted: boolean) => void) | undefined
  const initial = createLocalWorkspace('Kestrel Reach', 'Vesper')
  const source = createLocalWorkspace('Far Reach', 'Iria')
  const harness = makeFileActions(initial, {
    maxBytes: 1,
    confirmCapacity: () => new Promise<boolean>((resolve) => { settleCapacity = resolve }),
  })
  const input = fakeImportInput(JSON.stringify(exportJumpCluster(source)))

  try {
    await harness.files.importJsonFile(input.event)
    const confirmation = harness.files.confirmJsonImport()
    await Promise.resolve()
    expect(harness.history.getStatus()).toMatchObject({ isBusy: true, isConfirmingCapacity: true })
    settleCapacity?.(false)
    await confirmation
    expect(harness.workspace.value).toEqual(createWorkspaceSnapshot(initial))
    expect(harness.history.getStatus()).toMatchObject({ totalActions: 0, undoDepth: 0, redoDepth: 0 })
    expect(harness.files.importReview.value).toMatchObject({
      open: true,
      confirming: false,
      error: 'The action was canceled; the workspace and retained history were left unchanged.',
    })
  } finally {
    input.restore()
    harness.history.dispose()
  }
})

test('a stale import capacity answer cannot publish into a replacement workspace @pure', async () => {
  let settleCapacity: ((accepted: boolean) => void) | undefined
  const initial = createLocalWorkspace('Kestrel Reach', 'Vesper')
  const replacement = createLocalWorkspace('New Reach', 'Different System')
  const source = createLocalWorkspace('Far Reach', 'Iria')
  const harness = makeFileActions(initial, {
    maxBytes: 1,
    confirmCapacity: () => new Promise<boolean>((resolve) => { settleCapacity = resolve }),
  })
  const input = fakeImportInput(JSON.stringify(exportJumpCluster(source)))

  try {
    await harness.files.importJsonFile(input.event)
    const confirmation = harness.files.confirmJsonImport()
    await Promise.resolve()
    expect(harness.history.getStatus().isConfirmingCapacity).toBe(true)
    harness.replaceWorkspace(replacement)
    harness.history.getStatus()
    settleCapacity?.(true)
    await confirmation
    expect(harness.workspace.value).toEqual(createWorkspaceSnapshot(replacement))
    expect(harness.history.getStatus()).toMatchObject({ totalActions: 0, undoDepth: 0, redoDepth: 0 })
    expect(harness.files.importReview.value.open).toBe(false)
    expect(harness.files.importReview.value.error).toBe('')
  } finally {
    input.restore()
    harness.history.dispose()
  }
})

test('a reviewed JSON import can be undone and redone without changing the remapped IDs or export data', async ({ page }) => {
  await captureMapExportBlobs(page)
  await createSingleSystemWorkspace(page)
  await returnToClusterMap(page)
  const before = await downloadJson(page, 'Export Jump Cluster JSON')
  await setJsonFile(jsonMapImportInput(page), 'cluster-copy.json', JSON.stringify(before))
  await resolveImportReview(importReviewDialog(page), 'confirm')
  await waitForWorkspaceSaved(page)

  const after = await downloadJson(page, 'Export Jump Cluster JSON')
  expect(after.cluster?.systems).toHaveLength(2)
  const importedSystem = after.cluster!.systems[1]!
  expect(importedSystem.id).not.toBe(before.cluster!.systems[0]!.id)
  const importedIds = [
    importedSystem.id,
    ...importedSystem.objects.map(object => object.id),
    ...importedSystem.orbits.map(orbit => orbit.id),
  ]
  expect(after).not.toHaveProperty('history')

  const undo = page.getByRole('button', { name: /^Undo(?:\b|:)/ })
  const redo = page.getByRole('button', { name: /^Redo(?:\b|:)/ })
  await expect(undo).toBeEnabled()
  await undo.click()
  await waitForWorkspaceSaved(page)
  expect(await downloadJson(page, 'Export Jump Cluster JSON')).toEqual(before)
  await expect(redo).toBeEnabled()

  await redo.click()
  await waitForWorkspaceSaved(page)
  const replayed = await downloadJson(page, 'Export Jump Cluster JSON')
  expect(replayed).toEqual(after)
  expect([
    replayed.cluster!.systems[1]!.id,
    ...replayed.cluster!.systems[1]!.objects.map(object => object.id),
    ...replayed.cluster!.systems[1]!.orbits.map(orbit => orbit.id),
  ]).toEqual(importedIds)
  await expect(undo).toBeEnabled()
  await expect(redo).toBeDisabled()
})

test('reviewed system deletion restores the same cascade through the editor Undo and Redo commands', async ({ page }) => {
  test.setTimeout(60_000)
  await captureMapExportBlobs(page)
  await createSingleSystemWorkspace(page)
  await returnToClusterMap(page)
  await addClusterSystem(page)
  const before = await downloadJson(page, 'Export Jump Cluster JSON')
  await openWorkspaceHierarchy(page, 'Jump Cluster contents')
  const deletion = page.getByRole('button', { name: 'Delete New System 2 system', exact: true })
  await deletion.click()
  const review = page.getByRole('dialog', { name: 'Review deletion', exact: true })
  await expect(review).toBeVisible()
  await review.getByRole('button', { name: 'Confirm deletion', exact: true }).click()
  await expect(review).toBeHidden()
  await waitForWorkspaceSaved(page)
  const after = await downloadJson(page, 'Export Jump Cluster JSON')
  expect(after.cluster?.systems.map(system => system.name)).toEqual(['Vesper'])

  const undo = page.getByRole('button', { name: /^Undo(?:\b|:)/ })
  const redo = page.getByRole('button', { name: /^Redo(?:\b|:)/ })
  await undo.click()
  await waitForWorkspaceSaved(page)
  expect(await downloadJson(page, 'Export Jump Cluster JSON')).toEqual(before)
  await expect(redo).toBeEnabled()
  await redo.click()
  await waitForWorkspaceSaved(page)
  expect(await downloadJson(page, 'Export Jump Cluster JSON')).toEqual(after)
})

test('reviewed destructive Field change restores exact values through the editor Undo and Redo commands', async ({ page }) => {
  test.setTimeout(60_000)
  await captureMapExportBlobs(page)
  await createSingleSystemWorkspace(page)
  await setJsonFile(jsonMapImportInput(page), 'falsy-fields.json', JSON.stringify(exportJumpCluster(makeFieldWorkspace())))
  await resolveImportReview(importReviewDialog(page), 'confirm')
  await waitForWorkspaceSaved(page)
  await returnToClusterMap(page)
  const afterImport = await downloadJson(page, 'Export Jump Cluster JSON')
  const importedSystem = afterImport.cluster!.systems[1]!
  const fieldId = afterImport.objectFieldSettings.customFields.find(field => field.name === 'Threat')!.id
  expect(importedSystem.objects[0]?.customFieldValues?.[fieldId]).toBe(0)

  await setWorkspaceMapMode(page, 'Navigate')
  const clusterMap = page.getByRole('group', { name: 'Kestrel Reach Jump Cluster map', exact: true })
  await clusterMap.getByRole('button', { name: 'Open Vesper system map', exact: true }).last().click()
  await expect(page.getByRole('group', { name: 'Vesper star system map', exact: true })).toBeVisible()
  const hierarchy = await openWorkspaceHierarchy(page)
  await hierarchy.getByRole('button', { name: 'Select A, Primary Star', exact: true }).last().click()
  const dialog = await openFieldDefinitionDialog(page)
  await dialog.getByRole('button', { name: /Threat/ }).click()
  await editFieldDefinition(dialog)
  await dialog.getByLabel('Value type').click()
  await page.getByRole('option', { name: 'Text', exact: true }).click()
  await dialog.getByRole('button', { name: 'Apply field changes', exact: true }).click()
  const review = dialog.getByRole('region', { name: 'Field change review', exact: true })
  await expect(review).toBeVisible()
  await expect(review).toContainText('Threat')
  await dialog.getByRole('button', { name: 'Apply field changes', exact: true }).last().click()
  await expect(dialog.getByRole('region', { name: 'Field change review', exact: true })).toBeHidden()
  await waitForWorkspaceSaved(page)
  await dialog.getByRole('button', { name: 'Close field definitions', exact: true }).click()
  await expect(dialog).toBeHidden()
  await returnToClusterMap(page)
  const afterChange = await downloadJson(page, 'Export Jump Cluster JSON')
  expect(afterChange.objectFieldSettings.customFields.find(field => field.id === fieldId)?.type).toBe('text')
  expect(afterChange.cluster!.systems[1]!.objects[0]?.customFieldValues?.[fieldId]).toBeUndefined()

  const undo = page.getByRole('button', { name: /^Undo(?:\b|:)/ })
  const redo = page.getByRole('button', { name: /^Redo(?:\b|:)/ })
  await undo.click()
  await waitForWorkspaceSaved(page)
  expect(await downloadJson(page, 'Export Jump Cluster JSON')).toEqual(afterImport)
  await expect(redo).toBeEnabled()
  await redo.click()
  await waitForWorkspaceSaved(page)
  expect(await downloadJson(page, 'Export Jump Cluster JSON')).toEqual(afterChange)
})
