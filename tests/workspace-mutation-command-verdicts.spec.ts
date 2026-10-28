import { createPinia, setActivePinia } from 'pinia'
import { ref, shallowRef } from 'vue'
import { expect, test } from '@playwright/test'
import { createLocalWorkspace, type LocalWorkspace } from '../domain/workspace'
import { useClusterSystemPlacement } from '../composables/editor-workflows/useClusterSystemPlacement'
import { createContinuousOrbitAdjustmentController } from '../composables/editor-workflows/continuous-orbit-adjustments'
import { useFieldDefinitionWorkflows } from '../composables/editor-workflows/useFieldDefinitionWorkflows'
import { useMapWorkflows } from '../composables/editor-workflows/useMapWorkflows'
import { createWorkspaceHistoryCoordinator, createWorkspaceMutationExecutor } from '../composables/editor-workflows/workspace-mutations'
import { useEditorUiStore } from '../stores/editor-ui'

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((complete) => {
    resolve = complete
  })
  return { promise, resolve }
}

test('a map move publishes before its durable acknowledgement and keeps awaiting save @pure', async () => {
  setActivePinia(createPinia())
  const workspace = ref<LocalWorkspace | null>(createLocalWorkspace('Kestrel Reach', 'Vesper'))
  const durable = deferred<void>()
  let revision = 0
  const mutations = createWorkspaceHistoryCoordinator({
    getWorkspace: () => workspace.value,
    getRevision: () => revision,
    publishWorkspace: (nextWorkspace) => {
      workspace.value = nextWorkspace
      revision += 1
      return { durable: durable.promise }
    },
    getTraversalBlockReason: () => null,
    confirmCapacity: async () => false,
  })
  const editorError = ref('')
  const orbitAdjustments = createContinuousOrbitAdjustmentController({ history: mutations })
  const mapWorkflows = useMapWorkflows({
    workspace,
    mutations,
    systemMapRef: shallowRef(null),
    resolveTransition: async () => true,
    beginObjectSession: () => undefined,
    beginOrbitSession: () => undefined,
    isEntityCommandBlocked: () => false,
    editorError,
    orbitAdjustments,
    beforeWorkspaceOperation: async () => {
      const result = await orbitAdjustments.beforeOperation()
      if (result.status === 'applied') void result.durable.catch(() => undefined)
      return result.status !== 'rejected'
    },
  })
  const initialWorkspace = workspace.value
  expect(initialWorkspace).not.toBeNull()
  const systemId = initialWorkspace!.cluster.systems[0]!.id
  let completed = false

  const command = mapWorkflows.moveSystem(systemId, { x: 0.72, y: 0.28 }).then(() => {
    completed = true
  })
  await expect.poll(() => workspace.value?.layout.systemPositions[systemId]).toEqual({ x: 0.72, y: 0.28 })

  expect(workspace.value?.layout.systemPositions[systemId]).toEqual({ x: 0.72, y: 0.28 })
  expect(completed).toBe(false)
  expect(editorError.value).toBe('')

  durable.resolve()
  await command
  expect(completed).toBe(true)
  orbitAdjustments.dispose()
  mutations.dispose()
})

test('a rejected Cluster move keeps its initiating preview and leaves applied position intact @pure', async () => {
  setActivePinia(createPinia())
  const workspace = ref<LocalWorkspace | null>(createLocalWorkspace('Kestrel Reach', 'Vesper'))
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
  const system = workspace.value!.cluster.systems[0]!
  const original = workspace.value!.layout.systemPositions[system.id]!
  const store = useEditorUiStore()
  store.setSelection({ activeView: 'cluster', clusterSelectedSystemId: system.id })
  store.setMode('move')
  const orbitAdjustments = createContinuousOrbitAdjustmentController({ history: mutations })
  const placement = useClusterSystemPlacement({
    workspace,
    clusterMapRef: shallowRef(null),
    mutations,
    beforeWorkspaceOperation: async () => {
      const result = await orbitAdjustments.beforeOperation()
      if (result.status === 'applied') void result.durable.catch(() => undefined)
      return result.status !== 'rejected'
    },
  })

  expect(placement.previewSystemMoveAt({ x: 0.7, y: 0.8 })).toBe(true)
  const token = placement.clusterSystemMovePreview.value?.token
  expect(token).toBeDefined()
  mutations.dispose()

  expect(await placement.confirmSystemMove()).toBe(false)
  expect(placement.clusterSystemMovePreview.value?.token).toBe(token)
  expect(workspace.value?.layout.systemPositions[system.id]).toEqual(original)
  expect(placement.clusterSystemMoveError.value).toContain('no longer active')
  orbitAdjustments.dispose()
})

test('Fields keeps a rejected create draft and acknowledges only a published field @pure', async () => {
  const workspace = ref<LocalWorkspace | null>(createLocalWorkspace('Kestrel Reach', 'Vesper'))
  const durable = deferred<void>()
  let revision = 0
  const mutations = createWorkspaceMutationExecutor({
    getWorkspace: () => workspace.value,
    getRevision: () => revision,
    publishWorkspace: nextWorkspace => {
      workspace.value = nextWorkspace
      revision += 1
      return { durable: durable.promise }
    },
  })
  const fields = useFieldDefinitionWorkflows({
    workspace,
    mutations,
    resolveTransition: async () => true,
    isEntityCommandBlocked: () => false,
  })

  await fields.handleFieldDefinitionsIntent({ kind: 'open' })
  await fields.handleFieldDefinitionsIntent({ kind: 'new-field' })
  await fields.handleFieldDefinitionsIntent({ kind: 'patch-create', patch: { name: 'Trade Code' } })
  await fields.handleFieldDefinitionsIntent({ kind: 'save-field' })
  await Promise.resolve()

  expect(fields.fieldDefinitionsSession.appliedAck).toBe(1)
  expect(fields.fieldDefinitionsSession.createDraft).toBeNull()
  expect(workspace.value?.objectFieldSettings.customFields.map(field => field.name)).toContain('Trade Code')

  await fields.handleFieldDefinitionsIntent({ kind: 'new-field' })
  await fields.handleFieldDefinitionsIntent({ kind: 'patch-create', patch: { name: 'Trade Language' } })
  mutations.dispose()
  await fields.handleFieldDefinitionsIntent({ kind: 'save-field' })
  await Promise.resolve()

  expect(fields.fieldDefinitionsSession.appliedAck).toBe(1)
  expect(fields.fieldDefinitionsSession.createDraft?.name).toBe('Trade Language')
  expect(fields.fieldDefinitionsSession.error).toContain('no longer active')
  durable.resolve()
})
