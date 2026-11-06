import { expect, test } from '@playwright/test'
import { createPinia, setActivePinia } from 'pinia'
import { computed, createRenderer, ref, type Ref } from 'vue'
import { createJumpRoute, createLocalWorkspace, createSystemObject, type LocalWorkspace } from '../domain/workspace'
import type { SaveState } from '../composables/editor-workflows/types'
import type { EntityInspectorSession } from '../composables/editor-workflows/types'
import { useRouteInspectorSession } from '../composables/editor-workflows/useRouteInspectorSession'
import { useChartNamesSession } from '../composables/editor-workflows/useChartNamesSession'
import { useEditorTransitions } from '../composables/editor-workflows/useEditorTransitions'
import { usePublicationWorkflows } from '../composables/editor-workflows/usePublicationWorkflows'
import {
  createWorkspaceHistoryCoordinator,
  type WorkspaceHistoryCoordinator,
} from '../composables/editor-workflows/workspace-mutations'
import type { WorkspaceHistoryLimits } from '../composables/editor-workflows/workspace-history-timeline'
import type { PublicationTarget } from '../composables/editor-workflows/publication-types'
import { useEditorUiStore } from '../stores/editor-ui'

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

function addSecondSystem(workspace: LocalWorkspace): void {
  const first = workspace.cluster.systems[0]
  if (!first) throw new Error('The workspace must contain its initial system.')
  const id = 'publication-inspected-system'
  workspace.cluster.systems.push({ ...first, id, name: 'Inspected System', objects: [], orbits: [] })
  workspace.layout.systemPositions[id] = { x: 0.78, y: 0.54 }
}

function createHarness(options: {
  secondSystem?: boolean
  parentHidden?: boolean
  includeRoute?: boolean
  beforeWorkspaceOperation?: () => Promise<boolean>
  historyLimits?: Partial<WorkspaceHistoryLimits>
  confirmCapacity?: (signal: AbortSignal) => Promise<boolean>
} = {}) {
  setActivePinia(createPinia())
  const initial = createLocalWorkspace('Kestrel Reach', 'Vesper')
  if (options.secondSystem) addSecondSystem(initial)
  const first = initial.cluster.systems[0]
  const object = first?.objects[0]
  if (!first || !object) throw new Error('The test workspace must contain a map object.')
  if (options.parentHidden) first.publication = 'hidden'
  const route = options.includeRoute
    ? (() => {
        const point = createSystemObject(first, 'jump-point')
        first.objects.push(point)
        const created = createJumpRoute(initial.cluster, 1, point.id, null, 'Uncharted exit')
        initial.cluster.routes.push(created)
        return created
      })()
    : null

  const workspace = ref<LocalWorkspace | null>(initial)
  let revision = 0
  const history: WorkspaceHistoryCoordinator = createWorkspaceHistoryCoordinator({
    getWorkspace: () => workspace.value,
    getRevision: () => revision,
    publishWorkspace: next => {
      workspace.value = next
      revision += 1
      return { durable: Promise.resolve() }
    },
    getTraversalBlockReason: () => null,
    confirmCapacity: (_details, signal) => options.confirmCapacity?.(signal) ?? Promise.resolve(false),
    limits: options.historyLimits,
  })
  let mounted: {
    store: ReturnType<typeof useEditorUiStore>
    chart: ReturnType<typeof useChartNamesSession>
    route: ReturnType<typeof useRouteInspectorSession>
    transitions: ReturnType<typeof useEditorTransitions>
    publication: ReturnType<typeof usePublicationWorkflows>
  } | undefined
  const app = renderer.createApp({
    setup() {
      const store = useEditorUiStore()
      store.reset(`${initial.id}:${initial.cluster.id}`)
      const selectedSystem = computed(() => workspace.value?.cluster.systems.find(system => system.id === store.selectedSystemId))
      const chart = useChartNamesSession({
        workspace,
        saveState: ref<SaveState>('saved'),
        saveError: ref<string | null>(null),
        initializeWorkspace: async () => undefined,
        mutations: history,
        selectedSystem,
      })
      const routeSession = useRouteInspectorSession({ workspace, mutations: history })
      const transitions = useEditorTransitions({
        chart: {
          session: chart.session,
          editing: chart.editing,
          hasUncommittedNames: chart.hasUncommittedNames,
          apply: chart.apply,
          discard: chart.discard,
        },
        entity: {
          session: ref<EntityInspectorSession | null>(null) as Ref<EntityInspectorSession | null>,
          hasModified: ref(false),
          apply: async () => true,
          discard: () => undefined,
        },
        route: {
          session: routeSession.routeSession,
          hasModified: routeSession.hasModifiedRouteSession,
          apply: routeSession.applyRouteSession,
          discard: routeSession.discardRouteSession,
        },
        clearEditorError: () => undefined,
      })
      const publication = usePublicationWorkflows({
        workspace,
        store,
        mutations: history,
        transitions,
        routeSharing: {
          session: routeSession.routeSession,
          sessionGeneration: routeSession.sessionGeneration,
          beforeWorkspaceOperation: options.beforeWorkspaceOperation ?? (async () => true),
        },
        setError: () => undefined,
      })
      mounted = { store, chart, route: routeSession, transitions, publication }
      return () => null
    },
  })
  app.mount({ children: [], parent: null })
  if (!mounted) throw new Error('The publication workflow did not mount.')

  const active = mounted
  function dispose(): void {
    app.unmount()
    history.dispose()
  }

  return { workspace, history, routeId: route?.id ?? null, ...active, dispose }
}

function objectTarget(harness: ReturnType<typeof createHarness>): PublicationTarget {
  const system = harness.workspace.value?.cluster.systems[0]
  const object = system?.objects[0]
  if (!system || !object) throw new Error('The test workspace lost its initial object.')
  return { kind: 'object', id: object.id, systemId: system.id }
}

test('publication targets an inspected system without changing navigation and supports history and no-op @pure', async () => {
  const harness = createHarness({ secondSystem: true })
  try {
    const first = harness.workspace.value!.cluster.systems[0]!
    const second = harness.workspace.value!.cluster.systems[1]!
    harness.store.activeView = 'cluster'
    harness.store.selectedSystemId = first.id
    harness.store.clusterSelectedSystemId = second.id
    harness.store.inspectedClusterSystemId = second.id

    const original = harness.workspace.value!
    const target: PublicationTarget = { kind: 'system', id: second.id, systemId: second.id }
    const applied = await harness.publication.set({ targets: [target], mode: 'revealed' })
    expect(applied.status).toBe('applied')
    expect(harness.workspace.value?.cluster.systems[0]).toEqual(first)
    expect(harness.workspace.value?.cluster.systems[1]?.publication).toBe('revealed')
    expect(harness.workspace.value?.cluster.systems[1]?.name).toBe(second.name)
    expect(harness.workspace.value?.cluster.playerTitle).toBe(original.cluster.playerTitle)
    expect(harness.store.selectedSystemId).toBe(first.id)
    expect(harness.store.inspectedClusterSystemId).toBe(second.id)
    expect(harness.history.getEntries()).toHaveLength(1)

    const unchanged = await harness.publication.set({ targets: [target], mode: 'revealed' })
    expect(unchanged.status).toBe('unchanged')
    expect(harness.history.getEntries()).toHaveLength(1)
    const unsupportedBatch = await harness.publication.set({ targets: [target, target], mode: 'hidden' })
    expect(unsupportedBatch.status).toBe('rejected')
    expect(harness.history.getEntries()).toHaveLength(1)

    await harness.history.undo()
    expect(harness.workspace.value?.cluster.systems[1]?.publication).toBe('known-type')
    const preservedRedo = await harness.publication.set({ targets: [target], mode: 'known-type' })
    expect(preservedRedo.status).toBe('unchanged')
    expect(harness.history.getStatus()).toMatchObject({ redoDepth: 1, redoUnavailableReason: null })
    await harness.history.redo()
    expect(harness.workspace.value?.cluster.systems[1]?.publication).toBe('revealed')
  } finally {
    harness.dispose()
  }
})

test('publishing an object under a hidden system preserves the parent and resolves chart drafts @pure', async () => {
  const harness = createHarness({ parentHidden: true })
  try {
    const target = objectTarget(harness)
    const system = harness.workspace.value!.cluster.systems[0]!
    harness.store.activeView = 'system'
    harness.store.selectedSystemId = system.id
    harness.chart.beginAccepted(harness.workspace.value!, system)
    harness.chart.clusterName.value = 'Kestrel Reach II'

    const pending = harness.publication.set({ targets: [target], mode: 'revealed' })
    expect(harness.transitions.transitionGuard.value).toBe('chart')
    await harness.transitions.resolveTransitionChoice('apply')
    const applied = await pending

    expect(applied.status).toBe('applied')
    expect(harness.workspace.value?.cluster.name).toBe('Kestrel Reach II')
    expect(harness.workspace.value?.cluster.systems[0]?.publication).toBe('hidden')
    expect(harness.workspace.value?.cluster.systems[0]?.objects[0]?.publication).toBe('revealed')
    expect(harness.history.getEntries()).toHaveLength(2)
  } finally {
    harness.dispose()
  }
})

test('Discard applies only the requested visibility, while Stay preserves the draft and history @pure', async () => {
  const discarded = createHarness()
  try {
    const system = discarded.workspace.value!.cluster.systems[0]!
    discarded.store.selectedSystemId = system.id
    discarded.chart.beginAccepted(discarded.workspace.value!, system)
    discarded.chart.clusterName.value = 'Discard this name'
    const pending = discarded.publication.set({ targets: [objectTarget(discarded)], mode: 'unknown' })
    expect(discarded.transitions.transitionGuard.value).toBe('chart')
    await discarded.transitions.resolveTransitionChoice('discard')
    expect((await pending).status).toBe('applied')
    expect(discarded.workspace.value?.cluster.name).toBe('Kestrel Reach')
    expect(discarded.workspace.value?.cluster.systems[0]?.objects[0]?.publication).toBe('unknown')
    expect(discarded.history.getEntries()).toHaveLength(1)
  } finally {
    discarded.dispose()
  }

  const stayed = createHarness()
  try {
    const system = stayed.workspace.value!.cluster.systems[0]!
    stayed.store.selectedSystemId = system.id
    stayed.chart.beginAccepted(stayed.workspace.value!, system)
    stayed.chart.clusterName.value = 'Keep this draft'
    const before = stayed.workspace.value
    const pending = stayed.publication.set({ targets: [objectTarget(stayed)], mode: 'revealed' })
    expect(stayed.transitions.transitionGuard.value).toBe('chart')
    await stayed.transitions.resolveTransitionChoice('stay')
    expect(await pending).toMatchObject({ status: 'rejected', reason: 'cancelled' })
    expect(stayed.workspace.value).toBe(before)
    expect(stayed.chart.clusterName.value).toBe('Keep this draft')
    expect(stayed.chart.hasUncommittedNames.value).toBe(true)
    expect(stayed.history.getEntries()).toHaveLength(0)
  } finally {
    stayed.dispose()
  }
})

test('a captured publication request becomes stale when its editor context changes during a draft decision @pure', async () => {
  const harness = createHarness({ secondSystem: true })
  try {
    const first = harness.workspace.value!.cluster.systems[0]!
    const second = harness.workspace.value!.cluster.systems[1]!
    harness.store.selectedSystemId = first.id
    harness.chart.beginAccepted(harness.workspace.value!, first)
    harness.chart.clusterName.value = 'Pending chart name'

    const pending = harness.publication.set({ targets: [objectTarget(harness)], mode: 'revealed' })
    expect(harness.transitions.transitionGuard.value).toBe('chart')
    harness.store.selectedSystemId = second.id
    await harness.transitions.resolveTransitionChoice('discard')

    expect(await pending).toMatchObject({ status: 'rejected', reason: 'cancelled' })
    expect(harness.workspace.value?.cluster.systems[0]?.objects[0]?.publication).toBe('known-type')
    expect(harness.workspace.value?.cluster.name).toBe('Kestrel Reach')
    expect(harness.history.getEntries()).toHaveLength(0)
  } finally {
    harness.dispose()
  }
})

test('capacity cancellation leaves the published workspace and history unchanged @pure', async () => {
  let markCapacityShown: (() => void) | undefined
  let resolveCapacity: ((accepted: boolean) => void) | undefined
  const capacityShown = new Promise<void>((resolve) => { markCapacityShown = resolve })
  const confirmation = new Promise<boolean>((resolve) => { resolveCapacity = resolve })
  const harness = createHarness({
    historyLimits: { maxBytes: 0 },
    confirmCapacity: async () => {
      markCapacityShown?.()
      return confirmation
    },
  })
  try {
    const before = harness.workspace.value
    const pending = harness.publication.set({ targets: [objectTarget(harness)], mode: 'revealed' })
    await capacityShown
    expect(harness.publication.busy.value).toBe(true)
    resolveCapacity?.(false)
    expect((await pending).status).toBe('rejected')
    expect(harness.workspace.value).toBe(before)
    expect(harness.history.getEntries()).toHaveLength(0)
  } finally {
    resolveCapacity?.(false)
    harness.dispose()
  }
})

test('capacity consent cannot publish after the editor context changes @pure', async () => {
  let markCapacityShown: (() => void) | undefined
  let resolveCapacity: ((accepted: boolean) => void) | undefined
  const capacityShown = new Promise<void>((resolve) => { markCapacityShown = resolve })
  const confirmation = new Promise<boolean>((resolve) => { resolveCapacity = resolve })
  const harness = createHarness({
    secondSystem: true,
    historyLimits: { maxBytes: 0 },
    confirmCapacity: async () => {
      markCapacityShown?.()
      return confirmation
    },
  })
  try {
    const first = harness.workspace.value!.cluster.systems[0]!
    const second = harness.workspace.value!.cluster.systems[1]!
    harness.store.selectedSystemId = first.id
    const before = harness.workspace.value
    const pending = harness.publication.set({ targets: [objectTarget(harness)], mode: 'revealed' })
    await capacityShown
    harness.store.selectedSystemId = second.id
    resolveCapacity?.(true)

    expect((await pending).status).toBe('rejected')
    expect(harness.workspace.value).toBe(before)
    expect(harness.history.getEntries()).toHaveLength(0)
  } finally {
    resolveCapacity?.(false)
    harness.dispose()
  }
})

test('route sharing does not overwrite a route draft opened during preflight @pure', async () => {
  let markPreflightStarted: (() => void) | undefined
  let resolvePreflight: ((accepted: boolean) => void) | undefined
  const preflightStarted = new Promise<void>(resolve => { markPreflightStarted = resolve })
  const preflight = new Promise<boolean>(resolve => { resolvePreflight = resolve })
  const harness = createHarness({
    includeRoute: true,
    beforeWorkspaceOperation: async () => {
      markPreflightStarted?.()
      return preflight
    },
  })
  try {
    const routeId = harness.routeId
    if (!routeId) throw new Error('The workflow test needs a committed Jump Route.')
    harness.store.activeView = 'cluster'
    harness.store.selectedRouteId = routeId
    const routeBefore = harness.workspace.value!.cluster.routes.find(route => route.id === routeId)
    if (!routeBefore) throw new Error('The workflow test lost its committed Jump Route.')

    const pending = harness.publication.setRouteSharing(routeId, true)
    await preflightStarted
    const sessionId = harness.route.beginRouteSession(routeId)
    if (sessionId === null) throw new Error('The route Inspector draft must begin during preflight.')
    harness.route.updateRouteInput(sessionId, 'jumpLevel', '9')
    resolvePreflight?.(true)

    expect(await pending).toMatchObject({ status: 'rejected', reason: 'cancelled' })
    expect(harness.workspace.value?.cluster.routes.find(route => route.id === routeId)).toEqual(routeBefore)
    expect(harness.history.getEntries()).toHaveLength(0)
    expect(harness.route.routeSession.value?.draft.jumpLevel).toBe('9')
  } finally {
    resolvePreflight?.(false)
    harness.dispose()
  }
})
