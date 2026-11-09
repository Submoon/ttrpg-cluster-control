import { expect, test } from '@playwright/test'
import { createPinia, setActivePinia } from 'pinia'
import { createRenderer, ref } from 'vue'
import { createLocalWorkspace, createOrbit, nativePlayerFieldIds, planMapEntityDeletion, updateNativeFieldOptions, updateWorkspaceObject } from '../domain/workspace'
import type { MapNavigationHandle, SaveState, SearchPresentationSettlement, SystemMapHandle } from '../composables/editor-workflows/types'
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

function installBrowserLifecycleBoundary(compact = false): () => void {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
  const previousDocument = Object.getOwnPropertyDescriptor(globalThis, 'document')
  const media = {
    matches: compact,
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
  waitForSearchPresentation?: (signal: AbortSignal) => Promise<SearchPresentationSettlement>,
  compact = false,
) {
  const restoreBrowserBoundary = installBrowserLifecycleBoundary(compact)
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

function createSystemMapHandle(options: {
  whenReady: () => Promise<boolean>
  frameSearchTarget: NonNullable<MapNavigationHandle['frameSearchTarget']>
  focusMap: () => void
  prepareSearchLocator?: NonNullable<MapNavigationHandle['prepareSearchLocator']>
}): SystemMapHandle {
  return {
    ...createMapHandle(options),
    focusMap: options.focusMap,
    prepareSearchLocator: options.prepareSearchLocator,
    setObjectPlacementPreview: () => undefined,
    setOrbitPlacementPreview: () => undefined,
    setOrbitCenterMovePreview: () => undefined,
    getDetachedOrbitCenter: () => undefined,
    getCreationCandidates: () => [],
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((complete) => { resolve = complete })
  return { promise, resolve }
}

test('search follows applied object edits through Undo and Redo without adding history @pure', async () => {
  const harness = createSearchHarness()
  try {
    const system = harness.workspace.value.cluster.systems[0]
    const object = system?.objects[0]
    if (!system || !object) throw new Error('The local workspace did not create its first system object.')
    const originalName = object.name
    const originalKey = object.locationKey
    harness.store.setSelection({ activeView: 'system', selectedSystemId: system.id })
    const search = harness.workflows.search
    search.query.value = 'VEIL-09'
    expect(search.results.value.some(result => result.target.kind === 'object')).toBe(false)

    const applied = await harness.history.execute({
      action: { kind: 'rename', label: 'Rename object for search', target: { kind: 'object', id: object.id, systemId: system.id } },
      prepare: current => updateWorkspaceObject(current, system.id, object.id, {
        name: 'New Marker Object',
        locationKey: 'VEIL-09',
      }),
    })
    expect(applied.status).toBe('applied')
    expect(search.results.value.find(result => result.target.kind === 'object')?.name).toBe('New Marker Object')

    await harness.history.undo()
    expect(search.results.value.some(result => result.target.kind === 'object')).toBe(false)
    search.query.value = originalKey
    expect(search.results.value.find(result => result.target.kind === 'object')?.name).toBe(originalName)

    await harness.history.redo()
    search.query.value = 'veil-09'
    expect(search.results.value.find(result => result.target.kind === 'object')?.locationKey).toBe('VEIL-09')
    expect(harness.history.getStatus().totalActions).toBe(1)
  } finally {
    harness.dispose()
  }
})

test('Search prunes removed Field choices and reports the Search-only criteria update @pure', () => {
  const harness = createSearchHarness()
  try {
    const search = harness.workflows.search
    search.setFieldConditions([{
      fieldId: nativePlayerFieldIds.atmosphere,
      type: 'single-select',
      operator: 'is',
      values: ['Breathable'],
    }])
    expect(search.fieldConditions.value).toEqual([{
      fieldId: nativePlayerFieldIds.atmosphere,
      type: 'single-select',
      operator: 'is',
      values: ['Breathable'],
    }])

    harness.workspace.value = updateNativeFieldOptions(harness.workspace.value, 'atmosphere', ['Not breathable'], true)

    expect(search.fieldConditions.value).toEqual([])
    expect(search.invalidationNotice.value).toBe('Search filters updated because a Field or choice is no longer available.')
    expect(harness.store.selectedMapFieldConditions).toEqual([])
  } finally {
    harness.dispose()
  }
})



test('a refused cross-system reveal preserves the destination map visit @pure', async () => {
  const harness = createSearchHarness('Reach', 'Vesper', Promise.resolve(), 'Altair')
  const ready = deferred<boolean>()
  let readyWaits = 0
  try {
    const sourceSystem = harness.workspace.value.cluster.systems.find(system => system.name === 'Vesper')
    const targetSystem = harness.workspace.value.cluster.systems.find(system => system.name === 'Altair')
    const sourceObject = sourceSystem?.objects[0]
    if (!sourceSystem || !targetSystem || !sourceObject) throw new Error('The search fixture did not create both systems.')
    const targetObject = { ...sourceObject, id: 'cross-system-visit-target', name: 'Hidden Away', locationKey: 'AWAY-01' }
    const rememberedObject = { ...sourceObject, id: 'remembered-visit-selection', name: 'Remembered World', locationKey: 'AWAY-02' }
    targetSystem.objects.push(targetObject, rememberedObject)

    const destinationKey = `system:${harness.workspace.value.cluster.id}:${targetSystem.id}`
    const rememberedVisit = {
      viewport: { x: 35, y: -12, k: 1.4 },
      selection: { kind: 'object' as const, id: rememberedObject.id },
    }
    harness.store.rememberVisit(destinationKey, rememberedVisit)
    harness.store.setSelection({ activeView: 'cluster', selectedSystemId: sourceSystem.id })
    harness.workflows.placement.clusterSystem.armSystemAdd()
    expect(harness.workflows.placement.clusterSystem.clusterAddType.value).toBe('system')

    const sourceMap = createMapHandle({ whenReady: async () => true, frameSearchTarget: () => true, focusMap: () => undefined })
    sourceMap.getViewport = () => ({ x: 8, y: 11, k: 0.8 })
    harness.workflows.mapControls.clusterMapRef.value = sourceMap
    const destinationMap = createSystemMapHandle({
      whenReady: () => {
        readyWaits += 1
        return ready.promise
      },
      frameSearchTarget: () => true,
      focusMap: () => undefined,
    })
    destinationMap.getViewport = () => ({ x: 0, y: 0, k: 1 })
    harness.workflows.mapControls.systemMapRef.value = destinationMap

    const search = harness.workflows.search
    search.open.value = true
    search.query.value = targetObject.locationKey
    const target = {
      workspaceId: harness.workspace.value.id,
      clusterId: harness.workspace.value.cluster.id,
      kind: 'object' as const,
      systemId: targetSystem.id,
      objectId: targetObject.id,
    }

    const reveal = search.reveal(target)
    await expect.poll(() => readyWaits).toBe(1)
    expect(harness.workflows.placement.clusterSystem.clusterAddType.value).toBe('system')
    harness.workflows.mapControls.recordViewport(destinationKey, { x: 91, y: 42, k: 1.8 })
    ready.resolve(false)

    expect(await reveal).toEqual({ status: 'rejected', reason: 'unavailable' })
    expect(harness.store.visits[destinationKey]).toEqual(rememberedVisit)
    expect(harness.store.activeView).toBe('cluster')
    expect(harness.store.selectedSystemId).toBe(sourceSystem.id)
    expect(harness.workflows.placement.clusterSystem.clusterAddType.value).toBe('system')
    expect(search.open.value).toBe(true)
    expect(search.query.value).toBe(targetObject.locationKey)
  } finally {
    ready.resolve(false)
    harness.dispose()
  }
})

test('an unsettled search presentation restores the source context without framing @pure', async () => {
  const harness = createSearchHarness('Reach', 'Vesper', Promise.resolve(), 'Altair', async () => 'unavailable')
  let frameCount = 0
  try {
    const sourceSystem = harness.workspace.value.cluster.systems.find(system => system.name === 'Vesper')
    const targetSystem = harness.workspace.value.cluster.systems.find(system => system.name === 'Altair')
    const sourceObject = sourceSystem?.objects[0]
    if (!sourceSystem || !targetSystem || !sourceObject) throw new Error('The search fixture did not create both systems.')
    const targetObject = { ...sourceObject, id: 'unsettled-search-target', name: 'Hidden Away', locationKey: 'AWAY-03' }
    targetSystem.objects.push(targetObject)
    harness.store.setSelection({ activeView: 'cluster', selectedSystemId: sourceSystem.id })
    harness.workflows.placement.clusterSystem.armSystemAdd()
    harness.workflows.mapControls.systemMapRef.value = createSystemMapHandle({
      whenReady: async () => true,
      frameSearchTarget: () => {
        frameCount += 1
        return true
      },
      focusMap: () => undefined,
    })

    const search = harness.workflows.search
    search.open.value = true
    search.query.value = targetObject.locationKey
    const target = {
      workspaceId: harness.workspace.value.id,
      clusterId: harness.workspace.value.cluster.id,
      kind: 'object' as const,
      systemId: targetSystem.id,
      objectId: targetObject.id,
    }

    expect(await search.reveal(target)).toEqual({ status: 'rejected', reason: 'unavailable' })
    expect(harness.store.activeView).toBe('cluster')
    expect(harness.store.selectedSystemId).toBe(sourceSystem.id)
    expect(harness.workflows.placement.clusterSystem.clusterAddType.value).toBe('system')
    expect(search.open.value).toBe(true)
    expect(search.query.value).toBe(targetObject.locationKey)
    expect(frameCount).toBe(0)
  } finally {
    harness.dispose()
  }
})

test('accepted search cleanup does not end a newer destination Add session @pure', async () => {
  const harness = createSearchHarness('Reach', 'Vesper', Promise.resolve(), 'Altair')
  const ready = deferred<boolean>()
  let readyWaits = 0
  try {
    const sourceSystem = harness.workspace.value.cluster.systems.find(system => system.name === 'Vesper')
    const targetSystem = harness.workspace.value.cluster.systems.find(system => system.name === 'Altair')
    const sourceObject = sourceSystem?.objects[0]
    if (!sourceSystem || !targetSystem || !sourceObject) throw new Error('The search fixture did not create both systems.')
    const targetObject = { ...sourceObject, id: 'new-add-search-target', name: 'Hidden Away', locationKey: 'AWAY-04' }
    targetSystem.objects.push(targetObject)
    harness.store.setSelection({ activeView: 'system', selectedSystemId: sourceSystem.id })
    expect(await harness.workflows.placement.creation.chooseCreationType({ kind: 'orbit' })).toBe(true)
    const sourceAddId = harness.workflows.placement.creation.creationSession.value?.id
    if (sourceAddId === undefined) throw new Error('The source Add session was not created.')
    harness.workflows.mapControls.systemMapRef.value = createSystemMapHandle({
      whenReady: () => {
        readyWaits += 1
        return ready.promise
      },
      frameSearchTarget: () => true,
      focusMap: () => undefined,
    })

    const search = harness.workflows.search
    search.open.value = true
    search.query.value = targetObject.locationKey
    const target = {
      workspaceId: harness.workspace.value.id,
      clusterId: harness.workspace.value.cluster.id,
      kind: 'object' as const,
      systemId: targetSystem.id,
      objectId: targetObject.id,
    }

    const reveal = search.reveal(target)
    await expect.poll(() => readyWaits).toBe(1)
    expect(harness.store.selectedSystemId).toBe(targetSystem.id)
    expect(await harness.workflows.placement.creation.chooseCreationType({ kind: 'object', subtype: 'planet' })).toBe(true)
    const destinationAdd = harness.workflows.placement.creation.creationSession.value
    if (!destinationAdd || destinationAdd.id === sourceAddId) throw new Error('The destination Add intent did not replace the source session.')
    ready.resolve(true)

    expect(await reveal).toEqual({ status: 'revealed' })
    expect(harness.workflows.placement.creation.creationSession.value?.id).toBe(destinationAdd.id)
    expect(harness.workflows.placement.creation.creationSession.value?.systemId).toBe(targetSystem.id)
  } finally {
    ready.resolve(false)
    harness.dispose()
  }
})

test('an accepted source-draft Apply survives deletion of the later search target @pure', async () => {
  const harness = createSearchHarness('Reach', 'Vesper', Promise.resolve(), 'Altair')
  const ready = deferred<boolean>()
  let readyWaits = 0
  let frameCount = 0
  try {
    const sourceSystem = harness.workspace.value.cluster.systems.find(system => system.name === 'Vesper')
    const targetSystem = harness.workspace.value.cluster.systems.find(system => system.name === 'Altair')
    const sourceObject = sourceSystem?.objects[0]
    if (!sourceSystem || !targetSystem || !sourceObject) throw new Error('The search fixture did not create both systems.')
    const targetObject = {
      ...sourceObject,
      id: 'apply-before-cross-system-delete',
      name: 'Later Target',
      locationKey: 'AWAY-05',
      placement: { kind: 'system' as const, x: 0.34, y: 0.61 },
    }
    targetSystem.objects.push(targetObject)
    harness.store.setSelection({ activeView: 'system', selectedSystemId: sourceSystem.id, selectedObjectId: sourceObject.id })
    await harness.workflows.inspector.beginObjectEdit()
    const session = harness.workflows.inspector.entitySession.value
    if (!session || session.kind !== 'object') throw new Error('The source object draft was not created.')
    session.draft.name = 'Vesper Applied'
    harness.workflows.mapControls.systemMapRef.value = createSystemMapHandle({
      whenReady: () => {
        readyWaits += 1
        return ready.promise
      },
      frameSearchTarget: () => {
        frameCount += 1
        return true
      },
      focusMap: () => undefined,
    })

    const search = harness.workflows.search
    search.open.value = true
    search.query.value = targetObject.locationKey
    const target = {
      workspaceId: harness.workspace.value.id,
      clusterId: harness.workspace.value.cluster.id,
      kind: 'object' as const,
      systemId: targetSystem.id,
      objectId: targetObject.id,
    }

    const reveal = search.reveal(target)
    await expect.poll(() => harness.workflows.charts.transitionGuard.value).toBe('inspector')
    await harness.workflows.charts.resolveTransitionChoice('apply')
    await expect.poll(() => readyWaits).toBe(1)
    expect(harness.workflows.inspector.entitySession.value).toBeNull()

    const deleted = await harness.history.execute({
      action: { kind: 'delete', label: 'Delete Later Target', target: { kind: 'object', id: targetObject.id, systemId: targetSystem.id } },
      prepare: current => planMapEntityDeletion(current, {
        kind: 'object',
        systemId: targetSystem.id,
        objectId: targetObject.id,
      }).workspace,
    })
    expect(deleted.status).toBe('applied')
    ready.resolve(true)

    expect(await reveal).toEqual({ status: 'rejected', reason: 'unavailable' })
    expect(harness.workspace.value.cluster.systems.find(system => system.id === sourceSystem.id)?.objects
      .find(object => object.id === sourceObject.id)?.name).toBe('Vesper Applied')
    expect(harness.workflows.inspector.entitySession.value).toBeNull()
    expect(harness.store.activeView).toBe('system')
    expect(harness.store.selectedSystemId).toBe(sourceSystem.id)
    expect(harness.store.selectedObjectId).toBe(sourceObject.id)
    expect(search.open.value).toBe(true)
    expect(search.query.value).toBe(targetObject.locationKey)
    expect(harness.history.getStatus().totalActions).toBe(2)
    expect(frameCount).toBe(0)
  } finally {
    ready.resolve(false)
    harness.dispose()
  }
})



test('compact object reveal hides the Inspector while preserving its matching dirty session @pure', async () => {
  const harness = createSearchHarness('Reach', 'Vesper', Promise.resolve(), undefined, undefined, true)
  try {
    const system = harness.workspace.value.cluster.systems[0]
    const object = system?.objects[0]
    if (!system || !object) throw new Error('The local workspace did not create its first system object.')
    harness.store.setSelection({ activeView: 'system', selectedSystemId: system.id, selectedObjectId: object.id })
    harness.store.setCompactPanel('inspector')
    await harness.workflows.inspector.beginObjectEdit()
    const session = harness.workflows.inspector.entitySession.value
    if (!session || session.kind !== 'object') throw new Error('The selected object edit session did not start.')
    session.draft.name = 'Whispering World draft'
    const presentation: string[] = []
    harness.workflows.mapControls.systemMapRef.value = createSystemMapHandle({
      whenReady: async () => true,
      frameSearchTarget: () => { presentation.push('frame'); return true },
      focusMap: () => { presentation.push('focus') },
      prepareSearchLocator: objectId => () => { presentation.push(objectId) },
    })
    const search = harness.workflows.search
    search.open.value = true
    search.query.value = object.locationKey
    const objectResult = search.results.value.find(result => result.target.kind === 'object')
    if (!objectResult) throw new Error('The selected object did not produce a search result.')

    expect(await search.reveal(objectResult.target)).toEqual({ status: 'revealed' })
    expect(presentation).toEqual(['frame', 'focus', object.id])
    search.open.value = true
    expect(await search.reveal(objectResult.target)).toEqual({ status: 'revealed' })
    expect(presentation).toEqual(['frame', 'focus', object.id, 'frame', 'focus', object.id])
    expect(harness.store.inspectorPanelOpen).toBe(true)
    expect(harness.store.compactPanel).toBeNull()
    expect(harness.workflows.inspector.entitySession.value?.id).toBe(session.id)
    expect(harness.workflows.inspector.hasModifiedEntitySession.value).toBe(true)
    expect(harness.workflows.inspector.entitySession.value?.kind === 'object'
      ? harness.workflows.inspector.entitySession.value.draft.name
      : null).toBe('Whispering World draft')
  } finally {
    harness.dispose()
  }
})



test('invalid object-draft Apply cannot partly select a different search result @pure', async () => {
  const harness = createSearchHarness()
  try {
    const system = harness.workspace.value.cluster.systems[0]
    const selectedObject = system?.objects[0]
    if (!system || !selectedObject) throw new Error('The local workspace did not create its first system object.')
    const targetObject = { ...selectedObject, id: 'invalid-apply-target', name: 'Distant World', locationKey: 'VEIL-05' }
    system.objects.push(targetObject)
    harness.store.setSelection({ activeView: 'system', selectedSystemId: system.id, selectedObjectId: selectedObject.id })
    await harness.workflows.inspector.beginObjectEdit()
    const session = harness.workflows.inspector.entitySession.value
    if (!session || session.kind !== 'object') throw new Error('The selected object edit session did not start.')
    session.draft.name = '   '
    const search = harness.workflows.search
    search.open.value = true
    search.query.value = 'VEIL-05'
    const objectResult = search.results.value.find(result => result.target.kind === 'object')
    if (!objectResult || objectResult.target.kind !== 'object' || objectResult.target.objectId !== targetObject.id) {
      throw new Error('The other object did not produce the captured result.')
    }
    const locatedObjects: string[] = []
    harness.workflows.mapControls.systemMapRef.value = createSystemMapHandle({
      whenReady: async () => true,
      frameSearchTarget: () => true,
      focusMap: () => undefined,
      prepareSearchLocator: objectId => () => { locatedObjects.push(objectId) },
    })

    const reveal = search.reveal(objectResult.target)
    await expect.poll(() => harness.workflows.charts.transitionGuard.value).toBe('inspector')
    await harness.workflows.charts.resolveTransitionChoice('apply')

    expect(await reveal).toEqual({ status: 'rejected', reason: 'guard' })
    expect(locatedObjects).toEqual([])
    expect(session.errors.name).toBe('Object name is required.')
    expect(harness.store.activeView).toBe('system')
    expect(harness.store.selectedSystemId).toBe(system.id)
    expect(harness.store.selectedObjectId).toBe(selectedObject.id)
    expect(harness.workflows.inspector.entitySession.value?.id).toBe(session.id)
    expect(harness.workflows.inspector.hasModifiedEntitySession.value).toBe(true)
    expect(search.open.value).toBe(true)
    expect(search.query.value).toBe('VEIL-05')
  } finally {
    harness.dispose()
  }
})



test('a hidden modified Orbit draft still guards an object result in compact view @pure', async () => {
  const harness = createSearchHarness('Reach', 'Vesper', Promise.resolve(), undefined, undefined, true)
  try {
    const system = harness.workspace.value.cluster.systems[0]
    const object = system?.objects[0]
    if (!system || !object) throw new Error('The local workspace did not create its first system object.')
    const orbit = createOrbit(system, object.id)
    system.orbits.push(orbit)
    harness.workspace.value.layout.orbitRadii[orbit.id] = { horizontal: 180, vertical: 110 }
    harness.store.setSelection({ activeView: 'system', selectedSystemId: system.id, selectedOrbitId: orbit.id })
    harness.store.setCompactPanel('inspector')
    await harness.workflows.inspector.beginOrbitEdit()
    const session = harness.workflows.inspector.entitySession.value
    if (!session || session.kind !== 'orbit') throw new Error('The selected Orbit edit session did not start.')
    session.draft.horizontalRadius = '244'
    harness.store.setCompactPanel(null)
    const search = harness.workflows.search
    search.open.value = true
    search.query.value = object.locationKey
    const objectResult = search.results.value.find(result => result.target.kind === 'object')
    if (!objectResult || objectResult.target.kind !== 'object' || objectResult.target.objectId !== object.id) {
      throw new Error('The hosted object did not produce the captured result.')
    }

    const reveal = search.reveal(objectResult.target)
    await expect.poll(() => harness.workflows.charts.transitionGuard.value).toBe('inspector')
    await harness.workflows.charts.resolveTransitionChoice('stay')

    expect(await reveal).toEqual({ status: 'rejected', reason: 'guard' })
    expect(harness.store.activeView).toBe('system')
    expect(harness.store.selectedSystemId).toBe(system.id)
    expect(harness.store.selectedObjectId).toBeNull()
    expect(harness.store.selectedOrbitId).toBe(orbit.id)
    expect(harness.store.compactPanel).toBeNull()
    expect(harness.workflows.inspector.entitySession.value?.id).toBe(session.id)
    expect(harness.workflows.inspector.hasModifiedEntitySession.value).toBe(true)
    expect(harness.workflows.inspector.entitySession.value?.kind === 'orbit'
      ? harness.workflows.inspector.entitySession.value.draft.horizontalRadius
      : null).toBe('244')
    expect(search.open.value).toBe(true)
    expect(search.query.value).toBe(object.locationKey)
  } finally {
    harness.dispose()
  }
})

test('removing a captured object while its map is ready restores only the still-owned starting selection @pure', async () => {
  const harness = createSearchHarness()
  const ready = deferred<boolean>()
  let readyWaits = 0
  let frameCount = 0
  let focusCount = 0
  try {
    const system = harness.workspace.value.cluster.systems[0]
    const startingObject = system?.objects[0]
    if (!system || !startingObject) throw new Error('The local workspace did not create its first system object.')
    const targetObject = { ...startingObject, id: 'search-removal-target', name: 'Fading World', locationKey: 'VEIL-06' }
    system.objects.push(targetObject)
    harness.store.setSelection({ activeView: 'system', selectedSystemId: system.id, selectedObjectId: startingObject.id })
    harness.store.setMode('move')
    harness.workflows.mapControls.systemMapRef.value = createSystemMapHandle({
      whenReady: () => {
        readyWaits += 1
        return ready.promise
      },
      frameSearchTarget: () => {
        frameCount += 1
        return true
      },
      focusMap: () => { focusCount += 1 },
    })
    const search = harness.workflows.search
    search.open.value = true
    search.query.value = 'VEIL-06'
    const objectResult = search.results.value.find(result => result.target.kind === 'object')
    if (!objectResult || objectResult.target.kind !== 'object' || objectResult.target.objectId !== targetObject.id) {
      throw new Error('The target object did not produce the captured result.')
    }

    const reveal = search.reveal(objectResult.target)
    await expect.poll(() => readyWaits).toBe(1)
    expect(harness.store.selectedObjectId).toBe(targetObject.id)
    const deletion = await harness.history.execute({
      action: { kind: 'delete', label: 'Delete Fading World', target: { kind: 'object', id: targetObject.id, systemId: system.id } },
      prepare: current => planMapEntityDeletion(current, { kind: 'object', systemId: system.id, objectId: targetObject.id }).workspace,
    })
    expect(deletion.status).toBe('applied')
    expect(harness.store.selectedObjectId).toBeNull()
    ready.resolve(true)

    expect(await reveal).toEqual({ status: 'rejected', reason: 'unavailable' })
    expect(harness.store.activeView).toBe('system')
    expect(harness.store.selectedSystemId).toBe(system.id)
    expect(harness.store.selectedObjectId).toBe(startingObject.id)
    expect(harness.store.mapMode).toBe('move')
    expect(search.open.value).toBe(true)
    expect(search.query.value).toBe('VEIL-06')
    expect(search.results.value.some(result => result.target.kind === 'object')).toBe(false)
    expect(frameCount).toBe(0)
    expect(focusCount).toBe(0)
  } finally {
    ready.resolve(false)
    harness.dispose()
  }
})

test('reopening Search invalidates deletion rollback during object-map readiness @pure', async () => {
  const harness = createSearchHarness()
  const ready = deferred<boolean>()
  let readyWaits = 0
  let frameCount = 0
  let focusCount = 0
  try {
    const system = harness.workspace.value.cluster.systems[0]
    const startingObject = system?.objects[0]
    if (!system || !startingObject) throw new Error('The local workspace did not create its first system object.')
    const targetObject = { ...startingObject, id: 'search-aba-target', name: 'Fading Echo', locationKey: 'VEIL-07' }
    system.objects.push(targetObject)
    harness.store.setSelection({ activeView: 'system', selectedSystemId: system.id, selectedObjectId: startingObject.id })
    harness.store.setMode('move')
    harness.workflows.mapControls.systemMapRef.value = createSystemMapHandle({
      whenReady: () => {
        readyWaits += 1
        return ready.promise
      },
      frameSearchTarget: () => {
        frameCount += 1
        return true
      },
      focusMap: () => { focusCount += 1 },
    })
    const search = harness.workflows.search
    search.open.value = true
    search.query.value = 'VEIL-07'
    const objectResult = search.results.value.find(result => result.target.kind === 'object')
    if (!objectResult || objectResult.target.kind !== 'object' || objectResult.target.objectId !== targetObject.id) {
      throw new Error('The target object did not produce the captured result.')
    }

    const reveal = search.reveal(objectResult.target)
    await expect.poll(() => readyWaits).toBe(1)
    search.open.value = true
    search.open.value = false
    const deletion = await harness.history.execute({
      action: { kind: 'delete', label: 'Delete Fading Echo', target: { kind: 'object', id: targetObject.id, systemId: system.id } },
      prepare: current => planMapEntityDeletion(current, { kind: 'object', systemId: system.id, objectId: targetObject.id }).workspace,
    })
    expect(deletion.status).toBe('applied')
    expect(harness.store.selectedObjectId).toBeNull()
    ready.resolve(true)

    expect(await reveal).toEqual({ status: 'rejected', reason: 'stale' })
    expect(harness.store.activeView).toBe('system')
    expect(harness.store.selectedSystemId).toBe(system.id)
    expect(harness.store.selectedObjectId).toBeNull()
    expect(harness.store.mapMode).toBe('select')
    expect(search.open.value).toBe(false)
    expect(search.query.value).toBe('VEIL-07')
    expect(frameCount).toBe(0)
    expect(focusCount).toBe(0)
  } finally {
    ready.resolve(false)
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



test('a hidden modified chart-name draft guards an object result and Stay leaves the system untouched @pure', async () => {
  const harness = createSearchHarness()
  try {
    const system = harness.workspace.value.cluster.systems[0]
    const selectedObject = system?.objects[0]
    if (!system || !selectedObject) throw new Error('The local workspace did not create its first system object.')
    const targetObject = { ...selectedObject, id: 'chart-stay-target', name: 'Destination World', locationKey: 'VEIL-11' }
    system.objects.push(targetObject)
    harness.store.setSelection({ activeView: 'system', selectedSystemId: system.id, selectedObjectId: selectedObject.id })
    harness.store.setMode('move')
    await harness.workflows.charts.beginNamesEdit()
    harness.workflows.charts.systemName.value = 'Vesper Prime'
    harness.workflows.charts.setDialogOpen(false)
    harness.workflows.mapControls.systemMapRef.value = createSystemMapHandle({
      whenReady: async () => true,
      frameSearchTarget: () => true,
      focusMap: () => undefined,
    })
    const search = harness.workflows.search
    search.open.value = true
    search.query.value = 'VEIL-11'
    const objectResult = search.results.value.find(result => result.target.kind === 'object')
    if (!objectResult || objectResult.target.kind !== 'object' || objectResult.target.objectId !== targetObject.id) {
      throw new Error('The destination object did not produce the captured result.')
    }

    const reveal = search.reveal(objectResult.target)
    await expect.poll(() => harness.workflows.charts.transitionGuard.value).toBe('chart')
    const observedGuard = harness.workflows.charts.transitionGuard.value
    await harness.workflows.charts.resolveTransitionChoice('stay')
    const outcome = await reveal

    expect(observedGuard).toBe('chart')
    expect(outcome).toEqual({ status: 'rejected', reason: 'guard' })
    expect(harness.store.activeView).toBe('system')
    expect(harness.store.selectedSystemId).toBe(system.id)
    expect(harness.store.selectedObjectId).toBe(selectedObject.id)
    expect(harness.store.mapMode).toBe('move')
    expect(harness.workflows.charts.hasChartNameDraft.value).toBe(true)
    expect(harness.workflows.charts.hasUncommittedNames.value).toBe(true)
    expect(harness.workflows.charts.systemName.value).toBe('Vesper Prime')
    expect(harness.workflows.charts.dialogOpen.value).toBe(true)
    expect(search.open.value).toBe(true)
    expect(search.query.value).toBe('VEIL-11')
  } finally {
    harness.dispose()
  }
})

test('invalid Apply on a hidden chart-name draft cannot partly select an object result @pure', async () => {
  const harness = createSearchHarness()
  try {
    const system = harness.workspace.value.cluster.systems[0]
    const selectedObject = system?.objects[0]
    if (!system || !selectedObject) throw new Error('The local workspace did not create its first system object.')
    const targetObject = { ...selectedObject, id: 'chart-apply-target', name: 'Destination World', locationKey: 'VEIL-12' }
    system.objects.push(targetObject)
    harness.store.setSelection({ activeView: 'system', selectedSystemId: system.id, selectedObjectId: selectedObject.id })
    harness.store.setMode('move')
    await harness.workflows.charts.beginNamesEdit()
    harness.workflows.charts.systemName.value = '   '
    harness.workflows.charts.setDialogOpen(false)
    harness.workflows.mapControls.systemMapRef.value = createSystemMapHandle({
      whenReady: async () => true,
      frameSearchTarget: () => true,
      focusMap: () => undefined,
    })
    const search = harness.workflows.search
    search.open.value = true
    search.query.value = 'VEIL-12'
    const objectResult = search.results.value.find(result => result.target.kind === 'object')
    if (!objectResult || objectResult.target.kind !== 'object' || objectResult.target.objectId !== targetObject.id) {
      throw new Error('The destination object did not produce the captured result.')
    }

    const reveal = search.reveal(objectResult.target)
    await expect.poll(() => harness.workflows.charts.transitionGuard.value).toBe('chart')
    await harness.workflows.charts.resolveTransitionChoice('apply')

    expect(await reveal).toEqual({ status: 'rejected', reason: 'guard' })
    expect(harness.workflows.charts.hasChartNameDraft.value).toBe(true)
    expect(harness.workflows.charts.hasUncommittedNames.value).toBe(true)
    expect(harness.workflows.charts.formError.value).not.toBe('')
    expect(harness.workspace.value.cluster.systems[0]?.name).toBe(system.name)
    expect(harness.store.activeView).toBe('system')
    expect(harness.store.selectedSystemId).toBe(system.id)
    expect(harness.store.selectedObjectId).toBe(selectedObject.id)
    expect(harness.store.mapMode).toBe('move')
    expect(search.open.value).toBe(true)
    expect(search.query.value).toBe('VEIL-12')
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



test('reopening search while overlay teardown is pending prevents stale framing, focus and locator @pure', async () => {
  const presentation = deferred<void>()
  let presentationWaits = 0
  let presentationAborted = false
  let frameCount = 0
  let focusCount = 0
  const locatedObjects: string[] = []
  const harness = createSearchHarness(
    'Kestrel Reach',
    'Vesper',
    Promise.resolve(),
    undefined,
    (signal) => {
      presentationWaits += 1
      return new Promise<SearchPresentationSettlement>((resolve) => {
        signal.addEventListener('abort', () => {
          presentationAborted = true
          resolve('cancelled')
        }, { once: true })
        void presentation.promise.then(() => resolve('settled'))
      })
    },
  )
  try {
    const system = harness.workspace.value.cluster.systems[0]
    const object = system?.objects[0]
    if (!system || !object) throw new Error('The local workspace did not create its first system object.')
    harness.store.setSelection({ activeView: 'cluster' })
    harness.workflows.mapControls.systemMapRef.value = createSystemMapHandle({
      whenReady: async () => true,
      frameSearchTarget: () => {
        frameCount += 1
        return true
      },
      focusMap: () => { focusCount += 1 },
      prepareSearchLocator: objectId => () => { locatedObjects.push(objectId) },
    })
    const search = harness.workflows.search
    search.open.value = true
    search.query.value = object.locationKey
    const result = search.results.value.find(candidate => candidate.target.kind === 'object')
    if (!result) throw new Error('The applied object was not searchable.')

    const reveal = search.reveal(result.target)
    await expect.poll(() => harness.store.activeView).toBe('system')
    await expect.poll(() => search.open.value).toBe(false)
    await expect.poll(() => presentationWaits).toBe(1)
    search.open.value = true
    presentation.resolve()

    expect(await reveal).toEqual({ status: 'rejected', reason: 'stale' })
    expect(search.open.value).toBe(true)
    expect(search.query.value).toBe(object.locationKey)
    expect(presentationAborted).toBe(true)
    expect(frameCount).toBe(0)
    expect(focusCount).toBe(0)
    expect(locatedObjects).toEqual([])
  } finally {
    presentation.resolve()
    harness.dispose()
  }
})
