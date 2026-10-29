import { expect, test } from '@playwright/test'
import { createPinia, setActivePinia } from 'pinia'
import { computed, effectScope, ref, shallowRef, watchEffect } from 'vue'
import {
  createLocalWorkspace,
  type LocalWorkspace,
  type Orbit,
  type SystemObject,
} from '../domain/workspace'
import { createContinuousOrbitAdjustmentController } from '../composables/editor-workflows/continuous-orbit-adjustments'
import { useEntityInspectorSession } from '../composables/editor-workflows/useEntityInspectorSession'
import { useMapWorkflows } from '../composables/editor-workflows/useMapWorkflows'
import { useOrbitCenterPlacement } from '../composables/editor-workflows/useOrbitCenterPlacement'
import { useUnresolvedExitPlacement } from '../composables/editor-workflows/useUnresolvedExitPlacement'
import { useSystemCreationWorkflows } from '../composables/editor-workflows/useSystemCreationWorkflows'
import { useEditorWorkflows } from '../composables/useEditorWorkflows'
import type { SaveState } from '../composables/editor-workflows/types'
import {
  createWorkspaceHistoryCoordinator,
  type WorkspaceHistoryCapacityDetails,
} from '../composables/editor-workflows/workspace-mutations'
import type { MapNavigationHandle, SystemMapHandle } from '../composables/editor-workflows/types'
import { useEditorUiStore } from '../stores/editor-ui'
import { createWorkspaceSnapshot } from '../utils/workspace-storage'

interface HistoryHarnessOptions {
  limits?: { maxActions?: number; maxBytes?: number }
  confirmCapacity?: (details: WorkspaceHistoryCapacityDetails, signal: AbortSignal) => Promise<boolean>
}

function createHistoryHarness(initial: LocalWorkspace, options: HistoryHarnessOptions = {}) {
  const workspace = shallowRef<LocalWorkspace | null>(createWorkspaceSnapshot(initial))
  const blockedReason = ref<string | null>(null)
  let revision = 0
  const history = createWorkspaceHistoryCoordinator({
    getWorkspace: () => workspace.value,
    getRevision: () => revision,
    publishWorkspace: next => {
      workspace.value = createWorkspaceSnapshot(next)
      revision += 1
      return { durable: Promise.resolve() }
    },
    getTraversalBlockReason: () => blockedReason.value,
    confirmCapacity: options.confirmCapacity ?? (async () => false),
    limits: options.limits,
  })
  return {
    workspace,
    blockedReason,
    history,
    dispose: () => history.dispose(),
  }
}

function createUnresolvedRouteWorkspace(): { workspace: LocalWorkspace; routeId: string } {
  const initial = createLocalWorkspace('Kestrel Reach', 'Vesper')
  const system = initial.cluster.systems[0]
  if (!system) throw new Error('The initial workspace has no star system.')
  const jumpPoint: SystemObject = {
    id: 'history-integration-jump-point',
    family: 'JumpPoint',
    subtype: 'jump-point',
    locationKey: 'J',
    name: 'Far Gate',
    description: '',
    placement: { kind: 'system', x: 0.78, y: 0.5 },
  }
  const routeId = 'history-integration-unresolved-route'
  return {
    routeId,
    workspace: createWorkspaceSnapshot({
      ...initial,
      cluster: {
        ...initial.cluster,
        systems: [{ ...system, objects: [...system.objects, jumpPoint] }],
        routes: [{
          id: routeId,
          fromPointId: jumpPoint.id,
          toPointId: null,
          unresolvedExit: 'Beyond the known Cluster',
          jumpLevel: 1,
        }],
      },
    }),
  }
}

interface UnoccupiedOrbitFixture {
  workspace: LocalWorkspace
  systemId: string
  orbitId: string
}

async function createUnoccupiedOrbitWorkspace(
  reorderPropertiesForRegression = false,
): Promise<UnoccupiedOrbitFixture> {
  const initial = createLocalWorkspace('Kestrel Reach', 'Vesper')
  const system = initial.cluster.systems[0]
  if (!system) throw new Error('The initial workspace has no star system.')
  const harness = createHistoryHarness(initial)
  const store = useEditorUiStore()
  store.setSelection({ activeView: 'system', selectedSystemId: system.id })
  const scope = effectScope()
  const creation = scope.run(() => useSystemCreationWorkflows({
    workspace: harness.workspace,
    systemMapRef: shallowRef<SystemMapHandle | null>(null),
    mutations: harness.history,
    isEntityCommandBlocked: () => false,
    resolveObjectCreationTransition: async () => true,
    onObjectCreated: async () => undefined,
  }))
  if (!creation) throw new Error('The system creation workflow was not created.')

  try {
    if (!await creation.handleCreationDrop({ kind: 'orbit' }, [{
      key: 'unoccupied-center',
      label: 'Unoccupied center',
      target: { kind: 'free', point: { x: 0.5, y: 0.5 } },
      error: null,
    }])) {
      throw new Error('The Orbit Add drop did not create an unoccupied Orbit.')
    }

    const createdWorkspace = harness.workspace.value
    const createdSystem = createdWorkspace?.cluster.systems.find(candidate => candidate.id === system.id)
    const createdOrbit = createdSystem?.orbits[0]
    if (!createdWorkspace || !createdSystem || !createdOrbit
      || createdOrbit.hostId !== null || !createdOrbit.center) {
      throw new Error('The Orbit Add command did not publish an unoccupied Orbit.')
    }

    // Keep production Add's record by default. This explicit adversarial order is used only
    // by the key-order regression, so it does not depend on the Add builder's field order.
    const orbit: Orbit = reorderPropertiesForRegression
      ? {
          center: { ...createdOrbit.center },
          id: createdOrbit.id,
          order: createdOrbit.order,
          hostId: null,
        }
      : createdOrbit
    const workspace = createWorkspaceSnapshot({
      ...createdWorkspace,
      cluster: {
        ...createdWorkspace.cluster,
        systems: createdWorkspace.cluster.systems.map(candidate => candidate.id === system.id
          ? { ...candidate, orbits: [orbit] }
          : candidate),
      },
      layout: {
        ...createdWorkspace.layout,
        orbitRadii: { ...createdWorkspace.layout.orbitRadii, [orbit.id]: { horizontal: 140, vertical: 90 } },
        orbitRotations: { ...createdWorkspace.layout.orbitRotations, [orbit.id]: 17 },
      },
    })

    return { workspace, systemId: system.id, orbitId: orbit.id }
  } finally {
    scope.stop()
    harness.dispose()
  }
}

function mapNavigationStub(): MapNavigationHandle {
  return {
    focusMap: () => undefined,
    setUnresolvedExitPositionPreview: () => undefined,
  } as unknown as MapNavigationHandle
}

function systemMapStub(): SystemMapHandle {
  return {
    focusMap: () => undefined,
    setOrbitCenterMovePreview: () => undefined,
  } as unknown as SystemMapHandle
}

function connectPreviewGuard(
  blockedReason: ReturnType<typeof createHistoryHarness>['blockedReason'],
  hasPendingPreview: () => boolean,
  message: string,
) {
  return watchEffect(() => {
    blockedReason.value = hasPendingPreview() ? message : null
  }, { flush: 'sync' })
}

test('unresolved-exit direct moves and confirmed previews round-trip through the shared coordinator @pure', async () => {
  setActivePinia(createPinia())
  const initial = createUnresolvedRouteWorkspace()
  const harness = createHistoryHarness(initial.workspace)
  const scope = effectScope()
  const store = useEditorUiStore()
  store.setSelection({ activeView: 'cluster', selectedRouteId: null })
  store.setMode('move')
  const placement = scope.run(() => useUnresolvedExitPlacement({
    workspace: harness.workspace,
    selectedRouteId: computed(() => store.selectedRouteId),
    clusterMapRef: shallowRef(mapNavigationStub()),
    mutations: harness.history,
    beforeWorkspaceOperation: async () => true,
  }))
  if (!placement) throw new Error('The unresolved-exit placement controller was not created.')
  const stopGuard = connectPreviewGuard(
    harness.blockedReason,
    () => placement.preview.value !== null,
    'Confirm or cancel the unresolved-exit preview first.',
  )

  store.setSelection({ selectedRouteId: initial.routeId })
  expect(placement.begin()).toBe(true)
  const automaticPosition = { ...placement.preview.value!.position }
  placement.cancel()
  expect(await placement.move(initial.routeId, automaticPosition)).toBe(true)
  expect(harness.workspace.value?.layout.unresolvedExitPositions).toEqual({})
  expect(harness.history.getStatus().totalActions).toBe(0)

  // An explicit confirmation at the same visual point creates the manual override as one action.
  expect(placement.begin()).toBe(true)
  expect(placement.preview.value?.position).toEqual(automaticPosition)
  expect(await placement.confirm()).toBe(true)
  expect(harness.workspace.value?.layout.unresolvedExitPositions?.[initial.routeId]).toEqual(automaticPosition)
  expect(harness.history.getStatus().totalActions).toBe(1)
  expect((await harness.history.undo()).status).toBe('applied')
  expect(harness.workspace.value).toEqual(createWorkspaceSnapshot(initial.workspace))
  expect((await harness.history.redo()).status).toBe('applied')
  expect(harness.workspace.value?.layout.unresolvedExitPositions?.[initial.routeId]).toEqual(automaticPosition)

  const directPosition = { x: 684, y: 248 }
  expect(await placement.move(initial.routeId, directPosition)).toBe(true)
  expect(harness.workspace.value?.layout.unresolvedExitPositions?.[initial.routeId]).toEqual(directPosition)
  expect(harness.history.getStatus().undoAction?.label).toBe('Move unresolved Jump Route target')
  expect((await harness.history.undo()).status).toBe('applied')
  expect(harness.workspace.value?.layout.unresolvedExitPositions?.[initial.routeId]).toEqual(automaticPosition)
  expect((await harness.history.redo()).status).toBe('applied')
  expect(harness.workspace.value?.layout.unresolvedExitPositions?.[initial.routeId]).toEqual(directPosition)

  store.setSelection({ selectedRouteId: initial.routeId })
  expect(placement.begin()).toBe(true)
  const targetPosition = { x: 752, y: 310 }
  expect(placement.previewAt(targetPosition)).toBe(true)
  expect(harness.history.getStatus().undoUnavailableReason).toBe('Confirm or cancel the unresolved-exit preview first.')
  expect(await harness.history.undo()).toMatchObject({ status: 'rejected', reason: 'unavailable' })
  const previewToken = placement.preview.value?.token
  expect(previewToken).toBeDefined()
  expect(await placement.confirm()).toBe(true)
  expect(placement.preview.value).toBeNull()
  expect(harness.workspace.value?.layout.unresolvedExitPositions?.[initial.routeId]).toEqual(targetPosition)
  expect((await harness.history.undo()).status).toBe('applied')
  expect(harness.workspace.value?.layout.unresolvedExitPositions?.[initial.routeId]).toEqual(directPosition)
  expect((await harness.history.redo()).status).toBe('applied')
  expect(harness.workspace.value?.layout.unresolvedExitPositions?.[initial.routeId]).toEqual(targetPosition)
  expect(harness.workspace.value?.cluster.routes[0]?.id).toBe(initial.routeId)

  stopGuard()
  scope.stop()
  harness.dispose()
})

function createOrbitCenterControllers(
  harness: ReturnType<typeof createHistoryHarness>,
  fixture: UnoccupiedOrbitFixture,
) {
  const scope = effectScope()
  const store = useEditorUiStore()
  store.setSelection({
    activeView: 'system',
    selectedSystemId: fixture.systemId,
    selectedOrbitId: fixture.orbitId,
  })
  store.setMode('move')
  const systemMapRef = shallowRef<SystemMapHandle | null>(systemMapStub())
  const orbitAdjustments = createContinuousOrbitAdjustmentController({ history: harness.history })
  const beforeWorkspaceOperation = async (): Promise<boolean> => {
    const result = await orbitAdjustments.beforeOperation()
    if (result.status === 'applied') void result.durable.catch(() => undefined)
    return result.status !== 'rejected'
  }
  let mapWorkflows: ReturnType<typeof useMapWorkflows> | undefined
  let placement: ReturnType<typeof useOrbitCenterPlacement> | undefined
  scope.run(() => {
    mapWorkflows = useMapWorkflows({
      workspace: harness.workspace,
      mutations: harness.history,
      systemMapRef,
      resolveTransition: async () => true,
      beginObjectSession: () => undefined,
      beginOrbitSession: () => undefined,
      isEntityCommandBlocked: () => false,
      editorError: ref(''),
      orbitAdjustments,
      beforeWorkspaceOperation,
    })
    placement = useOrbitCenterPlacement({
      workspace: harness.workspace,
      creationActive: computed(() => false),
      systemMapRef,
      isEntityCommandBlocked: () => false,
      moveOrbitCenter: mapWorkflows.moveMapOrbitCenter,
    })
  })
  if (!mapWorkflows || !placement) throw new Error('The Orbit-center workflows were not created.')
  return {
    placement,
    mapWorkflows,
    dispose() {
      orbitAdjustments.dispose()
      scope.stop()
    },
  }
}

test('unoccupied Orbit-center previews survive capacity cancellation and accepted moves round-trip @pure', async () => {
  setActivePinia(createPinia())
  const fixture = await createUnoccupiedOrbitWorkspace()

  const rejectedHarness = createHistoryHarness(fixture.workspace, {
    limits: { maxBytes: 1, maxActions: 100 },
    confirmCapacity: async () => false,
  })
  const rejectedControllers = createOrbitCenterControllers(rejectedHarness, fixture)
  const stopRejectedGuard = connectPreviewGuard(
    rejectedHarness.blockedReason,
    () => rejectedControllers.placement.orbitCenterMapMoveTargeting.value,
    'Confirm or cancel the Orbit-center move first.',
  )
  expect(rejectedControllers.placement.beginOrbitCenterMapMove()).toBe(true)
  const rejectedTarget = { x: 0.73, y: 0.64 }
  expect(rejectedControllers.placement.previewOrbitCenterMoveAt({
    x: 64 + rejectedTarget.x * 832,
    y: 72 + rejectedTarget.y * 416,
  })).toBe(true)
  const rejectedPreviewToken = rejectedControllers.placement.orbitCenterMovePreview.value?.token
  expect(rejectedPreviewToken).toBeDefined()
  expect(await rejectedControllers.placement.confirmOrbitCenterMove(rejectedPreviewToken!)).toBe(false)
  expect(rejectedControllers.placement.orbitCenterMovePreview.value?.token).toBe(rejectedPreviewToken)
  expect(rejectedHarness.workspace.value?.cluster.systems[0]?.orbits[0]?.center)
    .toEqual(fixture.workspace.cluster.systems[0]?.orbits[0]?.center)
  expect(rejectedHarness.history.getStatus().totalActions).toBe(0)
  stopRejectedGuard()
  rejectedControllers.dispose()
  rejectedHarness.dispose()

  const harness = createHistoryHarness(fixture.workspace)
  const controllers = createOrbitCenterControllers(harness, fixture)
  const stopGuard = connectPreviewGuard(
    harness.blockedReason,
    () => controllers.placement.orbitCenterMapMoveTargeting.value,
    'Confirm or cancel the Orbit-center move first.',
  )
  const before = createWorkspaceSnapshot(harness.workspace.value!)
  expect(controllers.placement.beginOrbitCenterMapMove()).toBe(true)
  const target = { x: 0.71, y: 0.66 }
  expect(controllers.placement.previewOrbitCenterMoveAt({
    x: 64 + target.x * 832,
    y: 72 + target.y * 416,
  })).toBe(true)
  const token = controllers.placement.orbitCenterMovePreview.value?.token
  expect(token).toBeDefined()
  expect(await controllers.placement.confirmOrbitCenterMove(token!)).toBe(true)
  expect(controllers.placement.orbitCenterMovePreview.value).toBeNull()
  const acceptedCenter = { ...harness.workspace.value!.cluster.systems[0]!.orbits[0]!.center }
  expect(acceptedCenter.x).toBeCloseTo(target.x, 12)
  expect(acceptedCenter.y).toBeCloseTo(target.y, 12)
  expect(harness.history.getStatus().undoAction?.label).toBe('Move Orbit 1')

  expect((await harness.history.undo()).status).toBe('applied')
  expect(harness.workspace.value).toEqual(before)
  expect((await harness.history.redo()).status).toBe('applied')
  expect(harness.workspace.value?.cluster.systems[0]?.orbits[0]?.center).toEqual(acceptedCenter)
  expect(harness.workspace.value?.cluster.systems[0]?.orbits[0]?.id).toBe(fixture.orbitId)

  stopGuard()
  controllers.dispose()
  harness.dispose()
})

test('late capacity consent cannot publish a canceled and replaced Orbit-center preview @pure', async () => {
  setActivePinia(createPinia())
  const fixture = await createUnoccupiedOrbitWorkspace()
  let decideCapacity: ((accepted: boolean) => void) | undefined
  let announceCapacity: (() => void) | undefined
  const capacityDecision = new Promise<boolean>((resolve) => { decideCapacity = resolve })
  const capacityShown = new Promise<void>((resolve) => { announceCapacity = resolve })
  const harness = createHistoryHarness(fixture.workspace, {
    limits: { maxBytes: 1, maxActions: 100 },
    confirmCapacity: async () => {
      announceCapacity?.()
      return await capacityDecision
    },
  })
  const controllers = createOrbitCenterControllers(harness, fixture)
  const stopGuard = connectPreviewGuard(
    harness.blockedReason,
    () => controllers.placement.orbitCenterMapMoveTargeting.value,
    'Confirm or cancel the Orbit-center move first.',
  )
  const before = createWorkspaceSnapshot(harness.workspace.value!)
  expect(controllers.placement.beginOrbitCenterMapMove()).toBe(true)
  expect(controllers.placement.previewOrbitCenterMoveAt({ x: 64 + 0.69 * 832, y: 72 + 0.61 * 416 })).toBe(true)
  const canceledToken = controllers.placement.orbitCenterMovePreview.value?.token
  expect(canceledToken).toBeDefined()

  const pendingConfirm = controllers.placement.confirmOrbitCenterMove(canceledToken!)
  await capacityShown
  controllers.placement.cancelOrbitCenterMove(false)
  expect(controllers.placement.beginOrbitCenterMapMove()).toBe(true)
  expect(controllers.placement.previewOrbitCenterMoveAt({ x: 64 + 0.76 * 832, y: 72 + 0.68 * 416 })).toBe(true)
  const replacementToken = controllers.placement.orbitCenterMovePreview.value?.token
  expect(replacementToken).toBeDefined()
  expect(replacementToken).not.toBe(canceledToken)

  decideCapacity?.(true)
  expect(await pendingConfirm).toBe(false)
  expect(harness.workspace.value).toEqual(before)
  expect(harness.history.getStatus().totalActions).toBe(0)
  expect(controllers.placement.orbitCenterMovePreview.value?.token).toBe(replacementToken)

  stopGuard()
  controllers.dispose()
  harness.dispose()
})

test('a map-mode change invalidates an Orbit-center preview while capacity consent is open @pure', async () => {
  setActivePinia(createPinia())
  const fixture = await createUnoccupiedOrbitWorkspace()
  let decideCapacity: ((accepted: boolean) => void) | undefined
  let announceCapacity: (() => void) | undefined
  const capacityDecision = new Promise<boolean>((resolve) => { decideCapacity = resolve })
  const capacityShown = new Promise<void>((resolve) => { announceCapacity = resolve })
  const harness = createHistoryHarness(fixture.workspace, {
    limits: { maxBytes: 1, maxActions: 100 },
    confirmCapacity: async () => {
      announceCapacity?.()
      return await capacityDecision
    },
  })
  const controllers = createOrbitCenterControllers(harness, fixture)
  const store = useEditorUiStore()
  const stopGuard = connectPreviewGuard(
    harness.blockedReason,
    () => controllers.placement.orbitCenterMapMoveTargeting.value,
    'Confirm or cancel the Orbit-center move first.',
  )
  const before = createWorkspaceSnapshot(harness.workspace.value!)
  expect(controllers.placement.beginOrbitCenterMapMove()).toBe(true)
  expect(controllers.placement.previewOrbitCenterMoveAt({ x: 64 + 0.74 * 832, y: 72 + 0.59 * 416 })).toBe(true)
  const token = controllers.placement.orbitCenterMovePreview.value?.token
  expect(token).toBeDefined()

  const pendingConfirm = controllers.placement.confirmOrbitCenterMove(token!)
  await capacityShown
  store.setMode('select')
  decideCapacity?.(true)

  expect(await pendingConfirm).toBe(false)
  expect(harness.workspace.value).toEqual(before)
  expect(harness.history.getStatus().totalActions).toBe(0)
  expect(controllers.placement.orbitCenterMovePreview.value).toBeNull()
  expect(controllers.placement.orbitCenterMapMoveTargeting.value).toBe(false)
  expect(harness.blockedReason.value).toBeNull()

  stopGuard()
  controllers.dispose()
  harness.dispose()
})

async function verifyAcceptedOrbitCenterMovesRetainInspectorSessions(reorderPropertiesForRegression: boolean): Promise<void> {
  setActivePinia(createPinia())
  const fixture = await createUnoccupiedOrbitWorkspace(reorderPropertiesForRegression)
  const initialOrbitKeys = Object.keys(fixture.workspace.cluster.systems[0]!.orbits[0]!)
  if (reorderPropertiesForRegression) {
    expect(initialOrbitKeys).toEqual(['center', 'id', 'order', 'hostId'])
  }
  const harness = createHistoryHarness(fixture.workspace)
  const scope = effectScope()
  const workflows = scope.run(() => useEditorWorkflows({
    workspace: harness.workspace,
    mutations: harness.history,
    initializeWorkspace: async () => undefined,
    saveState: ref<SaveState>('saved'),
    saveError: ref<string | null>(null),
  }))
  if (!workflows) throw new Error('The editor workflows were not created.')

  const store = useEditorUiStore()
  store.setSelection({
    activeView: 'system',
    selectedSystemId: fixture.systemId,
    selectedOrbitId: fixture.orbitId,
  })
  await workflows.inspector.beginOrbitEdit()
  const cleanSession = workflows.inspector.entitySession.value
  expect(cleanSession?.kind).toBe('orbit')
  if (!cleanSession || cleanSession.kind !== 'orbit') throw new Error('The Orbit Inspector session did not start.')

  expect(await workflows.placement.map.moveMapOrbitCenter(fixture.orbitId, { x: 0.62, y: 0.71 }, null)).toBe(true)
  expect(Object.keys(harness.workspace.value!.cluster.systems[0]!.orbits[0]!)).not.toEqual(initialOrbitKeys)
  expect(workflows.inspector.entitySession.value?.id).toBe(cleanSession.id)
  expect(workflows.inspector.hasModifiedEntitySession.value).toBe(false)

  cleanSession.draft.horizontalRadius = '240'
  expect(workflows.inspector.hasModifiedEntitySession.value).toBe(true)
  expect(await workflows.placement.map.moveMapOrbitCenter(fixture.orbitId, { x: 0.74, y: 0.39 }, null)).toBe(true)
  expect(workflows.inspector.entitySession.value?.id).toBe(cleanSession.id)
  expect(workflows.inspector.entitySession.value?.kind === 'orbit'
    ? workflows.inspector.entitySession.value.draft.horizontalRadius
    : null).toBe('240')
  expect(await workflows.inspector.applyEntitySession(cleanSession.id)).toBe(true)
  expect(harness.workspace.value?.layout.orbitRadii[fixture.orbitId]?.horizontal).toBe(240)

  workflows.adjustments.resetOrbitAdjustments()
  scope.stop()
  harness.dispose()
}

test('accepted Orbit-center moves retain Inspector sessions from production Add records @pure', async () => {
  await verifyAcceptedOrbitCenterMovesRetainInspectorSessions(false)
})

test('accepted Orbit-center moves ignore deterministic Orbit property reordering @pure', async () => {
  await verifyAcceptedOrbitCenterMovesRetainInspectorSessions(true)
})

test('Orbit Inspector still rejects changed hosts and radii @pure', async () => {
  async function expectStaleDraft(
    changeWorkspace: (current: LocalWorkspace, fixture: UnoccupiedOrbitFixture) => LocalWorkspace,
    message: string,
  ): Promise<void> {
    const fixture = await createUnoccupiedOrbitWorkspace()
    const harness = createHistoryHarness(fixture.workspace)
    const scope = effectScope()
    const inspector = scope.run(() => useEntityInspectorSession({
      workspace: harness.workspace,
      mutations: harness.history,
    }))
    if (!inspector) throw new Error('The Inspector session controller was not created.')
    inspector.beginOrbitSession(fixture.workspace.cluster.id, fixture.systemId, fixture.orbitId)
    const session = inspector.entitySession.value
    if (!session || session.kind !== 'orbit') throw new Error('The Orbit Inspector session did not start.')
    session.draft.horizontalRadius = '240'
    harness.workspace.value = createWorkspaceSnapshot(changeWorkspace(harness.workspace.value!, fixture))

    expect(await inspector.applyEntitySession(session.id)).toBe(false)
    expect(session.error).toContain(message)
    expect(harness.history.getStatus().totalActions).toBe(0)

    scope.stop()
    harness.dispose()
  }

  setActivePinia(createPinia())
  await expectStaleDraft((current, fixture) => ({
    ...current,
    layout: {
      ...current.layout,
      orbitRadii: {
        ...current.layout.orbitRadii,
        [fixture.orbitId]: { horizontal: 190, vertical: 90 },
      },
    },
  }), 'The Orbit host or one of its parent placements changed while this Inspector was open.')

  await expectStaleDraft((current, fixture) => {
    const system = current.cluster.systems.find(candidate => candidate.id === fixture.systemId)!
    const orbit = system.orbits.find(candidate => candidate.id === fixture.orbitId)!
    const hostId = system.objects[0]!.id
    return {
      ...current,
      cluster: {
        ...current.cluster,
        systems: current.cluster.systems.map(candidate => candidate.id === fixture.systemId
          ? {
              ...candidate,
              orbits: candidate.orbits.map(value => value.id === fixture.orbitId
                ? { id: orbit.id, hostId, order: orbit.order }
                : value),
            }
          : candidate),
      },
    }
  }, 'This Orbit changed while its Inspector was open.')
})

test('capacity-delayed Orbit-center moves do not rebase a replacement Inspector session @pure', async () => {
  setActivePinia(createPinia())
  const fixture = await createUnoccupiedOrbitWorkspace()
  let decideCapacity: ((accepted: boolean) => void) | undefined
  let announceCapacity: (() => void) | undefined
  const capacityDecision = new Promise<boolean>((resolve) => { decideCapacity = resolve })
  const capacityShown = new Promise<void>((resolve) => { announceCapacity = resolve })
  const harness = createHistoryHarness(fixture.workspace, {
    limits: { maxBytes: 1, maxActions: 100 },
    confirmCapacity: async () => {
      announceCapacity?.()
      return await capacityDecision
    },
  })
  const system = fixture.workspace.cluster.systems[0]!
  const object = system.objects[0]!
  const store = useEditorUiStore()
  store.setSelection({
    activeView: 'system',
    selectedSystemId: fixture.systemId,
    selectedOrbitId: fixture.orbitId,
  })
  store.setMode('move')
  const scope = effectScope()
  const systemMapRef = shallowRef<SystemMapHandle | null>(systemMapStub())
  const orbitAdjustments = createContinuousOrbitAdjustmentController({ history: harness.history })
  const beforeWorkspaceOperation = async (): Promise<boolean> => {
    const result = await orbitAdjustments.beforeOperation()
    if (result.status === 'applied') void result.durable.catch(() => undefined)
    return result.status !== 'rejected'
  }
  const controllers = scope.run(() => {
    const inspector = useEntityInspectorSession({ workspace: harness.workspace, mutations: harness.history })
    const map = useMapWorkflows({
      workspace: harness.workspace,
      mutations: harness.history,
      systemMapRef,
      resolveTransition: async () => true,
      beginObjectSession: inspector.beginObjectSession,
      beginOrbitSession: inspector.beginOrbitSession,
      isEntityCommandBlocked: inspector.isEntityCommandBlocked,
      createCommittedPositionAppliedHandler: inspector.createCommittedPositionAppliedHandler,
      createCommittedOrbitCenterAppliedHandler: inspector.createCommittedOrbitCenterAppliedHandler,
      editorError: ref(''),
      orbitAdjustments,
      beforeWorkspaceOperation,
    })
    return { inspector, map }
  })
  if (!controllers) throw new Error('The Inspector and map workflows were not created.')

  controllers.inspector.beginOrbitSession(fixture.workspace.cluster.id, fixture.systemId, fixture.orbitId)
  const originalSession = controllers.inspector.entitySession.value
  if (!originalSession || originalSession.kind !== 'orbit' || originalSession.initial.orbit.hostId !== null) {
    throw new Error('The unoccupied Orbit Inspector session did not start.')
  }
  const originalCenter = { ...originalSession.initial.orbit.center }
  const originalSessionId = originalSession.id
  const pendingMove = controllers.map.moveMapOrbitCenter(fixture.orbitId, { x: 0.69, y: 0.57 }, null)
  await capacityShown

  controllers.inspector.beginObjectSession(fixture.workspace.cluster.id, fixture.systemId, object.id)
  controllers.inspector.beginOrbitSession(fixture.workspace.cluster.id, fixture.systemId, fixture.orbitId)
  const replacement = controllers.inspector.entitySession.value
  expect(replacement?.kind).toBe('orbit')
  if (!replacement || replacement.kind !== 'orbit') throw new Error('The replacement Orbit session did not start.')
  expect(replacement.id).not.toBe(originalSessionId)
  replacement.draft.horizontalRadius = '200'

  decideCapacity?.(true)
  expect(await pendingMove).toBe(true)
  expect(harness.workspace.value?.cluster.systems[0]?.orbits[0]?.center).toEqual({ x: 0.69, y: 0.57 })
  expect(controllers.inspector.entitySession.value?.id).toBe(replacement.id)
  expect(replacement.initial.orbit.center).toEqual(originalCenter)
  expect(replacement.draft.horizontalRadius).toBe('200')

  orbitAdjustments.dispose()
  scope.stop()
  harness.dispose()
})

test('accepted object-position moves retain the clean Object Inspector session @pure', async () => {
  setActivePinia(createPinia())
  const initial = createLocalWorkspace('Kestrel Reach', 'Vesper')
  const system = initial.cluster.systems[0]!
  const object = system.objects[0]!
  const harness = createHistoryHarness(initial)
  const scope = effectScope()
  const workflows = scope.run(() => useEditorWorkflows({
    workspace: harness.workspace,
    mutations: harness.history,
    initializeWorkspace: async () => undefined,
    saveState: ref<SaveState>('saved'),
    saveError: ref<string | null>(null),
  }))
  if (!workflows) throw new Error('The editor workflows were not created.')

  useEditorUiStore().setSelection({
    activeView: 'system',
    selectedSystemId: system.id,
    selectedObjectId: object.id,
  })
  await workflows.inspector.beginObjectEdit()
  const session = workflows.inspector.entitySession.value
  expect(session?.kind).toBe('object')
  if (!session || session.kind !== 'object') throw new Error('The Object Inspector session did not start.')

  const target = { x: 0.68, y: 0.42 }
  await workflows.placement.map.moveMapObject(object.id, target)

  expect(harness.workspace.value?.cluster.systems[0]?.objects[0]?.placement)
    .toEqual({ kind: 'system', ...target })
  expect(workflows.inspector.entitySession.value?.id).toBe(session.id)
  expect(workflows.inspector.hasModifiedEntitySession.value).toBe(false)
  expect(session.initial.object.placement).toEqual({ kind: 'system', ...target })

  workflows.adjustments.resetOrbitAdjustments()
  scope.stop()
  harness.dispose()
})

test('a blank route-creation session blocks Undo while a clean armed system Add does not @pure', async () => {
  setActivePinia(createPinia())
  const harness = createHistoryHarness(createLocalWorkspace('Kestrel Reach', 'Vesper'))
  const workflows = useEditorWorkflows({
    workspace: harness.workspace,
    mutations: harness.history,
    initializeWorkspace: async () => undefined,
    saveState: ref<SaveState>('saved'),
    saveError: ref<string | null>(null),
  })
  const store = useEditorUiStore()
  store.setSelection({ activeView: 'cluster' })
  const stopGuard = watchEffect(() => {
    harness.blockedReason.value = workflows.historyGuards.blockReason.value
  }, { flush: 'sync' })

  const before = harness.workspace.value!
  const rename = await harness.history.execute({
    action: { kind: 'rename', label: 'Rename Jump Cluster', target: { kind: 'cluster', id: before.cluster.id } },
    prepare: current => ({ ...current, cluster: { ...current.cluster, name: 'Kestrel Reach Prime' } }),
  })
  expect(rename.status).toBe('applied')
  await workflows.cluster.beginRoute()
  expect(workflows.inspector.routeSession.value?.routeId).toBeNull()
  expect(workflows.historyGuards.blockReason.value).toBe('Finish or cancel the current Cluster route action first.')
  expect(await harness.history.undo()).toMatchObject({ status: 'rejected', reason: 'unavailable' })
  expect(harness.workspace.value?.cluster.name).toBe('Kestrel Reach Prime')

  await workflows.placement.quitAdd()
  expect(workflows.inspector.routeSession.value).toBeNull()
  expect(workflows.historyGuards.blockReason.value).toBeNull()
  workflows.placement.clusterSystem.armSystemAdd()
  expect(workflows.historyGuards.blockReason.value).toBeNull()
  expect((await harness.history.undo()).status).toBe('applied')
  expect(harness.workspace.value?.cluster.name).toBe('Kestrel Reach')
  expect(workflows.placement.clusterSystem.clusterAddType.value).toBe('system')

  stopGuard()
  workflows.adjustments.resetOrbitAdjustments()
  harness.dispose()
})
