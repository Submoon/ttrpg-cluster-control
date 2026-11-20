import { expect, test } from '@playwright/test'
import { ref, shallowRef } from 'vue'
import { createLocalWorkspace, type LocalWorkspace } from '../domain/workspace'
import { resolveSystemObjectHistoryTarget } from '../domain/workspace'
import { useSystemObjectTransferWorkflow } from '../composables/editor-workflows/useSystemObjectTransferWorkflow'
import {
  createWorkspaceHistoryCoordinator,
  type WorkspaceHistoryCoordinator,
} from '../composables/editor-workflows/workspace-mutations'

function transferWorkspace(): { workspace: LocalWorkspace; sourceSystemId: string; destinationSystemId: string; rootObjectId: string } {
  const base = createLocalWorkspace('Kestrel Reach', 'Source')
  const source = base.cluster.systems[0]!
  const root = source.objects[0]!
  const destination = { ...source, id: 'destination', name: 'Destination', objects: [], orbits: [] }
  return {
    workspace: {
      ...base,
      cluster: { ...base.cluster, systems: [source, destination] },
      layout: {
        ...base.layout,
        systemPositions: { ...base.layout.systemPositions, [destination.id]: { x: 0.7, y: 0.6 } },
      },
    },
    sourceSystemId: source.id,
    destinationSystemId: destination.id,
    rootObjectId: root.id,
  }
}

function transferHarness(options: {
  maxBytes?: number
  resolveBeforeDrop?: Parameters<typeof useSystemObjectTransferWorkflow>[0]['resolveBeforeDrop']
} = {}) {
  const { workspace: fixture, sourceSystemId, destinationSystemId, rootObjectId } = transferWorkspace()
  const workspace = shallowRef(fixture)
  const revision = ref(0)
  const destinationOwner = { renderer: 'destination' }
  let currentDestinationOwner: object | null = destinationOwner
  let publishCount = 0
  let capacityPromptCount = 0
  const history: WorkspaceHistoryCoordinator = createWorkspaceHistoryCoordinator({
    getWorkspace: () => workspace.value,
    getRevision: () => revision.value,
    publishWorkspace(next) {
      workspace.value = next
      revision.value += 1
      publishCount += 1
      return { durable: Promise.resolve() }
    },
    getTraversalBlockReason: () => null,
    confirmCapacity: async () => {
      capacityPromptCount += 1
      return true
    },
    limits: options.maxBytes === undefined ? undefined : { maxBytes: options.maxBytes, maxActions: 100 },
  })
  const workflow = useSystemObjectTransferWorkflow({
    workspace,
    appliedRevision: revision,
    history,
    resolveBeforeTransfer: async () => true,
    resolveBeforeDrop: options.resolveBeforeDrop,
    beforeWorkspaceOperation: async () => true,
    captureDestinationMapOwner: systemId => systemId === destinationSystemId ? currentDestinationOwner : null,
    isDestinationMapOwnerCurrent: (systemId, owner) => systemId === destinationSystemId && owner === currentDestinationOwner,
  })
  return {
    workspace,
    revision,
    history,
    workflow,
    sourceSystemId,
    destinationSystemId,
    rootObjectId,
    destinationOwner,
    get publishCount() { return publishCount },
    get capacityPromptCount() { return capacityPromptCount },
    setDestinationOwner(owner: object | null) { currentDestinationOwner = owner },
    dispose() {
      workflow.dispose()
      history.dispose()
    },
  }
}

async function openTransfer(harness: ReturnType<typeof transferHarness>): Promise<number> {
  await harness.workflow.handleIntent({
    kind: 'open',
    sourceSystemId: harness.sourceSystemId,
    rootObjectId: harness.rootObjectId,
  })
  const sessionId = harness.workflow.session.value?.sessionId
  if (sessionId === undefined) throw new Error('The transfer review did not open.')
  await harness.workflow.handleIntent({ kind: 'select-destination', sessionId, systemId: harness.destinationSystemId })
  await harness.workflow.handleIntent({ kind: 'choose-free-placement', sessionId, point: { x: 0.6, y: 0.4 } })
  return sessionId
}

test('one accepted transfer publishes once and actual-owner history target follows Undo and Redo @pure', async () => {
  const harness = transferHarness()
  const sessionId = await openTransfer(harness)
  const result = await harness.workflow.handleIntent({ kind: 'apply', sessionId })

  expect(result?.status, JSON.stringify(result)).toBe('applied')
  if (result?.status === 'applied') await result.durable
  expect(harness.publishCount).toBe(1)
  expect(harness.history.getStatus()).toMatchObject({ undoDepth: 1, redoDepth: 0, undoAction: { kind: 'transfer' } })
  expect(resolveSystemObjectHistoryTarget(harness.workspace.value, harness.rootObjectId))
    .toEqual({ kind: 'object', id: harness.rootObjectId, systemId: harness.destinationSystemId })

  const undone = await harness.history.undo()
  expect(undone.status).toBe('applied')
  if (undone.status === 'applied') await undone.durable
  expect(resolveSystemObjectHistoryTarget(harness.workspace.value, harness.rootObjectId))
    .toEqual({ kind: 'object', id: harness.rootObjectId, systemId: harness.sourceSystemId })

  const redone = await harness.history.redo()
  expect(redone.status).toBe('applied')
  if (redone.status === 'applied') await redone.durable
  expect(resolveSystemObjectHistoryTarget(harness.workspace.value, harness.rootObjectId))
    .toEqual({ kind: 'object', id: harness.rootObjectId, systemId: harness.destinationSystemId })
  harness.dispose()
})

test('a drop in another system publishes the transfer and starting frame as one action @pure', async () => {
  const harness = transferHarness()
  const before = harness.workspace.value
  const placement = { kind: 'system' as const, x: 0.61, y: 0.39 }
  const frame = { left: 60, top: 30, right: 80, bottom: 30 }
  const destinationFrame = { left: 45, top: 30, right: 55, bottom: 45 }
  try {
    await harness.workflow.dropObject({
      sourceSystemId: harness.sourceSystemId,
      rootObjectId: harness.rootObjectId,
      destinationSystemId: harness.destinationSystemId,
      workspaceSnapshot: before,
      sourceFrameInsets: frame,
      destinationFrameInsets: destinationFrame,
      placement,
    })
    expect(harness.workflow.session.value).toBeNull()
    expect(harness.publishCount).toBe(1)
    expect(harness.workspace.value.layout.systemFrames?.[harness.sourceSystemId]).toEqual(frame)
    expect(harness.workspace.value.layout.systemFrames?.[harness.destinationSystemId]).toEqual(destinationFrame)
    const moved = harness.workspace.value.cluster.systems.find(system => system.id === harness.destinationSystemId)
      ?.objects.find(object => object.id === harness.rootObjectId)
    expect(moved?.placement).toEqual(placement)
    expect((await harness.history.undo()).status).toBe('applied')
    expect(harness.workspace.value).toEqual(before)
  } finally {
    harness.dispose()
  }
})

test('a drop with a conflicting key keeps its chosen location in review until accepted @pure', async () => {
  const harness = transferHarness()
  const workspace = harness.workspace.value
  const [source, destination] = workspace.cluster.systems
  if (!source || !destination || !source.objects[0]) throw new Error('Expected a source object and two systems.')
  const existing = { ...source.objects[0], id: 'destination-occupant' }
  const before = {
    ...workspace,
    cluster: { ...workspace.cluster, systems: [source, { ...destination, objects: [existing] }] },
  }
  harness.workspace.value = before
  const placement = { kind: 'system' as const, x: 0.61, y: 0.39 }
  try {
    await harness.workflow.dropObject({
      sourceSystemId: harness.sourceSystemId,
      rootObjectId: harness.rootObjectId,
      destinationSystemId: harness.destinationSystemId,
      workspaceSnapshot: before,
      placement,
    })
    const review = harness.workflow.session.value
    expect(review?.open).toBe(true)
    expect(review?.placement).toEqual(placement)
    expect(review?.review?.keyConflicts).toHaveLength(1)
    expect(harness.publishCount).toBe(0)
    expect(harness.workspace.value).toBe(before)
    if (!review) throw new Error('The conflict needs an explicit transfer review.')
    const result = await harness.workflow.handleIntent({ kind: 'apply', sessionId: review.sessionId })
    expect(result?.status).toBe('applied')
    expect(harness.publishCount).toBe(1)
  } finally {
    harness.dispose()
  }
})

test('a drop never rebases onto a workspace revision published outside its draft guard @pure', async () => {
  let finishGuard!: () => void
  const waiting = new Promise<void>(resolve => { finishGuard = resolve })
  let beginGuard!: () => void
  const started = new Promise<void>(resolve => { beginGuard = resolve })
  const harness = transferHarness({
    resolveBeforeDrop: async () => {
      beginGuard()
      await waiting
      return true
    },
  })
  try {
    const pending = harness.workflow.dropObject({
      sourceSystemId: harness.sourceSystemId,
      rootObjectId: harness.rootObjectId,
      destinationSystemId: harness.destinationSystemId,
      workspaceSnapshot: harness.workspace.value,
      placement: { kind: 'system', x: 0.61, y: 0.39 },
    })
    await started
    const newer = {
      ...harness.workspace.value,
      cluster: { ...harness.workspace.value.cluster, name: 'Changed elsewhere' },
    }
    harness.workspace.value = newer
    harness.revision.value += 1
    finishGuard()
    await pending
    expect(harness.workflow.session.value).toBeNull()
    expect(harness.workspace.value).toBe(newer)
    expect(harness.publishCount).toBe(0)
  } finally {
    finishGuard()
    harness.dispose()
  }
})

test('an oversized transfer is rejected before capacity consent or publication @pure', async () => {
  const harness = transferHarness({ maxBytes: 0 })
  const before = harness.workspace.value
  const sessionId = await openTransfer(harness)
  const result = await harness.workflow.handleIntent({ kind: 'apply', sessionId })

  expect(result, JSON.stringify(result)).toMatchObject({ status: 'rejected', reason: 'unavailable' })
  expect(harness.capacityPromptCount).toBe(0)
  expect(harness.publishCount).toBe(0)
  expect(harness.workspace.value).toBe(before)
  expect(harness.history.getStatus()).toMatchObject({ undoDepth: 0, redoDepth: 0, totalActions: 0 })
  expect(harness.workflow.session.value?.open).toBe(true)
  harness.dispose()
})

test('map placement lease is bound to exact destination owner and retains the review session @pure', async () => {
  const harness = transferHarness()
  const sessionId = await openTransfer(harness)
  await harness.workflow.handleIntent({ kind: 'place-on-map', sessionId })
  const lease = harness.workflow.pendingMapPlacement.value
  expect(lease).not.toBeNull()
  expect(harness.workflow.session.value).toMatchObject({ sessionId, open: false, placingOnMap: true })
  expect(harness.workflow.ownsMapPlacement(lease!)).toBe(true)
  expect(harness.workflow.ownsMapPlacement({ ...lease! })).toBe(false)

  await harness.workflow.handleIntent({ kind: 'cancel-map-placement', sessionId, lease: lease! })
  expect(harness.workflow.pendingMapPlacement.value).toBeNull()
  expect(harness.workflow.session.value).toMatchObject({
    sessionId,
    open: true,
    placingOnMap: false,
    destinationSystemId: harness.destinationSystemId,
    placement: { kind: 'system', x: 0.6, y: 0.4 },
  })
  await harness.workflow.handleIntent({ kind: 'place-on-map', sessionId })
  const resumedLease = harness.workflow.pendingMapPlacement.value
  expect(resumedLease).not.toBe(lease)
  expect(harness.workflow.ownsMapPlacement(resumedLease!)).toBe(true)
  await harness.workflow.handleIntent({ kind: 'cancel-map-placement', sessionId, lease: lease! })
  expect(harness.workflow.pendingMapPlacement.value).toBe(resumedLease)

  harness.setDestinationOwner({ renderer: 'replacement' })
  expect(harness.workflow.ownsMapPlacement(resumedLease!)).toBe(false)
  expect(harness.workflow.completeMapPlacement(resumedLease!, { kind: 'system', x: 0.51, y: 0.25 })).toBe(false)
  expect(harness.workflow.session.value).toMatchObject({ sessionId, open: true, placingOnMap: false })
  expect(harness.workflow.session.value?.placement).toEqual({ kind: 'system', x: 0.6, y: 0.4 })
  harness.dispose()
})

test('map placement preview and completion retain the explicitly selected destination Orbit @pure', async () => {
  const harness = transferHarness()
  const workspace = harness.workspace.value
  const source = workspace.cluster.systems[0]!
  const destination = {
    ...workspace.cluster.systems[1]!,
    orbits: [{ id: 'destination-orbit', order: 1, hostId: null, center: { x: 0.45, y: 0.55 } }],
  }
  harness.workspace.value = { ...workspace, cluster: { ...workspace.cluster, systems: [source, destination] } }
  const sessionId = await openTransfer(harness)
  await harness.workflow.handleIntent({
    kind: 'choose-orbit-placement',
    sessionId,
    orbitId: destination.orbits[0]!.id,
    angle: 0.2,
  })
  await harness.workflow.handleIntent({ kind: 'place-on-map', sessionId })
  const lease = harness.workflow.pendingMapPlacement.value
  expect(lease?.placementCandidate).toEqual({ kind: 'orbit', orbitId: 'destination-orbit', angle: 0.2 })

  const pointerPlacement = { kind: 'orbit' as const, orbitId: 'destination-orbit', angle: 2.3 }
  expect(harness.workflow.previewMapPlacement(lease!, pointerPlacement)).toBe(true)
  const preview = harness.workflow.mapPreview.value?.previewWorkspace
  const previewDestination = preview?.cluster.systems
    .find(system => system.id === harness.destinationSystemId)
  expect(previewDestination?.objects.find(object => object.id === harness.rootObjectId)?.placement)
    .toEqual({ kind: 'orbit', orbitId: pointerPlacement.orbitId })
  expect(preview?.layout.objectAngles[harness.rootObjectId]).toBeCloseTo(pointerPlacement.angle)

  expect(harness.workflow.completeMapPlacement(lease!, pointerPlacement)).toBe(true)
  expect(harness.workflow.session.value?.placement).toEqual(pointerPlacement)
  harness.dispose()
})

test('a stale transfer session no longer publishes its captured map ghost @pure', async () => {
  const harness = transferHarness()
  const sessionId = await openTransfer(harness)
  expect(harness.workflow.mapPreview.value?.destinationSystemId).toBe(harness.destinationSystemId)

  harness.workspace.value = { ...harness.workspace.value }

  expect(harness.workflow.session.value).toMatchObject({ sessionId, stale: true, canAccept: false })
  expect(harness.workflow.mapPreview.value).toBeNull()
  harness.dispose()
})
