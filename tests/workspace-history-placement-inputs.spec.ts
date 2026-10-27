import { expect, test } from '@playwright/test'
import { createPinia, setActivePinia } from 'pinia'
import { computed, effectScope, ref, shallowRef, watchEffect } from 'vue'
import { createLocalWorkspace, createOrbit, type LocalWorkspace } from '../domain/workspace'
import { useClusterSystemPlacement } from '../composables/editor-workflows/useClusterSystemPlacement'
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

function connectInputGuard(
  blockedReason: ReturnType<typeof createHistoryHarness>['blockedReason'],
  isPending: () => boolean,
  reason: string,
) {
  return watchEffect(() => {
    blockedReason.value = isPending() ? reason : null
  }, { flush: 'sync' })
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
  const placement = scope.run(() => useSystemObjectPlacement({
    workspace,
    creationActive: computed(() => false),
    systemMapRef: shallowRef(null),
    mutations: history,
    isEntityCommandBlocked: () => false,
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
  })
  return { placement, mapWorkflows, systemId, dispose: () => scope.stop() }
}

test('a numeric Cluster placement can Undo and Redo after its clean inputs follow each restore @pure', async () => {
  setActivePinia(createPinia())
  const harness = createHistoryHarness(createLocalWorkspace('Kestrel Reach', 'Vesper'))
  const scope = effectScope()
  const store = useEditorUiStore()
  const system = harness.workspace.value!.cluster.systems[0]!
  const original = { ...harness.workspace.value!.layout.systemPositions[system.id]! }
  store.setSelection({ activeView: 'cluster', clusterSelectedSystemId: system.id })
  store.setMode('select')
  let placement: ReturnType<typeof useClusterSystemPlacement> | undefined
  scope.run(() => {
    placement = useClusterSystemPlacement({
      workspace: harness.workspace,
      clusterMapRef: shallowRef(null),
      mutations: harness.history,
    })
  })
  if (!placement) throw new Error('The Cluster placement controller was not created.')
  const mapWorkflows = useMapWorkflows({
    workspace: harness.workspace,
    mutations: harness.history,
    systemMapRef: shallowRef(null),
    resolveTransition: async () => true,
    beginObjectSession: () => undefined,
    beginOrbitSession: () => undefined,
    isEntityCommandBlocked: () => false,
    editorError: ref(''),
  })
  const stopGuard = connectInputGuard(
    harness.blockedReason,
    () => placement!.hasPendingHistoryInput.value,
    'Finish the pending Cluster placement inputs first.',
  )
  store.setMode('move')

  expect(placement.clusterSystemPositionInputs).toMatchObject({ x: String(original.x), y: String(original.y) })
  expect(placement.hasPendingHistoryInput.value).toBe(false)
  expect(placement.previewSystemMoveAt({ x: 0.72, y: 0.68 })).toBe(true)
  expect(await placement.confirmSystemMove()).toBe(true)
  expect(harness.workspace.value?.layout.systemPositions[system.id]).toEqual({ x: 0.72, y: 0.68 })
  expect({
    preview: placement.clusterSystemMovePreview.value,
    addType: placement.clusterAddType.value,
    targeting: placement.clusterMoveTargeting.value,
    inputs: { ...placement.clusterSystemPositionInputs },
  }).toEqual({ preview: null, addType: null, targeting: true, inputs: { x: '0.72', y: '0.68' } })
  expect(placement.hasPendingHistoryInput.value).toBe(false)

  expect((await harness.history.undo()).status).toBe('applied')
  expect(harness.workspace.value?.layout.systemPositions[system.id]).toEqual(original)
  expect(placement.hasPendingHistoryInput.value).toBe(false)
  expect(harness.history.getStatus().redoUnavailableReason).toBeNull()
  expect((await harness.history.redo()).status).toBe('applied')
  expect(harness.workspace.value?.layout.systemPositions[system.id]).toEqual({ x: 0.72, y: 0.68 })

  placement.updateClusterSystemPositionInput('x', '0.81')
  await mapWorkflows.moveSystem(system.id, { x: 0.55, y: 0.4 })
  expect(placement.clusterSystemPositionInputs.x).toBe('0.81')
  expect(placement.hasPendingHistoryInput.value).toBe(true)
  expect(harness.history.getStatus().undoUnavailableReason).toBe('Finish the pending Cluster placement inputs first.')
  expect(await harness.history.undo()).toMatchObject({ status: 'rejected', reason: 'unavailable' })

  scope.stop()
  stopGuard()
  harness.dispose()
})

test('a same-Orbit object angle command can Undo and Redo without a stale angle input @pure', async () => {
  setActivePinia(createPinia())
  const prepared = createObjectOrbitWorkspace()
  const harness = createHistoryHarness(prepared.workspace)
  const controller = createObjectPlacementController(harness.workspace, harness.history, prepared.objectId)
  const stopGuard = connectInputGuard(
    harness.blockedReason,
    () => controller.placement.hasPendingHistoryInput.value,
    'Finish the pending placement inputs first.',
  )
  const initialDegrees = String(0.2 * 180 / Math.PI)

  expect(controller.placement.systemObjectPositionInput.value).toBe(initialDegrees)
  expect(controller.placement.hasPendingHistoryInput.value).toBe(false)
  await controller.mapWorkflows.rotateMapObject(prepared.objectId, 1.2)
  expect(harness.workspace.value?.layout.objectAngles[prepared.objectId]).toBe(1.2)
  expect(controller.placement.hasPendingHistoryInput.value).toBe(false)

  expect((await harness.history.undo()).status).toBe('applied')
  expect(harness.workspace.value?.layout.objectAngles[prepared.objectId]).toBe(0.2)
  expect(controller.placement.systemObjectPositionInput.value).toBe(initialDegrees)
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

  controller.placement.updateSystemObjectPositionInput('45')
  expect(controller.placement.hasPendingHistoryInput.value).toBe(true)
  await controller.mapWorkflows.rotateMapObject(prepared.objectId, 1.2)

  expect(controller.placement.systemObjectPositionInput.value).toBe('45')
  expect(controller.placement.hasPendingHistoryInput.value).toBe(true)
  expect(harness.history.getStatus().undoUnavailableReason).toBe('Finish the pending placement inputs first.')
  expect(await harness.history.undo()).toMatchObject({ status: 'rejected', reason: 'unavailable' })
  expect(harness.workspace.value?.layout.objectAngles[prepared.objectId]).toBe(1.2)

  controller.dispose()
  stopGuard()
  harness.dispose()
})
