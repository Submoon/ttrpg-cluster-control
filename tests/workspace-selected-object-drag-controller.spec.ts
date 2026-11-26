import { expect, test } from '@playwright/test'
import { createPinia, setActivePinia } from 'pinia'
import { ref } from 'vue'
import { createLocalWorkspace, replaceWorkspaceSystem, type LocalWorkspace, type SystemObject } from '../domain/workspace'
import { addStarSystem } from '../domain/workspace-cluster'
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

function createContinuousHarness(continuousMap = false) {
  setActivePinia(createPinia())
  const base = createLocalWorkspace('Kestrel Reach', 'Vesper')
  const firstSystem = base.cluster.systems[0]!
  const first = makeObject('first-system-object', { kind: 'system', x: 0.5, y: 0.5 })
  const second = makeObject('second-system-object', { kind: 'system', x: 0.5, y: 0.5 })
  const added = addStarSystem(base, 'Rigel')
  const secondSystem = added.system
  const secondOwner = { ...secondSystem, objects: [second] }
  const firstOwner = { ...firstSystem, objects: [first] }
  const workspaceSnapshot = {
    ...added.workspace,
    cluster: { ...added.workspace.cluster, systems: [firstOwner, secondOwner] },
  }
  let snapshot = createWorkspaceSnapshot(workspaceSnapshot)
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
    confirmCapacity: async () => true,
  })
  const owner = mountController(() => useEditorWorkflows({
    workspace,
    appliedRevision,
    mutations: history,
    continuousMap: ref(continuousMap),
    initializeWorkspace: async () => undefined,
    saveState: ref<SaveState>('saved'),
    saveError: ref<string | null>(null),
  }))
  const store = useEditorUiStore()
  store.setSelection({
    activeView: 'cluster',
    selectedSystemId: firstSystem.id,
    inspectedTarget: { kind: 'object', systemId: firstSystem.id, objectId: first.id },
    selectedObjectId: first.id,
    selectedObjectIds: [first.id, second.id],
  })
  store.setMode('move')
  const scales = new Map([[firstSystem.id, 0.2], [secondOwner.id, 0.2]])

  return {
    owner,
    history,
    workspace,
    appliedRevision,
    first,
    second,
    firstSystemId: firstSystem.id,
    secondSystemId: secondOwner.id,
    store,
    scales,
    get publications() { return publications },
    begin(mode: 'select' | 'move' = 'move') { return owner.value.move.beginSelectedObjectDrag(first.id, scales, mode) },
    dispose() {
      owner.unmount()
      history.dispose()
    },
  }
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

test('a collective move grows the Zone for every member but rejects targets beyond the root reach @pure', async () => {
  await withHarness(async harness => {
    const initial = harness.workspace.value
    const outside = { x: 2000, y: 0 }
    const invalidDrag = harness.begin()
    expect(invalidDrag?.preview(outside)).toBeNull()
    await invalidDrag?.complete(outside)
    expect(harness.workspace.value).toBe(initial)
    expect(harness.publications).toBe(0)

    const delta = { x: 110, y: 0 }
    const drag = harness.begin()
    const preview = drag?.preview(delta)
    expect(preview?.positions.get(harness.first.id)).toEqual({ x: 590, y: 280 })
    expect(preview?.positions.get(harness.second.id)).toEqual({ x: 798, y: 280 })
    expect(preview?.frames?.get(harness.systemId)).toBeDefined()
    await drag?.complete(delta)
    expect(harness.publications).toBe(1)
    expect(harness.workspace.value?.layout.systemFrames?.[harness.systemId]).toBeDefined()
    expect(harness.workspace.value?.cluster.systems[0]?.objects.map(object => object.placement)).toEqual([
      { kind: 'system', x: 0.5 + 110 / 832, y: 0.5 },
      { kind: 'system', x: 0.75 + 110 / 832, y: 0.5 },
    ])
  })
})

test('a neighboring Zone can block the whole preview when only the other selected member cannot fit @pure', async () => {
  await withHarness(async harness => {
    const { workspace, system: neighbor } = addStarSystem(harness.workspace.value!, 'Neighbor')
    const anchor = workspace.layout.systemPositions[harness.systemId]!
    const initial = createWorkspaceSnapshot({
      ...workspace,
      layout: {
        ...workspace.layout,
        systemPositions: { ...workspace.layout.systemPositions, [neighbor.id]: { x: anchor.x + 100 / 736, y: anchor.y } },
        systemFrames: {
          [harness.systemId]: { left: 55, right: 55, top: 40, bottom: 40 },
          [neighbor.id]: { left: 45, right: 45, top: 40, bottom: 40 },
        },
      },
    })
    harness.workspace.value = initial
    // The grabbed object stays near its anchor. The second object's 41.6-unit offset carries it
    // into the neighbor's frame when both members translate by 20 scene units.
    const drag = harness.begin()
    expect(drag).not.toBeNull()
    expect(drag?.preview({ x: 100, y: 0 })).toBeNull()
    await drag?.complete({ x: 100, y: 0 })
    expect(harness.workspace.value).toEqual(initial)
    expect(harness.publications).toBe(0)
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

test('a continuous group move publishes once across owning systems and remains one history action @pure', async () => {
  await withControlledBrowserEnvironment(async () => {
    const harness = createContinuousHarness()
    try {
      const before = harness.workspace.value!
      const drag = harness.begin()
      expect(drag).not.toBeNull()
      expect(drag!.preview({ x: 2.4, y: -1.4 })?.positions.get(harness.first.id)).toEqual({ x: 492, y: 273 })
      expect(drag!.preview({ x: 2.4, y: -1.4 })?.positions.get(harness.second.id)).toEqual({ x: 492, y: 273 })
      expect(harness.workspace.value).toBe(before)

      await drag!.complete({ x: 2.4, y: -1.4 })
      expect(harness.publications).toBe(1)
      expect(harness.history.getEntries()).toHaveLength(1)
      expect(harness.history.getEntries()[0]?.action).toMatchObject({
        kind: 'move',
        target: { kind: 'object', id: harness.first.id, systemId: harness.firstSystemId },
        parent: { kind: 'system', id: harness.firstSystemId },
      })
      expect(harness.workspace.value?.cluster.systems.find(system => system.id === harness.firstSystemId)?.objects[0]?.placement)
        .toEqual({ kind: 'system', x: 0.5 + 12 / 832, y: 0.5 - 7 / 416 })
      expect(harness.workspace.value?.cluster.systems.find(system => system.id === harness.secondSystemId)?.objects[0]?.placement)
        .toEqual({ kind: 'system', x: 0.5 + 12 / 832, y: 0.5 - 7 / 416 })

      await harness.history.undo()
      expect(harness.workspace.value?.cluster.systems.map(system => system.objects[0]?.placement)).toEqual([
        harness.first.placement,
        harness.second.placement,
      ])
    } finally {
      harness.dispose()
    }
  })
})

test('a continuous group drag started in Select records one move without changing selection or tool @pure', async () => {
  await withControlledBrowserEnvironment(async () => {
    const harness = createContinuousHarness(true)
    try {
      harness.store.setMode('select')
      const before = harness.workspace.value
      const drag = harness.begin('select')
      expect(drag).not.toBeNull()
      expect(drag!.preview({ x: 2.4, y: -1.4 })?.positions.size).toBe(2)
      expect(harness.workspace.value).toBe(before)

      await drag!.complete({ x: 2.4, y: -1.4 })
      expect(harness.history.getEntries()).toHaveLength(1)
      expect(harness.publications).toBe(1)
      expect(harness.store.mapMode).toBe('select')
      expect(harness.store.selectedObjectIds).toEqual([harness.first.id, harness.second.id])
    } finally {
      harness.dispose()
    }
  })
})

test('a single Select drop publishes only while the map gesture still owns it @pure', async () => {
  await withControlledBrowserEnvironment(async () => {
    const harness = createContinuousHarness(true)
    try {
      harness.store.setMode('select')
      harness.store.setSelection({ selectedObjectIds: [harness.first.id] })
      const before = harness.workspace.value!
      let current = false
      const move = () => harness.owner.value.placement.map.moveMapObjectInSystem(
        harness.firstSystemId, harness.first.id, { x: 0.5625, y: 0.53125 }, before, undefined,
        { selectedObjectIds: [harness.first.id], isCurrent: () => current },
      )
      await move()
      expect(harness.workspace.value).toBe(before)
      expect(harness.history.getEntries()).toHaveLength(0)

      current = true
      await move()
      expect(harness.workspace.value?.cluster.systems[0]?.objects[0]?.placement)
        .toEqual({ kind: 'system', x: 0.5625, y: 0.53125 })
      expect(harness.history.getEntries()).toHaveLength(1)
      expect(harness.store.selectedObjectIds).toEqual([harness.first.id])
    } finally {
      harness.dispose()
    }
  })
})

test('canceling a continuous group gesture leaves every owning system unchanged @pure', async () => {
  await withControlledBrowserEnvironment(async () => {
    const harness = createContinuousHarness()
    try {
      const before = harness.workspace.value
      const drag = harness.begin()
      expect(drag).not.toBeNull()
      expect(drag!.preview({ x: 2.4, y: -1.4 })).not.toBeNull()
      drag!.cancel()
      await drag!.complete({ x: 2.4, y: -1.4 })

      expect(harness.workspace.value).toBe(before)
      expect(harness.publications).toBe(0)
      expect(harness.history.getEntries()).toHaveLength(0)
    } finally {
      harness.dispose()
    }
  })
})

test('dropping an object into the inspected system preserves the unrelated Inspector draft @pure', async () => {
  await withControlledBrowserEnvironment(async () => {
    const harness = createContinuousHarness()
    try {
      harness.store.setSelection({ selectedObjectIds: [harness.first.id] })
      await harness.owner.value.inspector.beginObjectEdit()
      const session = harness.owner.value.inspector.entitySession.value
      if (session?.kind !== 'object') throw new Error('The destination Inspector draft did not start.')
      session.draft.name = 'Still editing this object'
      const before = harness.workspace.value
      if (!before) throw new Error('The Workspace did not hydrate.')
      const inspected = harness.store.inspectedTarget
      await harness.owner.value.transfer.dropObject({
        workspaceSnapshot: before,
        sourceSystemId: harness.secondSystemId,
        rootObjectId: harness.second.id,
        destinationSystemId: harness.firstSystemId,
        placement: { kind: 'system', x: 0.61, y: 0.43 },
      })
      expect(harness.publications).toBe(1)
      expect(harness.store.inspectedTarget).toEqual(inspected)
      expect(harness.owner.value.inspector.entitySession.value).toMatchObject({
        id: session.id,
        kind: 'object',
        draft: { name: 'Still editing this object' },
      })
      expect(harness.workspace.value?.cluster.systems.find(system => system.id === harness.firstSystemId)
        ?.objects.find(object => object.id === harness.second.id)?.placement).toEqual({ kind: 'system', x: 0.61, y: 0.43 })
    } finally {
      harness.dispose()
    }
  })
})

test('an affected Inspector draft can be applied before a drop transfers the edited object @pure', async () => {
  await withControlledBrowserEnvironment(async () => {
    const harness = createContinuousHarness()
    try {
      harness.store.setSelection({ selectedObjectIds: [harness.first.id] })
      await harness.owner.value.inspector.beginObjectEdit()
      const session = harness.owner.value.inspector.entitySession.value
      const before = harness.workspace.value
      if (session?.kind !== 'object' || !before) throw new Error('The source draft needs an applied workspace.')
      session.draft.name = 'Renamed before transfer'
      const pending = harness.owner.value.transfer.dropObject({
        workspaceSnapshot: before,
        sourceSystemId: harness.firstSystemId,
        rootObjectId: harness.first.id,
        destinationSystemId: harness.secondSystemId,
        placement: { kind: 'system', x: 0.62, y: 0.43 },
      })
      await expect.poll(() => harness.owner.value.charts.transitionGuard.value).toBe('inspector')
      expect(harness.publications).toBe(0)
      await harness.owner.value.charts.resolveTransitionChoice('apply')
      await pending
      expect(harness.publications).toBe(2)
      expect(harness.workspace.value?.cluster.systems.find(system => system.id === harness.secondSystemId)
        ?.objects.find(object => object.id === harness.first.id)?.name).toBe('Renamed before transfer')
      expect((await harness.history.undo()).status).toBe('applied')
      expect(harness.workspace.value?.cluster.systems[0]?.objects[0]?.name).toBe('Renamed before transfer')
    } finally {
      harness.dispose()
    }
  })
})
