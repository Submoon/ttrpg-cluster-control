import { expect, test } from '@playwright/test'
import { createPinia, setActivePinia } from 'pinia'
import { ref } from 'vue'
import { createLocalWorkspace, replaceWorkspaceSystem, type LocalWorkspace, type SystemObject } from '../domain/workspace'
import { useEditorWorkflows } from '../composables/useEditorWorkflows'
import type { SaveState } from '../composables/editor-workflows/types'
import { createWorkspaceHistoryCoordinator } from '../composables/editor-workflows/workspace-mutations'
import { useEditorUiStore } from '../stores/editor-ui'
import { createWorkspaceSnapshot } from '../utils/workspace-storage'
import { mountController, withControlledBrowserEnvironment } from './support/mounted-controller'

function makeObject(id: string, placement: SystemObject['placement']): SystemObject {
  return {
    id,
    publication: 'known-type',
    family: 'Installation',
    subtype: 'station',
    locationKey: id,
    name: id,
    description: '',
    playerText: '',
    playerFieldMasks: [],
    placement,
  }
}

function createHarness(options: { maxBytes?: number; confirmCapacity?: () => Promise<boolean> } = {}) {
  setActivePinia(createPinia())
  const base = createLocalWorkspace('Kestrel Reach', 'Vesper')
  const initialSystem = base.cluster.systems[0]!
  const first = makeObject('first', { kind: 'system', x: 0.5, y: 0.5 })
  const second = makeObject('second', { kind: 'system', x: 0.75, y: 0.5 })
  const system = { ...initialSystem, objects: [first, second] }
  let snapshot = createWorkspaceSnapshot(replaceWorkspaceSystem(base, system))
  const workspace = ref<LocalWorkspace | null>(snapshot)
  const appliedRevision = ref(0)
  let publications = 0
  const history = createWorkspaceHistoryCoordinator({
    getWorkspace: () => workspace.value,
    getRevision: () => appliedRevision.value,
    publishWorkspace: next => {
      snapshot = createWorkspaceSnapshot(next)
      workspace.value = snapshot
      appliedRevision.value += 1
      publications += 1
      return { durable: Promise.resolve() }
    },
    getTraversalBlockReason: () => null,
    confirmCapacity: options.confirmCapacity ?? (async () => true),
    limits: options.maxBytes === undefined ? undefined : { maxBytes: options.maxBytes },
  })
  const owner = mountController(() => useEditorWorkflows({
    workspace,
    appliedRevision,
    mutations: history,
    initializeWorkspace: async () => undefined,
    saveState: ref<SaveState>('saved'),
    saveError: ref<string | null>(null),
  }))
  const store = useEditorUiStore()
  store.setSelection({
    activeView: 'system',
    selectedSystemId: initialSystem.id,
    selectedObjectId: null,
    selectedObjectIds: [first.id, second.id],
  })
  store.setMode('move')

  return {
    owner,
    history,
    workspace,
    appliedRevision,
    first,
    second,
    systemId: initialSystem.id,
    store,
    get publications() { return publications },
    begin() { return owner.value.move.beginSelectedObjectDrag(first.id) },
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

test('previews without publishing, then commits the collective translation as one reversible action @pure', async () => {
  await withHarness(async harness => {
    const before = harness.workspace.value!
    const drag = harness.begin()
    expect(drag).not.toBeNull()

    const preview = drag!.preview({ x: 12, y: -7 })
    expect(preview?.positions.get(harness.first.id)).toEqual({ x: 492, y: 273 })
    expect(preview?.positions.get(harness.second.id)).toEqual({ x: 700, y: 273 })
    expect(harness.workspace.value).toBe(before)
    expect(harness.publications).toBe(0)

    await Promise.all([
      drag!.complete({ x: 12, y: -7 }),
      drag!.complete({ x: 12, y: -7 }),
    ])
    expect(harness.publications).toBe(1)
    expect(harness.workspace.value?.cluster.systems[0]?.objects.map(object => object.placement)).toEqual([
      { kind: 'system', x: 0.5 + 12 / 832, y: 0.5 - 7 / 416 },
      { kind: 'system', x: 0.75 + 12 / 832, y: 0.5 - 7 / 416 },
    ])
    expect(harness.history.getEntries()).toHaveLength(1)
    expect(harness.history.getEntries()[0]?.action).toMatchObject({
      kind: 'move',
      target: { kind: 'object', id: harness.first.id, systemId: harness.systemId },
      parent: { kind: 'system', id: harness.systemId },
    })

    await harness.history.undo()
    expect(harness.workspace.value?.cluster.systems[0]?.objects.map(object => object.placement)).toEqual([
      harness.first.placement,
      harness.second.placement,
    ])
  })
})

test('a zero-delta release leaves workspace identity and history unchanged @pure', async () => {
  await withHarness(async harness => {
    const before = harness.workspace.value
    const drag = harness.begin()
    expect(drag).not.toBeNull()
    await drag!.complete({ x: 0, y: 0 })

    expect(harness.workspace.value).toBe(before)
    expect(harness.publications).toBe(0)
    expect(harness.history.getEntries()).toHaveLength(0)
  })
})

test('a draft that conflicts with a member placement blocks the whole drag @pure', async () => {
  await withHarness(async harness => {
    harness.store.setSelection({ selectedObjectId: harness.first.id })
    await harness.owner.value.inspector.beginObjectEdit()
    const session = harness.owner.value.inspector.entitySession.value
    expect(session?.kind).toBe('object')
    if (!session || session.kind !== 'object') throw new Error('The first object Inspector session did not start.')
    session.draft.name = 'Unsaved name'
    session.draft.placement = 'draft:orbit'

    const before = harness.workspace.value
    const drag = harness.begin()
    expect(drag).not.toBeNull()
    expect(drag!.preview({ x: 12, y: -7 })).toBeNull()
    await drag!.complete({ x: 12, y: -7 })

    expect(harness.workspace.value).toBe(before)
    expect(harness.publications).toBe(0)
    expect(harness.history.getEntries()).toHaveLength(0)
    expect(harness.owner.value.move.error.value).toContain('Inspector draft')
    harness.store.setSelection({ selectedObjectIds: [harness.first.id] })
    expect(harness.owner.value.move.error.value).toBe('')
  })
})

test('rejects a drag if its captured selection changes away and back during asynchronous consent @pure', async () => {
  let finishCapacity: ((accepted: boolean) => void) | undefined
  let capacityAsked = false
  await withHarness(async harness => {
    const before = harness.workspace.value
    const drag = harness.begin()
    expect(drag).not.toBeNull()
    const completion = drag!.complete({ x: 12, y: -7 })
    await expect.poll(() => capacityAsked).toBe(true)

    harness.store.setSelection({ selectedObjectIds: [harness.first.id] })
    harness.store.setSelection({ selectedObjectIds: [harness.first.id, harness.second.id] })
    finishCapacity?.(true)
    await completion

    expect(harness.workspace.value).toBe(before)
    expect(harness.publications).toBe(0)
    expect(harness.history.getEntries()).toHaveLength(0)
    expect(harness.owner.value.move.error.value).toBe('')
  }, {
    maxBytes: 0,
    confirmCapacity: () => new Promise<boolean>(resolve => {
      capacityAsked = true
      finishCapacity = resolve
    }),
  })
})

test('canceling during asynchronous history consent prevents the collective move @pure', async () => {
  let finishCapacity: ((accepted: boolean) => void) | undefined
  let capacityAsked = false
  await withHarness(async harness => {
    const before = harness.workspace.value
    const drag = harness.begin()
    expect(drag).not.toBeNull()
    const completion = drag!.complete({ x: 12, y: -7 })
    await expect.poll(() => capacityAsked).toBe(true)

    drag!.cancel()
    finishCapacity?.(true)
    await completion

    expect(harness.workspace.value).toBe(before)
    expect(harness.publications).toBe(0)
    expect(harness.history.getEntries()).toHaveLength(0)
  }, {
    maxBytes: 0,
    confirmCapacity: () => new Promise<boolean>(resolve => {
      capacityAsked = true
      finishCapacity = resolve
    }),
  })
})
