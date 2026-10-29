import { expect, test } from '@playwright/test'
import { computed, createRenderer, ref } from 'vue'
import { createLocalWorkspace, type LocalWorkspace } from '../domain/workspace'
import type { SaveState } from '../composables/editor-workflows/types'
import { useEditorTransitions } from '../composables/editor-workflows/useEditorTransitions'
import { useChartNamesSession, type ChartNamesSession } from '../composables/editor-workflows/useChartNamesSession'
import type { EntityInspectorSession } from '../composables/editor-workflows/types'
import type { RouteInspectorSession } from '../composables/editor-workflows/useRouteInspectorSession'
import type { RouteDraftValues } from '../composables/editor-workflows/useRouteInspectorSession'
import { useEntityInspectorSession } from '../composables/editor-workflows/useEntityInspectorSession'
import {
  createWorkspaceHistoryCoordinator,
  createWorkspaceMutationExecutor,
  type WorkspaceHistoryCoordinator,
  type WorkspaceMutationRequest,
  type WorkspaceMutationResult,
} from '../composables/editor-workflows/workspace-mutations'

interface HostNode {
  children: HostNode[]
  parent: HostNode | null
}

const renderer = createRenderer<HostNode, HostNode>({
  patchProp: () => undefined,
  insert: (child, parent, anchor) => {
    child.parent = parent
    const index = anchor ? parent.children.indexOf(anchor) : -1
    if (index < 0) parent.children.push(child)
    else parent.children.splice(index, 0, child)
  },
  remove: child => {
    if (!child.parent) return
    child.parent.children = child.parent.children.filter(candidate => candidate !== child)
    child.parent = null
  },
  createElement: () => ({ children: [], parent: null }),
  createText: () => ({ children: [], parent: null }),
  createComment: () => ({ children: [], parent: null }),
  setText: () => undefined,
  setElementText: () => undefined,
  parentNode: node => node.parent,
  nextSibling: node => {
    if (!node.parent) return null
    const index = node.parent.children.indexOf(node)
    return node.parent.children[index + 1] ?? null
  },
})

function mountTransitions(options: Parameters<typeof useEditorTransitions>[0]) {
  let transitions: ReturnType<typeof useEditorTransitions> | undefined
  const app = renderer.createApp({
    setup() {
      transitions = useEditorTransitions(options)
      return () => null
    },
  })
  app.mount({ children: [], parent: null })
  if (!transitions) throw new Error('The transition controller was not created.')
  return { transitions, dispose: () => app.unmount() }
}

interface PendingMutation {
  request: WorkspaceMutationRequest
  resolve(result: WorkspaceMutationResult): void
}

function createMutationGate() {
  const workspace = ref<LocalWorkspace | null>(createLocalWorkspace('Kestrel Reach', 'Vesper'))
  let revision = 0
  let rejectDurable: ((error: Error) => void) | undefined
  const durable = new Promise<void>((_resolve, reject) => { rejectDurable = reject })
  const pending: PendingMutation[] = []
  const pendingMutationWaiters: Array<() => void> = []
  const history = createWorkspaceHistoryCoordinator({
    getWorkspace: () => workspace.value,
    getRevision: () => revision,
    publishWorkspace: next => {
      workspace.value = next
      revision += 1
      return { durable }
    },
    getTraversalBlockReason: () => null,
    confirmCapacity: async () => false,
  })
  const mutations: WorkspaceHistoryCoordinator = {
    ...history,
    execute: request => new Promise(resolve => {
      pending.push({ request, resolve })
      pendingMutationWaiters.shift()?.()
    }),
    dispose: () => history.dispose(),
  }

  function takePending(): PendingMutation {
    const next = pending.shift()
    if (!next) throw new Error('There is no delayed mutation to release.')
    return next
  }

  async function acceptNext(): Promise<void> {
    const next = takePending()
    next.resolve(await history.execute(next.request))
  }

  async function waitForPendingMutation(): Promise<void> {
    if (pending.length > 0) return
    await new Promise<void>(resolve => pendingMutationWaiters.push(resolve))
  }

  async function executeNextAndHoldResult(): Promise<() => void> {
    const next = takePending()
    const result = await history.execute(next.request)
    return () => next.resolve(result)
  }

  function rejectNext(message: string): void {
    takePending().resolve({ status: 'rejected', reason: 'failed', message })
  }

  return {
    workspace,
    durable,
    mutations,
    revision: () => revision,
    acceptNext,
    waitForPendingMutation,
    executeNextAndHoldResult,
    rejectNext,
    rejectDurable: (error: Error) => rejectDurable?.(error),
  }
}

function createChartTransition(gate: ReturnType<typeof createMutationGate>) {
  const workspace = gate.workspace
  const selectedSystem = computed(() => workspace.value?.cluster.systems[0])
  const chart = useChartNamesSession({
    workspace,
    saveState: ref<SaveState>('saved'),
    saveError: ref(null),
    mutations: gate.mutations,
    initializeWorkspace: async () => undefined,
    selectedSystem,
  })
  const current = workspace.value
  const system = selectedSystem.value
  if (!current || !system) throw new Error('The test workspace did not contain its initial system.')
  chart.beginAccepted(current, system)
  chart.clusterName.value = 'Kestrel Reach Prime'

  const transition = mountTransitions({
    chart: {
      session: chart.session,
      editing: chart.editing,
      hasUncommittedNames: chart.hasUncommittedNames,
      apply: chart.apply,
      discard: chart.discard,
    },
    entity: {
      session: ref<EntityInspectorSession | null>(null),
      hasModified: ref(false),
      apply: async () => true,
      discard: () => undefined,
    },
    route: {
      session: ref<RouteInspectorSession | null>(null),
      hasModified: ref(false),
      apply: async () => true,
      discard: () => undefined,
    },
    clearEditorError: () => undefined,
  })
  return { ...transition, chart }
}

test('a rejected delayed Apply retains its chart draft and ignores a duplicate Discard @pure', async () => {
  const gate = createMutationGate()
  const chart = createChartTransition(gate)
  const pendingTransition = chart.transitions.resolveTransition()
  let transitionSettled = false
  void pendingTransition.then(() => { transitionSettled = true })

  const applying = chart.transitions.resolveTransitionChoice('apply')
  await chart.transitions.resolveTransitionChoice('discard')
  expect(gate.workspace.value?.cluster.name).toBe('Kestrel Reach')
  expect(chart.chart.session.value).not.toBeNull()
  expect(chart.chart.clusterName.value).toBe('Kestrel Reach Prime')
  expect(transitionSettled).toBe(false)

  gate.rejectNext('The proposal was refused.')
  await applying

  expect(chart.transitions.transitionGuard.value).toBeNull()
  expect(chart.chart.session.value).not.toBeNull()
  expect(chart.chart.editing.value).toBe(true)
  expect(chart.chart.formError.value).toBe('The proposal was refused.')
  expect(gate.workspace.value?.cluster.name).toBe('Kestrel Reach')
  await expect(pendingTransition).resolves.toBe(false)
  chart.dispose()
})

test('an accepted delayed Apply publishes once and completes navigation before a later save failure @pure', async () => {
  const gate = createMutationGate()
  const chart = createChartTransition(gate)
  const pendingTransition = chart.transitions.resolveTransition()
  let transitionSettled = false
  void pendingTransition.then(() => { transitionSettled = true })

  const applying = chart.transitions.resolveTransitionChoice('apply')
  await chart.transitions.resolveTransitionChoice('discard')
  expect(gate.workspace.value?.cluster.name).toBe('Kestrel Reach')
  expect(chart.chart.session.value).not.toBeNull()
  expect(transitionSettled).toBe(false)

  await gate.acceptNext()
  await applying
  await expect(pendingTransition).resolves.toBe(true)
  expect(chart.chart.session.value).toBeNull()
  expect(gate.workspace.value?.cluster.name).toBe('Kestrel Reach Prime')
  expect(gate.revision()).toBe(1)

  gate.rejectDurable(new Error('IndexedDB is unavailable.'))
  await expect(gate.durable).rejects.toThrow('IndexedDB is unavailable.')
  expect(gate.workspace.value?.cluster.name).toBe('Kestrel Reach Prime')
  chart.dispose()
})

test('an accepted result after transition unmount cannot close a newer chart session @pure', async () => {
  const gate = createMutationGate()
  const chart = createChartTransition(gate)
  const firstSessionId = chart.chart.session.value?.id
  const pendingTransition = chart.transitions.resolveTransition()
  const applying = chart.transitions.resolveTransitionChoice('apply')

  await gate.waitForPendingMutation()
  const releaseResult = await gate.executeNextAndHoldResult()
  expect(gate.workspace.value?.cluster.name).toBe('Kestrel Reach Prime')
  chart.dispose()
  await expect(pendingTransition).resolves.toBe(false)

  chart.chart.discard()
  const current = gate.workspace.value
  const systemId = chart.chart.session.value?.systemId ?? current?.cluster.systems[0]?.id
  const nextSystem = current?.cluster.systems.find(candidate => candidate.id === systemId)
  if (!current || !nextSystem) throw new Error('The current chart target disappeared.')
  chart.chart.beginAccepted(current, nextSystem)
  chart.chart.clusterName.value = 'Kestrel Reach Secondary'
  const newerSessionId = chart.chart.session.value?.id
  releaseResult()
  await applying

  expect(newerSessionId).toBeGreaterThan(firstSessionId ?? 0)
  expect(chart.chart.session.value?.id).toBe(newerSessionId)
  expect(chart.chart.clusterName.value).toBe('Kestrel Reach Secondary')
  expect(gate.workspace.value?.cluster.name).toBe('Kestrel Reach Prime')

  gate.rejectDurable(new Error('IndexedDB is unavailable.'))
  await expect(gate.durable).rejects.toThrow('IndexedDB is unavailable.')
})

test('an accepted route result cannot apply an entity session replaced while the transition is pending @pure', async () => {
  const workspace = ref<LocalWorkspace | null>(createLocalWorkspace('Kestrel Reach', 'Vesper'))
  let revision = 0
  const mutations = createWorkspaceMutationExecutor({
    getWorkspace: () => workspace.value,
    getRevision: () => revision,
    publishWorkspace: next => {
      workspace.value = next
      revision += 1
      return { durable: Promise.resolve() }
    },
  })
  const entity = useEntityInspectorSession({ workspace, mutations })
  const current = workspace.value!
  const system = current.cluster.systems[0]!
  const object = system.objects[0]!
  entity.beginObjectSession(current.cluster.id, system.id, object.id)
  const originalEntitySession = entity.entitySession.value!
  if (originalEntitySession.kind !== 'object') throw new Error('The object Inspector session was not created.')
  originalEntitySession.draft.name = 'An applied object edit'

  const routeDraft: RouteDraftValues = {
    jumpLevel: '1',
    fromPointId: 'point-a',
    destination: 'point',
    toPointId: 'point-b',
    unresolvedExit: '',
  }
  const routeSession = ref<RouteInspectorSession | null>({
    id: 7,
    clusterId: current.cluster.id,
    routeId: 'route-a',
    initial: { ...routeDraft },
    draft: { ...routeDraft, jumpLevel: '2' },
    sourceSystemIds: null,
    destinationSystemIds: null,
    endpointToChoose: 'to',
    errors: {},
    error: '',
  })
  const routeHasModified = ref(true)
  let resolveRouteApply: ((applied: boolean) => void) | undefined
  const transitionChartSession = ref<ChartNamesSession | null>(null)
  const mountedTransition: ReturnType<typeof mountTransitions> = mountTransitions({
    chart: {
      session: transitionChartSession,
      editing: ref(false),
      hasUncommittedNames: ref(false),
      apply: async () => true,
      discard: () => { transitionChartSession.value = null },
    },
    entity: {
      session: entity.entitySession,
      hasModified: entity.hasModifiedEntitySession,
      apply: entity.applyEntitySession,
      discard: entity.discardEntitySession,
    },
    route: {
      session: routeSession,
      hasModified: routeHasModified,
      apply: () => new Promise(resolve => { resolveRouteApply = resolve }),
      discard: id => {
        if (routeSession.value?.id === id) routeSession.value = null
      },
    },
    clearEditorError: () => undefined,
  })

  const pendingTransition = mountedTransition.transitions.resolveTransition()
  const applying = mountedTransition.transitions.resolveTransitionChoice('apply')
  const newerDraft = 'A newer object draft that must remain pending'
  const releaseRouteApply = (): void => {
    routeSession.value = null
    routeHasModified.value = false
    queueMicrotask(() => {
      entity.discardEntitySession(originalEntitySession.id)
      entity.beginObjectSession(current.cluster.id, system.id, object.id)
      const newer = entity.entitySession.value
      if (newer?.kind === 'object') newer.draft.name = newerDraft
    })
    resolveRouteApply?.(true)
  }
  releaseRouteApply()
  await applying

  const survivingSession = entity.entitySession.value
  expect(survivingSession?.id).toBeGreaterThan(originalEntitySession.id)
  expect(survivingSession?.kind === 'object' ? survivingSession.draft.name : '').toBe(newerDraft)
  expect(workspace.value).toBe(current)
  expect(revision).toBe(0)
  await expect(pendingTransition).resolves.toBe(false)
  mountedTransition.dispose()
})
