import { expect, test } from '@playwright/test'
import process from 'node:process'
import { createLocalWorkspace, createOrbit, type LocalWorkspace } from '../domain/workspace'
import { createWorkspaceHistoryCoordinator } from '../composables/editor-workflows/workspace-mutations'
import {
  createContinuousOrbitAdjustmentController,
  createOrbitAdjustmentFocusBoundaryScheduler,
  type OrbitAdjustmentGeometry,
  type OrbitAdjustmentIntent,
} from '../composables/editor-workflows/continuous-orbit-adjustments'
import { createWorkspaceSnapshot } from '../utils/workspace-storage'

class ControlledClock {
  private now = 0
  private nextId = 0
  private readonly timers = new Map<number, { due: number; callback: () => void }>()

  setTimeout = (callback: () => void, delay: number): number => {
    const id = ++this.nextId
    this.timers.set(id, { due: this.now + delay, callback })
    return id
  }

  clearTimeout = (handle: unknown): void => { this.timers.delete(handle as number) }

  advanceBy(duration: number): void {
    const end = this.now + duration
    while (true) {
      const next = [...this.timers.entries()]
        .filter(([, timer]) => timer.due <= end)
        .sort((left, right) => left[1].due - right[1].due || left[0] - right[0])[0]
      if (!next) break
      this.now = next[1].due
      this.timers.delete(next[0])
      next[1].callback()
    }
    this.now = end
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(complete => { resolve = complete })
  return { promise, resolve }
}

function createHarness(options: {
  clock?: ControlledClock
  durability?: () => Promise<void>
  confirmCapacity?: (signal: AbortSignal) => Promise<boolean>
  maxBytes?: number
} = {}) {
  let workspace = createLocalWorkspace('Kestrel Reach', 'Vesper')
  const system = workspace.cluster.systems[0]
  const host = system?.objects[0]
  if (!system || !host) throw new Error('The orbit fixture needs a host object.')
  const orbit = createOrbit(system, host.id)
  workspace = createWorkspaceSnapshot({
    ...workspace,
    cluster: { ...workspace.cluster, systems: [{ ...system, orbits: [orbit] }] },
    layout: {
      ...workspace.layout,
      orbitRadii: { [orbit.id]: { horizontal: 120, vertical: 90 } },
      orbitRotations: { [orbit.id]: 20 },
    },
  })
  const orbitId = orbit.id
  const systemId = system.id
  let revision = 0
  let publications = 0
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
    confirmCapacity: (_details, signal) => options.confirmCapacity?.(signal) ?? Promise.resolve(false),
    limits: { maxBytes: options.maxBytes ?? 33_554_432 },
  })
  const previews: Array<OrbitAdjustmentGeometry | null> = []
  const controller = createContinuousOrbitAdjustmentController({
    history,
    clock: options.clock,
    setPreview: value => previews.push(value?.geometry ?? null),
  })

  const currentGeometry = (): OrbitAdjustmentGeometry => ({
    center: { x: 0.5, y: 0.5 },
    radii: workspace.layout.orbitRadii[orbitId] ?? { horizontal: 120, vertical: 90 },
    rotation: workspace.layout.orbitRotations[orbitId] ?? 20,
  })

  function makeIntent(
    property: OrbitAdjustmentIntent['change']['kind'],
    inputKind: 'keyboard' | 'wheel' = 'keyboard',
    keyCode?: string,
    delta = 1,
  ): OrbitAdjustmentIntent {
    const change: OrbitAdjustmentIntent['change'] = property === 'radii'
      ? { kind: 'radii', axis: 'horizontal', operation: 'delta', delta, minimum: 24 }
      : property === 'rotation'
        ? { kind: 'rotation', delta }
        : { kind: 'center', delta: { x: delta / 100, y: 0 } }
    return {
      workspaceId: workspace.id,
      systemId,
      orbitId,
      inputKind,
      ...(keyCode === undefined ? {} : { keyCode }),
      change,
    }
  }

  const buildRequest = (geometry: OrbitAdjustmentGeometry) => ({
    action: {
      kind: 'resize' as const,
      label: 'Adjust Test Orbit',
      target: { kind: 'orbit' as const, id: orbitId, systemId },
      parent: { kind: 'system' as const, id: systemId },
    },
    prepare: (current: LocalWorkspace): LocalWorkspace => ({
      ...current,
      layout: {
        ...current.layout,
        orbitRadii: { ...current.layout.orbitRadii, [orbitId]: geometry.radii },
        orbitRotations: { ...current.layout.orbitRotations, [orbitId]: geometry.rotation },
      },
    }),
  })

  return {
    history,
    controller,
    previews,
    currentGeometry,
    makeIntent,
    buildRequest,
    get workspace() { return workspace },
    orbitId,
    systemId,
    get publications() { return publications },
    dispose() { controller.dispose(); history.dispose() },
  }
}

test('relative repeated input updates one preview and one reversible saved change @pure', async () => {
  const harness = createHarness()
  const read = harness.currentGeometry
  const build = harness.buildRequest

  expect(await harness.controller.update(harness.makeIntent('radii', 'keyboard', 'ArrowRight'), read, build)).toEqual({ status: 'preview' })
  expect(await harness.controller.update(harness.makeIntent('radii', 'keyboard', 'ArrowRight'), read, build)).toEqual({ status: 'preview' })
  expect(harness.controller.preview.value?.geometry.radii.horizontal).toBe(122)
  expect(harness.workspace.layout.orbitRadii[harness.orbitId]?.horizontal).toBe(120)
  expect(harness.publications).toBe(0)

  const applied = await harness.controller.completeGroup()
  expect(applied.status).toBe('applied')
  if (applied.status !== 'applied') throw new Error('The Orbit adjustment did not apply.')
  await applied.durable
  expect(harness.workspace.layout.orbitRadii[harness.orbitId]?.horizontal).toBe(122)
  expect(harness.publications).toBe(1)
  expect(harness.controller.preview.value).toBeNull()
  expect(harness.history.getStatus()).toMatchObject({ undoDepth: 1, redoDepth: 0 })
  const undone = await harness.history.undo()
  if (undone.status === 'applied') await undone.durable
  expect(harness.workspace.layout.orbitRadii[harness.orbitId]?.horizontal).toBe(120)
  harness.dispose()
})

test('the first relative event after changing Orbit property uses the freshly applied geometry @pure', async () => {
  const harness = createHarness()
  await harness.controller.update(harness.makeIntent('radii', 'keyboard', 'ArrowRight'), harness.currentGeometry, harness.buildRequest)
  let reads = 0
  const readUpdatedGeometry = (): OrbitAdjustmentGeometry => {
    reads += 1
    return harness.currentGeometry()
  }

  const next = await harness.controller.update(
    harness.makeIntent('rotation', 'keyboard', 'ArrowRight', 15),
    readUpdatedGeometry,
    harness.buildRequest,
  )

  expect(next).toEqual({ status: 'preview' })
  expect(reads).toBe(1)
  expect(harness.history.getStatus().undoDepth).toBe(1)
  expect(harness.workspace.layout.orbitRadii[harness.orbitId]?.horizontal).toBe(121)
  expect(harness.controller.preview.value?.geometry.rotation).toBe(35)
  const result = await harness.controller.completeGroup()
  expect(result.status).toBe('applied')
  if (result.status === 'applied') await result.durable
  expect(harness.workspace.layout.orbitRotations[harness.orbitId]).toBe(35)
  expect(harness.history.getStatus()).toMatchObject({ undoDepth: 2, redoDepth: 0 })
  harness.dispose()
})

test('wheel adjustment completes at exactly 300 ms of inactivity @pure', async () => {
  const clock = new ControlledClock()
  const harness = createHarness({ clock })
  await harness.controller.update(harness.makeIntent('rotation', 'wheel', undefined, 5), harness.currentGeometry, harness.buildRequest)

  clock.advanceBy(299)
  expect(harness.publications).toBe(0)
  expect(harness.controller.preview.value?.geometry.rotation).toBe(25)
  clock.advanceBy(1)
  await expect.poll(() => harness.publications).toBe(1)
  expect(harness.controller.preview.value).toBeNull()
  expect(harness.workspace.layout.orbitRotations[harness.orbitId]).toBe(25)
  harness.dispose()
})

test('a matching keyboard release completes a held-key adjustment once @pure', async () => {
  const harness = createHarness()
  await harness.controller.update(harness.makeIntent('radii', 'keyboard', 'ArrowRight'), harness.currentGeometry, harness.buildRequest)
  await harness.controller.update(harness.makeIntent('radii', 'keyboard', 'ArrowRight'), harness.currentGeometry, harness.buildRequest)

  expect((await harness.controller.releaseKey('ArrowLeft')).status).toBe('unchanged')
  expect(harness.publications).toBe(0)
  const completed = await harness.controller.releaseKey('ArrowRight')

  expect(completed.status).toBe('applied')
  if (completed.status === 'applied') await completed.durable
  expect(harness.publications).toBe(1)
  expect(harness.workspace.layout.orbitRadii[harness.orbitId]?.horizontal).toBe(122)
  harness.dispose()
})

test('a focus interruption completes the pending preview and clears its timeout @pure', async () => {
  const clock = new ControlledClock()
  const harness = createHarness({ clock })
  await harness.controller.update(harness.makeIntent('rotation', 'wheel', undefined, 10), harness.currentGeometry, harness.buildRequest)

  const completed = await harness.controller.focusLost()
  clock.advanceBy(500)

  expect(completed.status).toBe('applied')
  if (completed.status === 'applied') await completed.durable
  expect(harness.publications).toBe(1)
  expect(harness.history.getStatus().undoDepth).toBe(1)
  expect(harness.controller.preview.value).toBeNull()
  harness.dispose()
})

test('center-relative movement keeps both normalized coordinates in the preview @pure', async () => {
  const harness = createHarness()
  const intent = harness.makeIntent('center', 'keyboard', 'ArrowRight', 3)
  const result = await harness.controller.update(intent, harness.currentGeometry, harness.buildRequest)

  expect(result).toEqual({ status: 'preview' })
  expect(harness.controller.preview.value?.geometry.center).toEqual({ x: 0.53, y: 0.5 })
  expect(harness.publications).toBe(0)
  expect(harness.history.getStatus().totalActions).toBe(0)
  harness.controller.dispose()
  harness.history.dispose()
})

test('whole-Orbit Home then End adjusts both radii within one held-key group @pure', async () => {
  const harness = createHarness()
  const base = {
    workspaceId: harness.workspace.id,
    systemId: harness.systemId,
    orbitId: harness.orbitId,
    inputKind: 'keyboard' as const,
  }
  const home: OrbitAdjustmentIntent = {
    ...base,
    keyCode: 'Home',
    change: { kind: 'radii', axis: 'both', operation: 'minimum', minimum: 24 },
  }
  const end: OrbitAdjustmentIntent = {
    ...base,
    keyCode: 'End',
    change: { kind: 'radii', axis: 'both', operation: 'delta', delta: 400, minimum: 24 },
  }

  expect(await harness.controller.update(home, harness.currentGeometry, harness.buildRequest)).toEqual({ status: 'preview' })
  expect(await harness.controller.update(end, harness.currentGeometry, harness.buildRequest)).toEqual({ status: 'preview' })
  expect(harness.controller.preview.value?.geometry.radii).toEqual({ horizontal: 424, vertical: 424 })
  const applied = await harness.controller.completeGroup()

  expect(applied.status).toBe('applied')
  if (applied.status === 'applied') await applied.durable
  expect(harness.workspace.layout.orbitRadii[harness.orbitId]).toEqual({ horizontal: 424, vertical: 424 })
  expect(harness.history.getStatus()).toMatchObject({ undoDepth: 1, redoDepth: 0 })
  harness.dispose()
})

test('automatic wheel completion handles save failure without replaying or losing the action @pure', async () => {
  const clock = new ControlledClock()
  const harness = createHarness({ clock, durability: () => Promise.reject(new Error('IndexedDB unavailable')) })
  const unhandled: unknown[] = []
  const onUnhandled = (reason: unknown): void => { unhandled.push(reason) }
  process.on('unhandledRejection', onUnhandled)

  try {
    await harness.controller.update(
      harness.makeIntent('rotation', 'wheel', undefined, 5),
      harness.currentGeometry,
      harness.buildRequest,
    )
    clock.advanceBy(300)
    await expect.poll(() => harness.publications).toBe(1)
    await new Promise(resolve => setTimeout(resolve, 0))

    expect(harness.workspace.layout.orbitRotations[harness.orbitId]).toBe(25)
    expect(harness.history.getStatus()).toMatchObject({ undoDepth: 1, redoDepth: 0, hasPendingGroup: false })
    expect(unhandled).toEqual([])
  } finally {
    process.off('unhandledRejection', onUnhandled)
    harness.dispose()
  }
})

test('changing Orbit property handles the prior group save rejection without losing either state @pure', async () => {
  const harness = createHarness({ durability: () => Promise.reject(new Error('IndexedDB unavailable')) })
  const unhandled: unknown[] = []
  const onUnhandled = (reason: unknown): void => { unhandled.push(reason) }
  process.on('unhandledRejection', onUnhandled)

  try {
    await harness.controller.update(
      harness.makeIntent('radii', 'keyboard', 'ArrowRight'),
      harness.currentGeometry,
      harness.buildRequest,
    )
    const nextProperty = await harness.controller.update(
      harness.makeIntent('rotation', 'keyboard', 'ArrowUp', 5),
      harness.currentGeometry,
      harness.buildRequest,
    )
    await new Promise(resolve => setTimeout(resolve, 0))

    expect(nextProperty).toEqual({ status: 'preview' })
    expect(harness.workspace.layout.orbitRadii[harness.orbitId]?.horizontal).toBe(121)
    expect(harness.controller.preview.value?.geometry.rotation).toBe(25)
    expect(harness.history.getStatus()).toMatchObject({ undoDepth: 1, hasPendingGroup: true })
    expect(unhandled).toEqual([])
  } finally {
    process.off('unhandledRejection', onUnhandled)
    harness.dispose()
  }
})

test('history reset immediately clears the page-owned preview and invalidates its timeout @pure', async () => {
  const clock = new ControlledClock()
  const harness = createHarness({ clock })
  await harness.controller.update(
    harness.makeIntent('rotation', 'wheel', undefined, 5),
    harness.currentGeometry,
    harness.buildRequest,
  )
  expect(harness.controller.preview.value).not.toBeNull()

  harness.history.reset('The editing session was restored.')
  clock.advanceBy(500)
  await new Promise(resolve => setTimeout(resolve, 0))

  expect(harness.controller.preview.value).toBeNull()
  expect(harness.publications).toBe(0)
  expect(harness.history.getStatus()).toMatchObject({ hasPendingGroup: false, undoDepth: 0, redoDepth: 0 })
  harness.dispose()
})

test('a queued relative input cannot stage after same-identity recovery resets the session @pure', async () => {
  let capacityAsked = false
  const harness = createHarness({
    maxBytes: 0,
    confirmCapacity: () => {
      capacityAsked = true
      return new Promise<boolean>(() => undefined)
    },
  })
  const intent = harness.makeIntent('rotation', 'keyboard', 'ArrowRight', 5)
  await harness.controller.update(intent, harness.currentGeometry, harness.buildRequest)

  const completion = harness.controller.completeGroup()
  await expect.poll(() => capacityAsked).toBe(true)
  const queuedUpdate = harness.controller.update(intent, harness.currentGeometry, harness.buildRequest)

  harness.controller.reset()
  harness.history.reset('The same workspace was hydrated from recovery data.')
  const completed = await completion
  const stale = await queuedUpdate

  expect(completed).toMatchObject({ status: 'rejected', reason: 'stale' })
  expect(stale).toMatchObject({ status: 'rejected', reason: 'stale' })
  expect(harness.controller.preview.value).toBeNull()
  expect(harness.history.getStatus()).toMatchObject({ hasPendingGroup: false, totalActions: 0 })
  harness.dispose()
})

test('a timer already queued at reset cannot complete a new same-identity group @pure', async () => {
  const clock = new ControlledClock()
  const harness = createHarness({ clock })
  const intent = harness.makeIntent('rotation', 'wheel', undefined, 5)
  await harness.controller.update(intent, harness.currentGeometry, harness.buildRequest)

  clock.advanceBy(300)
  harness.controller.reset()
  harness.history.reset('The same workspace was hydrated from recovery data.')
  const freshPreview = await harness.controller.update(intent, harness.currentGeometry, harness.buildRequest)

  expect(freshPreview).toEqual({ status: 'preview' })
  expect(harness.controller.preview.value?.geometry.rotation).toBe(25)
  expect(harness.publications).toBe(0)
  expect(harness.history.getStatus()).toMatchObject({ hasPendingGroup: true, totalActions: 0 })

  const completed = await harness.controller.completeGroup()
  expect(completed.status).toBe('applied')
  if (completed.status === 'applied') await completed.durable
  expect(harness.publications).toBe(1)
  expect(harness.history.getStatus()).toMatchObject({ undoDepth: 1, totalActions: 1 })
  harness.dispose()
})

test('a capacity cancellation rejects workspace operations already queued behind the group @pure', async () => {
  const consent = deferred<boolean>()
  let confirmations = 0
  const harness = createHarness({
    maxBytes: 0,
    confirmCapacity: () => {
      confirmations += 1
      return consent.promise
    },
  })
  await harness.controller.update(
    harness.makeIntent('radii', 'keyboard', 'ArrowRight'),
    harness.currentGeometry,
    harness.buildRequest,
  )

  const differingProperty = harness.controller.update(
    harness.makeIntent('rotation', 'keyboard', 'ArrowUp', 5),
    harness.currentGeometry,
    harness.buildRequest,
  )
  await expect.poll(() => confirmations).toBe(1)
  const queuedWorkspaceOperation = harness.controller.beforeOperation()
  consent.resolve(false)
  const failedUpdate = await differingProperty
  const blockedOperation = await queuedWorkspaceOperation

  expect(failedUpdate).toMatchObject({ status: 'rejected', reason: 'cancelled' })
  expect(blockedOperation).toEqual(failedUpdate)
  expect(confirmations).toBe(1)
  expect(harness.controller.preview.value).toBeNull()
  expect(harness.history.getStatus()).toMatchObject({ hasPendingGroup: false, totalActions: 0 })
  harness.dispose()
})

test('a deferred focus frame cannot complete a new group after a session reset @pure', async () => {
  const harness = createHarness()
  let nextFrame = 0
  const frames = new Map<number, FrameRequestCallback>()
  const scheduler = createOrbitAdjustmentFocusBoundaryScheduler(
    harness.controller,
    () => null,
    callback => {
      const id = ++nextFrame
      frames.set(id, callback)
      return id
    },
    id => { frames.delete(id) },
  )
  const intent = harness.makeIntent('rotation', 'wheel', undefined, 5)
  await harness.controller.update(intent, harness.currentGeometry, harness.buildRequest)
  scheduler.schedule()
  const oldFocusFrame = [...frames.values()][0]
  expect(oldFocusFrame).toBeDefined()

  harness.controller.reset()
  harness.history.reset('The same workspace was hydrated from recovery data.')
  await harness.controller.update(intent, harness.currentGeometry, harness.buildRequest)
  oldFocusFrame?.(0)
  await new Promise(resolve => setTimeout(resolve, 0))

  expect(harness.controller.preview.value?.geometry.rotation).toBe(25)
  expect(harness.history.getStatus()).toMatchObject({ hasPendingGroup: true, totalActions: 0 })
  expect(harness.publications).toBe(0)
  const completed = await harness.controller.completeGroup()
  expect(completed.status).toBe('applied')
  if (completed.status === 'applied') await completed.durable
  scheduler.dispose()
  harness.dispose()
})

test('a queued key release applies to the property group staged after capacity consent @pure', async () => {
  const firstConsent = deferred<boolean>()
  let confirmations = 0
  const harness = createHarness({
    maxBytes: 0,
    confirmCapacity: () => {
      confirmations += 1
      return confirmations === 1 ? firstConsent.promise : Promise.resolve(true)
    },
  })
  await harness.controller.update(
    harness.makeIntent('radii', 'keyboard', 'ArrowRight'),
    harness.currentGeometry,
    harness.buildRequest,
  )

  const continued = harness.controller.update(
    harness.makeIntent('rotation', 'keyboard', 'ArrowUp', 5),
    harness.currentGeometry,
    harness.buildRequest,
  )
  await expect.poll(() => confirmations).toBe(1)
  const released = harness.controller.releaseKey('ArrowUp')
  firstConsent.resolve(true)

  expect(await continued).toEqual({ status: 'preview' })
  const releaseResult = await released
  expect(releaseResult.status).toBe('applied')
  if (releaseResult.status === 'applied') await releaseResult.durable
  expect(confirmations).toBe(2)
  expect(harness.workspace.layout.orbitRotations[harness.orbitId]).toBe(25)
  expect(harness.controller.preview.value).toBeNull()
  expect(harness.history.getStatus()).toMatchObject({ hasPendingGroup: false, totalActions: 0 })
  expect(harness.publications).toBe(2)
  harness.dispose()
})

test('a queued workspace preflight completes the next property group after capacity consent @pure', async () => {
  const firstConsent = deferred<boolean>()
  let confirmations = 0
  const harness = createHarness({
    maxBytes: 0,
    confirmCapacity: () => {
      confirmations += 1
      return confirmations === 1 ? firstConsent.promise : Promise.resolve(true)
    },
  })
  await harness.controller.update(
    harness.makeIntent('radii', 'keyboard', 'ArrowRight'),
    harness.currentGeometry,
    harness.buildRequest,
  )

  const continued = harness.controller.update(
    harness.makeIntent('rotation', 'keyboard', 'ArrowUp', 5),
    harness.currentGeometry,
    harness.buildRequest,
  )
  await expect.poll(() => confirmations).toBe(1)
  const beforeOperation = harness.controller.beforeOperation()
  firstConsent.resolve(true)

  expect(await continued).toEqual({ status: 'preview' })
  const operationResult = await beforeOperation
  expect(operationResult.status).toBe('applied')
  if (operationResult.status === 'applied') await operationResult.durable
  expect(confirmations).toBe(2)
  expect(harness.workspace.layout.orbitRotations[harness.orbitId]).toBe(25)
  expect(harness.controller.preview.value).toBeNull()
  expect(harness.history.getStatus()).toMatchObject({ hasPendingGroup: false, totalActions: 0 })
  expect(harness.publications).toBe(2)
  harness.dispose()
})
