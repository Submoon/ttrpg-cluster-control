import { createPinia, setActivePinia } from 'pinia'
import { ref, shallowRef } from 'vue'
import { expect, test } from '@playwright/test'
import { createLocalWorkspace, type LocalWorkspace } from '../domain/workspace'
import { useClusterSystemPlacement } from '../composables/editor-workflows/useClusterSystemPlacement'
import { useFieldDefinitionWorkflows } from '../composables/editor-workflows/useFieldDefinitionWorkflows'
import { useMapWorkflows } from '../composables/editor-workflows/useMapWorkflows'
import { createWorkspaceMutationExecutor } from '../composables/editor-workflows/workspace-mutations'
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
  const mutations = createWorkspaceMutationExecutor({
    getWorkspace: () => workspace.value,
    getRevision: () => revision,
    publishWorkspace: (nextWorkspace) => {
      workspace.value = nextWorkspace
      revision += 1
      return { durable: durable.promise }
    },
  })
  const editorError = ref('')
  const mapWorkflows = useMapWorkflows({
    workspace,
    mutations,
    systemMapRef: shallowRef(null),
    resolveTransition: async () => true,
    beginObjectSession: () => undefined,
    beginOrbitSession: () => undefined,
    isEntityCommandBlocked: () => false,
    editorError,
  })
  const initialWorkspace = workspace.value
  expect(initialWorkspace).not.toBeNull()
  const systemId = initialWorkspace!.cluster.systems[0]!.id
  let completed = false

  const command = mapWorkflows.moveSystem(systemId, { x: 0.72, y: 0.28 }).then(() => {
    completed = true
  })
  await Promise.resolve()

  expect(workspace.value?.layout.systemPositions[systemId]).toEqual({ x: 0.72, y: 0.28 })
  expect(completed).toBe(false)
  expect(editorError.value).toBe('')

  durable.resolve()
  await command
  expect(completed).toBe(true)
})

test('a rejected Cluster move keeps its initiating preview and leaves applied position intact @pure', async () => {
  setActivePinia(createPinia())
  const workspace = ref<LocalWorkspace | null>(createLocalWorkspace('Kestrel Reach', 'Vesper'))
  const mutations = createWorkspaceMutationExecutor({
    getWorkspace: () => workspace.value,
    getRevision: () => 0,
    publishWorkspace: nextWorkspace => {
      workspace.value = nextWorkspace
      return { durable: Promise.resolve() }
    },
  })
  const system = workspace.value!.cluster.systems[0]!
  const original = workspace.value!.layout.systemPositions[system.id]!
  const store = useEditorUiStore()
  store.setSelection({ activeView: 'cluster', clusterSelectedSystemId: system.id })
  store.setMode('move')
  const placement = useClusterSystemPlacement({
    workspace,
    clusterMapRef: shallowRef(null),
    mutations,
  })

  expect(placement.previewSystemMoveAt({ x: 0.7, y: 0.8 })).toBe(true)
  const token = placement.clusterSystemMovePreview.value?.token
  expect(token).toBeDefined()
  mutations.dispose()

  expect(await placement.confirmSystemMove()).toBe(false)
  expect(placement.clusterSystemMovePreview.value?.token).toBe(token)
  expect(workspace.value?.layout.systemPositions[system.id]).toEqual(original)
  expect(placement.clusterSystemMoveError.value).toContain('no longer active')
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

  fields.handleFieldDefinitionsIntent({ kind: 'open' })
  fields.handleFieldDefinitionsIntent({ kind: 'new-field' })
  fields.handleFieldDefinitionsIntent({ kind: 'patch-create', patch: { name: 'Trade Code' } })
  fields.handleFieldDefinitionsIntent({ kind: 'save-field' })
  await Promise.resolve()

  expect(fields.fieldDefinitionsSession.appliedAck).toBe(1)
  expect(fields.fieldDefinitionsSession.createDraft).toBeNull()
  expect(workspace.value?.objectFieldSettings.customFields.map(field => field.name)).toContain('Trade Code')

  fields.handleFieldDefinitionsIntent({ kind: 'new-field' })
  fields.handleFieldDefinitionsIntent({ kind: 'patch-create', patch: { name: 'Trade Language' } })
  mutations.dispose()
  fields.handleFieldDefinitionsIntent({ kind: 'save-field' })
  await Promise.resolve()

  expect(fields.fieldDefinitionsSession.appliedAck).toBe(1)
  expect(fields.fieldDefinitionsSession.createDraft?.name).toBe('Trade Language')
  expect(fields.fieldDefinitionsSession.error).toContain('no longer active')
  durable.resolve()
})
