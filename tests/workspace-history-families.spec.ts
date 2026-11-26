import { expect, test } from './fixtures'
import { addZoneWithPrimaryStar, createWorkspaceWithPrimaryStar } from './support/primary-star-fixture'
import { workspaceWithRouteObjects } from './support/route-objects-fixture'
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
  restoreLocalWorkspace,
  updateCustomFieldApplicability,
  updateCustomFieldType,
  type LocalWorkspace,
  type StarSystem,
} from '../domain/workspace'
import { createWorkspaceHistoryCoordinator } from '../composables/editor-workflows/workspace-mutations'
import { useRouteInspectorSession } from '../composables/editor-workflows/useRouteInspectorSession'
import type { WorkspaceHistoryCapacityDetails } from '../composables/editor-workflows/workspace-mutations'
import { useWorkspaceFiles } from '../composables/useWorkspaceFiles'
import { createWorkspaceSnapshot } from '../utils/workspace-storage'
import { projectWardenSystem } from '../utils/continuous-map-projection'
import {
  waitForWorkspaceSaved,
  captureMapExportBlobs,
  createSingleSystemWorkspace,
  downloadJson,
  fitWorkspaceMap,
  resolveJumpClusterRestoreReview,
  reviewJumpClusterBackup,
  wardenSystemMark,
} from './helpers'

function fakeImportInput(content: string, readContent: () => Promise<string> = async () => content): { event: Event; restore(): void } {
  const previousDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'HTMLInputElement')
  class TestInput {
    value = 'map.json'
    files = [{ text: readContent }]
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

test('standalone import previews a detached placement that can be moved and canceled @pure', async () => {
  const initial = createLocalWorkspace('Kestrel Reach', 'Vesper')
  const source = createLocalWorkspace('Far Reach', 'Iria')
  const sourceSystem = source.cluster.systems[0]
  if (!sourceSystem) throw new Error('The standalone import fixture needs a source system.')
  const harness = makeFileActions(initial)
  const input = fakeImportInput(JSON.stringify(exportStarSystem(source, sourceSystem.id)))
  const before = createWorkspaceSnapshot(initial)
  const chosenAnchor = { x: -1.2, y: 1.8 }

  try {
    await harness.files.importJsonFile(input.event)
    expect(harness.files.importReview.value.open).toBe(false)
    expect(harness.files.standaloneImportPlacementEnabled.value).toBe(true)
    const placement = harness.files.standaloneImportPlacement.value
    expect(placement?.system.name).toBe('Iria')
    expect(placement?.system.id).not.toBe(sourceSystem.id)
    expect(placement?.anchor).toEqual({ x: 0.5, y: 0.35 })

    expect(harness.files.previewStandaloneImportAnchor({ x: Number.POSITIVE_INFINITY, y: 0 })).toBe(false)
    expect(harness.files.standaloneImportPlacement.value?.anchor).toEqual({ x: 0.5, y: 0.35 })
    expect(harness.files.previewStandaloneImportAnchor(chosenAnchor)).toBe(true)
    expect(harness.files.standaloneImportPlacement.value?.anchor).toEqual(chosenAnchor)
    expect(harness.workspace.value).toEqual(before)

    harness.files.cancelStandaloneImportPlacement()
    expect(harness.files.standaloneImportPlacementEnabled.value).toBe(false)
    expect(harness.files.standaloneImportPlacement.value).toBeNull()
    expect(harness.files.importReview.value.open).toBe(false)
    expect(harness.workspace.value).toEqual(before)
  } finally {
    input.restore()
    harness.history.dispose()
  }
})

test('legacy standalone placement reviews and applies the selected anchor with its complete rotated Orbit geometry @pure', async () => {
  const initial = createLocalWorkspace('Kestrel Reach', 'Vesper')
  const source = createWorkspaceWithPrimaryStar('Far Reach', 'Iria')
  const sourceSystem = source.cluster.systems[0]
  if (!sourceSystem) throw new Error('The legacy import fixture needs a source system.')
  const star = sourceSystem.objects[0]
  if (!star) throw new Error('The legacy import fixture needs its host star.')
  const orbit = createOrbit(sourceSystem, star.id)
  const systemWithOrbit = { ...sourceSystem, orbits: [orbit] }
  const distantPlanet = createSystemObject(systemWithOrbit, 'planet', orbit.id)
  const standaloneSystem = {
    ...systemWithOrbit,
    objects: [...sourceSystem.objects, distantPlanet],
  }
  const sourceWithGeometry = {
    ...source,
    cluster: { ...source.cluster, systems: [standaloneSystem] },
    layout: {
      ...source.layout,
      orbitRadii: { [orbit.id]: { horizontal: 4200, vertical: 1900 } },
      orbitRotations: { [orbit.id]: 31 },
      objectAngles: { [distantPlanet.id]: 1.1 },
    },
  }
  const legacyExport = JSON.parse(JSON.stringify(exportStarSystem(sourceWithGeometry, standaloneSystem.id))) as {
    version: number
    system: { objects: Array<Record<string, unknown>> }
  }
  legacyExport.version = 3
  for (const object of legacyExport.system.objects) {
    delete object.playerText
    delete object.playerFieldMasks
  }
  const harness = makeFileActions(initial)
  const input = fakeImportInput(JSON.stringify(legacyExport))
  const chosenAnchor = { x: -4.25, y: 1.75 }

  try {
    await harness.files.importJsonFile(input.event)
    const placement = harness.files.standaloneImportPlacement.value
    if (!placement) throw new Error('The legacy system should be available for placement.')
    expect(placement.system.id).not.toBe(standaloneSystem.id)
    const projectionSystem = JSON.parse(JSON.stringify(placement.system)) as StarSystem
    const projectionAnchor = { ...placement.anchor }
    const projectionGeometry = JSON.parse(JSON.stringify(placement.geometry)) as Parameters<typeof projectWardenSystem>[2]
    const projection = projectWardenSystem(projectionSystem, projectionAnchor, projectionGeometry)
    expect(projection.envelope.width).toBeGreaterThan(1000)
    expect(placement.geometry.orbitRotations).toEqual({ [placement.system.orbits[0]!.id]: 31 })
    expect(Object.values(placement.geometry.orbitRadii)).toEqual([{ horizontal: 4200, vertical: 1900 }])

    expect(harness.files.previewStandaloneImportAnchor(chosenAnchor)).toBe(true)
    harness.files.reviewStandaloneImportPlacement()
    expect(harness.files.importReview.value.open).toBe(true)
    expect(harness.files.standaloneImportPlacement.value).toBeNull()
    await harness.files.confirmJsonImport()

    const importedSystem = harness.workspace.value?.cluster.systems.find(system => system.name === 'Iria')
    if (!importedSystem) throw new Error('The confirmed system copy is missing from the Cluster.')
    const importedOrbit = importedSystem.orbits[0]
    expect(importedOrbit).toBeTruthy()
    expect(harness.workspace.value?.layout.systemPositions[importedSystem.id]).toEqual(chosenAnchor)
    expect(importedOrbit && harness.workspace.value?.layout.orbitRotations[importedOrbit.id]).toBe(31)
    expect(importedOrbit && harness.workspace.value?.layout.orbitRadii[importedOrbit.id])
      .toEqual({ horizontal: 4200, vertical: 1900 })

    const reopened = restoreLocalWorkspace(createWorkspaceSnapshot(harness.workspace.value!))
    expect(reopened?.layout.systemPositions[importedSystem.id]).toEqual(chosenAnchor)
    expect(importedOrbit && reopened?.layout.orbitRotations[importedOrbit.id]).toBe(31)
    expect(importedOrbit && reopened?.layout.orbitRadii[importedOrbit.id])
      .toEqual({ horizontal: 4200, vertical: 1900 })
  } finally {
    input.restore()
    harness.history.dispose()
  }
})

test('standalone placement cannot enter review after its captured workspace is replaced @pure', async () => {
  const initial = createLocalWorkspace('Kestrel Reach', 'Vesper')
  const replacement = createLocalWorkspace('New Reach', 'Different System')
  const source = createLocalWorkspace('Far Reach', 'Iria')
  const sourceSystem = source.cluster.systems[0]
  if (!sourceSystem) throw new Error('The stale placement fixture needs a source system.')
  const harness = makeFileActions(initial)
  const input = fakeImportInput(JSON.stringify(exportStarSystem(source, sourceSystem.id)))

  try {
    await harness.files.importJsonFile(input.event)
    expect(harness.files.standaloneImportPlacementEnabled.value).toBe(true)
    harness.replaceWorkspace(replacement)
    expect(harness.files.standaloneImportPlacementEnabled.value).toBe(false)
    harness.files.reviewStandaloneImportPlacement()

    expect(harness.files.standaloneImportPlacement.value).toBeNull()
    expect(harness.files.importReview.value.open).toBe(false)
    expect(harness.workspace.value).toEqual(createWorkspaceSnapshot(replacement))
  } finally {
    input.restore()
    harness.history.dispose()
  }
})

test('a workspace replacement while standalone file text is pending prevents placement admission @pure', async () => {
  const initial = createLocalWorkspace('Kestrel Reach', 'Vesper')
  const replacement = createLocalWorkspace('New Reach', 'Different System')
  const source = createLocalWorkspace('Far Reach', 'Iria')
  const sourceSystem = source.cluster.systems[0]
  if (!sourceSystem) throw new Error('The stale file-read fixture needs a source system.')
  let finishRead: ((text: string) => void) | undefined
  let markReadStarted: (() => void) | undefined
  const readStarted = new Promise<void>((resolve) => { markReadStarted = resolve })
  const input = fakeImportInput(
    JSON.stringify(exportStarSystem(source, sourceSystem.id)),
    () => new Promise<string>((resolve) => {
      finishRead = resolve
      markReadStarted?.()
    }),
  )
  const harness = makeFileActions(initial)

  try {
    const importAttempt = harness.files.importJsonFile(input.event)
    await readStarted
    harness.replaceWorkspace(replacement)
    finishRead?.(JSON.stringify(exportStarSystem(source, sourceSystem.id)))
    await importAttempt

    expect(harness.files.standaloneImportPlacement.value).toBeNull()
    expect(harness.files.importReview.value.open).toBe(false)
    expect(harness.workspace.value).toEqual(createWorkspaceSnapshot(replacement))
  } finally {
    input.restore()
    harness.history.dispose()
  }
})

function makeCascadeWorkspace(): LocalWorkspace {
  let workspace = createWorkspaceWithPrimaryStar('Kestrel Reach', 'A')
  const systemA = workspace.cluster.systems[0]!
  const systemBResult = addZoneWithPrimaryStar(workspace, 'B')
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

  const destination = { ...createSystemObject(systemB, 'jump-point'), name: 'B Gate', locationKey: 'JP-03' }
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
  const workspace = createWorkspaceWithPrimaryStar('Kestrel Reach', 'Vesper')
  const system = workspace.cluster.systems[0]!
  const object = system.objects[0]!
  const customFields = [
    { id: 'notes', name: 'Campaign notes', type: 'text' as const, playerShared: false },
    { id: 'threat', name: 'Threat', type: 'number' as const, playerShared: false },
    { id: 'known', name: 'Known', type: 'boolean' as const, playerShared: false },
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
  const workspace = ref<LocalWorkspace>(createWorkspaceSnapshot(initial))
  let revision = 0
  const history = createWorkspaceHistoryCoordinator({
    getWorkspace: () => workspace.value,
    getRevision: () => revision,
    publishWorkspace: (next) => {
      workspace.value = createWorkspaceSnapshot(next)
      revision += 1
      return { durable: Promise.resolve() }
    },
    getTraversalBlockReason: () => null,
    confirmCapacity: async () => false,
  })
  return {
    history,
    workspace,
    get current() { return workspace.value },
    dispose: () => history.dispose(),
  }
}

test('a route Inspector reversal complements root progression in the preview and one reversible edit @pure', async () => {
  const { workspace, route, root, occupant, branch } = workspaceWithRouteObjects()
  const harness = makeHistory(workspace)
  const inspector = useRouteInspectorSession({ workspace: harness.workspace, mutations: harness.history })
  try {
    const session = inspector.beginRouteSession(route.id)!
    inspector.reverseRouteEndpoints(session)

    const reversedBranch = {
      ...branch,
      objects: [{ ...root, placement: { kind: 'route', progression: 0.75 } }, occupant],
    }
    expect(inspector.projectDraft(harness.current)?.cluster.routeContents[route.id]).toEqual(reversedBranch)
    expect(harness.current).toEqual(workspace)
    expect(harness.history.getEntries()).toHaveLength(0)

    expect(await inspector.applyRouteSession(session)).toBe(true)
    const applied = harness.current
    expect(applied.cluster.routes[0]).toMatchObject({
      id: route.id, fromSystemId: route.toSystemId, toSystemId: route.fromSystemId,
    })
    expect(applied.cluster.routeContents[route.id]).toEqual(reversedBranch)
    expect(applied.layout).toEqual(workspace.layout)
    expect(harness.history.getEntries()).toHaveLength(1)

    expect((await harness.history.undo()).status).toBe('applied')
    expect(harness.current).toEqual(workspace)
    expect((await harness.history.redo()).status).toBe('applied')
    expect(harness.current).toEqual(applied)
  } finally {
    harness.dispose()
  }
})

test('route retargeting preserves fixed and moving objects at both progression endpoints @pure', async () => {
  const { workspace, route, root, occupant, branch } = workspaceWithRouteObjects()
  const fixed = {
    ...occupant,
    id: 'fixed-obstacle',
    name: 'Fixed obstacle',
    locationKey: 'AN-02',
    placement: { kind: 'route', progression: 1 } as const,
  }
  const contents = {
    ...branch,
    objects: [{ ...root, placement: { kind: 'route', progression: 0 } as const }, fixed, occupant],
  }
  const original: LocalWorkspace = {
    ...workspace,
    cluster: { ...workspace.cluster, routeContents: { [route.id]: contents } },
  }
  const harness = makeHistory(original)
  const inspector = useRouteInspectorSession({ workspace: harness.workspace, mutations: harness.history })
  try {
    const first = inspector.beginRouteSession(route.id)!
    inspector.updateRouteInput(first, 'destination', 'external')
    inspector.updateRouteInput(first, 'unresolvedExit', 'Far survey')
    expect(inspector.projectDraft(harness.current)?.cluster.routeContents[route.id]).toEqual(contents)
    expect(await inspector.applyRouteSession(first)).toBe(true)
    const unresolved = harness.current
    expect(unresolved.cluster.routes[0]).toMatchObject({ id: route.id, toSystemId: null, unresolvedExit: 'Far survey' })
    expect(unresolved.cluster.routeContents[route.id]).toEqual(contents)
    expect(unresolved.layout).toEqual(workspace.layout)

    const second = inspector.beginRouteSession(route.id)!
    inspector.updateRouteInput(second, 'toSystemId', route.fromSystemId)
    expect(await inspector.applyRouteSession(second)).toBe(false)
    expect(harness.current).toEqual(unresolved)
    expect(harness.history.getEntries()).toHaveLength(1)
    inspector.updateRouteInput(second, 'toSystemId', route.toSystemId!)
    expect(await inspector.applyRouteSession(second)).toBe(true)
    expect(harness.current).toEqual(original)
  } finally {
    harness.dispose()
  }
})

for (const kind of ['route', 'system'] as const) {
  test(`confirmed ${kind} deletion removes the complete occupied route and restores it through history @pure`, async () => {
    const { workspace, route, root, orbit, occupant, branch } = workspaceWithRouteObjects()
    const { workspace: withNeighbor, system: neighbor } = addStarSystem(workspace, 'Harrow')
    const unaffected = createJumpRoute(withNeighbor.cluster, {
      jumpLevel: 5,
      fromSystemId: neighbor.id,
      fromPointId: null,
      toSystemId: route.toSystemId!,
      toPointId: null,
    })
    const hazard = {
      ...root,
      id: 'frontier-debris',
      name: 'Frontier debris',
      locationKey: 'AN-02',
      family: occupant.family,
      subtype: occupant.subtype,
      placement: { kind: 'route', progression: 1 } as const,
    }
    withNeighbor.cluster.routes.push(unaffected)
    withNeighbor.cluster.routeContents[unaffected.id] = { objects: [hazard], orbits: [] }
    const before = createWorkspaceSnapshot(withNeighbor)
    const harness = makeHistory(before)
    const target = kind === 'route'
      ? { kind, routeId: route.id }
      : { kind, systemId: route.fromSystemId }
    const id = kind === 'route' ? route.id : route.fromSystemId
    try {
      const plan = planMapEntityDeletion(harness.current, target)
      expect(plan.affectedEntities).toEqual(expect.arrayContaining([
        'Survey vessel (Vessel, VES-01)',
        'Orbit 1 around Survey vessel',
        'Captured echo (Anomaly, AN-01)',
      ]))
      expect(plan.affectedEntities).not.toContain('Frontier debris (Anomaly, AN-02)')
      expect(plan.removedRouteIds).toEqual([route.id])
      expect(plan.removedObjectIds).toEqual([root.id, occupant.id])
      expect(plan.removedOrbitIds).toEqual([orbit.id])
      expect(harness.current).toEqual(before)
      expect(harness.history.getEntries()).toHaveLength(0)

      const result = await harness.history.execute({
        action: { kind: 'delete', label: 'Delete reviewed target', target: { kind, id } },
        prepare: current => planMapEntityDeletion(current, target).workspace,
      })
      expect(result.status).toBe('applied')
      const deleted = harness.current
      expect(isLocalWorkspace(deleted)).toBe(true)
      expect(deleted.cluster.routes).toEqual([unaffected])
      expect(deleted.cluster.routeContents).toEqual({
        [unaffected.id]: { objects: [hazard], orbits: [] },
      })
      expect({
        orbitRadii: deleted.layout.orbitRadii,
        orbitRotations: deleted.layout.orbitRotations,
        objectAngles: deleted.layout.objectAngles,
      }).toEqual({ orbitRadii: {}, orbitRotations: {}, objectAngles: {} })

      expect((await harness.history.undo()).status).toBe('applied')
      expect(harness.current).toEqual(before)
      expect(harness.current.cluster.routeContents[route.id]).toEqual(branch)
      expect((await harness.history.redo()).status).toBe('applied')
      expect(harness.current).toEqual(deleted)
    } finally {
      harness.dispose()
    }
  })
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
    null,
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
  const sourceJumpPoint = { ...createSystemObject({ ...sourceSystem, objects: [...sourceSystem.objects, sourceStation] }, 'jump-point'), name: 'Beta Gate', locationKey: 'JP-02' }
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
        id: 'incoming-notes', name: 'Campaign notes', type: 'text' as const, playerShared: false,
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
  const source = createWorkspaceSnapshot(addZoneWithPrimaryStar(initial, 'Distant Reach').workspace)
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
    id: 'shared-notes', name: 'Campaign notes', type: 'text', playerShared: false,
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
        id: 'incoming-notes', name: 'Campaign notes', type: 'text' as const, playerShared: false,
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
  const importSystem = sourceMap.cluster.systems[0]
  if (!importSystem) throw new Error('The import review fixture has no standalone system.')
  const input = fakeImportInput(JSON.stringify(exportStarSystem(sourceMap, importSystem.id)))

  try {
    await harness.files.importJsonFile(input.event)
    harness.files.reviewStandaloneImportPlacement()
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
  const sourceSystem = source.cluster.systems[0]
  if (!sourceSystem) throw new Error('The import capacity fixture has no standalone system.')
  const harness = makeFileActions(initial, {
    maxBytes: 1,
    confirmCapacity: () => new Promise<boolean>((resolve) => { settleCapacity = resolve }),
  })
  const input = fakeImportInput(JSON.stringify(exportStarSystem(source, sourceSystem.id)))

  try {
    await harness.files.importJsonFile(input.event)
    harness.files.reviewStandaloneImportPlacement()
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
  const sourceSystem = source.cluster.systems[0]
  if (!sourceSystem) throw new Error('The stale import capacity fixture has no standalone system.')
  const harness = makeFileActions(initial, {
    maxBytes: 1,
    confirmCapacity: () => new Promise<boolean>((resolve) => { settleCapacity = resolve }),
  })
  const input = fakeImportInput(JSON.stringify(exportStarSystem(source, sourceSystem.id)))

  try {
    await harness.files.importJsonFile(input.event)
    harness.files.reviewStandaloneImportPlacement()
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

test('focused map deletion reviews a seeded system cascade and Undo restores the complete Cluster', async ({ page }) => {
  test.setTimeout(60_000)
  await captureMapExportBlobs(page)
  await createSingleSystemWorkspace(page)
  const fixture = makeCascadeWorkspace()
  const { branch, workspace: occupiedRouteFixture } = workspaceWithRouteObjects()
  const occupiedRoute = fixture.cluster.routes[0]!
  fixture.cluster.routeContents[occupiedRoute.id] = branch
  Object.assign(fixture.layout.orbitRadii, occupiedRouteFixture.layout.orbitRadii)
  Object.assign(fixture.layout.orbitRotations, occupiedRouteFixture.layout.orbitRotations)
  Object.assign(fixture.layout.objectAngles, occupiedRouteFixture.layout.objectAngles)
  const restore = await reviewJumpClusterBackup(page, 'deletion-cascade.json', JSON.stringify(exportJumpCluster(fixture)))
  await resolveJumpClusterRestoreReview(restore, 'confirm')
  await waitForWorkspaceSaved(page)
  await fitWorkspaceMap(page)
  const before = await downloadJson(page, 'Export Jump Cluster JSON')
  const source = fixture.cluster.systems[0]!
  const target = wardenSystemMark(page, source.id)
  await target.focus()
  await expect(target).toBeFocused()
  const menu = page.getByRole('menu', { name: 'Map item actions', exact: true })
  const deletion = menu.getByRole('menuitem', { name: 'Delete', exact: true })
  const review = page.getByRole('dialog', { name: 'Review deletion', exact: true })
  const confirm = review.getByRole('button', { name: 'Confirm deletion', exact: true })
  const openReview = async () => {
    await target.press('Shift+F10')
    await expect(menu).toBeVisible()
    await expect(deletion).toBeEnabled()
    await deletion.focus()
    await expect(deletion).toBeFocused()
    await page.keyboard.press('Space')
    await expect(review).toBeVisible()
  }
  await openReview()
  await expect(review).toContainText('Survey vessel')
  await expect(review).toContainText('Orbit 1 around Survey vessel')
  await expect(review).toContainText('Captured echo')
  await review.getByRole('button', { name: 'Cancel deletion', exact: true }).click()
  await expect(review).toBeHidden()
  await openReview()
  await expect(review).toContainText('A Zone')
  await expect(review).toContainText('Herma')
  await expect(review).toContainText('Iria')
  await expect(review).toContainText('Lost Gate')
  await expect(confirm).toBeFocused()
  await page.keyboard.press('Space')
  await expect(review).toBeHidden()
  await waitForWorkspaceSaved(page)
  const after = await downloadJson(page, 'Export Jump Cluster JSON')
  if (before.type !== 'cluster' || !before.cluster || after.type !== 'cluster' || !after.cluster) {
    throw new Error('Expected complete Cluster backups.')
  }
  expect(after.cluster.systems.map(system => system.name)).toEqual(['B'])
  expect(after.cluster.routes).toEqual([])
  expect(after.cluster.routeContents).toEqual({})
  expect(after.cluster.systems[0]?.objects.map(object => object.name)).toEqual(['Primary Star', 'B Gate'])

  const undo = page.getByRole('button', { name: /^Undo(?:\b|:)/ })
  await undo.click()
  await waitForWorkspaceSaved(page)
  expect(await downloadJson(page, 'Export Jump Cluster JSON')).toEqual(before)
})
