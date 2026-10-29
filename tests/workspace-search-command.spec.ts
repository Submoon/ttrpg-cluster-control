import { expect, test } from '@playwright/test'
import { createPinia, setActivePinia } from 'pinia'
import { createRenderer, ref } from 'vue'
import { createLocalWorkspace, planMapEntityDeletion } from '../domain/workspace'
import type { MapNavigationHandle, SaveState } from '../composables/editor-workflows/types'
import { useEditorWorkflows } from '../composables/useEditorWorkflows'
import { createWorkspaceHistoryCoordinator } from '../composables/editor-workflows/workspace-mutations'
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

function installBrowserLifecycleBoundary(): () => void {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
  const previousDocument = Object.getOwnPropertyDescriptor(globalThis, 'document')
  const media = {
    matches: false,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      matchMedia: () => media,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      requestAnimationFrame: () => 0,
      cancelAnimationFrame: () => undefined,
    },
  })
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: {
      activeElement: null,
      visibilityState: 'visible',
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    },
  })
  return () => {
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow)
    else Reflect.deleteProperty(globalThis, 'window')
    if (previousDocument) Object.defineProperty(globalThis, 'document', previousDocument)
    else Reflect.deleteProperty(globalThis, 'document')
  }
}

function createSearchHarness(
  clusterName = 'Kestrel Reach',
  systemName = 'Vesper',
  durable: Promise<void> = Promise.resolve(),
  additionalSystemName?: string,
  waitForSearchPresentation?: () => Promise<void>,
) {
  const restoreBrowserBoundary = installBrowserLifecycleBoundary()
  setActivePinia(createPinia())
  const initialWorkspace = createLocalWorkspace(clusterName, systemName)
  if (additionalSystemName) {
    const firstSystem = initialWorkspace.cluster.systems[0]
    if (!firstSystem) throw new Error('The local workspace did not create its first system.')
    const additionalSystemId = 'search-additional-system'
    initialWorkspace.cluster.systems.push({
      ...firstSystem,
      id: additionalSystemId,
      name: additionalSystemName,
      objects: [],
      orbits: [],
    })
    initialWorkspace.layout.systemPositions[additionalSystemId] = { x: 0.78, y: 0.54 }
  }
  const workspace = ref(initialWorkspace)
  let revision = 0
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
  let workflows: ReturnType<typeof useEditorWorkflows> | undefined
  const app = renderer.createApp({
    setup() {
      workflows = useEditorWorkflows({
        workspace,
        mutations: history,
        initializeWorkspace: async () => undefined,
        saveState: ref<SaveState>('saved'),
        saveError: ref<string | null>(null),
        waitForSearchPresentation,
      })
      return () => null
    },
  })
  app.mount({ children: [], parent: null })
  const mountedWorkflows = workflows
  if (!mountedWorkflows) throw new Error('The editor workflows were not created.')
  let disposed = false
  return {
    workspace,
    history,
    workflows: mountedWorkflows,
    store: useEditorUiStore(),
    dispose() {
      if (disposed) return
      disposed = true
      app.unmount()
      history.dispose()
      restoreBrowserBoundary()
    },
  }
}

function createMapHandle(options: {
  whenReady: () => Promise<boolean>
  frameSearchTarget: NonNullable<MapNavigationHandle['frameSearchTarget']>
  focusMap: () => void
}): MapNavigationHandle {
  return {
    exportImage: async () => new Blob(),
    focusMap: options.focusMap,
    getViewport: () => ({ x: 0, y: 0, k: 1 }),
    getMinimumZoomScale: () => 0.25,
    setViewport: () => undefined,
    zoomBy: () => undefined,
    panBy: () => undefined,
    fitMap: () => undefined,
    cancelActiveGesture: () => undefined,
    startViewPan: () => undefined,
    moveViewPan: () => undefined,
    endViewPan: () => undefined,
    startTouchNavigation: () => undefined,
    moveTouchNavigation: () => undefined,
    endTouchNavigation: () => undefined,
    whenReady: options.whenReady,
    frameSearchTarget: options.frameSearchTarget,
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((complete) => { resolve = complete })
  return { promise, resolve }
}

test('Stay keeps the modified chart draft, map context, and search query when a result is rejected @pure', async () => {
  const harness = createSearchHarness()
  try {
    const initialSystem = harness.workspace.value.cluster.systems[0]
    if (!initialSystem) throw new Error('The local workspace did not create its first system.')
    harness.store.setSelection({
      activeView: 'system',
      selectedSystemId: initialSystem.id,
      selectedObjectId: initialSystem.objects[0]?.id ?? null,
    })
    harness.store.setMode('move')
    await harness.workflows.charts.beginNamesEdit()
    harness.workflows.charts.clusterName.value = 'Kestrel Reach Prime'
    harness.store.setSelection({ activeView: 'cluster', clusterSelectedSystemId: initialSystem.id })
    harness.workflows.placement.clusterSystem.armSystemAdd()

    const search = harness.workflows.search
    search.open.value = true
    search.query.value = 'Kestrel'
    const clusterResult = search.results.value.find(result => result.target.kind === 'cluster')
    if (!clusterResult) throw new Error('The applied cluster name was not searchable.')
    const initialSelection = {
      activeView: harness.store.activeView,
      selectedSystemId: harness.store.selectedSystemId,
      selectedObjectId: harness.store.selectedObjectId,
      mapMode: harness.store.mapMode,
    }

    const reveal = search.reveal(clusterResult.target)
    await expect.poll(() => harness.workflows.charts.transitionGuard.value).toBe('chart')
    await harness.workflows.charts.resolveTransitionChoice('stay')

    expect(await reveal).toEqual({ status: 'rejected', reason: 'guard' })
    expect({
      activeView: harness.store.activeView,
      selectedSystemId: harness.store.selectedSystemId,
      selectedObjectId: harness.store.selectedObjectId,
      mapMode: harness.store.mapMode,
    }).toEqual(initialSelection)
    expect(harness.workflows.charts.clusterName.value).toBe('Kestrel Reach Prime')
    expect(harness.workflows.placement.clusterSystem.clusterAddType.value).toBe('system')
    expect(harness.workflows.search.open.value).toBe(true)
    expect(harness.workflows.search.query.value).toBe('Kestrel')
  } finally {
    harness.dispose()
  }
})

test('an accepted system result selects and frames its cluster node without replacing the active system @pure', async () => {
  const harness = createSearchHarness()
  try {
    const system = harness.workspace.value.cluster.systems[0]
    if (!system) throw new Error('The local workspace did not create its first system.')
    harness.store.setSelection({ activeView: 'system', selectedSystemId: system.id })
    harness.store.setMode('move')
    const framedTargets: Parameters<NonNullable<MapNavigationHandle['frameSearchTarget']>>[0][] = []
    let focusCount = 0
    harness.workflows.mapControls.clusterMapRef.value = createMapHandle({
      whenReady: async () => true,
      frameSearchTarget: target => {
        framedTargets.push(target)
        return true
      },
      focusMap: () => { focusCount += 1 },
    })
    const search = harness.workflows.search
    search.open.value = true
    search.query.value = system.name
    const systemResult = search.results.value.find(result => result.target.kind === 'system')
    if (!systemResult) throw new Error('The applied system name was not searchable.')

    expect(await search.reveal(systemResult.target)).toEqual({ status: 'revealed' })
    expect(harness.store.activeView).toBe('cluster')
    expect(harness.store.selectedSystemId).toBe(system.id)
    expect(harness.store.clusterSelectedSystemId).toBe(system.id)
    expect(harness.store.inspectedClusterSystemId).toBeNull()
    expect(harness.store.mapMode).toBe('select')
    expect(search.open.value).toBe(false)
    expect(search.query.value).toBe(system.name)
    expect(framedTargets).toEqual([systemResult.target])
    expect(focusCount).toBe(1)
    expect(harness.history.getStatus().totalActions).toBe(0)
  } finally {
    harness.dispose()
  }
})

test('invalid chart Apply rejects a result without closing search or leaving the starting map @pure', async () => {
  const harness = createSearchHarness()
  try {
    const system = harness.workspace.value.cluster.systems[0]
    if (!system) throw new Error('The local workspace did not create its first system.')
    harness.store.setSelection({ activeView: 'system', selectedSystemId: system.id })
    harness.store.setMode('move')
    await harness.workflows.charts.beginNamesEdit()
    harness.workflows.charts.clusterName.value = '   '
    const search = harness.workflows.search
    search.open.value = true
    search.query.value = 'Kestrel'
    const result = search.results.value.find(candidate => candidate.target.kind === 'cluster')
    if (!result) throw new Error('The applied cluster name was not searchable.')

    const reveal = search.reveal(result.target)
    await expect.poll(() => harness.workflows.charts.transitionGuard.value).toBe('chart')
    await harness.workflows.charts.resolveTransitionChoice('apply')

    expect(await reveal).toEqual({ status: 'rejected', reason: 'guard' })
    expect(harness.workflows.charts.hasChartNameDraft.value).toBe(true)
    expect(harness.workflows.charts.formError.value).not.toBe('')
    expect(harness.workspace.value.cluster.name).toBe('Kestrel Reach')
    expect(harness.store.activeView).toBe('system')
    expect(harness.store.selectedSystemId).toBe(system.id)
    expect(harness.store.mapMode).toBe('move')
    expect(search.open.value).toBe(true)
    expect(search.query.value).toBe('Kestrel')
  } finally {
    harness.dispose()
  }
})

test('accepted chart Apply publishes its rename and the captured stable cluster target still reveals @pure', async () => {
  const durable = deferred<void>()
  let durableSettled = false
  void durable.promise.then(() => { durableSettled = true })
  const harness = createSearchHarness('Kestrel Reach', 'Vesper', durable.promise)
  try {
    const system = harness.workspace.value.cluster.systems[0]
    if (!system) throw new Error('The local workspace did not create its first system.')
    harness.store.setSelection({ activeView: 'system', selectedSystemId: system.id })
    harness.store.setMode('move')
    await harness.workflows.charts.beginNamesEdit()
    harness.workflows.charts.clusterName.value = 'Kestrel Reach Prime'

    const framedTargets: Parameters<NonNullable<MapNavigationHandle['frameSearchTarget']>>[0][] = []
    harness.workflows.mapControls.clusterMapRef.value = createMapHandle({
      whenReady: async () => true,
      frameSearchTarget: target => {
        framedTargets.push(target)
        return true
      },
      focusMap: () => undefined,
    })
    const search = harness.workflows.search
    search.open.value = true
    search.query.value = 'Kestrel'
    const clusterResult = search.results.value.find(result => result.target.kind === 'cluster')
    if (!clusterResult) throw new Error('The applied cluster name was not searchable.')

    const reveal = search.reveal(clusterResult.target)
    await expect.poll(() => harness.workflows.charts.transitionGuard.value).toBe('chart')
    await harness.workflows.charts.resolveTransitionChoice('apply')

    expect(await reveal).toEqual({ status: 'revealed' })
    expect(harness.workspace.value.cluster.name).toBe('Kestrel Reach Prime')
    expect(harness.workflows.search.results.value.map(result => result.name)).toContain('Kestrel Reach Prime')
    expect(durableSettled).toBe(false)
    expect(harness.store.activeView).toBe('cluster')
    expect(harness.store.mapMode).toBe('select')
    expect(search.open.value).toBe(false)
    expect(search.query.value).toBe('Kestrel')
    expect(framedTargets).toEqual([clusterResult.target])
    expect(harness.history.getStatus().totalActions).toBe(1)
  } finally {
    durable.resolve()
    harness.dispose()
  }
})

test('a second pending result invalidates the earlier reveal instead of queueing a stale destination @pure', async () => {
  const harness = createSearchHarness('Vesper', 'Vesper')
  try {
    const system = harness.workspace.value.cluster.systems[0]
    if (!system) throw new Error('The local workspace did not create its first system.')
    harness.store.setSelection({ activeView: 'system', selectedSystemId: system.id })
    await harness.workflows.charts.beginNamesEdit()
    harness.workflows.charts.clusterName.value = 'Vesper Reach'
    const search = harness.workflows.search
    search.open.value = true
    search.query.value = 'Vesper'
    const clusterResult = search.results.value.find(result => result.target.kind === 'cluster')
    const systemResult = search.results.value.find(result => result.target.kind === 'system')
    if (!clusterResult || !systemResult) throw new Error('The duplicate cluster and system names were not searchable.')

    const firstReveal = search.reveal(clusterResult.target)
    await expect.poll(() => harness.workflows.charts.transitionGuard.value).toBe('chart')
    expect(await search.reveal(systemResult.target)).toEqual({ status: 'rejected', reason: 'guard' })
    await harness.workflows.charts.resolveTransitionChoice('stay')

    expect(await firstReveal).toEqual({ status: 'rejected', reason: 'stale' })
    expect(harness.store.activeView).toBe('system')
    expect(harness.workflows.charts.hasChartNameDraft.value).toBe(true)
    expect(search.open.value).toBe(true)
    expect(search.query.value).toBe('Vesper')
  } finally {
    harness.dispose()
  }
})

test('a system result keeps its dirty object draft behind the existing Stay guard @pure', async () => {
  const harness = createSearchHarness()
  try {
    const system = harness.workspace.value.cluster.systems[0]
    const object = system?.objects.find(candidate => candidate.subtype === 'star') ?? system?.objects[0]
    if (!system || !object) throw new Error('The local workspace did not create its first system object.')
    harness.store.setSelection({ activeView: 'system', selectedSystemId: system.id, selectedObjectId: object.id })
    await harness.workflows.inspector.beginObjectEdit()
    const session = harness.workflows.inspector.entitySession.value
    if (!session || session.kind !== 'object') throw new Error('The selected object edit session did not start.')
    session.draft.name = 'Primary Star Prime'

    const search = harness.workflows.search
    search.open.value = true
    search.query.value = system.name
    const systemResult = search.results.value.find(result => result.target.kind === 'system')
    if (!systemResult) throw new Error('The applied system name was not searchable.')

    const reveal = search.reveal(systemResult.target)
    await expect.poll(() => harness.workflows.charts.transitionGuard.value).toBe('inspector')
    await harness.workflows.charts.resolveTransitionChoice('stay')

    expect(await reveal).toEqual({ status: 'rejected', reason: 'guard' })
    expect(harness.workflows.inspector.entitySession.value?.id).toBe(session.id)
    expect(harness.workflows.inspector.hasModifiedEntitySession.value).toBe(true)
    expect(harness.workflows.inspector.entitySession.value?.kind === 'object'
      ? harness.workflows.inspector.entitySession.value.draft.name
      : null).toBe('Primary Star Prime')
    expect(harness.store.activeView).toBe('system')
    expect(harness.store.selectedObjectId).toBe(object.id)
    expect(search.open.value).toBe(true)
    expect(search.query.value).toBe(system.name)
  } finally {
    harness.dispose()
  }
})

test('a system result preserves its matching chart-name session and its unapplied system name @pure', async () => {
  const harness = createSearchHarness()
  try {
    const system = harness.workspace.value.cluster.systems[0]
    if (!system) throw new Error('The local workspace did not create its first system.')
    harness.store.setSelection({ activeView: 'system', selectedSystemId: system.id })
    await harness.workflows.charts.beginNamesEdit()
    harness.workflows.charts.systemName.value = 'Vesper Prime'
    harness.workflows.mapControls.clusterMapRef.value = createMapHandle({
      whenReady: async () => true,
      frameSearchTarget: () => true,
      focusMap: () => undefined,
    })
    const search = harness.workflows.search
    search.open.value = true
    search.query.value = system.name
    const systemResult = search.results.value.find(result => result.target.kind === 'system')
    if (!systemResult) throw new Error('The applied system name was not searchable.')

    expect(await search.reveal(systemResult.target)).toEqual({ status: 'revealed' })
    expect(harness.store.activeView).toBe('cluster')
    expect(harness.store.selectedSystemId).toBe(system.id)
    expect(harness.workflows.charts.hasChartNameDraft.value).toBe(true)
    expect(harness.workflows.charts.hasUncommittedNames.value).toBe(true)
    expect(harness.workflows.charts.systemName.value).toBe('Vesper Prime')
    expect(search.open.value).toBe(false)
    expect(search.query.value).toBe(system.name)
  } finally {
    harness.dispose()
  }
})

test('a changed navigation context during confirmation makes the captured result stale @pure', async () => {
  const harness = createSearchHarness()
  try {
    const system = harness.workspace.value.cluster.systems[0]
    if (!system) throw new Error('The local workspace did not create its first system.')
    harness.store.setSelection({ activeView: 'system', selectedSystemId: system.id })
    await harness.workflows.charts.beginNamesEdit()
    harness.workflows.charts.clusterName.value = 'Kestrel Reach Prime'
    const search = harness.workflows.search
    search.open.value = true
    search.query.value = 'Kestrel'
    const clusterResult = search.results.value.find(result => result.target.kind === 'cluster')
    if (!clusterResult) throw new Error('The applied cluster name was not searchable.')

    const reveal = search.reveal(clusterResult.target)
    await expect.poll(() => harness.workflows.charts.transitionGuard.value).toBe('chart')
    harness.store.setSelection({ activeView: 'cluster' })
    await harness.workflows.charts.resolveTransitionChoice('discard')

    expect(await reveal).toEqual({ status: 'rejected', reason: 'stale' })
    expect(harness.store.activeView).toBe('cluster')
    expect(harness.workflows.charts.hasChartNameDraft.value).toBe(false)
    expect(search.open.value).toBe(true)
    expect(search.query.value).toBe('Kestrel')
  } finally {
    harness.dispose()
  }
})

test('disposing the editor while a map is becoming ready prevents a deferred reveal and resets search @pure', async () => {
  const harness = createSearchHarness()
  const ready = deferred<boolean>()
  let frameCount = 0
  let focusCount = 0
  try {
    const system = harness.workspace.value.cluster.systems[0]
    if (!system) throw new Error('The local workspace did not create its first system.')
    harness.store.setSelection({ activeView: 'system', selectedSystemId: system.id })
    harness.workflows.mapControls.clusterMapRef.value = createMapHandle({
      whenReady: () => ready.promise,
      frameSearchTarget: () => {
        frameCount += 1
        return true
      },
      focusMap: () => { focusCount += 1 },
    })
    const search = harness.workflows.search
    search.open.value = true
    search.query.value = system.name
    const systemResult = search.results.value.find(result => result.target.kind === 'system')
    if (!systemResult) throw new Error('The applied system name was not searchable.')

    const reveal = search.reveal(systemResult.target)
    await expect.poll(() => harness.store.activeView).toBe('cluster')
    expect(search.open.value).toBe(false)
    harness.dispose()
    ready.resolve(true)

    expect(await reveal).toEqual({ status: 'rejected', reason: 'stale' })
    expect(frameCount).toBe(0)
    expect(focusCount).toBe(0)
    expect(harness.store.searchOpen).toBe(false)
    expect(harness.store.searchQuery).toBe('')
  } finally {
    harness.dispose()
  }
})

test('deleting a captured system while its destination map is mounting restores the starting context @pure', async () => {
  const harness = createSearchHarness('Kestrel Reach', 'Vesper', Promise.resolve(), 'Altair')
  const ready = deferred<boolean>()
  let frameCount = 0
  let focusCount = 0
  try {
    const targetSystem = harness.workspace.value.cluster.systems.find(system => system.name === 'Vesper')
    const activeSystem = harness.workspace.value.cluster.systems.find(system => system.name === 'Altair')
    if (!targetSystem || !activeSystem) throw new Error('The deletion fixture needs both systems.')
    harness.store.setSelection({ activeView: 'system', selectedSystemId: activeSystem.id })
    harness.store.setMode('move')
    harness.workflows.mapControls.clusterMapRef.value = createMapHandle({
      whenReady: () => ready.promise,
      frameSearchTarget: () => {
        frameCount += 1
        return true
      },
      focusMap: () => { focusCount += 1 },
    })
    const search = harness.workflows.search
    search.open.value = true
    search.query.value = 'Vesper'
    const systemResult = search.results.value.find(result => result.target.kind === 'system')
    if (!systemResult) throw new Error('The applied system name was not searchable.')

    const reveal = search.reveal(systemResult.target)
    await expect.poll(() => harness.store.activeView).toBe('cluster')
    await expect.poll(() => search.open.value).toBe(false)
    const deletion = await harness.history.execute({
      action: { kind: 'delete', label: 'Delete Vesper', target: { kind: 'system', id: targetSystem.id } },
      prepare: current => planMapEntityDeletion(current, { kind: 'system', systemId: targetSystem.id }).workspace,
    })
    expect(deletion.status).toBe('applied')
    await expect.poll(() => harness.store.clusterSelectedSystemId).toBeNull()
    ready.resolve(true)

    expect(await reveal).toEqual({ status: 'rejected', reason: 'unavailable' })
    expect(harness.store.activeView).toBe('system')
    expect(harness.store.selectedSystemId).toBe(activeSystem.id)
    expect(harness.store.mapMode).toBe('move')
    expect(search.open.value).toBe(true)
    expect(search.query.value).toBe('Vesper')
    expect(search.results.value).toEqual([])
    expect(frameCount).toBe(0)
    expect(focusCount).toBe(0)
  } finally {
    ready.resolve(false)
    harness.dispose()
  }
})

test('reopening search while overlay teardown is pending prevents a stale map focus @pure', async () => {
  const presentation = deferred<void>()
  let presentationWaits = 0
  let frameCount = 0
  let focusCount = 0
  const harness = createSearchHarness(
    'Kestrel Reach',
    'Vesper',
    Promise.resolve(),
    undefined,
    () => {
      presentationWaits += 1
      return presentation.promise
    },
  )
  try {
    const system = harness.workspace.value.cluster.systems[0]
    if (!system) throw new Error('The local workspace did not create its first system.')
    harness.store.setSelection({ activeView: 'system', selectedSystemId: system.id })
    harness.workflows.mapControls.clusterMapRef.value = createMapHandle({
      whenReady: async () => true,
      frameSearchTarget: () => {
        frameCount += 1
        return true
      },
      focusMap: () => { focusCount += 1 },
    })
    const search = harness.workflows.search
    search.open.value = true
    search.query.value = 'Vesper'
    const result = search.results.value.find(candidate => candidate.target.kind === 'system')
    if (!result) throw new Error('The applied system name was not searchable.')

    const reveal = search.reveal(result.target)
    await expect.poll(() => harness.store.activeView).toBe('cluster')
    await expect.poll(() => search.open.value).toBe(false)
    await expect.poll(() => presentationWaits).toBe(1)
    search.open.value = true
    presentation.resolve()

    expect(await reveal).toEqual({ status: 'rejected', reason: 'stale' })
    expect(search.open.value).toBe(true)
    expect(search.query.value).toBe('Vesper')
    expect(frameCount).toBe(0)
    expect(focusCount).toBe(0)
  } finally {
    presentation.resolve()
    harness.dispose()
  }
})

test('reopening then closing search does not revive a pending reveal @pure', async () => {
  const presentation = deferred<void>()
  let frameCount = 0
  let focusCount = 0
  const harness = createSearchHarness(
    'Kestrel Reach',
    'Vesper',
    Promise.resolve(),
    undefined,
    () => presentation.promise,
  )
  try {
    const system = harness.workspace.value.cluster.systems[0]
    if (!system) throw new Error('The local workspace did not create its first system.')
    harness.store.setSelection({ activeView: 'system', selectedSystemId: system.id })
    harness.workflows.mapControls.clusterMapRef.value = createMapHandle({
      whenReady: async () => true,
      frameSearchTarget: () => {
        frameCount += 1
        return true
      },
      focusMap: () => { focusCount += 1 },
    })
    const search = harness.workflows.search
    search.open.value = true
    search.query.value = 'Vesper'
    const result = search.results.value.find(candidate => candidate.target.kind === 'system')
    if (!result) throw new Error('The applied system name was not searchable.')

    const reveal = search.reveal(result.target)
    await expect.poll(() => harness.store.activeView).toBe('cluster')
    await expect.poll(() => search.open.value).toBe(false)
    search.open.value = true
    await expect.poll(() => search.open.value).toBe(true)
    search.open.value = false
    await expect.poll(() => search.open.value).toBe(false)
    presentation.resolve()

    expect({ result: await reveal, frameCount, focusCount }).toEqual({
      result: { status: 'rejected', reason: 'stale' },
      frameCount: 0,
      focusCount: 0,
    })
  } finally {
    presentation.resolve()
    harness.dispose()
  }
})

test('an accepted same-cluster system result ends the armed system Add action @pure', async () => {
  const harness = createSearchHarness()
  try {
    const system = harness.workspace.value.cluster.systems[0]
    if (!system) throw new Error('The local workspace did not create its first system.')
    harness.store.setSelection({ activeView: 'cluster', clusterSelectedSystemId: system.id })
    harness.workflows.mapControls.clusterMapRef.value = createMapHandle({
      whenReady: async () => true,
      frameSearchTarget: () => true,
      focusMap: () => undefined,
    })
    harness.workflows.placement.clusterSystem.armSystemAdd()
    expect(harness.workflows.placement.clusterSystem.clusterAddType.value).toBe('system')

    const search = harness.workflows.search
    search.open.value = true
    search.query.value = system.name
    const result = search.results.value.find(candidate => candidate.target.kind === 'system')
    if (!result) throw new Error('The applied system name was not searchable.')

    expect(await search.reveal(result.target)).toEqual({ status: 'revealed' })
    expect(harness.workflows.placement.clusterSystem.clusterAddType.value).toBeNull()
  } finally {
    harness.dispose()
  }
})
