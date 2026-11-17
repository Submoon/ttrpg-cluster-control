import { createPinia, setActivePinia } from 'pinia'
import { ref, shallowRef } from 'vue'
import { expect, test } from '@playwright/test'
import { addStarSystem, createLocalWorkspace, replaceWorkspaceSystem, type LocalWorkspace, type StarSystem, type SystemObject } from '../domain/workspace'
import { createContinuousOrbitAdjustmentController } from '../composables/editor-workflows/continuous-orbit-adjustments'
import { useMapWorkflows } from '../composables/editor-workflows/useMapWorkflows'
import { createWorkspaceHistoryCoordinator } from '../composables/editor-workflows/workspace-mutations'
import { useEditorUiStore } from '../stores/editor-ui'
import { objectPositions, toNormalizedMapPoint } from '../utils/system-map-geometry'

function object(id: string, placement: SystemObject['placement']): SystemObject {
  return {
    id,
    publication: 'revealed',
    family: 'CelestialBody',
    subtype: 'planet',
    locationKey: id,
    name: id,
    description: '',
    playerText: '',
    playerFieldMasks: [],
    placement,
  }
}

test('an explicit-owner move snaps in its source system and carries its hosted branch without retargeting Inspect @pure', async () => {
  setActivePinia(createPinia())
  const initial = createLocalWorkspace('Kestrel Reach', 'Vesper')
  const inspectedSystem = initial.cluster.systems[0]!
  const inspectedObject = object('inspected-object', { kind: 'system', x: 0.5, y: 0.5 })
  let workspaceWithInspector = replaceWorkspaceSystem(initial, {
    ...inspectedSystem,
    objects: [inspectedObject],
  })
  const added = addStarSystem(workspaceWithInspector, 'Altair')
  const owningSystem = added.system
  const movedObject = object('moving-object', { kind: 'system', x: 0.5, y: 0.5 })
  const hostedObject = object('hosted-object', { kind: 'orbit', orbitId: 'host-orbit' })
  workspaceWithInspector = replaceWorkspaceSystem(added.workspace, {
    ...owningSystem,
    objects: [movedObject, hostedObject],
    orbits: [
      { id: 'host-orbit', hostId: movedObject.id, order: 1 },
      { id: 'destination-orbit', hostId: null, center: toNormalizedMapPoint({ x: 640, y: 280 }), order: 1 },
    ],
  })
  workspaceWithInspector.layout.orbitRadii['destination-orbit'] = { horizontal: 60, vertical: 60 }

  const workspace = ref<LocalWorkspace | null>(workspaceWithInspector)
  let revision = 0
  const mutations = createWorkspaceHistoryCoordinator({
    getWorkspace: () => workspace.value,
    getRevision: () => revision,
    publishWorkspace: nextWorkspace => {
      workspace.value = nextWorkspace
      revision += 1
      return { durable: Promise.resolve() }
    },
    getTraversalBlockReason: () => null,
    confirmCapacity: async () => false,
  })
  const orbitAdjustments = createContinuousOrbitAdjustmentController({ history: mutations })
  const store = useEditorUiStore()
  store.setSelection({
    activeView: 'cluster',
    selectedSystemId: inspectedSystem.id,
    selectedObjectId: inspectedObject.id,
    inspectedTarget: { kind: 'object', systemId: inspectedSystem.id, objectId: inspectedObject.id },
  })
  store.setMode('move')
  const inspectorBefore = {
    activeView: store.activeView,
    selectedSystemId: store.selectedSystemId,
    selectedObjectId: store.selectedObjectId,
    inspectedTarget: store.inspectedTarget,
  }
  const editorError = ref('')
  const map = useMapWorkflows({
    workspace,
    mutations,
    systemMapRef: shallowRef(null),
    resolveTransition: async () => true,
    beginObjectSession: () => undefined,
    beginOrbitSession: () => undefined,
    isEntityCommandBlocked: command => command.kind === 'object-placement' && command.objectId === inspectedObject.id,
    editorError,
    orbitAdjustments,
    beforeWorkspaceOperation: async () => true,
  })

  await map.moveMapObjectInSystem(
    owningSystem.id,
    movedObject.id,
    toNormalizedMapPoint({ x: 700, y: 280 }),
  )
  expect(editorError.value).toBe('')

  const updatedSystem = workspace.value?.cluster.systems.find(system => system.id === owningSystem.id)!
  expect(updatedSystem.objects.find(item => item.id === movedObject.id)?.placement)
    .toEqual({ kind: 'orbit', orbitId: 'destination-orbit' })
  const owningSystemBefore = workspaceWithInspector.cluster.systems.find(system => system.id === owningSystem.id)!
  const beforePositions = objectPositions(owningSystemBefore, {
    objectAngles: workspaceWithInspector.layout.objectAngles,
    orbitRadii: workspaceWithInspector.layout.orbitRadii,
    orbitRotations: workspaceWithInspector.layout.orbitRotations,
  })
  const afterPositions = objectPositions(updatedSystem, {
    objectAngles: workspace.value!.layout.objectAngles,
    orbitRadii: workspace.value!.layout.orbitRadii,
    orbitRotations: workspace.value!.layout.orbitRotations,
  })
  expect(afterPositions.get(movedObject.id)?.x).toBeCloseTo(700)
  expect(afterPositions.get(hostedObject.id)?.x).toBeCloseTo((beforePositions.get(hostedObject.id)?.x ?? 0) + 220)
  expect(afterPositions.get(hostedObject.id)?.y).toBeCloseTo(beforePositions.get(hostedObject.id)?.y ?? 0)
  expect({
    activeView: store.activeView,
    selectedSystemId: store.selectedSystemId,
    selectedObjectId: store.selectedObjectId,
    inspectedTarget: store.inspectedTarget,
  }).toEqual(inspectorBefore)

  orbitAdjustments.dispose()
  mutations.dispose()
})

test('Add writes to the chosen owner without opening a new Inspector target @pure', async () => {
  setActivePinia(createPinia())
  const initial = createLocalWorkspace('Kestrel Reach', 'Vesper')
  const inspectedSystem = initial.cluster.systems[0]!
  const inspectedObject = object('inspected-object', { kind: 'system', x: 0.5, y: 0.5 })
  const withInspector = replaceWorkspaceSystem(initial, {
    ...inspectedSystem,
    objects: [inspectedObject],
  })
  const added = addStarSystem(withInspector, 'Altair')
  const workspace = ref<LocalWorkspace | null>(added.workspace)
  let revision = 0
  const mutations = createWorkspaceHistoryCoordinator({
    getWorkspace: () => workspace.value,
    getRevision: () => revision,
    publishWorkspace: nextWorkspace => {
      workspace.value = nextWorkspace
      revision += 1
      return { durable: Promise.resolve() }
    },
    getTraversalBlockReason: () => null,
    confirmCapacity: async () => false,
  })
  const orbitAdjustments = createContinuousOrbitAdjustmentController({ history: mutations })
  const store = useEditorUiStore()
  store.setSelection({
    activeView: 'cluster',
    selectedSystemId: inspectedSystem.id,
    selectedObjectId: inspectedObject.id,
    inspectedTarget: { kind: 'object', systemId: inspectedSystem.id, objectId: inspectedObject.id },
  })
  store.setMode('add')
  const inspectedTargetBefore = store.inspectedTarget
  const map = useMapWorkflows({
    workspace,
    mutations,
    systemMapRef: shallowRef(null),
    resolveTransition: async () => true,
    beginObjectSession: () => undefined,
    beginOrbitSession: () => undefined,
    isEntityCommandBlocked: () => false,
    editorError: ref(''),
    orbitAdjustments,
    beforeWorkspaceOperation: async () => true,
  })

  await map.addMapObjectInSystem(
    added.system.id,
    'planet',
    { kind: 'free', point: toNormalizedMapPoint({ x: 690, y: 330 }) },
  )

  const createdSystem = workspace.value?.cluster.systems.find(system => system.id === added.system.id)!
  expect(createdSystem.objects).toHaveLength(added.system.objects.length + 1)
  const created = createdSystem.objects.find(candidate => candidate.subtype === 'planet')!
  expect(created?.subtype).toBe('planet')
  expect(created?.placement).toEqual({ kind: 'system', ...toNormalizedMapPoint({ x: 690, y: 330 }) })
  expect(store.inspectedTarget).toEqual(inspectedTargetBefore)
  expect(store.selectedSystemId).toBe(inspectedSystem.id)
  expect(store.selectedObjectId).toBe(inspectedObject.id)

  orbitAdjustments.dispose()
  mutations.dispose()
})
