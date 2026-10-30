import { expect, test } from '@playwright/test'
import { createPinia, setActivePinia } from 'pinia'
import { ref } from 'vue'
import { createLocalWorkspace, createOrbit, type LocalWorkspace } from '../domain/workspace'
import { useEditorWorkflows } from '../composables/useEditorWorkflows'
import type { SaveState } from '../composables/editor-workflows/types'
import { createWorkspaceHistoryCoordinator } from '../composables/editor-workflows/workspace-mutations'
import { useEditorUiStore } from '../stores/editor-ui'
import { createWorkspaceSnapshot } from '../utils/workspace-storage'
import { mountController, withControlledBrowserEnvironment } from './support/mounted-controller'

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
  const owner = mountController(() => useEditorWorkflows({
    workspace,
    mutations: history,
    initializeWorkspace: async () => undefined,
    saveState: ref<SaveState>('saved'),
    saveError: ref<string | null>(null),
  }))
  const workflows = owner.value
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
      owner.unmount()
      history.dispose()
    },
  }
}

async function withHarness(
  run: (harness: ReturnType<typeof createHarness>) => Promise<void>,
  options: Parameters<typeof createHarness>[0] = {},
): Promise<void> {
  await withControlledBrowserEnvironment(async () => {
    const harness = createHarness(options)
    try {
      await run(harness)
    } finally {
      harness.dispose()
    }
  })
}

test('public Inspector Apply finalizes the Orbit group before applying its captured draft @pure', async () => {
  await withHarness(async harness => {
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
  })
})

test('canceling Orbit capacity consent preserves the Inspector draft and applied data @pure', async () => {
  await withHarness(async harness => {
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
  }, { maxBytes: 0, allowCapacity: false })
})

test('quick publication completes the pending Orbit adjustment once before its update @pure', async () => {
  await withHarness(async harness => {
    const originalWorkspace = createWorkspaceSnapshot(harness.workspace.value!)
    expect(await harness.updateOrbit()).toEqual({ status: 'preview' })

    const result = await harness.workflows.publication.set({
      targets: [{ kind: 'object', id: harness.starId, systemId: harness.systemId }],
      mode: 'revealed',
    })

    expect(result.status).toBe('applied')
    expect(harness.workspace.value?.cluster.systems[0]?.objects.find(object => object.id === harness.starId)?.publication)
      .toBe('revealed')
    expect(harness.workspace.value?.layout.orbitRadii[harness.orbitId]?.horizontal).toBe(113)
    expect(harness.workflows.adjustments.orbitAdjustmentPreview.value).toBeNull()
    expect(harness.history.getStatus()).toMatchObject({
      undoDepth: 2,
      redoDepth: 0,
      totalActions: 2,
      hasPendingGroup: false,
    })
    expect(harness.history.getEntries()[1]?.action).toMatchObject({
      kind: 'update',
      target: { kind: 'object', id: harness.starId, systemId: harness.systemId },
    })
    expect(harness.publications).toBe(2)

    await harness.history.undo()
    expect(harness.workspace.value?.cluster.systems[0]?.objects.find(object => object.id === harness.starId)?.publication)
      .toBe('known-type')
    expect(harness.workspace.value?.layout.orbitRadii[harness.orbitId]?.horizontal).toBe(113)
    await harness.history.undo()
    expect(harness.workspace.value).toEqual(originalWorkspace)
  })
})

test('canceling Orbit capacity during quick publication leaves it unapplied @pure', async () => {
  await withHarness(async harness => {
    const originalWorkspace = harness.workspace.value
    expect(await harness.updateOrbit()).toEqual({ status: 'preview' })

    const result = await harness.workflows.publication.set({
      targets: [{ kind: 'object', id: harness.starId, systemId: harness.systemId }],
      mode: 'revealed',
    })

    expect(result).toMatchObject({ status: 'rejected', reason: 'cancelled' })
    expect(harness.capacityQuestions).toBe(1)
    expect(harness.workspace.value).toBe(originalWorkspace)
    expect(harness.workspace.value?.cluster.systems[0]?.objects.find(object => object.id === harness.starId)?.publication)
      .toBe('known-type')
    expect(harness.workflows.adjustments.orbitAdjustmentPreview.value).toBeNull()
    expect(harness.history.getStatus()).toMatchObject({
      totalActions: 0,
      hasPendingGroup: false,
      undoDepth: 0,
      redoDepth: 0,
    })
    expect(harness.publications).toBe(0)
  }, { maxBytes: 0, allowCapacity: false })
})
