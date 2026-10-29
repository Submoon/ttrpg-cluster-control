import { expect, test } from '@playwright/test'
import process from 'node:process'
import { createLocalWorkspace, type LocalWorkspace } from '../domain/workspace'
import { createWorkspaceSnapshot } from '../utils/workspace-storage'
import {
  createWorkspaceHistoryCoordinator,
  type WorkspaceHistoryCapacityDetails,
  type WorkspaceMutationRequest,
} from '../composables/editor-workflows/workspace-mutations'

function renameRequest(current: LocalWorkspace, name: string, label = 'Adjust Jump Cluster'): WorkspaceMutationRequest {
  return {
    action: { kind: 'rename', label, target: { kind: 'cluster', id: current.cluster.id } },
    prepare: workspace => ({ ...workspace, cluster: { ...workspace.cluster, name } }),
  }
}

function createHarness(options: {
  maxBytes?: number
  confirmCapacity?: (details: WorkspaceHistoryCapacityDetails, signal: AbortSignal) => Promise<boolean>
  durability?: () => Promise<void>
} = {}) {
  let workspace = createWorkspaceSnapshot(createLocalWorkspace('Kestrel Reach', 'Vesper'))
  let revision = 0
  let publications = 0
  let confirmationCount = 0
  const history = createWorkspaceHistoryCoordinator({
    getWorkspace: () => workspace,
    getRevision: () => revision,
    publishWorkspace: next => {
      workspace = createWorkspaceSnapshot(next)
      revision += 1
      publications += 1
      return { durable: options.durability?.() ?? Promise.resolve() }
    },
    getTraversalBlockReason: () => null,
    confirmCapacity: (details, signal) => {
      confirmationCount += 1
      return options.confirmCapacity?.(details, signal) ?? Promise.resolve(false)
    },
    limits: options.maxBytes === undefined ? undefined : { maxBytes: options.maxBytes },
  })
  return {
    history,
    get workspace() { return workspace },
    get revision() { return revision },
    get publications() { return publications },
    get confirmationCount() { return confirmationCount },
    replaceWorkspace(next: LocalWorkspace) {
      workspace = createWorkspaceSnapshot(next)
      revision += 1
    },
    dispose: () => history.dispose(),
  }
}

test('continuous updates publish their latest proposal once and undo as one action @pure', async () => {
  const harness = createHarness()
  const initial = harness.workspace
  const key = `${initial.cluster.id}:orbit-1:horizontal-radius:key`

  expect(await harness.history.stageGroup(key, renameRequest(initial, 'Kestrel Reach 10'))).toEqual({ status: 'preview' })
  expect(await harness.history.stageGroup(key, renameRequest(initial, 'Kestrel Reach 11'))).toEqual({ status: 'preview' })
  expect(await harness.history.stageGroup(key, renameRequest(initial, 'Kestrel Reach 12'))).toEqual({ status: 'preview' })
  expect(harness.workspace.cluster.name).toBe('Kestrel Reach')
  expect(harness.publications).toBe(0)
  expect(harness.history.getStatus()).toMatchObject({ hasPendingGroup: true, undoDepth: 0, redoDepth: 0 })
  expect(harness.history.getStatus().undoUnavailableReason).toContain('Finish the active adjustment')

  const applied = await harness.history.completeGroup()
  expect(applied.status).toBe('applied')
  if (applied.status !== 'applied') throw new Error('The continuous adjustment was not applied.')
  await applied.durable
  expect(harness.workspace.cluster.name).toBe('Kestrel Reach 12')
  expect(harness.publications).toBe(1)
  expect(harness.history.getStatus()).toMatchObject({ hasPendingGroup: false, undoDepth: 1, redoDepth: 0 })
  const undo = await harness.history.undo()
  expect(undo.status).toBe('applied')
  if (undo.status === 'applied') await undo.durable
  expect(harness.workspace.cluster.name).toBe('Kestrel Reach')
  expect(harness.history.getStatus().redoDepth).toBe(1)
  harness.dispose()
})

test('a net-zero adjustment publishes nothing and keeps the existing Redo branch @pure', async () => {
  const harness = createHarness()
  const seeded = await harness.history.execute(renameRequest(harness.workspace, 'Kestrel Reach Saved'))
  expect(seeded.status).toBe('applied')
  if (seeded.status === 'applied') await seeded.durable
  const undo = await harness.history.undo()
  expect(undo.status).toBe('applied')
  if (undo.status === 'applied') await undo.durable
  const publicationsBeforeGroup = harness.publications
  const initial = harness.workspace
  const key = `${initial.cluster.id}:orbit-1:rotation:wheel`

  await harness.history.stageGroup(key, renameRequest(initial, 'Preview away'))
  await harness.history.stageGroup(key, renameRequest(initial, initial.cluster.name))
  const result = await harness.history.completeGroup()

  expect(result.status).toBe('unchanged')
  expect(harness.workspace.cluster.name).toBe('Kestrel Reach')
  expect(harness.publications).toBe(publicationsBeforeGroup)
  expect(harness.history.getStatus()).toMatchObject({ hasPendingGroup: false, undoDepth: 0, redoDepth: 1 })
  harness.dispose()
})

test('a prebuilt next request is rejected after fallback finalization changes its baseline @pure', async () => {
  const harness = createHarness()
  const initial = harness.workspace
  const key = `${initial.cluster.id}:orbit-1:vertical-radius:key`
  await harness.history.stageGroup(key, renameRequest(initial, 'Kestrel Reach Group'))

  const staleNextOperation = renameRequest(initial, 'Kestrel Reach Next')
  const next = await harness.history.execute(staleNextOperation)

  expect(next).toMatchObject({ status: 'rejected', reason: 'stale' })
  expect(harness.workspace.cluster.name).toBe('Kestrel Reach Group')
  expect(harness.history.getStatus()).toMatchObject({ undoDepth: 1, redoDepth: 0, hasPendingGroup: false })
  const fresh = await harness.history.execute(renameRequest(harness.workspace, 'Kestrel Reach Next'))
  expect(fresh.status).toBe('applied')
  if (fresh.status === 'applied') await fresh.durable
  expect(harness.workspace.cluster.name).toBe('Kestrel Reach Next')
  harness.dispose()
})

test('fallback finalization handles rejected durability while retaining the applied group @pure', async () => {
  const harness = createHarness({ durability: () => Promise.reject(new Error('IndexedDB unavailable')) })
  const initial = harness.workspace
  await harness.history.stageGroup('held-adjustment', renameRequest(initial, 'Kestrel Reach Group'))
  const unhandled: unknown[] = []
  const onUnhandled = (reason: unknown): void => { unhandled.push(reason) }
  process.on('unhandledRejection', onUnhandled)

  try {
    const next = await harness.history.execute(renameRequest(initial, 'Kestrel Reach Next'))
    await new Promise(resolve => setTimeout(resolve, 0))

    expect(next).toMatchObject({ status: 'rejected', reason: 'stale' })
    expect(harness.workspace.cluster.name).toBe('Kestrel Reach Group')
    expect(harness.history.getStatus()).toMatchObject({ undoDepth: 1, redoDepth: 0, hasPendingGroup: false })
    expect(unhandled).toEqual([])
  } finally {
    process.off('unhandledRejection', onUnhandled)
    harness.dispose()
  }
})

test('a different group key completes the previous action and rejects a prebuilt next proposal @pure', async () => {
  const harness = createHarness()
  const initial = harness.workspace
  await harness.history.stageGroup('orbit-1:horizontal:key', renameRequest(initial, 'Kestrel Reach Horizontal'))

  const next = await harness.history.stageGroup(
    'orbit-2:horizontal:key',
    renameRequest(initial, 'Kestrel Reach Vertical'),
  )

  expect(next).toMatchObject({ status: 'rejected', reason: 'stale' })
  expect(harness.workspace.cluster.name).toBe('Kestrel Reach Horizontal')
  expect(harness.history.getStatus()).toMatchObject({ hasPendingGroup: false, undoDepth: 1, redoDepth: 0 })
  harness.dispose()
})

test('different-key staging handles a rejected save without losing the completed group @pure', async () => {
  const harness = createHarness({ durability: () => Promise.reject(new Error('IndexedDB unavailable')) })
  const initial = harness.workspace
  await harness.history.stageGroup('first-adjustment', renameRequest(initial, 'Kestrel Reach First'))
  const unhandled: unknown[] = []
  const onUnhandled = (reason: unknown): void => { unhandled.push(reason) }
  process.on('unhandledRejection', onUnhandled)

  try {
    const next = await harness.history.stageGroup('second-adjustment', renameRequest(initial, 'Kestrel Reach Second'))
    await new Promise(resolve => setTimeout(resolve, 0))

    expect(next).toMatchObject({ status: 'rejected', reason: 'stale' })
    expect(harness.workspace.cluster.name).toBe('Kestrel Reach First')
    expect(harness.history.getStatus()).toMatchObject({ undoDepth: 1, redoDepth: 0, hasPendingGroup: false })
    expect(unhandled).toEqual([])
  } finally {
    process.off('unhandledRejection', onUnhandled)
    harness.dispose()
  }
})

test('stale adjustment previews are refused without overwriting a newer workspace @pure', async () => {
  const harness = createHarness()
  const initial = harness.workspace
  await harness.history.stageGroup('radius-key', renameRequest(initial, 'Kestrel Reach Preview'))
  harness.replaceWorkspace({ ...initial, cluster: { ...initial.cluster, name: 'Restored Workspace' } })

  const result = await harness.history.completeGroup()

  expect(result).toMatchObject({ status: 'rejected', reason: 'stale' })
  expect(harness.workspace.cluster.name).toBe('Restored Workspace')
  expect(harness.publications).toBe(0)
  expect(harness.history.getStatus()).toMatchObject({ hasPendingGroup: false, undoDepth: 0, redoDepth: 0 })
  harness.dispose()
})

test('canceling oversized group consent keeps applied data and history unchanged @pure', async () => {
  const harness = createHarness({ maxBytes: 1, confirmCapacity: async () => false })
  const initial = harness.workspace
  await harness.history.stageGroup('oversized-key', renameRequest(initial, 'Kestrel Reach Preview'))

  const result = await harness.history.completeGroup()

  expect(result).toMatchObject({ status: 'rejected', reason: 'cancelled' })
  expect(harness.confirmationCount).toBe(1)
  expect(harness.workspace.cluster.name).toBe('Kestrel Reach')
  expect(harness.publications).toBe(0)
  expect(harness.history.getStatus()).toMatchObject({ hasPendingGroup: false, undoDepth: 0, redoDepth: 0 })
  harness.dispose()
})

test('reset aborts an outstanding group consent without applying the preview @pure', async () => {
  let acceptCapacity: ((accepted: boolean) => void) | undefined
  const harness = createHarness({
    maxBytes: 1,
    confirmCapacity: () => new Promise(resolve => { acceptCapacity = resolve }),
  })
  await harness.history.stageGroup('oversized-key', renameRequest(harness.workspace, 'Kestrel Reach Preview'))
  const completion = harness.history.completeGroup()
  await expect.poll(() => harness.history.getStatus().isConfirmingCapacity).toBe(true)

  harness.history.reset('A new editing session starts here.')
  acceptCapacity?.(true)
  const result = await completion

  expect(result).toMatchObject({ status: 'rejected', reason: 'stale' })
  expect(harness.workspace.cluster.name).toBe('Kestrel Reach')
  expect(harness.publications).toBe(0)
  expect(harness.history.getStatus()).toMatchObject({ hasPendingGroup: false, undoDepth: 0, redoDepth: 0 })
  harness.dispose()
})

test('concurrent completion requests share one oversized-operation confirmation and publication @pure', async () => {
  let acceptCapacity: ((accepted: boolean) => void) | undefined
  const harness = createHarness({
    maxBytes: 1,
    confirmCapacity: () => new Promise(resolve => { acceptCapacity = resolve }),
  })
  await harness.history.stageGroup('oversized-key', renameRequest(harness.workspace, 'Kestrel Reach Preview'))

  const first = harness.history.completeGroup()
  const second = harness.history.completeGroup()
  expect(first).toBe(second)
  await expect.poll(() => harness.confirmationCount).toBe(1)
  expect(harness.history.getStatus()).toMatchObject({ hasPendingGroup: true, isConfirmingCapacity: true })

  acceptCapacity?.(true)
  const [firstResult, secondResult] = await Promise.all([first, second])

  expect(firstResult.status).toBe('applied')
  expect(secondResult).toBe(firstResult)
  expect(harness.confirmationCount).toBe(1)
  expect(harness.publications).toBe(1)
  expect(harness.workspace.cluster.name).toBe('Kestrel Reach Preview')
  expect(harness.history.getStatus()).toMatchObject({ hasPendingGroup: false, undoDepth: 0, redoDepth: 0, retentionReduced: true })
  harness.dispose()
})
