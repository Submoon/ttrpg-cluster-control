import { expect, test } from '@playwright/test'
import { ref, shallowRef } from 'vue'
import { createLocalWorkspace, type LocalWorkspace } from '../domain/workspace'
import { resolveSystemObjectHistoryTarget } from '../domain/workspace'
import { useSystemObjectTransferWorkflow } from '../composables/editor-workflows/useSystemObjectTransferWorkflow'
import {
  createWorkspaceHistoryCoordinator,
  type WorkspaceHistoryCoordinator,
} from '../composables/editor-workflows/workspace-mutations'
import type { SystemObjectTransferMapPlacementLease } from '../composables/editor-workflows/system-object-transfer-types'

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
  workspace?: LocalWorkspace
  maxBytes?: number
} = {}) {
  const { workspace: fixture, sourceSystemId, destinationSystemId, rootObjectId } = transferWorkspace()
  const workspace = shallowRef(options.workspace ?? fixture)
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
  const lease = harness.workflow.pendingMapPlacement.value as SystemObjectTransferMapPlacementLease | null
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
  const resumedLease = harness.workflow.pendingMapPlacement.value as SystemObjectTransferMapPlacementLease | null
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

test('a stale transfer session no longer publishes its captured map ghost @pure', async () => {
  const harness = transferHarness()
  const sessionId = await openTransfer(harness)
  expect(harness.workflow.mapPreview.value?.destinationSystemId).toBe(harness.destinationSystemId)

  harness.workspace.value = { ...harness.workspace.value }

  expect(harness.workflow.session.value).toMatchObject({ sessionId, stale: true, canAccept: false })
  expect(harness.workflow.mapPreview.value).toBeNull()
  harness.dispose()
})
