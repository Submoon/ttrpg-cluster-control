import { expect, test } from '@playwright/test'
import { createPinia, setActivePinia } from 'pinia'
import { ref } from 'vue'
import { createLocalWorkspace, createOrbit, type LocalWorkspace } from '../domain/workspace'
import { useEditorWorkflows } from '../composables/useEditorWorkflows'
import type { SaveState } from '../composables/editor-workflows/types'
import { createWorkspaceHistoryCoordinator } from '../composables/editor-workflows/workspace-mutations'
import { useEditorUiStore } from '../stores/editor-ui'
import { createWorkspaceSnapshot } from '../utils/workspace-storage'

function createHarness(options: { maxBytes?: number; allowCapacity?: boolean } = {}) {
  setActivePinia(createPinia())
  const base = createLocalWorkspace('Kestrel Reach', 'Vesper')
  const initialSystem = base.cluster.systems[0]!
  const primaryStar = initialSystem.objects.find(object => object.subtype === 'star')
    ?? initialSystem.objects[0]
  if (!primaryStar) throw new Error('The Inspector fixture needs its Primary Star.')
  const freeOrbit = createOrbit(initialSystem, null)
  let workspaceSnapshot = createWorkspaceSnapshot({
    ...base,
    cluster: {
      ...base.cluster,
      systems: [{ ...initialSystem, orbits: [...initialSystem.orbits, freeOrbit] }],
    },
  })
  const workspace = ref<LocalWorkspace | null>(workspaceSnapshot)
  let revision = 0
  let publications = 0
  let capacityQuestions = 0
  const history = createWorkspaceHistoryCoordinator({
    getWorkspace: () => workspace.value,
    getRevision: () => revision,
    publishWorkspace: next => {
      workspaceSnapshot = createWorkspaceSnapshot(next)
      workspace.value = workspaceSnapshot
      revision += 1
      publications += 1
      return { durable: Promise.resolve() }
    },
    getTraversalBlockReason: () => null,
    confirmCapacity: async () => {
      capacityQuestions += 1
      return options.allowCapacity ?? false
    },
    limits: options.maxBytes === undefined ? undefined : { maxBytes: options.maxBytes },
  })
  const workflows = useEditorWorkflows({
    workspace,
    mutations: history,
    initializeWorkspace: async () => undefined,
    saveState: ref<SaveState>('saved'),
    saveError: ref<string | null>(null),
  })
  const store = useEditorUiStore()
  store.setSelection({
    activeView: 'system',
    selectedSystemId: initialSystem.id,
    selectedObjectId: primaryStar.id,
  })
  store.setMode('move')

  return {
    workspace,
    history,
    workflows,
    systemId: initialSystem.id,
    starId: primaryStar.id,
    orbitId: freeOrbit.id,
    get publications() { return publications },
    get capacityQuestions() { return capacityQuestions },
    async beginModifiedStarDraft() {
      await workflows.inspector.beginObjectEdit()
      const session = workflows.inspector.entitySession.value
      if (!session || session.kind !== 'object' || session.targetId !== primaryStar.id) {
        throw new Error('The Primary Star Inspector session did not start.')
      }
      session.draft.name = 'Primary Star Prime'
      return session
    },
    updateOrbit() {
      return workflows.adjustments.updateOrbitAdjustment({
        workspaceId: workspace.value!.id,
        systemId: initialSystem.id,
        orbitId: freeOrbit.id,
        inputKind: 'keyboard',
        keyCode: 'ArrowRight',
        change: { kind: 'radii', axis: 'horizontal', operation: 'delta', delta: 1, minimum: 24 },
      })
    },
    dispose() {
      workflows.adjustments.resetOrbitAdjustments()
      history.dispose()
    },
  }
}

test('public Inspector Apply finalizes the Orbit group before applying its captured draft @pure', async () => {
  const harness = createHarness()
  const session = await harness.beginModifiedStarDraft()
  expect(await harness.updateOrbit()).toEqual({ status: 'preview' })

  expect(await harness.workflows.inspector.applyEntitySession(session.id)).toBe(true)

  const latest = harness.workspace.value!
  expect(latest.cluster.systems[0]?.objects.find(object => object.id === harness.starId)?.name).toBe('Primary Star Prime')
  expect(latest.layout.orbitRadii[harness.orbitId]?.horizontal).toBe(113)
  expect(harness.workflows.inspector.entitySession.value).toBeNull()
  expect(harness.workflows.inspector.hasModifiedEntitySession.value).toBe(false)
  expect(harness.workflows.adjustments.orbitAdjustmentPreview.value).toBeNull()
  expect(harness.history.getStatus()).toMatchObject({ undoDepth: 2, redoDepth: 0, hasPendingGroup: false })
  expect(harness.publications).toBe(2)
  harness.dispose()
})

test('canceling Orbit capacity consent preserves the Inspector draft and applied data @pure', async () => {
  const harness = createHarness({ maxBytes: 0, allowCapacity: false })
  const session = await harness.beginModifiedStarDraft()
  const originalWorkspace = harness.workspace.value
  expect(await harness.updateOrbit()).toEqual({ status: 'preview' })

  expect(await harness.workflows.inspector.applyEntitySession(session.id)).toBe(false)

  expect(harness.capacityQuestions).toBe(1)
  expect(harness.workspace.value).toBe(originalWorkspace)
  expect(harness.workspace.value?.cluster.systems[0]?.objects.find(object => object.id === harness.starId)?.name)
    .not.toBe('Primary Star Prime')
  expect(harness.workflows.inspector.entitySession.value?.id).toBe(session.id)
  expect(harness.workflows.inspector.hasModifiedEntitySession.value).toBe(true)
  expect(harness.workflows.adjustments.orbitAdjustmentPreview.value).toBeNull()
  expect(harness.history.getStatus()).toMatchObject({ totalActions: 0, hasPendingGroup: false, undoDepth: 0, redoDepth: 0 })
  expect(harness.publications).toBe(0)
  harness.dispose()
})
