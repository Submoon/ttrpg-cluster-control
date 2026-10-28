import { expect, test } from '@playwright/test'
import { createPinia, setActivePinia } from 'pinia'
import { computed, effectScope, ref, shallowRef, watchEffect } from 'vue'
import { addStarSystem, createLocalWorkspace, createOrbit, createSystemObject, planMapEntityDeletion, type LocalWorkspace } from '../domain/workspace'
import { useClusterSystemPlacement } from '../composables/editor-workflows/useClusterSystemPlacement'
import { createContinuousOrbitAdjustmentController } from '../composables/editor-workflows/continuous-orbit-adjustments'
import { useSystemCreationWorkflows } from '../composables/editor-workflows/useSystemCreationWorkflows'
import { useMapWorkflows } from '../composables/editor-workflows/useMapWorkflows'
import { createWorkspaceHistoryCoordinator } from '../composables/editor-workflows/workspace-mutations'
import { useSystemObjectPlacement } from '../composables/editor-workflows/useSystemObjectPlacement'
import { useEditorUiStore } from '../stores/editor-ui'

function createHistoryHarness(initial: LocalWorkspace) {
  const workspace = ref<LocalWorkspace | null>(initial)
  const blockedReason = ref<string | null>(null)
  let revision = 0
  const history = createWorkspaceHistoryCoordinator({
    getWorkspace: () => workspace.value,
    getRevision: () => revision,
    publishWorkspace: (next) => {
      workspace.value = next
      revision += 1
      return { durable: Promise.resolve() }
    },
    getTraversalBlockReason: () => blockedReason.value,
    confirmCapacity: async () => false,
  })
  return { workspace, history, blockedReason, dispose: () => history.dispose() }
}

function createSystemCreationController(
  workspace: ReturnType<typeof createHistoryHarness>['workspace'],
  history: ReturnType<typeof createHistoryHarness>['history'],
  systemId = workspace.value!.cluster.systems[0]!.id,
) {
  const scope = effectScope()
  const store = useEditorUiStore()
  store.setSelection({ activeView: 'system', selectedSystemId: systemId })
  store.setMode('select')
  const creation = scope.run(() => useSystemCreationWorkflows({
    workspace,
    systemMapRef: shallowRef(null),
    mutations: history,
    isEntityCommandBlocked: () => false,
    resolveObjectCreationTransition: async () => true,
    onObjectCreated: async () => undefined,
  }))
  if (!creation) throw new Error('The system creation controller was not created.')
  return {
    creation,
    systemId,
    dispose: () => scope.stop(),
  }
}

async function recordClusterRename(harness: ReturnType<typeof createHistoryHarness>): Promise<void> {
  const initial = harness.workspace.value!
  const result = await harness.history.execute({
    action: {
      kind: 'rename',
      label: 'Rename Jump Cluster',
      target: { kind: 'cluster', id: initial.cluster.id },
    },
    prepare: current => ({
      ...current,
      cluster: { ...current.cluster, name: 'Kestrel Prime' },
    }),
  })
  expect(result.status).toBe('applied')
}

function connectInputGuard(
  blockedReason: ReturnType<typeof createHistoryHarness>['blockedReason'],
  isPending: () => boolean,
  reason: string,
) {
  return watchEffect(() => {
    blockedReason.value = isPending() ? reason : null
  }, { flush: 'sync' })
}

function createMapAdjustmentBindings(history: ReturnType<typeof createWorkspaceHistoryCoordinator>) {
  const orbitAdjustments = createContinuousOrbitAdjustmentController({ history })
  return {
    orbitAdjustments,
    beforeWorkspaceOperation: async () => {
      const result = await orbitAdjustments.beforeOperation()
      if (result.status === 'applied') void result.durable.catch(() => undefined)
      return result.status !== 'rejected'
    },
  }
}

function createObjectOrbitWorkspace(): { workspace: LocalWorkspace; objectId: string } {
  const initial = createLocalWorkspace('Kestrel Reach', 'Vesper')
  const system = initial.cluster.systems[0]!
  const orbit = createOrbit(system, null)
  const objectId = 'test-orbit-object'
  const orbitObject = {
    id: objectId,
    family: 'CelestialBody' as const,
    subtype: 'planet',
    locationKey: 'B',
    name: 'Test Planet',
    description: '',
    placement: { kind: 'orbit' as const, orbitId: orbit.id },
  }
  return {
    workspace: {
      ...initial,
      cluster: {
        ...initial.cluster,
        systems: [{
          ...system,
          objects: [...system.objects, orbitObject],
          orbits: [orbit],
        }],
      },
      layout: {
        ...initial.layout,
        objectAngles: { ...initial.layout.objectAngles, [objectId]: 0.2 },
      },
    },
    objectId,
  }
}

function createObjectPlacementController(
  workspace: ReturnType<typeof createHistoryHarness>['workspace'],
  history: ReturnType<typeof createHistoryHarness>['history'],
  objectId: string,
) {
  const scope = effectScope()
  const store = useEditorUiStore()
  const systemId = workspace.value!.cluster.systems[0]!.id
  store.setSelection({ activeView: 'system', selectedSystemId: systemId, selectedObjectId: objectId })
  store.setMode('move')
  const adjustmentBindings = createMapAdjustmentBindings(history)
  const placement = scope.run(() => useSystemObjectPlacement({
    workspace,
    creationActive: computed(() => false),
    systemMapRef: shallowRef(null),
    mutations: history,
    isEntityCommandBlocked: () => false,
    beforeWorkspaceOperation: adjustmentBindings.beforeWorkspaceOperation,
  }))
  if (!placement) throw new Error('The object placement controller was not created.')
  const mapWorkflows = useMapWorkflows({
    workspace,
    mutations: history,
    systemMapRef: shallowRef(null),
    resolveTransition: async () => true,
    beginObjectSession: () => undefined,
    beginOrbitSession: () => undefined,
    isEntityCommandBlocked: () => false,
    editorError: ref(''),
    ...adjustmentBindings,
  })
  return {
    placement,
    mapWorkflows,
    systemId,
    dispose: () => {
      adjustmentBindings.orbitAdjustments.dispose()
      scope.stop()
    },
  }
}

test('a Cluster map placement can Undo and Redo, while a pending map preview blocks traversal @pure', async () => {
  setActivePinia(createPinia())
  const harness = createHistoryHarness(createLocalWorkspace('Kestrel Reach', 'Vesper'))
  const scope = effectScope()
  const store = useEditorUiStore()
  const system = harness.workspace.value!.cluster.systems[0]!
  const original = { ...harness.workspace.value!.layout.systemPositions[system.id]! }
  store.setSelection({ activeView: 'cluster', clusterSelectedSystemId: system.id })
  store.setMode('select')
  const adjustmentBindings = createMapAdjustmentBindings(harness.history)
  let placement: ReturnType<typeof useClusterSystemPlacement> | undefined
  scope.run(() => {
    placement = useClusterSystemPlacement({
      workspace: harness.workspace,
      clusterMapRef: shallowRef(null),
      mutations: harness.history,
      beforeWorkspaceOperation: adjustmentBindings.beforeWorkspaceOperation,
    })
  })
  if (!placement) throw new Error('The Cluster placement controller was not created.')
  const stopGuard = connectInputGuard(
    harness.blockedReason,
    () => placement!.hasPendingHistoryInput.value,
    'Finish or cancel the Cluster move preview first.',
  )
  store.setMode('move')

  expect(placement.beginClusterSystemMapMove()).toBe(true)
  expect(placement.hasPendingHistoryInput.value).toBe(true)
  expect(placement.previewSystemMoveAt({ x: 112 + 0.72 * 736, y: 96 + 0.68 * 368 })).toBe(true)
  expect(placement.hasPendingHistoryInput.value).toBe(true)
  expect(await placement.confirmSystemMove()).toBe(true)
  expect(harness.workspace.value?.layout.systemPositions[system.id]?.x).toBeCloseTo(0.72)
  expect(harness.workspace.value?.layout.systemPositions[system.id]?.y).toBeCloseTo(0.68)
  expect(placement.clusterSystemMovePreview.value).toBeNull()
  expect(placement.clusterAddType.value).toBeNull()
  expect(placement.hasPendingHistoryInput.value).toBe(false)

  expect((await harness.history.undo()).status).toBe('applied')
  expect(harness.workspace.value?.layout.systemPositions[system.id]).toEqual(original)
  expect(placement.hasPendingHistoryInput.value).toBe(false)
  expect(harness.history.getStatus().redoUnavailableReason).toBeNull()
  expect((await harness.history.redo()).status).toBe('applied')
  expect(harness.workspace.value?.layout.systemPositions[system.id]?.x).toBeCloseTo(0.72)
  expect(harness.workspace.value?.layout.systemPositions[system.id]?.y).toBeCloseTo(0.68)

  expect(placement.beginClusterSystemMapMove()).toBe(true)
  expect(placement.previewSystemMoveAt({ x: 112 + 0.81 * 736, y: 96 + 0.4 * 368 })).toBe(true)
  expect(placement.hasPendingHistoryInput.value).toBe(true)
  expect(harness.history.getStatus().undoUnavailableReason).toBe('Finish or cancel the Cluster move preview first.')
  expect(await harness.history.undo()).toMatchObject({ status: 'rejected', reason: 'unavailable' })

  placement.cancelSystemMovePreview()
  scope.stop()
  adjustmentBindings.orbitAdjustments.dispose()
  stopGuard()
  harness.dispose()
})

test('armed Cluster Add System stays history-safe across Undo and Redo without dirty inputs @pure', async () => {
  setActivePinia(createPinia())
  const initial = createLocalWorkspace('Kestrel Reach', 'Vesper')
  const harness = createHistoryHarness(initial)
  await recordClusterRename(harness)

  const scope = effectScope()
  const store = useEditorUiStore()
  store.setSelection({ activeView: 'cluster' })
  store.setMode('select')
  const adjustmentBindings = createMapAdjustmentBindings(harness.history)
  const placement = scope.run(() => useClusterSystemPlacement({
    workspace: harness.workspace,
    clusterMapRef: shallowRef(null),
    mutations: harness.history,
    beforeWorkspaceOperation: adjustmentBindings.beforeWorkspaceOperation,
  }))
  if (!placement) throw new Error('The Cluster placement controller was not created.')
  const stopGuard = connectInputGuard(
    harness.blockedReason,
    () => placement.hasPendingHistoryInput.value,
    'Finish the pending Cluster placement inputs first.',
  )

  placement.armSystemAdd()
  expect(placement.hasPendingHistoryInput.value).toBe(false)
  expect(await harness.history.undo()).toMatchObject({ status: 'applied' })
  expect(harness.workspace.value?.cluster.name).toBe('Kestrel Reach')
  expect(placement.clusterAddType.value).toBe('system')
  expect(placement.hasPendingHistoryInput.value).toBe(false)
  expect(await harness.history.redo()).toMatchObject({ status: 'applied' })
  expect(harness.workspace.value?.cluster.name).toBe('Kestrel Prime')
  expect(placement.clusterAddType.value).toBe('system')
  expect(placement.hasPendingHistoryInput.value).toBe(false)

  expect(await placement.addSystemAt({ x: 0.75, y: 0.1 })).toBe(true)
  expect(harness.workspace.value?.cluster.systems).toHaveLength(2)
  expect(placement.clusterAddType.value).toBe('system')
  expect(placement.hasPendingHistoryInput.value).toBe(false)
  expect(await harness.history.undo()).toMatchObject({ status: 'applied' })
  expect(harness.workspace.value?.cluster.systems).toHaveLength(1)
  expect(placement.hasPendingHistoryInput.value).toBe(false)
  expect(await harness.history.redo()).toMatchObject({ status: 'applied' })
  expect(harness.workspace.value?.cluster.systems).toHaveLength(2)
  expect(placement.clusterAddType.value).toBe('system')
  expect(placement.hasPendingHistoryInput.value).toBe(false)

  scope.stop()
  adjustmentBindings.orbitAdjustments.dispose()
  stopGuard()
  harness.dispose()
})

test('armed object Add blocks dirty inputs and unresolved candidate choices but not a clean tool @pure', async () => {
  setActivePinia(createPinia())
  const harness = createHistoryHarness(createLocalWorkspace('Kestrel Reach', 'Vesper'))
  await recordClusterRename(harness)
  const controller = createSystemCreationController(harness.workspace, harness.history)
  const stopGuard = connectInputGuard(
    harness.blockedReason,
    () => controller.creation.hasPendingHistoryInput.value,
    'Finish or cancel the object or Orbit placement first.',
  )

  expect(await controller.creation.chooseCreationType({ kind: 'object', subtype: 'other' })).toBe(true)
  expect(controller.creation.hasPendingHistoryInput.value).toBe(false)

  controller.creation.updateCreationInput('otherType', 'Relay Beacon')
  expect(controller.creation.hasPendingHistoryInput.value).toBe(true)
  expect(await harness.history.undo()).toMatchObject({ status: 'rejected', reason: 'unavailable' })
  controller.creation.updateCreationInput('otherType', '')
  expect(controller.creation.hasPendingHistoryInput.value).toBe(false)

  expect(await controller.creation.offerCreationCandidates([
    { key: 'first', label: 'First location', target: { kind: 'free', point: { x: 0.8, y: 0.8 } }, error: null },
    { key: 'second', label: 'Second location', target: { kind: 'free', point: { x: 0.9, y: 0.9 } }, error: null },
  ])).toBe(false)
  expect(controller.creation.hasPendingHistoryInput.value).toBe(true)
  expect(await harness.history.undo()).toMatchObject({ status: 'rejected', reason: 'unavailable' })
  controller.creation.cancelCreationPreview()
  expect(controller.creation.hasPendingHistoryInput.value).toBe(false)

  expect(await harness.history.undo()).toMatchObject({ status: 'applied' })
  expect(harness.workspace.value?.cluster.name).toBe('Kestrel Reach')

  controller.dispose()
  stopGuard()
  harness.dispose()
})

test('clean Add target references follow restored Orbit and system data @pure', async () => {
  setActivePinia(createPinia())
  const initial = addStarSystem(createLocalWorkspace('Kestrel Reach', 'Vesper')).workspace
  const targetSystem = initial.cluster.systems[0]!
  const otherSystem = initial.cluster.systems[1]!
  const harness = createHistoryHarness(initial)
  const controller = createSystemCreationController(harness.workspace, harness.history, targetSystem.id)
  const stopGuard = connectInputGuard(
    harness.blockedReason,
    () => controller.creation.hasPendingHistoryInput.value,
    'Finish or cancel the object or Orbit placement first.',
  )

  const orbit = createOrbit(targetSystem, null)
  const createOrbitResult = await harness.history.execute({
    action: {
      kind: 'create',
      label: 'Create Orbit',
      target: { kind: 'orbit', id: orbit.id, systemId: targetSystem.id },
      parent: { kind: 'system', id: targetSystem.id },
    },
    prepare: current => ({
      ...current,
      cluster: {
        ...current.cluster,
        systems: current.cluster.systems.map(system => system.id === targetSystem.id
          ? { ...system, orbits: [...system.orbits, orbit] }
          : system),
      },
      layout: {
        ...current.layout,
        orbitRadii: { ...current.layout.orbitRadii, [orbit.id]: { horizontal: 80, vertical: 80 } },
        orbitRotations: { ...current.layout.orbitRotations, [orbit.id]: 0 },
      },
    }),
  })
  expect(createOrbitResult.status).toBe('applied')

  expect(await controller.creation.chooseCreationType({ kind: 'object', subtype: 'planet' })).toBe(true)
  controller.creation.updateCreationInput('orbitId', orbit.id)
  expect(await controller.creation.addCreationFromInputs()).toBe(true)
  expect(controller.creation.hasPendingHistoryInput.value).toBe(false)
  expect(await harness.history.undo()).toMatchObject({ status: 'applied' })
  expect(controller.creation.creationSession.value?.inputs.orbitId).toBe(orbit.id)
  expect(controller.creation.hasPendingHistoryInput.value).toBe(false)

  expect(await harness.history.undo()).toMatchObject({ status: 'applied' })
  expect(harness.workspace.value?.cluster.systems[0]?.orbits).toHaveLength(0)
  expect(controller.creation.creationSession.value?.inputs.orbitId).toBe('__free__')
  expect(controller.creation.hasPendingHistoryInput.value).toBe(false)

  const latestSystem = harness.workspace.value!.cluster.systems[0]!
  const host = createSystemObject(latestSystem, 'planet')
  const createHostResult = await harness.history.execute({
    action: {
      kind: 'create',
      label: `Create ${host.name}`,
      target: { kind: 'object', id: host.id, systemId: targetSystem.id },
      parent: { kind: 'system', id: targetSystem.id },
    },
    prepare: current => ({
      ...current,
      cluster: {
        ...current.cluster,
        systems: current.cluster.systems.map(system => system.id === targetSystem.id
          ? { ...system, objects: [...system.objects, host] }
          : system),
      },
    }),
  })
  expect(createHostResult.status).toBe('applied')
  expect(await controller.creation.chooseCreationType({ kind: 'orbit' })).toBe(true)
  controller.creation.updateCreationInput('hostId', host.id)
  expect(await controller.creation.addCreationFromInputs()).toBe(true)
  expect(controller.creation.hasPendingHistoryInput.value).toBe(false)
  expect(await harness.history.undo()).toMatchObject({ status: 'applied' })
  expect(controller.creation.creationSession.value?.inputs.hostId).toBe(host.id)
  expect(controller.creation.hasPendingHistoryInput.value).toBe(false)
  expect(await harness.history.undo()).toMatchObject({ status: 'applied' })
  expect(harness.workspace.value?.cluster.systems[0]?.objects.some(object => object.id === host.id)).toBe(false)
  expect(controller.creation.creationSession.value?.inputs.hostId).toBe('')
  expect(controller.creation.hasPendingHistoryInput.value).toBe(false)

  const deleteSystemResult = await harness.history.execute({
    action: {
      kind: 'delete',
      label: 'Delete Vesper',
      target: { kind: 'system', id: targetSystem.id },
      parent: { kind: 'cluster', id: initial.cluster.id },
    },
    prepare: current => planMapEntityDeletion(current, { kind: 'system', systemId: targetSystem.id }).workspace,
  })
  expect(deleteSystemResult.status).toBe('applied')
  expect(harness.workspace.value?.cluster.systems.map(system => system.id)).toEqual([otherSystem.id])
  expect(controller.creation.creationSession.value).toBeNull()
  expect(await harness.history.undo()).toMatchObject({ status: 'applied' })
  expect(harness.workspace.value?.cluster.systems.map(system => system.id)).toContain(targetSystem.id)
  expect(controller.creation.creationSession.value).toBeNull()

  controller.dispose()
  stopGuard()
  harness.dispose()
})

test('a same-Orbit object rotation can Undo and Redo without a dirty placement choice @pure', async () => {
  setActivePinia(createPinia())
  const prepared = createObjectOrbitWorkspace()
  const harness = createHistoryHarness(prepared.workspace)
  const controller = createObjectPlacementController(harness.workspace, harness.history, prepared.objectId)
  const stopGuard = connectInputGuard(
    harness.blockedReason,
    () => controller.placement.hasPendingHistoryInput.value,
    'Finish the pending placement inputs first.',
  )
  expect(controller.placement.hasPendingHistoryInput.value).toBe(false)
  await controller.mapWorkflows.rotateMapObject(prepared.objectId, 1.2)
  expect(harness.workspace.value?.layout.objectAngles[prepared.objectId]).toBe(1.2)
  expect(controller.placement.hasPendingHistoryInput.value).toBe(false)

  expect((await harness.history.undo()).status).toBe('applied')
  expect(harness.workspace.value?.layout.objectAngles[prepared.objectId]).toBe(0.2)
  expect(harness.history.getStatus().redoUnavailableReason).toBeNull()
  expect((await harness.history.redo()).status).toBe('applied')
  expect(harness.workspace.value?.layout.objectAngles[prepared.objectId]).toBe(1.2)

  controller.dispose()
  stopGuard()
  harness.dispose()
})

test('accepted geometry changes preserve genuinely edited placement inputs and block traversal @pure', async () => {
  setActivePinia(createPinia())
  const prepared = createObjectOrbitWorkspace()
  const harness = createHistoryHarness(prepared.workspace)
  const controller = createObjectPlacementController(harness.workspace, harness.history, prepared.objectId)
  const stopGuard = connectInputGuard(
    harness.blockedReason,
    () => controller.placement.hasPendingHistoryInput.value,
    'Finish the pending placement inputs first.',
  )

  controller.placement.updateSystemObjectMoveDestination('__free__')
  expect(controller.placement.hasPendingHistoryInput.value).toBe(true)
  await controller.mapWorkflows.rotateMapObject(prepared.objectId, 1.2)

  expect(controller.placement.systemObjectMoveDestination.value).toBe('__free__')
  expect(controller.placement.hasPendingHistoryInput.value).toBe(true)
  expect(harness.history.getStatus().undoUnavailableReason).toBe('Finish the pending placement inputs first.')
  expect(await harness.history.undo()).toMatchObject({ status: 'rejected', reason: 'unavailable' })
  expect(harness.workspace.value?.layout.objectAngles[prepared.objectId]).toBe(1.2)

  controller.dispose()
  stopGuard()
  harness.dispose()
})
