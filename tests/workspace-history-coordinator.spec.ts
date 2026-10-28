import { expect, test } from '@playwright/test'
import { createLocalWorkspace, type LocalWorkspace } from '../domain/workspace'
import { createWorkspaceSnapshot } from '../utils/workspace-storage'
import {
  createWorkspaceHistoryCoordinator,
  type WorkspaceHistoryCapacityDetails,
  type WorkspaceMutationAction,
  type WorkspaceMutationRequest,
} from '../composables/editor-workflows/workspace-mutations'

function renamed(current: LocalWorkspace, name: string, label = 'Rename Jump Cluster'): WorkspaceMutationRequest {
  return {
    action: { kind: 'rename', label, target: { kind: 'cluster', id: current.cluster.id } },
    prepare: workspace => ({ ...workspace, cluster: { ...workspace.cluster, name } }),
  }
}

function historyHarness(options: {
  workspace?: LocalWorkspace
  limits?: { maxActions?: number; maxBytes?: number }
  blockReason?: () => string | null
  confirmCapacity?: (details: WorkspaceHistoryCapacityDetails, signal: AbortSignal) => Promise<boolean>
  failPublication?: () => boolean
  failAfterPublication?: () => boolean
  beforePublication?: () => void
} = {}) {
  let workspace = createWorkspaceSnapshot(options.workspace ?? createLocalWorkspace('Kestrel Reach', 'Vesper'))
  let revision = 0
  let workspaceReadUnavailable = false
  let blockedReason: string | null = null
  let publishCount = 0
  const subscribers = { count: 0 }
  const history = createWorkspaceHistoryCoordinator({
    getWorkspace: () => {
      if (workspaceReadUnavailable) throw new Error('The workspace owner is temporarily unavailable.')
      return workspace
    },
    getRevision: () => revision,
    publishWorkspace: next => {
      options.beforePublication?.()
      if (options.failPublication?.()) throw new Error('The workspace writer refused the change.')
      workspace = createWorkspaceSnapshot(next)
      revision += 1
      publishCount += 1
      if (options.failAfterPublication?.()) throw new Error('The writer failed after publishing memory.')
      return { durable: Promise.resolve() }
    },
    getTraversalBlockReason: () => options.blockReason?.() ?? blockedReason,
    confirmCapacity: options.confirmCapacity ?? (async () => false),
    limits: options.limits,
  })
  const unsubscribe = history.subscribe(() => { subscribers.count += 1 })

  return {
    history,
    get workspace() { return workspace },
    get revision() { return revision },
    get publishCount() { return publishCount },
    get notificationCount() { return subscribers.count },
    set blockedReason(value: string | null) { blockedReason = value },
    set workspaceReadUnavailable(value: boolean) { workspaceReadUnavailable = value },
    setWorkspace(next: LocalWorkspace) {
      workspace = createWorkspaceSnapshot(next)
      revision += 1
    },
    dispose() {
      unsubscribe()
      history.dispose()
    },
  }
}

async function applyRename(
  history: ReturnType<typeof historyHarness>['history'],
  current: LocalWorkspace,
  name: string,
): Promise<void> {
  const result = await history.execute(renamed(current, name))
  if (result.status !== 'applied') throw new Error(`Expected an applied rename, received ${result.status}.`)
  await result.durable
}

test('saved snapshot traversal restores exact identities and a new accepted edit drops Redo @pure', async () => {
  const initial = createLocalWorkspace('Kestrel Reach', 'Vesper')
  const systemId = initial.cluster.systems[0]?.id
  const objectId = initial.cluster.systems[0]?.objects[0]?.id
  if (!systemId || !objectId) throw new Error('The workspace fixture is missing its initial system and object.')
  const harness = historyHarness({ workspace: initial })

  await applyRename(harness.history, harness.workspace, 'Kestrel Reach Prime')
  expect(harness.history.getStatus()).toMatchObject({
    undoDepth: 1,
    redoDepth: 0,
    undoAction: { label: 'Rename Jump Cluster', workspaceId: initial.id, clusterId: initial.cluster.id },
  })

  const undone = await harness.history.undo()
  expect(undone.status).toBe('applied')
  if (undone.status === 'applied') await undone.durable
  expect(harness.workspace.cluster.name).toBe('Kestrel Reach')
  expect(harness.workspace.cluster.systems[0]?.id).toBe(systemId)
  expect(harness.workspace.cluster.systems[0]?.objects[0]?.id).toBe(objectId)
  expect(harness.history.getStatus()).toMatchObject({ undoDepth: 0, redoDepth: 1 })

  await applyRename(harness.history, harness.workspace, 'Kestrel Reach Alternate')
  expect(harness.history.getStatus()).toMatchObject({ undoDepth: 1, redoDepth: 0 })
  expect(harness.workspace.cluster.name).toBe('Kestrel Reach Alternate')
  harness.dispose()
})

test('the read-only history list follows the current position and exposes detached action summaries @pure', async () => {
  const initial = createLocalWorkspace('Kestrel Reach', 'Vesper')
  const harness = historyHarness({ workspace: initial })
  expect(harness.history.getEntries()).toEqual([])

  await applyRename(harness.history, harness.workspace, 'Kestrel Reach Prime')
  await applyRename(harness.history, harness.workspace, 'Kestrel Reach North')
  const applied = harness.history.getEntries()
  expect(applied).toEqual([
    { action: { kind: 'rename', label: 'Rename Jump Cluster', target: { kind: 'cluster', id: initial.cluster.id }, workspaceId: initial.id, clusterId: initial.cluster.id, contextLabel: 'Kestrel Reach Prime' }, applied: true },
    { action: { kind: 'rename', label: 'Rename Jump Cluster', target: { kind: 'cluster', id: initial.cluster.id }, workspaceId: initial.id, clusterId: initial.cluster.id, contextLabel: 'Kestrel Reach North' }, applied: true },
  ])

  applied[0]!.action.target.id = 'mutated-copy'
  const undo = await harness.history.undo()
  expect(undo.status).toBe('applied')
  if (undo.status === 'applied') await undo.durable

  expect(harness.history.getStatus()).toMatchObject({ undoDepth: 1, redoDepth: 1 })
  expect(harness.history.getEntries()).toEqual([
    { action: { kind: 'rename', label: 'Rename Jump Cluster', target: { kind: 'cluster', id: initial.cluster.id }, workspaceId: initial.id, clusterId: initial.cluster.id, contextLabel: 'Kestrel Reach Prime' }, applied: true },
    { action: { kind: 'rename', label: 'Rename Jump Cluster', target: { kind: 'cluster', id: initial.cluster.id }, workspaceId: initial.id, clusterId: initial.cluster.id, contextLabel: 'Kestrel Reach North' }, applied: false },
  ])
  harness.history.reset('History starts after the workspace is recovered.')
  expect(harness.history.getEntries()).toEqual([])
  expect(harness.history.getStatus().notice).toBe('History starts after the workspace is recovered.')
  harness.dispose()
})

test('accepted traversal reports its direction and action descriptor after memory publication @pure', async () => {
  const initial = createLocalWorkspace('Kestrel Reach', 'Vesper')
  let publishedWorkspace: LocalWorkspace = createWorkspaceSnapshot(initial)
  let revision = 0
  const traversals: Array<{ direction: 'undo' | 'redo'; label: string; targetId: string }> = []
  const history = createWorkspaceHistoryCoordinator({
    getWorkspace: () => publishedWorkspace,
    getRevision: () => revision,
    publishWorkspace: next => {
      publishedWorkspace = createWorkspaceSnapshot(next)
      revision += 1
      return { durable: Promise.resolve() }
    },
    getTraversalBlockReason: () => null,
    confirmCapacity: async () => false,
    onTraversalApplied: ({ direction, action }) => {
      traversals.push({ direction, label: action.label, targetId: action.target.id })
    },
  })
  const rename = await history.execute(renamed(publishedWorkspace, 'Kestrel Reach Prime'))
  if (rename.status !== 'applied') throw new Error('The setup rename did not apply.')
  await rename.durable
  const undo = await history.undo()
  if (undo.status === 'applied') await undo.durable
  const redo = await history.redo()
  if (redo.status === 'applied') await redo.durable

  expect(traversals).toEqual([
    { direction: 'undo', label: 'Rename Jump Cluster', targetId: initial.cluster.id },
    { direction: 'redo', label: 'Rename Jump Cluster', targetId: initial.cluster.id },
  ])
  history.dispose()
})

test('a no-op leaves Redo available and traversal changes data before durability finishes @pure', async () => {
  let releaseSave: (() => void) | undefined
  const durable = new Promise<void>(resolve => { releaseSave = resolve })
  let current: LocalWorkspace = createWorkspaceSnapshot(createLocalWorkspace('Kestrel Reach', 'Vesper'))
  let revision = 0
  let isSaved = true
  const history = createWorkspaceHistoryCoordinator({
    getWorkspace: () => current,
    getRevision: () => revision,
    publishWorkspace: next => {
      current = createWorkspaceSnapshot(next)
      revision += 1
      isSaved = false
      const thisRevision = revision
      return {
        durable: durable.then(() => {
          if (revision === thisRevision) isSaved = true
        }),
      }
    },
    getTraversalBlockReason: () => isSaved ? null : 'Save the latest workspace change first.',
    confirmCapacity: async () => false,
  })

  const first = await history.execute(renamed(current, 'Kestrel Reach Prime'))
  expect(first.status).toBe('applied')
  if (first.status === 'applied') {
    const noop = await history.execute({
      action: { kind: 'rename', label: 'Rename Jump Cluster', target: { kind: 'cluster', id: current.cluster.id } },
      prepare: workspace => workspace,
    })
    expect(noop.status).toBe('unchanged')
    expect(history.getStatus().undoDepth).toBe(1)
    expect(history.getStatus().redoDepth).toBe(0)
    releaseSave?.()
    await first.durable
  }
  const undone = await history.undo()
  expect(undone.status).toBe('applied')
  expect(current.cluster.name).toBe('Kestrel Reach')
  expect(history.getStatus().redoDepth).toBe(1)
  history.dispose()
})

test('prefix eviction retains a contiguous restorable suffix under the action limit @pure', async () => {
  const harness = historyHarness({ limits: { maxActions: 2 } })

  await applyRename(harness.history, harness.workspace, 'Reach 1')
  await applyRename(harness.history, harness.workspace, 'Reach 2')
  await applyRename(harness.history, harness.workspace, 'Reach 3')

  expect(harness.history.getStatus()).toMatchObject({ undoDepth: 2, redoDepth: 0, totalActions: 2, retentionReduced: true })
  expect(harness.history.getEntries()).toHaveLength(2)
  expect(harness.history.getEntries().every(entry => entry.applied)).toBe(true)
  const firstUndo = await harness.history.undo()
  if (firstUndo.status === 'applied') await firstUndo.durable
  expect(harness.workspace.cluster.name).toBe('Reach 2')
  const secondUndo = await harness.history.undo()
  if (secondUndo.status === 'applied') await secondUndo.durable
  expect(harness.workspace.cluster.name).toBe('Reach 1')
  expect(harness.history.getStatus().undoUnavailableReason).toBe('There is nothing to undo.')
  expect(harness.history.getStatus().notice).toContain('Older Undo history was removed')
  harness.dispose()
})

test('100 actions fit exactly and action 101 evicts only the oldest Undo edge @pure', async () => {
  const harness = historyHarness({ limits: { maxActions: 100 } })

  for (let action = 1; action <= 100; action += 1) {
    await applyRename(harness.history, harness.workspace, `Reach ${action}`)
  }
  expect(harness.history.getStatus()).toMatchObject({ undoDepth: 100, redoDepth: 0, totalActions: 100, retentionReduced: false })

  await applyRename(harness.history, harness.workspace, 'Reach 101')
  expect(harness.history.getStatus()).toMatchObject({ undoDepth: 100, redoDepth: 0, totalActions: 100, retentionReduced: true })

  for (let action = 0; action < 100; action += 1) {
    const result = await harness.history.undo()
    if (result.status === 'applied') await result.durable
  }
  expect(harness.workspace.cluster.name).toBe('Reach 1')
  expect(harness.history.getStatus()).toMatchObject({ undoDepth: 0, redoDepth: 100 })
  harness.dispose()
})

test('a capacity cancellation after Undo preserves the existing Redo branch @pure', async () => {
  const workspace = createLocalWorkspace('Kestrel Reach', 'Vesper')
  const measurement = historyHarness({ workspace })
  await applyRename(measurement.history, measurement.workspace, 'Kestrel Reach Prime')
  const oneActionBytes = measurement.history.getStatus().retainedBytes
  measurement.dispose()

  let confirmations = 0
  const branch = historyHarness({
    workspace,
    limits: { maxBytes: oneActionBytes, maxActions: 100 },
    confirmCapacity: async () => {
      confirmations += 1
      return false
    },
  })
  await applyRename(branch.history, branch.workspace, 'Kestrel Reach Prime')
  const undone = await branch.history.undo()
  if (undone.status === 'applied') await undone.durable
  const beforeBranch = branch.history.getStatus()
  const canceled = await branch.history.execute({
    action: { kind: 'rename', label: 'L'.repeat(160), target: { kind: 'cluster', id: branch.workspace.cluster.id } },
    prepare: current => ({ ...current, cluster: { ...current.cluster, name: 'Alternate Reach' } }),
  })

  expect(canceled).toMatchObject({ status: 'rejected', reason: 'cancelled' })
  expect(branch.workspace.cluster.name).toBe('Kestrel Reach')
  expect(branch.history.getStatus()).toMatchObject({
    undoDepth: 0,
    redoDepth: 1,
    retainedBytes: beforeBranch.retainedBytes,
    redoAction: { label: 'Rename Jump Cluster' },
  })
  expect(confirmations).toBe(1)
  branch.dispose()
})

test('retained bytes count canonical UTF-8 workspace nodes and their action descriptor exactly @pure', async () => {
  const initial = createLocalWorkspace('星雲 🚀 reach', 'Vesper')
  const nextName = '星雲 🚀 reaches — édition'
  const harness = historyHarness({ workspace: initial })
  const result = await harness.history.execute(renamed(harness.workspace, nextName))
  expect(result.status).toBe('applied')

  const status = harness.history.getStatus()
  const next = createWorkspaceSnapshot({
    ...initial,
    cluster: { ...initial.cluster, name: nextName },
  })
  const action: WorkspaceMutationAction = {
    kind: 'rename',
    label: 'Rename Jump Cluster',
    target: { kind: 'cluster', id: initial.cluster.id },
  }
  const metadata = {
    workspaceId: initial.id,
    clusterId: initial.cluster.id,
    ...action,
    contextLabel: nextName,
  }
  const expectedBytes = new TextEncoder().encode(JSON.stringify(initial)).byteLength
    + new TextEncoder().encode(JSON.stringify(next)).byteLength
    + new TextEncoder().encode(JSON.stringify(metadata)).byteLength

  expect(status.retainedBytes).toBe(expectedBytes)
  expect(status.retainedBytes).toBeGreaterThan(JSON.stringify(initial).length + JSON.stringify(next).length)
  if (result.status === 'applied') await result.durable
  harness.dispose()
})

test('adjacent history actions count their shared workspace snapshot node once @pure', async () => {
  const initial = createLocalWorkspace('Kestrel Reach', 'Vesper')
  const middle = createWorkspaceSnapshot({
    ...initial,
    cluster: { ...initial.cluster, name: 'Middle Reach' },
  })
  const final = createWorkspaceSnapshot({
    ...initial,
    cluster: { ...initial.cluster, name: 'Final Reach' },
  })
  const harness = historyHarness({ workspace: initial })
  await applyRename(harness.history, harness.workspace, middle.cluster.name)
  await applyRename(harness.history, harness.workspace, final.cluster.name)

  const action: WorkspaceMutationAction = {
    kind: 'rename',
    label: 'Rename Jump Cluster',
    target: { kind: 'cluster', id: initial.cluster.id },
  }
  const descriptorBytes = [middle.cluster.name, final.cluster.name]
    .reduce((total, contextLabel) => total + new TextEncoder().encode(JSON.stringify({
      workspaceId: initial.id,
      clusterId: initial.cluster.id,
      ...action,
      contextLabel,
    })).byteLength, 0)
  const expected = new TextEncoder().encode(JSON.stringify(initial)).byteLength
    + new TextEncoder().encode(JSON.stringify(middle)).byteLength
    + new TextEncoder().encode(JSON.stringify(final)).byteLength
    + descriptorBytes

  expect(harness.history.getStatus()).toMatchObject({ undoDepth: 2, redoDepth: 0, retainedBytes: expected })
  harness.dispose()
})

test('exact byte capacity fits and one byte less requires consent without changing data or history @pure', async () => {
  const workspace = createLocalWorkspace('Kestrel Reach', 'Vesper')
  const measurement = historyHarness({ workspace })
  await applyRename(measurement.history, measurement.workspace, 'Kestrel Reach Prime')
  const exactLimit = measurement.history.getStatus().retainedBytes
  measurement.dispose()

  let exactConfirmations = 0
  const exact = historyHarness({ workspace, limits: { maxBytes: exactLimit, maxActions: 100 }, confirmCapacity: async () => {
    exactConfirmations += 1
    return false
  } })
  await applyRename(exact.history, exact.workspace, 'Kestrel Reach Prime')
  expect(exact.history.getStatus().retainedBytes).toBe(exactLimit)
  expect(exactConfirmations).toBe(0)
  exact.dispose()

  let offered: WorkspaceHistoryCapacityDetails | null = null
  const over = historyHarness({
    workspace,
    limits: { maxBytes: exactLimit - 1, maxActions: 100 },
    confirmCapacity: async details => {
      offered = details
      return false
    },
  })
  const current = over.workspace
  const rejected = await over.history.execute(renamed(current, 'Kestrel Reach Prime'))
  expect(rejected).toMatchObject({ status: 'rejected', reason: 'cancelled' })
  expect(over.workspace).toEqual(current)
  expect(over.history.getStatus()).toMatchObject({ totalActions: 0, retainedBytes: 0, undoDepth: 0, redoDepth: 0 })
  expect(offered).toMatchObject({ projectedBytes: exactLimit, maxBytes: exactLimit - 1 })
  over.dispose()
})

test('accepting an oversized action publishes it as a non-undoable empty-history baseline @pure', async () => {
  const workspace = createLocalWorkspace('Kestrel Reach', 'Vesper')
  const measurement = historyHarness({ workspace })
  await applyRename(measurement.history, measurement.workspace, 'Kestrel Reach Prime')
  const oneActionBytes = measurement.history.getStatus().retainedBytes
  measurement.dispose()

  let promptCount = 0
  const oversized = historyHarness({
    workspace,
    limits: { maxBytes: oneActionBytes - 1, maxActions: 100 },
    confirmCapacity: async () => {
      promptCount += 1
      return true
    },
  })
  const applied = await oversized.history.execute(renamed(oversized.workspace, 'Kestrel Reach Prime'))

  expect(applied.status).toBe('applied')
  if (applied.status === 'applied') await applied.durable
  expect(oversized.workspace.cluster.name).toBe('Kestrel Reach Prime')
  expect(oversized.history.getStatus()).toMatchObject({
    totalActions: 0,
    retainedBytes: 0,
    undoDepth: 0,
    redoDepth: 0,
    retentionReduced: true,
    notice: 'This action cannot be undone. It cleared the retained history.',
  })
  expect(oversized.history.getStatus().undoUnavailableReason).toBe('There is nothing to undo.')
  expect(oversized.history.getEntries()).toEqual([])
  expect(promptCount).toBe(1)
  oversized.dispose()
})

test('writer rejection and cancellation preserve both sides of the timeline @pure', async () => {
  let failNextPublication = false
  const harness = historyHarness({ failPublication: () => {
    if (!failNextPublication) return false
    failNextPublication = false
    return true
  } })
  await applyRename(harness.history, harness.workspace, 'Kestrel Reach Prime')
  await harness.history.undo()
  expect(harness.history.getStatus()).toMatchObject({ undoDepth: 0, redoDepth: 1 })
  failNextPublication = true
  const refused = await harness.history.execute(renamed(harness.workspace, 'A new branch'))

  expect(refused).toMatchObject({ status: 'rejected', reason: 'failed' })
  expect(harness.workspace.cluster.name).toBe('Kestrel Reach')
  expect(harness.history.getStatus()).toMatchObject({ undoDepth: 0, redoDepth: 1 })
  harness.dispose()
})

test('a synchronous writer failure after memory publication keeps the matching history edge @pure', async () => {
  let failOnce = true
  const harness = historyHarness({ failAfterPublication: () => {
    if (!failOnce) return false
    failOnce = false
    return true
  } })

  const applied = await harness.history.execute(renamed(harness.workspace, 'Visible Reach'))

  expect(applied.status).toBe('applied')
  expect(harness.workspace.cluster.name).toBe('Visible Reach')
  expect(harness.history.getStatus()).toMatchObject({ undoDepth: 1, redoDepth: 0 })
  if (applied.status === 'applied') {
    await expect(applied.durable).rejects.toThrow('The writer failed after publishing memory.')
  }
  harness.dispose()
})

test('external traversal blockers are checked again at command entry and remain readable @pure', async () => {
  const harness = historyHarness()
  await applyRename(harness.history, harness.workspace, 'Kestrel Reach Prime')
  harness.blockedReason = 'Save the latest workspace change first.'

  expect(harness.history.getStatus().undoUnavailableReason).toBe('Save the latest workspace change first.')
  const result = await harness.history.undo()
  expect(result).toMatchObject({ status: 'rejected', reason: 'unavailable', message: 'Save the latest workspace change first.' })
  expect(harness.workspace.cluster.name).toBe('Kestrel Reach Prime')
  expect(harness.history.getStatus().undoDepth).toBe(1)
  harness.dispose()
})

test('a temporary workspace identity read failure preserves history and disables traversal @pure', async () => {
  const harness = historyHarness()
  await applyRename(harness.history, harness.workspace, 'Kestrel Reach Prime')
  harness.workspaceReadUnavailable = true

  const unavailable = harness.history.getStatus()
  expect(unavailable).toMatchObject({
    totalActions: 1,
    undoDepth: 1,
    redoDepth: 0,
    undoUnavailableReason: 'Workspace history is unavailable: The workspace owner is temporarily unavailable.',
  })
  expect(await harness.history.undo()).toMatchObject({ status: 'rejected', reason: 'unavailable' })
  expect(harness.history.getStatus().undoDepth).toBe(1)

  harness.workspaceReadUnavailable = false
  expect(harness.history.getStatus()).toMatchObject({ totalActions: 1, undoDepth: 1, undoUnavailableReason: null })
  const undo = await harness.history.undo()
  expect(undo.status).toBe('applied')
  expect(harness.workspace.cluster.name).toBe('Kestrel Reach')
  harness.dispose()
})

test('reentrant writer and synchronous subscriber commands are refused during publication @pure', async () => {
  let harness: ReturnType<typeof historyHarness> | null = null
  let listenerAttempt: Promise<unknown> | null = null
  let writerAttempt: Promise<unknown> | null = null
  let listenerEntered = false
  harness = historyHarness({
    beforePublication: () => {
      if (writerAttempt || !harness) return
      writerAttempt = harness.history.execute(renamed(harness.workspace, 'Writer reentry'))
    },
  })
  const unsubscribe = harness.history.subscribe(() => {
    if (listenerEntered || !harness || !harness.history.getStatus().isBusy) return
    listenerEntered = true
    listenerAttempt = harness.history.undo()
  })

  const outer = await harness.history.execute(renamed(harness.workspace, 'Published once'))
  expect(outer.status).toBe('applied')
  expect(await listenerAttempt).toMatchObject({ status: 'rejected', reason: 'busy' })
  expect(await writerAttempt).toMatchObject({ status: 'rejected', reason: 'busy' })
  expect(harness.publishCount).toBe(1)
  expect(harness.workspace.cluster.name).toBe('Published once')
  expect(harness.history.getStatus()).toMatchObject({ undoDepth: 1, redoDepth: 0 })
  unsubscribe()
  harness.dispose()
})

test('reset from a synchronous publication observer prevents stale Undo from publishing @pure', async () => {
  const harness = historyHarness()
  await applyRename(harness.history, harness.workspace, 'Kestrel Reach Prime')
  let resetInObserver = false
  const unsubscribe = harness.history.subscribe(() => {
    if (resetInObserver || !harness.history.getStatus().isBusy) return
    resetInObserver = true
    harness.history.reset('The editing baseline changed.')
  })

  const undo = await harness.history.undo()

  expect(undo).toMatchObject({ status: 'rejected', reason: 'stale' })
  expect(harness.workspace.cluster.name).toBe('Kestrel Reach Prime')
  expect(harness.publishCount).toBe(1)
  expect(harness.history.getStatus()).toMatchObject({
    totalActions: 0,
    undoDepth: 0,
    redoDepth: 0,
    notice: 'The editing baseline changed.',
  })
  unsubscribe()
  harness.dispose()
})

test('disposal from a synchronous publication observer prevents stale Redo from publishing @pure', async () => {
  const harness = historyHarness()
  await applyRename(harness.history, harness.workspace, 'Kestrel Reach Prime')
  const undo = await harness.history.undo()
  if (undo.status === 'applied') await undo.durable
  let disposeInObserver = false
  const unsubscribe = harness.history.subscribe(() => {
    if (disposeInObserver || !harness.history.getStatus().isBusy) return
    disposeInObserver = true
    harness.history.dispose()
  })

  const redo = await harness.history.redo()

  expect(redo).toMatchObject({ status: 'rejected', reason: 'stale' })
  expect(harness.workspace.cluster.name).toBe('Kestrel Reach')
  expect(harness.publishCount).toBe(2)
  unsubscribe()
  harness.dispose()
})

test('reset from a synchronous mutation observer prevents the unpublished action @pure', async () => {
  const harness = historyHarness()
  let resetInObserver = false
  const unsubscribe = harness.history.subscribe(() => {
    if (resetInObserver || !harness.history.getStatus().isBusy) return
    resetInObserver = true
    harness.history.reset('A new editing baseline was selected.')
  })

  const result = await harness.history.execute(renamed(harness.workspace, 'Must not publish'))

  expect(result).toMatchObject({ status: 'rejected', reason: 'stale' })
  expect(harness.workspace.cluster.name).toBe('Kestrel Reach')
  expect(harness.publishCount).toBe(0)
  expect(harness.history.getStatus()).toMatchObject({ totalActions: 0, notice: 'A new editing baseline was selected.' })
  unsubscribe()
  harness.dispose()
})

test('reset during capacity-status notification prevents opening a stale consent prompt @pure', async () => {
  const workspace = createLocalWorkspace('Kestrel Reach', 'Vesper')
  const measurement = historyHarness({ workspace })
  await applyRename(measurement.history, measurement.workspace, 'Kestrel Reach Prime')
  const oneActionBytes = measurement.history.getStatus().retainedBytes
  measurement.dispose()

  let confirmCount = 0
  const capacity = historyHarness({
    workspace,
    limits: { maxBytes: oneActionBytes - 1, maxActions: 100 },
    confirmCapacity: async () => {
      confirmCount += 1
      return true
    },
  })
  let resetInObserver = false
  const unsubscribe = capacity.history.subscribe(() => {
    if (resetInObserver || !capacity.history.getStatus().isConfirmingCapacity) return
    resetInObserver = true
    capacity.history.reset('The workspace session ended.')
  })

  const result = await capacity.history.execute(renamed(capacity.workspace, 'Kestrel Reach Prime'))

  expect(result).toMatchObject({ status: 'rejected', reason: 'stale' })
  expect(confirmCount).toBe(0)
  expect(capacity.workspace.cluster.name).toBe('Kestrel Reach')
  expect(capacity.history.getStatus()).toMatchObject({ isBusy: false, isConfirmingCapacity: false, totalActions: 0 })
  unsubscribe()
  capacity.dispose()
})

test('a changed request owner after capacity consent leaves the existing Redo branch intact @pure', async () => {
  const workspace = createLocalWorkspace('Kestrel Reach', 'Vesper')
  const measurement = historyHarness({ workspace })
  await applyRename(measurement.history, measurement.workspace, 'Kestrel Reach Prime')
  const oneActionBytes = measurement.history.getStatus().retainedBytes
  measurement.dispose()

  let resolveConsent: ((accepted: boolean) => void) | undefined
  const branch = historyHarness({
    workspace,
    limits: { maxBytes: oneActionBytes, maxActions: 100 },
    confirmCapacity: () => new Promise(resolve => { resolveConsent = resolve }),
  })
  await applyRename(branch.history, branch.workspace, 'Kestrel Reach Prime')
  const undone = await branch.history.undo()
  if (undone.status === 'applied') await undone.durable
  let requestStillOwned = true
  const pending = branch.history.execute({
    action: { kind: 'rename', label: 'L'.repeat(160), target: { kind: 'cluster', id: branch.workspace.cluster.id } },
    isCurrent: () => requestStillOwned,
    prepare: current => ({ ...current, cluster: { ...current.cluster, name: 'Alternate Reach' } }),
  })
  requestStillOwned = false
  resolveConsent?.(true)

  expect(await pending).toMatchObject({ status: 'rejected', reason: 'stale' })
  expect(branch.workspace.cluster.name).toBe('Kestrel Reach')
  expect(branch.history.getStatus()).toMatchObject({ undoDepth: 0, redoDepth: 1 })
  branch.dispose()
})

test('a failed traversal save retains its moved cursor and blocks more traversal until Retry @pure', async () => {
  let workspace: LocalWorkspace = createWorkspaceSnapshot(createLocalWorkspace('Kestrel Reach', 'Vesper'))
  let revision = 0
  let saved = true
  let rejectTraversalSave: ((error: Error) => void) | undefined
  let failTraversalSave = false
  const history = createWorkspaceHistoryCoordinator({
    getWorkspace: () => workspace,
    getRevision: () => revision,
    publishWorkspace: next => {
      workspace = createWorkspaceSnapshot(next)
      revision += 1
      if (!failTraversalSave) return { durable: Promise.resolve() }
      failTraversalSave = false
      saved = false
      return {
        durable: new Promise<void>((_resolve, reject) => { rejectTraversalSave = reject }),
      }
    },
    getTraversalBlockReason: () => saved ? null : 'Retry saving the current workspace before using Undo or Redo.',
    confirmCapacity: async () => false,
  })
  const edit = await history.execute(renamed(workspace, 'Kestrel Reach Prime'))
  if (edit.status !== 'applied') throw new Error('The setup rename was not applied.')
  await edit.durable

  failTraversalSave = true
  const undo = await history.undo()
  expect(undo.status).toBe('applied')
  expect(workspace.cluster.name).toBe('Kestrel Reach')
  expect(history.getStatus()).toMatchObject({ undoDepth: 0, redoDepth: 1 })
  expect(history.getStatus().redoUnavailableReason).toBe('Retry saving the current workspace before using Undo or Redo.')
  if (undo.status === 'applied') {
    rejectTraversalSave?.(new Error('IndexedDB rejected the restored snapshot.'))
    await expect(undo.durable).rejects.toThrow('IndexedDB rejected the restored snapshot.')
  }

  const blockedRedo = await history.redo()
  expect(blockedRedo).toMatchObject({ status: 'rejected', reason: 'unavailable' })
  expect(workspace.cluster.name).toBe('Kestrel Reach')
  expect(history.getStatus()).toMatchObject({ undoDepth: 0, redoDepth: 1 })
  saved = true
  expect(history.getStatus().redoUnavailableReason).toBeNull()
  const redo = await history.redo()
  expect(redo.status).toBe('applied')
  expect(workspace.cluster.name).toBe('Kestrel Reach Prime')
  if (redo.status === 'applied') await redo.durable
  history.dispose()
})

test('reset aborts an outstanding capacity question without applying the proposal @pure', async () => {
  const workspace = createLocalWorkspace('Kestrel Reach', 'Vesper')
  const measurement = historyHarness({ workspace })
  await applyRename(measurement.history, measurement.workspace, 'Kestrel Reach Prime')
  const actionBytes = measurement.history.getStatus().retainedBytes
  measurement.dispose()

  let resolveConsent: ((accepted: boolean) => void) | undefined
  const pending = historyHarness({
    workspace,
    limits: { maxBytes: actionBytes - 1, maxActions: 100 },
    confirmCapacity: () => new Promise(resolve => { resolveConsent = resolve }),
  })
  const request = pending.history.execute(renamed(pending.workspace, 'Kestrel Reach Prime'))
  expect(pending.history.getStatus()).toMatchObject({ isBusy: true, isConfirmingCapacity: true })

  pending.history.reset('History starts at the recovered workspace.')
  const result = await request

  expect(result).toMatchObject({ status: 'rejected', reason: 'stale' })
  expect(pending.workspace.cluster.name).toBe('Kestrel Reach')
  expect(pending.history.getStatus()).toMatchObject({
    isBusy: false,
    isConfirmingCapacity: false,
    totalActions: 0,
    retainedBytes: 0,
    notice: 'History starts at the recovered workspace.',
  })
  resolveConsent?.(true)
  pending.dispose()
})

test('a stale consent result cannot apply an action to a newer workspace revision @pure', async () => {
  const workspace = createLocalWorkspace('Kestrel Reach', 'Vesper')
  const measurement = historyHarness({ workspace })
  await applyRename(measurement.history, measurement.workspace, 'Kestrel Reach Prime')
  const actionBytes = measurement.history.getStatus().retainedBytes
  measurement.dispose()

  let resolveConsent: ((accepted: boolean) => void) | undefined
  const stale = historyHarness({
    workspace,
    limits: { maxBytes: actionBytes - 1, maxActions: 100 },
    confirmCapacity: () => new Promise(resolve => { resolveConsent = resolve }),
  })
  const request = stale.history.execute(renamed(stale.workspace, 'Kestrel Reach Prime'))
  stale.setWorkspace({ ...stale.workspace, cluster: { ...stale.workspace.cluster, name: 'Externally changed' } })
  resolveConsent?.(true)
  const result = await request

  expect(result).toMatchObject({ status: 'rejected', reason: 'stale' })
  expect(stale.workspace.cluster.name).toBe('Externally changed')
  expect(stale.history.getStatus()).toMatchObject({ totalActions: 0, retainedBytes: 0 })
  stale.dispose()
})

test('traversal publishes its result and cursor before its durable acknowledgement settles @pure', async () => {
  let releaseTraversalSave: (() => void) | undefined
  let isSaved = true
  let revision = 0
  let workspace: LocalWorkspace = createWorkspaceSnapshot(createLocalWorkspace('Kestrel Reach', 'Vesper'))
  const history = createWorkspaceHistoryCoordinator({
    getWorkspace: () => workspace,
    getRevision: () => revision,
    publishWorkspace: next => {
      workspace = createWorkspaceSnapshot(next)
      revision += 1
      if (workspace.cluster.name === 'Kestrel Reach') {
        isSaved = false
        return { durable: new Promise<void>(resolve => { releaseTraversalSave = () => { isSaved = true; resolve() } }) }
      }
      return { durable: Promise.resolve() }
    },
    getTraversalBlockReason: () => isSaved ? null : 'Save the latest workspace change first.',
    confirmCapacity: async () => false,
  })
  const edit = await history.execute(renamed(workspace, 'Kestrel Reach Prime'))
  if (edit.status !== 'applied') throw new Error('The setup rename did not apply.')
  await edit.durable

  const undo = await history.undo()
  expect(undo.status).toBe('applied')
  expect(workspace.cluster.name).toBe('Kestrel Reach')
  expect(history.getStatus()).toMatchObject({ undoDepth: 0, redoDepth: 1 })
  expect(history.getStatus().redoUnavailableReason).toBe('Save the latest workspace change first.')
  if (undo.status === 'applied') {
    releaseTraversalSave?.()
    await undo.durable
  }
  expect(history.getStatus().redoUnavailableReason).toBeNull()
  history.dispose()
})
