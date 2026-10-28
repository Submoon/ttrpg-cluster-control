import { expect, test } from '@playwright/test'
import { createPinia, setActivePinia } from 'pinia'
import { ref, shallowRef } from 'vue'
import { createLocalWorkspace, createOrbit, defaultOrbitRadius, type LocalWorkspace, type OrbitRadii } from '../domain/workspace'
import {
  createContinuousOrbitAdjustmentController,
  type OrbitAdjustmentChange,
  type OrbitAdjustmentIntent,
} from '../composables/editor-workflows/continuous-orbit-adjustments'
import { useMapWorkflows } from '../composables/editor-workflows/useMapWorkflows'
import { createWorkspaceHistoryCoordinator } from '../composables/editor-workflows/workspace-mutations'
import { useEditorUiStore } from '../stores/editor-ui'
import { createWorkspaceSnapshot } from '../utils/workspace-storage'

function createAdapterHarness(initialRadii?: OrbitRadii) {
  setActivePinia(createPinia())
  const base = createLocalWorkspace('Kestrel Reach', 'Vesper')
  const initialSystem = base.cluster.systems[0]!
  const orbit = createOrbit(initialSystem, null)
  const initialWorkspace = createWorkspaceSnapshot({
    ...base,
    cluster: {
      ...base.cluster,
      systems: [{ ...initialSystem, orbits: [orbit] }],
    },
    layout: {
      ...base.layout,
      orbitRadii: initialRadii ? { [orbit.id]: initialRadii } : {},
    },
  })
  const workspace = ref<LocalWorkspace | null>(initialWorkspace)
  let revision = 0
  let publications = 0
  const history = createWorkspaceHistoryCoordinator({
    getWorkspace: () => workspace.value,
    getRevision: () => revision,
    publishWorkspace: next => {
      workspace.value = createWorkspaceSnapshot(next)
      revision += 1
      publications += 1
      return { durable: Promise.resolve() }
    },
    getTraversalBlockReason: () => null,
    confirmCapacity: async () => false,
  })
  const adjustments = createContinuousOrbitAdjustmentController({ history })
  const store = useEditorUiStore()
  store.setSelection({ activeView: 'system', selectedSystemId: initialSystem.id })
  store.setMode('move')
  const map = useMapWorkflows({
    workspace,
    mutations: history,
    systemMapRef: shallowRef(null),
    resolveTransition: async () => true,
    beginObjectSession: () => undefined,
    beginOrbitSession: () => undefined,
    isEntityCommandBlocked: () => false,
    editorError: ref(''),
    orbitAdjustments: adjustments,
    beforeWorkspaceOperation: async () => true,
  })
  const system = initialWorkspace.cluster.systems[0]!
  const currentOrbit = system.orbits[0]!
  const radiusIntent = (keyCode: string, delta: number): OrbitAdjustmentIntent => ({
    workspaceId: initialWorkspace.id,
    systemId: system.id,
    orbitId: currentOrbit.id,
    inputKind: 'keyboard',
    keyCode,
    change: { kind: 'radii', axis: 'horizontal', operation: 'delta', delta, minimum: 24 },
  })
  const intentFor = (keyCode: string, change: OrbitAdjustmentChange): OrbitAdjustmentIntent => ({
    workspaceId: initialWorkspace.id,
    systemId: system.id,
    orbitId: currentOrbit.id,
    inputKind: 'keyboard',
    keyCode,
    change,
  })

  return {
    workspace,
    history,
    adjustments,
    map,
    system,
    orbit: currentOrbit,
    get publications() { return publications },
    radiusIntent,
    rotationIntent(keyCode: string, delta: number) {
      return intentFor(keyCode, { kind: 'rotation', delta })
    },
    centerIntent(keyCode: string, delta: { x: number; y: number }) {
      return intentFor(keyCode, { kind: 'center', delta })
    },
    async createRedoBranch() {
      const current = workspace.value!
      const applied = await history.execute({
        action: { kind: 'rename', label: 'Rename Jump Cluster', target: { kind: 'cluster', id: current.cluster.id } },
        prepare: latest => ({
          ...latest,
          cluster: { ...latest.cluster, name: `${latest.cluster.name} Prime` },
        }),
      })
      if (applied.status !== 'applied') throw new Error('Could not create the fixture history action.')
      await applied.durable
      const undone = await history.undo()
      if (undone.status !== 'applied') throw new Error('Could not create the fixture Redo branch.')
      await undone.durable
      expect(history.getStatus().redoDepth).toBe(1)
    },
    async stageNetZeroPair() {
      expect(await map.updateOrbitAdjustment(radiusIntent('ArrowRight', 1))).toEqual({ status: 'preview' })
      expect(await map.updateOrbitAdjustment(radiusIntent('ArrowLeft', -1))).toEqual({ status: 'preview' })
      expect(adjustments.preview.value?.geometry.radii).toEqual({
        horizontal: (initialRadii?.horizontal ?? defaultOrbitRadius(system, currentOrbit)),
        vertical: (initialRadii?.vertical ?? defaultOrbitRadius(system, currentOrbit)),
      })
      expect((await adjustments.releaseKey('ArrowRight')).status).toBe('unchanged')
      return adjustments.releaseKey('ArrowLeft')
    },
    dispose() {
      adjustments.dispose()
      history.dispose()
    },
  }
}

test('a net-zero resize keeps omitted radii omitted and preserves Redo @pure', async () => {
  const harness = createAdapterHarness()
  await harness.createRedoBranch()
  expect(harness.workspace.value?.layout.orbitRadii[harness.orbit.id]).toBeUndefined()

  const result = await harness.stageNetZeroPair()

  expect(result.status).toBe('unchanged')
  expect(harness.workspace.value?.layout.orbitRadii[harness.orbit.id]).toBeUndefined()
  expect(harness.history.getStatus()).toMatchObject({ undoDepth: 0, redoDepth: 1, hasPendingGroup: false })
  expect(harness.publications).toBe(2)
  harness.dispose()
})

test('a fractional net-zero resize preserves exact saved radii and Redo @pure', async () => {
  const harness = createAdapterHarness({ horizontal: 180.5, vertical: 170.5 })
  await harness.createRedoBranch()

  const result = await harness.stageNetZeroPair()

  expect(result.status).toBe('unchanged')
  expect(harness.workspace.value?.layout.orbitRadii[harness.orbit.id]).toEqual({ horizontal: 180.5, vertical: 170.5 })
  expect(harness.history.getStatus()).toMatchObject({ undoDepth: 0, redoDepth: 1, hasPendingGroup: false })
  expect(harness.publications).toBe(2)
  harness.dispose()
})

test('a horizontal resize keeps the untouched fractional vertical radius @pure', async () => {
  const harness = createAdapterHarness({ horizontal: 180.5, vertical: 170.5 })
  expect(await harness.map.updateOrbitAdjustment(harness.radiusIntent('ArrowRight', 1))).toEqual({ status: 'preview' })

  const result = await harness.adjustments.releaseKey('ArrowRight')
  expect(result.status).toBe('applied')
  if (result.status === 'applied') await result.durable

  expect(harness.workspace.value?.layout.orbitRadii[harness.orbit.id]).toEqual({ horizontal: 182, vertical: 170.5 })
  expect(harness.history.getStatus()).toMatchObject({ undoDepth: 1, redoDepth: 0, hasPendingGroup: false })
  harness.dispose()
})

test('a net-zero rotation keeps the implicit zero and preserves Redo @pure', async () => {
  const harness = createAdapterHarness()
  await harness.createRedoBranch()
  expect(harness.workspace.value?.layout.orbitRotations[harness.orbit.id]).toBeUndefined()

  expect(await harness.map.updateOrbitAdjustment(harness.rotationIntent('ArrowRight', 15))).toEqual({ status: 'preview' })
  expect(await harness.map.updateOrbitAdjustment(harness.rotationIntent('ArrowLeft', -15))).toEqual({ status: 'preview' })
  expect((await harness.adjustments.releaseKey('ArrowRight')).status).toBe('unchanged')
  const result = await harness.adjustments.releaseKey('ArrowLeft')

  expect(result.status).toBe('unchanged')
  expect(harness.workspace.value?.layout.orbitRotations[harness.orbit.id]).toBeUndefined()
  expect(harness.history.getStatus()).toMatchObject({ undoDepth: 0, redoDepth: 1, hasPendingGroup: false })
  expect(harness.publications).toBe(2)
  harness.dispose()
})

test('a canonical no-op Orbit center adjustment keeps Redo @pure', async () => {
  const harness = createAdapterHarness()
  await harness.createRedoBranch()
  const originalCenter = harness.workspace.value?.cluster.systems[0]?.orbits[0]?.center

  expect(await harness.map.updateOrbitAdjustment(harness.centerIntent('ArrowRight', { x: 0, y: 0 })))
    .toEqual({ status: 'preview' })
  const result = await harness.adjustments.releaseKey('ArrowRight')

  expect(result.status).toBe('unchanged')
  expect(harness.workspace.value?.cluster.systems[0]?.orbits[0]?.center).toEqual(originalCenter)
  expect(harness.history.getStatus()).toMatchObject({ undoDepth: 0, redoDepth: 1, hasPendingGroup: false })
  expect(harness.publications).toBe(2)
  harness.dispose()
})
