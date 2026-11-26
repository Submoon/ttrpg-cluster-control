import { createWorkspaceWithPrimaryStar } from './support/primary-star-fixture'
import { expect, test } from '@playwright/test'
import { createPinia, setActivePinia } from 'pinia'
import { createRenderer, nextTick, ref } from 'vue'
import { applySystemObjectTransfer, createOrbit, nativePlayerFieldIds, planMapEntityDeletion, updateNativeFieldOptions, updateWorkspaceObject } from '../domain/workspace'
import type { MapNavigationHandle, SaveState, SearchPresentationSettlement, SystemMapHandle } from '../composables/editor-workflows/types'
import { useEditorWorkflows } from '../composables/useEditorWorkflows'
import { createWorkspaceHistoryCoordinator } from '../composables/editor-workflows/workspace-mutations'
import { useEditorUiStore } from '../stores/editor-ui'
import { createWorkspaceSnapshot } from '../utils/workspace-storage'
import { mapModeForShortcut } from '../composables/useMapToolShortcuts'

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
  continuousMap = false,
) {
  const restoreBrowserBoundary = installBrowserLifecycleBoundary(compact)
  setActivePinia(createPinia())
  const initialWorkspace = createWorkspaceWithPrimaryStar(clusterName, systemName)
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
  const searchFilterInvalidations: number[] = []
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
        continuousMap: ref(continuousMap),
        onSearchFiltersInvalidated: () => { searchFilterInvalidations.push(searchFilterInvalidations.length + 1) },
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
    searchFilterInvalidations,
    dispose() {
      if (disposed) return
      disposed = true
      app.unmount()
      history.dispose()
      restoreBrowserBoundary()
    },
  }
}

test('continuous map inspection selects an object without changing its cluster map owner @pure', async () => {
  const harness = createSearchHarness('Kestrel Reach', 'Vesper', Promise.resolve(), undefined, undefined, false, true)
  try {
    const system = harness.workspace.value.cluster.systems[0]
    const object = system?.objects[0]
    if (!system || !object) throw new Error('The local workspace did not create its first system object.')
    harness.store.setSelection({ activeView: 'cluster' })
    expect(harness.workflows.navigation.continuousMapEnabled.value).toBe(true)
    const mapKey = harness.workflows.mapControls.activeMapKey.value
    expect(await harness.workflows.mapControls.setMapMode('navigate')).toBe(false)
    expect(harness.store.mapMode).toBe('select')

    expect(await harness.workflows.navigation.inspectContinuousTarget({ kind: 'object', systemId: system.id, objectId: object.id })).toBe(true)

    expect(harness.store.activeView).toBe('cluster')
    expect(harness.workflows.mapControls.activeMapKey.value).toBe(mapKey)
    expect(harness.workflows.mapControls.systemMapRef.value).toBeNull()
    expect(harness.store.inspectedTarget).toEqual({ kind: 'object', systemId: system.id, objectId: object.id })
  } finally {
    harness.dispose()
  }
})

test('continuous object group membership crosses systems while Inspector focus and draft stay owned @pure', async () => {
  const harness = createSearchHarness('Kestrel Reach', 'Vesper', Promise.resolve(), 'Altair', undefined, false, true)
  try {
    const [sourceSystem, remoteSystem] = harness.workspace.value.cluster.systems
    const sourceObject = sourceSystem?.objects[0]
    if (!sourceSystem || !remoteSystem || !sourceObject) throw new Error('Expected two systems and a source object.')
    const sourceMember = { ...sourceObject, id: 'group-source-member', name: 'Source member' }
    const remoteMember = { ...sourceObject, id: 'group-remote-member', name: 'Remote member' }
    sourceSystem.objects = [sourceMember]
    remoteSystem.objects = [remoteMember]
    harness.store.setSelection({ activeView: 'cluster' })
    const sourceTarget = { kind: 'object' as const, systemId: sourceSystem.id, objectId: sourceMember.id }
    expect(await harness.workflows.navigation.inspectContinuousTarget(sourceTarget)).toBe(true)
    await harness.workflows.inspector.beginObjectEdit()
    const draft = harness.workflows.inspector.entitySession.value
    if (!draft || draft.kind !== 'object') throw new Error('The focused object draft was not created.')
    draft.draft.name = 'Unapplied group-safe draft'

    await harness.workflows.navigation.toggleObjectSelection(remoteMember.id)
    expect(harness.store.selectedObjectIds).toEqual([sourceMember.id, remoteMember.id])
    expect(harness.store.inspectedTarget).toEqual(sourceTarget)
    expect(harness.workflows.inspector.entitySession.value?.id).toBe(draft.id)
    expect(harness.workflows.inspector.hasModifiedEntitySession.value).toBe(true)

    await harness.workflows.navigation.toggleObjectSelection(sourceMember.id)
    expect(harness.store.selectedObjectIds).toEqual([remoteMember.id])
    expect(harness.store.selectedObjectId).toBe(sourceMember.id)
    expect(harness.store.inspectedTarget).toEqual(sourceTarget)
    expect(harness.workflows.inspector.entitySession.value?.id).toBe(draft.id)

    expect(await harness.workflows.navigation.inspectContinuousTarget(sourceTarget)).toBe(true)
    expect(harness.store.selectedObjectIds).toEqual([sourceMember.id])
    expect(harness.store.inspectedTarget).toEqual(sourceTarget)
    expect(harness.workflows.inspector.entitySession.value?.id).toBe(draft.id)
  } finally {
    harness.dispose()
  }
})

test('continuous toggles keep an explicitly empty selection separate from Inspector focus @pure', async () => {
  const harness = createSearchHarness('Kestrel Reach', 'Vesper', Promise.resolve(), 'Altair', undefined, false, true)
  try {
    const [sourceSystem, remoteSystem] = harness.workspace.value.cluster.systems
    const sourceObject = sourceSystem?.objects[0]
    if (!sourceSystem || !remoteSystem || !sourceObject) throw new Error('Expected two systems and a focused object.')
    const sourceMember = { ...sourceObject, id: 'toggle-focus-member', name: 'Focused member' }
    const remoteMember = { ...sourceObject, id: 'toggle-remote-member', name: 'Remote member' }
    sourceSystem.objects = [sourceMember]
    remoteSystem.objects = [remoteMember]
    harness.store.setSelection({ activeView: 'cluster' })
    const focusedTarget = { kind: 'object' as const, systemId: sourceSystem.id, objectId: sourceMember.id }
    expect(await harness.workflows.navigation.inspectContinuousTarget(focusedTarget)).toBe(true)
    expect(harness.store.selectedObjectIds).toEqual([sourceMember.id])

    await harness.workflows.navigation.toggleObjectSelection(remoteMember.id)
    expect(harness.store.selectedObjectIds).toEqual([sourceMember.id, remoteMember.id])
    await harness.workflows.navigation.toggleObjectSelection(sourceMember.id)
    expect(harness.store.selectedObjectIds).toEqual([remoteMember.id])
    await harness.workflows.navigation.toggleObjectSelection(remoteMember.id)
    expect(harness.store.selectedObjectIds).toEqual([])
    expect(harness.store.selectedObjectId).toBe(sourceMember.id)
    await harness.workflows.navigation.toggleObjectSelection(remoteMember.id)
    expect(harness.store.selectedObjectIds).toEqual([remoteMember.id])

    expect(await harness.workflows.navigation.inspectContinuousTarget(focusedTarget)).toBe(true)
    expect(harness.store.selectedObjectIds).toEqual([sourceMember.id])
    await harness.workflows.navigation.toggleObjectSelection(sourceMember.id)
    expect(harness.store.selectedObjectIds).toEqual([])
    await harness.workflows.navigation.toggleObjectSelection(remoteMember.id)
    expect(harness.store.selectedObjectIds).toEqual([remoteMember.id])
  } finally {
    harness.dispose()
  }
})

test('continuous map removes Navigate from map tool shortcuts @pure', () => {
  expect(mapModeForShortcut('n')).toBeNull()
  expect(mapModeForShortcut('s')).toBe('select')
  expect(mapModeForShortcut('m')).toBe('move')
})

test('only the newer continuous Orbit handoff can select its owner and offer host choices @pure', async () => {
  const harness = createSearchHarness('Kestrel Reach', 'Vesper', Promise.resolve(), 'Altair', undefined, false, true)
  try {
    const [source, destination] = harness.workspace.value.cluster.systems
    const star = source?.objects[0]
    if (!source || !destination || !star) throw new Error('Expected two systems and a primary star.')
    const host = { ...star, id: 'candidate-altair-host' }
    destination.objects.push(host)
    const olderOrbit = createOrbit(destination, null)
    destination.orbits.push(olderOrbit)
    const newerOrbit = createOrbit(destination, null)
    destination.orbits.push(newerOrbit)
    harness.store.setSelection({ activeView: 'cluster' })
    expect(await harness.workflows.navigation.inspectContinuousTarget({ kind: 'system', systemId: source.id })).toBe(true)
    harness.store.setMode('move')
    const candidates = [{
      key: `host:${host.id}`,
      label: `Center on ${host.name}`,
      target: { kind: 'host' as const, objectId: host.id },
      error: null,
    }]

    const selectCandidates = harness.workflows.placement.interactions.handleOrbitCenterCandidates
    const superseded = selectCandidates(olderOrbit.id, candidates, destination.id)
    const current = selectCandidates(newerOrbit.id, candidates, destination.id)
    await Promise.all([superseded, current])

    expect(harness.store.inspectedTarget).toEqual({ kind: 'orbit', systemId: destination.id, orbitId: newerOrbit.id })
    const session = harness.workflows.inspector.entitySession.value
    expect(session).toMatchObject({
      kind: 'orbit',
      targetId: newerOrbit.id,
      centerMoveCandidates: [{ key: candidates[0]!.key, target: candidates[0]!.target, error: null }],
    })
  } finally {
    harness.dispose()
  }
})

test('continuous Search reveals an object through the existing Cluster map handle @pure', async () => {
  const harness = createSearchHarness('Kestrel Reach', 'Vesper', Promise.resolve(), undefined, undefined, false, true)
  try {
    const system = harness.workspace.value.cluster.systems[0]
    const object = system?.objects[0]
    if (!system || !object) throw new Error('The local workspace did not create its first system object.')
    harness.store.setSelection({ activeView: 'cluster' })
    const framedTargets: Parameters<NonNullable<MapNavigationHandle['frameSearchTarget']>>[0][] = []
    harness.workflows.mapControls.clusterMapRef.value = createMapHandle({
      whenReady: async () => true,
      frameSearchTarget: target => { framedTargets.push(target); return true },
      focusMap: () => undefined,
    })
    const search = harness.workflows.search
    search.open.value = true
    search.query.value = object.name
    const result = search.results.value.find(candidate => candidate.target.kind === 'object')
    if (!result || result.target.kind !== 'object') throw new Error('The map object did not produce an object search result.')

    expect(await search.reveal(result.target)).toEqual({ status: 'revealed' })

    expect(harness.store.activeView).toBe('cluster')
    expect(harness.workflows.mapControls.activeMapKey.value).toBe(`cluster:${harness.workspace.value.cluster.id}`)
    expect(harness.workflows.mapControls.systemMapRef.value).toBeNull()
    expect(harness.store.inspectedTarget).toEqual({ kind: 'object', systemId: system.id, objectId: object.id })
    expect(harness.store.selectedObjectIds).toEqual([object.id])
    expect(framedTargets).toEqual([result.target])
    expect(search.open.value).toBe(false)
  } finally {
    harness.dispose()
  }
})

test('continuous Inspector Stay keeps the source target and its modified draft @pure', async () => {
  const harness = createSearchHarness('Kestrel Reach', 'Vesper', Promise.resolve(), undefined, undefined, false, true)
  try {
    const system = harness.workspace.value.cluster.systems[0]
    const sourceObject = system?.objects[0]
    if (!system || !sourceObject) throw new Error('The local workspace did not create its first system object.')
    const destinationObject = { ...sourceObject, id: 'continuous-inspector-destination', name: 'Destination World' }
    system.objects.push(destinationObject)
    harness.store.setSelection({ activeView: 'cluster' })
    expect(await harness.workflows.navigation.inspectContinuousTarget({
      kind: 'object', systemId: system.id, objectId: sourceObject.id,
    })).toBe(true)
    await harness.workflows.inspector.beginObjectEdit()
    const session = harness.workflows.inspector.entitySession.value
    if (!session || session.kind !== 'object') throw new Error('The source object draft was not created.')
    session.draft.name = 'Unapplied source draft'

    const leaveSource = harness.workflows.navigation.inspectContinuousTarget({
      kind: 'object', systemId: system.id, objectId: destinationObject.id,
    })
    await expect.poll(() => harness.workflows.charts.transitionGuard.value).toBe('inspector')
    await harness.workflows.charts.resolveTransitionChoice('stay')

    expect(await leaveSource).toBe(false)
    expect(harness.store.activeView).toBe('cluster')
    expect(harness.store.inspectedTarget).toEqual({ kind: 'object', systemId: system.id, objectId: sourceObject.id })
    expect(harness.workflows.inspector.entitySession.value?.id).toBe(session.id)
    expect(harness.workflows.inspector.hasModifiedEntitySession.value).toBe(true)
    expect(harness.workflows.inspector.entitySession.value?.kind === 'object'
      ? harness.workflows.inspector.entitySession.value.draft.name
      : null).toBe('Unapplied source draft')
  } finally {
    harness.dispose()
  }
})

test('continuous Inspector Apply commits the source draft before selecting the destination @pure', async () => {
  const harness = createSearchHarness('Kestrel Reach', 'Vesper', Promise.resolve(), undefined, undefined, false, true)
  try {
    const system = harness.workspace.value.cluster.systems[0]
    const sourceObject = system?.objects[0]
    if (!system || !sourceObject) throw new Error('The local workspace did not create its first system object.')
    const destinationObject = {
      ...sourceObject,
      id: 'continuous-inspector-apply-destination',
      name: 'Destination World',
      locationKey: 'VEIL-05',
    }
    system.objects.push(destinationObject)
    harness.store.setSelection({ activeView: 'cluster' })
    expect(await harness.workflows.navigation.inspectContinuousTarget({
      kind: 'object', systemId: system.id, objectId: sourceObject.id,
    })).toBe(true)
    await harness.workflows.inspector.beginObjectEdit()
    const session = harness.workflows.inspector.entitySession.value
    if (!session || session.kind !== 'object') throw new Error('The source object draft was not created.')
    session.draft.name = 'Applied source draft'

    const leaveSource = harness.workflows.navigation.inspectContinuousTarget({
      kind: 'object', systemId: system.id, objectId: destinationObject.id,
    })
    await expect.poll(() => harness.workflows.charts.transitionGuard.value).toBe('inspector')
    await harness.workflows.charts.resolveTransitionChoice('apply')

    const accepted = await leaveSource
    expect({
      accepted,
      inspectedTarget: harness.store.inspectedTarget,
      entitySessionId: harness.workflows.inspector.entitySession.value?.id ?? null,
      chartSessionId: harness.workflows.charts.session.value?.id ?? null,
    }).toEqual({
      accepted: true,
      inspectedTarget: { kind: 'object', systemId: system.id, objectId: destinationObject.id },
      entitySessionId: null,
      chartSessionId: null,
    })
    expect(harness.workspace.value.cluster.systems.find(candidate => candidate.id === system.id)?.objects
      .find(object => object.id === sourceObject.id)?.name).toBe('Applied source draft')
    expect(harness.store.inspectedTarget).toEqual({ kind: 'object', systemId: system.id, objectId: destinationObject.id })
    expect(harness.workflows.inspector.entitySession.value).toBeNull()
  } finally {
    harness.dispose()
  }
})

test('continuous Inspector failed Apply keeps its source target and invalid draft @pure', async () => {
  const harness = createSearchHarness('Kestrel Reach', 'Vesper', Promise.resolve(), undefined, undefined, false, true)
  try {
    const system = harness.workspace.value.cluster.systems[0]
    const sourceObject = system?.objects[0]
    if (!system || !sourceObject) throw new Error('The local workspace did not create its first system object.')
    const destinationObject = { ...sourceObject, id: 'continuous-inspector-invalid-apply-destination', name: 'Destination World' }
    system.objects.push(destinationObject)
    harness.store.setSelection({ activeView: 'cluster' })
    const sourceTarget = { kind: 'object' as const, systemId: system.id, objectId: sourceObject.id }
    expect(await harness.workflows.navigation.inspectContinuousTarget(sourceTarget)).toBe(true)
    await harness.workflows.inspector.beginObjectEdit()
    const session = harness.workflows.inspector.entitySession.value
    if (!session || session.kind !== 'object') throw new Error('The source object draft was not created.')
    session.draft.name = '   '

    const leaveSource = harness.workflows.navigation.inspectContinuousTarget({
      kind: 'object', systemId: system.id, objectId: destinationObject.id,
    })
    await expect.poll(() => harness.workflows.charts.transitionGuard.value).toBe('inspector')
    await harness.workflows.charts.resolveTransitionChoice('apply')

    expect(await leaveSource).toBe(false)
    expect(harness.store.activeView).toBe('cluster')
    expect(harness.store.inspectedTarget).toEqual(sourceTarget)
    expect(harness.workflows.inspector.entitySession.value?.id).toBe(session.id)
    expect(harness.workflows.inspector.entitySession.value?.kind === 'object'
      ? harness.workflows.inspector.entitySession.value.errors.name
      : null).toBe('Object name is required.')
    expect(harness.workspace.value.cluster.systems.find(candidate => candidate.id === system.id)?.objects
      .find(object => object.id === sourceObject.id)?.name).toBe(sourceObject.name)
  } finally {
    harness.dispose()
  }
})

test('continuous Inspector Discard selects the destination and leaves source data unchanged @pure', async () => {
  const harness = createSearchHarness('Kestrel Reach', 'Vesper', Promise.resolve(), undefined, undefined, false, true)
  try {
    const system = harness.workspace.value.cluster.systems[0]
    const sourceObject = system?.objects[0]
    if (!system || !sourceObject) throw new Error('The local workspace did not create its first system object.')
    const destinationObject = { ...sourceObject, id: 'continuous-inspector-discard-destination', name: 'Destination World' }
    system.objects.push(destinationObject)
    harness.store.setSelection({ activeView: 'cluster' })
    expect(await harness.workflows.navigation.inspectContinuousTarget({
      kind: 'object', systemId: system.id, objectId: sourceObject.id,
    })).toBe(true)
    await harness.workflows.inspector.beginObjectEdit()
    const session = harness.workflows.inspector.entitySession.value
    if (!session || session.kind !== 'object') throw new Error('The source object draft was not created.')
    session.draft.name = 'Discarded source draft'

    const leaveSource = harness.workflows.navigation.inspectContinuousTarget({
      kind: 'object', systemId: system.id, objectId: destinationObject.id,
    })
    await expect.poll(() => harness.workflows.charts.transitionGuard.value).toBe('inspector')
    await harness.workflows.charts.resolveTransitionChoice('discard')

    expect(await leaveSource).toBe(true)
    expect(harness.store.inspectedTarget).toEqual({ kind: 'object', systemId: system.id, objectId: destinationObject.id })
    expect(harness.workflows.inspector.entitySession.value).toBeNull()
    expect(harness.workspace.value.cluster.systems.find(candidate => candidate.id === system.id)?.objects
      .find(object => object.id === sourceObject.id)?.name).toBe(sourceObject.name)
  } finally {
    harness.dispose()
  }
})

test('continuous route selection and Cluster details keep the Inspector target synchronized @pure', async () => {
  const harness = createSearchHarness('Kestrel Reach', 'Vesper', Promise.resolve(), undefined, undefined, false, true)
  try {
    const system = harness.workspace.value.cluster.systems[0]
    const object = system?.objects[0]
    if (!system || !object) throw new Error('The local workspace did not create its first system object.')
    const route = {
      id: 'continuous-inspected-route',
      jumpLevel: 1,
      fromSystemId: system.id,
      fromPointId: null,
      toSystemId: null,
      toPointId: null,
      unresolvedExit: 'Uncharted Exit',
      playerShared: false,
    }
    harness.workspace.value.cluster.routes.push(route)
    harness.store.setSelection({ activeView: 'cluster' })
    expect(await harness.workflows.navigation.inspectContinuousTarget({
      kind: 'object', systemId: system.id, objectId: object.id,
    })).toBe(true)

    await harness.workflows.navigation.selectRoute(route.id)

    expect(harness.store.activeView).toBe('cluster')
    expect(harness.store.selectedRouteId).toBe(route.id)
    expect(harness.store.inspectedTarget).toEqual({ kind: 'route', routeId: route.id })

    await harness.workflows.navigation.showChartDetails()

    expect(harness.store.selectedRouteId).toBeNull()
    expect(harness.store.inspectedTarget).toEqual({ kind: 'cluster' })
  } finally {
    harness.dispose()
  }
})

test('continuous Cluster details guard a modified system chart across Stay, Discard, and Apply @pure', async () => {
  for (const decision of ['stay', 'discard', 'apply'] as const) {
    const harness = createSearchHarness('Kestrel Reach', 'Vesper', Promise.resolve(), undefined, undefined, false, true)
    try {
      const system = harness.workspace.value.cluster.systems[0]
      if (!system) throw new Error('The local workspace did not create its first system.')
      harness.store.setSelection({ activeView: 'cluster' })
      expect(await harness.workflows.navigation.inspectContinuousTarget({ kind: 'system', systemId: system.id })).toBe(true)
      await harness.workflows.charts.beginNamesEdit()
      const session = harness.workflows.charts.session.value
      if (!session) throw new Error('The system chart-name draft was not created.')
      harness.workflows.charts.systemName.value = `Changed ${decision}`

      const showClusterDetails = harness.workflows.navigation.showChartDetails()
      await expect.poll(() => harness.workflows.charts.transitionGuard.value).toBe('chart')
      await harness.workflows.charts.resolveTransitionChoice(decision)
      await showClusterDetails

      if (decision === 'stay') {
        expect(harness.store.inspectedTarget).toEqual({ kind: 'system', systemId: system.id })
        expect(harness.workflows.charts.session.value?.id).toBe(session.id)
        expect(harness.workflows.charts.hasUncommittedNames.value).toBe(true)
        expect(harness.workspace.value.cluster.systems.find(candidate => candidate.id === system.id)?.name)
          .not.toBe('Changed stay')
      } else {
        expect(harness.store.inspectedTarget).toEqual({ kind: 'cluster' })
        expect(harness.workflows.charts.session.value).toBeNull()
        expect(harness.workspace.value.cluster.systems.find(candidate => candidate.id === system.id)?.name)
          .toBe(decision === 'apply' ? `Changed ${decision}` : 'Vesper')
      }
    } finally {
      harness.dispose()
    }
  }
})

test('continuous Cluster details reuse an already-open Cluster chart session @pure', async () => {
  const harness = createSearchHarness('Kestrel Reach', 'Vesper', Promise.resolve(), undefined, undefined, false, true)
  try {
    const system = harness.workspace.value.cluster.systems[0]
    if (!system) throw new Error('The local workspace did not create its first system.')
    harness.store.setSelection({ activeView: 'cluster', selectedSystemId: system.id, inspectedTarget: { kind: 'cluster' } })
    await harness.workflows.charts.beginNamesEdit()
    const session = harness.workflows.charts.session.value
    if (!session) throw new Error('The Cluster chart-name draft was not created.')
    harness.workflows.charts.systemName.value = 'Retained Cluster chart'

    await harness.workflows.navigation.showChartDetails()

    expect(harness.workflows.charts.transitionGuard.value).toBeNull()
    expect(harness.workflows.charts.session.value?.id).toBe(session.id)
    expect(harness.workflows.charts.systemName.value).toBe('Retained Cluster chart')
    expect(harness.store.inspectedTarget).toEqual({ kind: 'cluster' })
  } finally {
    harness.dispose()
  }
})

test('continuous history keeps route selection or falls back to Cluster in the Inspector @pure', async () => {
  const harness = createSearchHarness('Kestrel Reach', 'Vesper', Promise.resolve(), undefined, undefined, false, true)
  try {
    const system = harness.workspace.value.cluster.systems[0]
    if (!system) throw new Error('The local workspace did not create its first system.')
    const route = {
      id: 'continuous-history-route',
      jumpLevel: 1,
      fromSystemId: system.id,
      fromPointId: null,
      toSystemId: null,
      toPointId: null,
      unresolvedExit: 'Uncharted Exit',
      playerShared: false,
    }
    harness.workspace.value.cluster.routes.push(route)
    harness.store.setSelection({ activeView: 'cluster' })
    const action = {
      workspaceId: harness.workspace.value.id,
      clusterId: harness.workspace.value.cluster.id,
      contextLabel: 'Jump Route',
      kind: 'update' as const,
      label: 'Update Jump Route',
      target: { kind: 'route' as const, id: route.id },
      parent: { kind: 'cluster' as const, id: harness.workspace.value.cluster.id },
    }

    await harness.workflows.navigation.revealHistoryContext({ direction: 'undo', action })

    expect(harness.store.activeView).toBe('cluster')
    expect(harness.store.selectedRouteId).toBe(route.id)
    expect(harness.store.inspectedTarget).toEqual({ kind: 'route', routeId: route.id })

    harness.workspace.value.cluster.routes.splice(0, 1)
    await harness.workflows.navigation.revealHistoryContext({ direction: 'undo', action })

    expect(harness.store.activeView).toBe('cluster')
    expect(harness.store.selectedRouteId).toBeNull()
    expect(harness.store.inspectedTarget).toEqual({ kind: 'cluster' })
  } finally {
    harness.dispose()
  }
})

test('continuous history restores an inspected object as the complete single-member selection @pure', async () => {
  const harness = createSearchHarness('Kestrel Reach', 'Vesper', Promise.resolve(), undefined, undefined, false, true)
  try {
    const system = harness.workspace.value.cluster.systems[0]
    const object = system?.objects[0]
    if (!system || !object) throw new Error('The local workspace did not create its first system object.')
    const action = {
      workspaceId: harness.workspace.value.id,
      clusterId: harness.workspace.value.cluster.id,
      contextLabel: system.name,
      kind: 'update' as const,
      label: `Update ${object.name}`,
      target: { kind: 'object' as const, id: object.id, systemId: system.id },
      parent: { kind: 'system' as const, id: system.id },
    }

    await harness.workflows.navigation.revealHistoryContext({ direction: 'undo', action })

    expect(harness.store.activeView).toBe('cluster')
    expect(harness.store.selectedObjectId).toBe(object.id)
    expect(harness.store.selectedObjectIds).toEqual([object.id])
    expect(harness.store.inspectedTarget).toEqual({ kind: 'object', systemId: system.id, objectId: object.id })
  } finally {
    harness.dispose()
  }
})

test('transfer Undo and Redo reveal the stable root in its actual owner @pure', async () => {
  const harness = createSearchHarness('Kestrel Reach', 'Vesper', Promise.resolve(), undefined, undefined, false, true)
  try {
    const original = harness.workspace.value
    const source = original.cluster.systems[0]
    const root = source?.objects[0]
    if (!source || !root) throw new Error('The local workspace did not create a transferable object.')
    const destination = { ...source, id: 'history-transfer-destination', name: 'Destination', objects: [], orbits: [] }
    harness.workspace.value = {
      ...original,
      cluster: { ...original.cluster, systems: [source, destination] },
      layout: {
        ...original.layout,
        systemPositions: { ...original.layout.systemPositions, [destination.id]: { x: 0.7, y: 0.55 } },
      },
    }
    const before = harness.workspace.value
    const action = {
      workspaceId: before.id,
      clusterId: before.cluster.id,
      contextLabel: source.name,
      kind: 'transfer' as const,
      label: `Change system for ${root.name}`,
      target: { kind: 'object' as const, id: root.id, systemId: source.id },
      parent: { kind: 'system' as const, id: destination.id },
    }

    await harness.workflows.navigation.revealHistoryContext({ direction: 'undo', action })
    expect(harness.store.inspectedTarget).toEqual({ kind: 'object', systemId: source.id, objectId: root.id })
    expect(harness.store.selectedObjectIds).toEqual([root.id])

    harness.workspace.value = applySystemObjectTransfer(before, {
      sourceSystemId: source.id,
      rootObjectId: root.id,
      destinationSystemId: destination.id,
      placement: { kind: 'system', x: 0.74, y: 0.56 },
    })
    await harness.workflows.navigation.revealHistoryContext({ direction: 'redo', action })

    expect(harness.store.activeView).toBe('cluster')
    expect(harness.store.selectedSystemId).toBe(destination.id)
    expect(harness.store.inspectedTarget).toEqual({ kind: 'object', systemId: destination.id, objectId: root.id })
    expect(harness.store.selectedObjectIds).toEqual([root.id])
  } finally {
    harness.dispose()
  }
})

test('editing the destination Orbit resumes transfer review and preserves the draft and previous placement @pure', async () => {
  const harness = createSearchHarness('Kestrel Reach', 'Vesper', Promise.resolve(), 'Harrow', undefined, false, true)
  try {
    const before = harness.workspace.value
    const [source, destination] = before.cluster.systems
    const root = source?.objects[0]
    if (!source || !destination || !root) throw new Error('The transfer fixture is incomplete.')
    const orbit = createOrbit(destination, null)
    destination.orbits.push(orbit)
    const mapOwner = {}
    harness.store.setSelection({ activeView: 'cluster' })
    harness.workflows.mapControls.clusterMapRef.value = {
      ...createMapHandle({ whenReady: async () => true, frameSearchTarget: () => true, focusMap: () => undefined }),
      isSystemTransferDestination: systemId => systemId === destination.id,
      captureSystemTransferMapOwner: () => mapOwner,
      isSystemTransferMapOwnerCurrent: (systemId, owner) => systemId === destination.id && owner === mapOwner,
      frameSystemTransferDestination: () => true,
    }
    const { inspector, navigation, transfer } = harness.workflows
    await transfer.handleIntent({ kind: 'open', sourceSystemId: source.id, rootObjectId: root.id })
    const sessionId = inspector.systemTransferSession.value?.sessionId
    if (sessionId === undefined) throw new Error('The transfer review did not open.')
    await transfer.handleIntent({ kind: 'select-destination', sessionId, systemId: destination.id })
    await transfer.handleIntent({ kind: 'choose-orbit-placement', sessionId, orbitId: orbit.id, angle: 0.5 })
    const previousPlacement = { kind: 'orbit', orbitId: orbit.id, angle: 0.5 }
    expect(inspector.systemTransferSession.value).toMatchObject({ canAccept: true, placement: previousPlacement })
    await transfer.handleIntent({ kind: 'place-on-map', sessionId })
    const lease = transfer.pendingMapPlacement.value
    if (!lease) throw new Error(inspector.systemTransferSession.value?.error ?? 'The transfer did not acquire map placement.')

    expect(await navigation.inspectContinuousTarget({ kind: 'orbit', systemId: destination.id, orbitId: orbit.id })).toBe(true)
    expect(transfer.pendingMapPlacement.value).toBe(lease)
    await inspector.beginOrbitEdit()
    const draft = inspector.entitySession.value
    if (draft?.kind !== 'orbit') throw new Error('The destination Orbit draft did not open.')
    draft.draft.horizontalRadius = '244'

    expect(transfer.pendingMapPlacement.value).toBeNull()
    expect(transfer.completeMapPlacement(lease, { kind: 'orbit', orbitId: orbit.id, angle: 1.5 })).toBe(false)
    expect(inspector.systemTransferSession.value).toMatchObject({
      sessionId, open: true, placingOnMap: false, placement: previousPlacement,
      error: 'Finish editing the destination system before continuing the transfer.',
    })
    await transfer.handleIntent({ kind: 'place-on-map', sessionId })
    expect(transfer.pendingMapPlacement.value).toBeNull()
    expect(await transfer.handleIntent({ kind: 'apply', sessionId })).toMatchObject({ status: 'rejected', reason: 'unavailable' })
    expect(inspector.entitySession.value).toBe(draft)
    expect(draft.draft.horizontalRadius).toBe('244')
    expect(harness.workspace.value).toBe(before)
  } finally {
    harness.dispose()
  }
})

test('continuous Route and Orbit cleanup preserves independent object-group membership @pure', async () => {
  async function assertCleanupPreservesGroup(focus: 'route' | 'orbit'): Promise<void> {
    const harness = createSearchHarness('Kestrel Reach', 'Vesper', Promise.resolve(), 'Altair', undefined, false, true)
    try {
      const [firstSystem, secondSystem] = harness.workspace.value.cluster.systems
      const templateObject = firstSystem?.objects[0]
      if (!firstSystem || !secondSystem || !templateObject) throw new Error('Expected two systems and a group fixture object.')
      const memberB = { ...templateObject, id: `${focus}-cleanup-member-b`, name: 'Member B' }
      const memberC = { ...templateObject, id: `${focus}-cleanup-member-c`, name: 'Member C' }
      firstSystem.objects = [memberB]
      secondSystem.objects = [memberC]
      harness.store.setSelection({ activeView: 'cluster' })
      harness.store.setMode('select')

      let routeId: string | null = null
      let orbitId: string | null = null
      if (focus === 'route') {
        const route = {
          id: 'continuous-route-cleanup-focus',
          jumpLevel: 1,
          fromSystemId: firstSystem.id,
          fromPointId: null,
          toSystemId: null,
          toPointId: null,
          unresolvedExit: 'Uncharted Exit',
          playerShared: false,
        }
        harness.workspace.value.cluster.routes.push(route)
        routeId = route.id
        await harness.workflows.navigation.selectRoute(route.id, false)
        expect(harness.store.selectedRouteId).toBe(route.id)
      } else {
        const orbit = createOrbit(firstSystem, null)
        firstSystem.orbits.push(orbit)
        orbitId = orbit.id
        expect(await harness.workflows.navigation.inspectContinuousTarget({
          kind: 'orbit', systemId: firstSystem.id, orbitId: orbit.id,
        })).toBe(true)
      }

      expect(await harness.workflows.navigation.replaceObjectSelection([memberB.id, memberC.id])).toBe(true)
      expect(harness.store.selectedObjectIds).toEqual([memberB.id, memberC.id])

      const current = harness.workspace.value
      harness.workspace.value = {
        ...current,
        cluster: {
          ...current.cluster,
          routes: routeId ? current.cluster.routes.filter(route => route.id !== routeId) : current.cluster.routes,
          systems: current.cluster.systems.map(system => orbitId === null || system.id !== firstSystem.id
            ? system
            : { ...system, orbits: system.orbits.filter(orbit => orbit.id !== orbitId) }),
        },
      }
      await nextTick()

      expect(harness.store.selectedObjectIds).toEqual([memberB.id, memberC.id])
      if (routeId) expect(harness.store.selectedRouteId).toBeNull()
      if (orbitId) expect(harness.store.selectedOrbitId).toBeNull()
    } finally {
      harness.dispose()
    }
  }

  await assertCleanupPreservesGroup('route')
  await assertCleanupPreservesGroup('orbit')
})

test('continuous history refits the surviving Cluster after its inspected system is removed @pure', async () => {
  const harness = createSearchHarness('Kestrel Reach', 'Vesper', Promise.resolve(), 'Quill', undefined, false, true)
  try {
    const removedSystem = harness.workspace.value.cluster.systems[1]
    if (!removedSystem) throw new Error('The local workspace did not create its additional system.')
    const clusterId = harness.workspace.value.cluster.id
    let clusterRevealCount = 0
    harness.store.setSelection({
      activeView: 'cluster',
      inspectedTarget: { kind: 'system', systemId: removedSystem.id },
      selectedSystemId: removedSystem.id,
    })
    harness.workflows.mapControls.clusterMapRef.value = createMapHandle({
      whenReady: async () => true,
      frameSearchTarget: () => true,
      focusMap: () => undefined,
      revealHistoryCluster: () => { clusterRevealCount += 1; return true },
    })
    const action = {
      workspaceId: harness.workspace.value.id,
      clusterId,
      contextLabel: 'Star System',
      kind: 'delete' as const,
      label: 'Delete Star System',
      target: { kind: 'system' as const, id: removedSystem.id },
      parent: { kind: 'cluster' as const, id: clusterId },
    }
    harness.workspace.value.cluster.systems.splice(1, 1)

    await harness.workflows.navigation.revealHistoryContext({ direction: 'undo', action })

    expect(clusterRevealCount).toBe(1)
    expect(harness.store.activeView).toBe('cluster')
    expect(harness.store.inspectedTarget).toEqual({ kind: 'cluster' })
  } finally {
    harness.dispose()
  }
})

test('a continuous map selection invalidates a pending Search frame on the captured cluster canvas @pure', async () => {
  const ready = deferred<boolean>()
  const harness = createSearchHarness('Kestrel Reach', 'Vesper', Promise.resolve(), undefined, undefined, false, true)
  try {
    const system = harness.workspace.value.cluster.systems[0]
    const firstObject = system?.objects[0]
    if (!system || !firstObject) throw new Error('The local workspace did not create its first system object.')
    const nextObject = { ...firstObject, id: 'continuous-search-next-target', name: 'Second World' }
    system.objects.push(nextObject)
    harness.store.setSelection({ activeView: 'cluster' })
    let frameCount = 0
    harness.workflows.mapControls.clusterMapRef.value = createMapHandle({
      whenReady: () => ready.promise,
      frameSearchTarget: () => { frameCount += 1; return true },
      focusMap: () => undefined,
    })
    const search = harness.workflows.search
    search.open.value = true
    search.query.value = firstObject.name
    const result = search.results.value.find(candidate => candidate.target.kind === 'object')
    if (!result || result.target.kind !== 'object') throw new Error('The first object did not produce an object search result.')

    const reveal = search.reveal(result.target)
    await expect.poll(() => harness.store.inspectedTarget?.kind).toBe('object')
    expect(await harness.workflows.navigation.inspectContinuousTarget({
      kind: 'object', systemId: system.id, objectId: nextObject.id,
    })).toBe(true)
    ready.resolve(true)

    expect(await reveal).toEqual({ status: 'rejected', reason: 'stale' })
    expect(harness.store.activeView).toBe('cluster')
    expect(harness.store.inspectedTarget).toEqual({ kind: 'object', systemId: system.id, objectId: nextObject.id })
    expect(frameCount).toBe(0)
  } finally {
    ready.resolve(false)
    harness.dispose()
  }
})

test('manual camera interaction abandons a pending continuous Search frame @pure', async () => {
  const ready = deferred<boolean>()
  const harness = createSearchHarness('Kestrel Reach', 'Vesper', Promise.resolve(), undefined, undefined, false, true)
  try {
    const system = harness.workspace.value.cluster.systems[0]
    const object = system?.objects[0]
    if (!system || !object) throw new Error('The local workspace did not create its first system object.')
    harness.store.setSelection({ activeView: 'cluster' })
    let interactionVersion = 0
    let frameCount = 0
    harness.workflows.mapControls.clusterMapRef.value = createMapHandle({
      whenReady: () => ready.promise,
      frameSearchTarget: () => { frameCount += 1; return true },
      focusMap: () => undefined,
      getCameraInteractionVersion: () => interactionVersion,
    })
    const search = harness.workflows.search
    search.open.value = true
    search.query.value = object.name
    const result = search.results.value.find(candidate => candidate.target.kind === 'object')
    if (!result || result.target.kind !== 'object') throw new Error('The object did not produce an object search result.')

    const reveal = search.reveal(result.target)
    await expect.poll(() => harness.store.inspectedTarget?.kind).toBe('object')
    interactionVersion += 1
    ready.resolve(true)

    expect(await reveal).toEqual({ status: 'rejected', reason: 'stale' })
    expect(harness.store.inspectedTarget).toEqual({ kind: 'object', systemId: system.id, objectId: object.id })
    expect(frameCount).toBe(0)
  } finally {
    ready.resolve(false)
    harness.dispose()
  }
})

function createMapHandle(options: {
  whenReady: () => Promise<boolean>
  frameSearchTarget: NonNullable<MapNavigationHandle['frameSearchTarget']>
  focusMap: () => void
  getCameraInteractionVersion?: NonNullable<MapNavigationHandle['getCameraInteractionVersion']>
  revealHistoryCluster?: NonNullable<MapNavigationHandle['revealHistoryCluster']>
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
    getCameraInteractionVersion: options.getCameraInteractionVersion,
    frameSearchTarget: options.frameSearchTarget,
    revealHistoryCluster: options.revealHistoryCluster,
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

test('Search reconciles Field edits synchronously while map criteria reconcile before render @pure', async () => {
  const harness = createSearchHarness()
  try {
    const searchCriteria = harness.workflows.filterCriteria.search
    const mapCriteria = harness.workflows.filterCriteria.map
    const condition = {
      fieldId: nativePlayerFieldIds.atmosphere,
      type: 'single-select' as const,
      operator: 'is' as const,
      values: ['Breathable'],
    }
    searchCriteria.setFieldConditions([{
      ...condition,
    }])
    mapCriteria.setFieldConditions([condition])
    expect(searchCriteria.criteria.value.fieldConditions).toEqual([{
      ...condition,
    }])

    harness.workspace.value = updateNativeFieldOptions(harness.workspace.value, 'atmosphere', ['Not breathable'], true)

    expect(searchCriteria.criteria.value.fieldConditions).toEqual([])
    expect(searchCriteria.invalidationNotice.value).toBe('Search filters updated because a Field or choice is no longer available.')
    expect(harness.searchFilterInvalidations).toEqual([1])
    expect(mapCriteria.criteria.value.fieldConditions).toEqual([condition])

    await nextTick()
    expect(mapCriteria.criteria.value.fieldConditions).toEqual([])
    expect(mapCriteria.invalidationNotice.value).toBe('Some filters were removed because Fields or choices changed.')

    searchCriteria.setFieldConditions([{ ...condition, values: ['Not breathable'] }])
    harness.workspace.value = updateNativeFieldOptions(harness.workspace.value, 'atmosphere', ['Neutral'], true)
    expect(searchCriteria.criteria.value.fieldConditions).toEqual([])
    expect(harness.searchFilterInvalidations).toEqual([1, 2])
  } finally {
    harness.dispose()
  }
})

test('clearing Search criteria keeps its query and map criteria; full reset clears Search state @pure', () => {
  const harness = createSearchHarness()
  try {
    const search = harness.workflows.search
    const searchFilters = harness.workflows.filterCriteria.search
    const mapFilters = harness.workflows.filterCriteria.map
    const mapType = mapFilters.typeOptions.value[0]
    if (!mapType) throw new Error('The Search harness has no object type filter option.')

    mapFilters.setTypes([mapType.value])
    search.open.value = true
    search.query.value = 'VEIL-09'
    searchFilters.setTypes([mapType.value])
    searchFilters.setFieldConditions([{
      fieldId: nativePlayerFieldIds.atmosphere,
      type: 'single-select',
      operator: 'is',
      values: ['Breathable'],
    }])
    harness.workspace.value = updateNativeFieldOptions(harness.workspace.value, 'atmosphere', ['Not breathable'], true)
    expect(searchFilters.invalidationNotice.value).toBe('Search filters updated because a Field or choice is no longer available.')

    searchFilters.clearAll()
    expect(searchFilters.criteria.value).toEqual({ types: [], publicationModes: [], fieldConditions: [] })
    expect(searchFilters.invalidationNotice.value).toBeNull()
    expect(search.query.value).toBe('VEIL-09')
    expect(search.open.value).toBe(true)
    expect(mapFilters.criteria.value.types).toEqual([mapType.value])
    expect(Object.keys(harness.store.searchTypeFilterOptionLabels).length).toBeGreaterThan(0)

    searchFilters.setTypes([mapType.value])
    searchFilters.setFieldConditions([{
      fieldId: nativePlayerFieldIds.atmosphere,
      type: 'single-select',
      operator: 'is',
      values: ['Not breathable'],
    }])
    harness.workspace.value = updateNativeFieldOptions(harness.workspace.value, 'atmosphere', ['Recycled'], true)
    expect(searchFilters.invalidationNotice.value).toBe('Search filters updated because a Field or choice is no longer available.')

    search.reset()
    expect(search.query.value).toBe('')
    expect(search.open.value).toBe(false)
    expect(searchFilters.criteria.value).toEqual({ types: [], publicationModes: [], fieldConditions: [] })
    expect(searchFilters.invalidationNotice.value).toBeNull()
    expect(mapFilters.criteria.value.types).toEqual([mapType.value])
    expect(harness.store.searchTypeFilterOptionLabels).toEqual({})
  } finally {
    harness.dispose()
  }
})

test('same-identity replacement preserves criteria while cluster and workspace resets keep their notice rules @pure', async () => {
  const harness = createSearchHarness()
  try {
    const search = harness.workflows.search
    const searchFilters = harness.workflows.filterCriteria.search
    const mapFilters = harness.workflows.filterCriteria.map
    const type = mapFilters.typeOptions.value[0]
    if (!type) throw new Error('The Search harness has no object type filter option.')
    const breathable = {
      fieldId: nativePlayerFieldIds.atmosphere,
      type: 'single-select' as const,
      operator: 'is' as const,
      values: ['Breathable'],
    }

    mapFilters.setTypes([type.value])
    searchFilters.setTypes([type.value])
    mapFilters.setFieldConditions([breathable])
    searchFilters.setFieldConditions([breathable])
    harness.workspace.value = updateNativeFieldOptions(harness.workspace.value, 'atmosphere', ['Not breathable'], true)
    await nextTick()
    expect(mapFilters.invalidationNotice.value).toBe('Some filters were removed because Fields or choices changed.')
    expect(searchFilters.invalidationNotice.value).toBe('Search filters updated because a Field or choice is no longer available.')

    harness.workspace.value = createWorkspaceSnapshot(harness.workspace.value!)
    expect(mapFilters.criteria.value.types).toEqual([type.value])
    expect(searchFilters.criteria.value.types).toEqual([type.value])
    expect(mapFilters.invalidationNotice.value).toBe('Some filters were removed because Fields or choices changed.')
    expect(searchFilters.invalidationNotice.value).toBe('Search filters updated because a Field or choice is no longer available.')

    const clusterReset = createWorkspaceSnapshot(harness.workspace.value!)
    clusterReset.cluster.id = 'replacement-cluster'
    harness.workspace.value = clusterReset
    expect(mapFilters.criteria.value.types).toEqual([])
    expect(searchFilters.criteria.value.types).toEqual([])
    expect(mapFilters.invalidationNotice.value).toBe('Some filters were removed because Fields or choices changed.')
    expect(searchFilters.invalidationNotice.value).toBeNull()
    expect(search.query.value).toBe('')
    expect(search.open.value).toBe(false)

    const currentFieldCondition = {
      ...breathable,
      values: ['Not breathable'],
    }
    mapFilters.setFieldConditions([currentFieldCondition])
    searchFilters.setFieldConditions([currentFieldCondition])
    harness.workspace.value = updateNativeFieldOptions(harness.workspace.value, 'atmosphere', ['Recycled'], true)
    await nextTick()
    expect(mapFilters.invalidationNotice.value).toBe('Some filters were removed because Fields or choices changed.')
    expect(searchFilters.invalidationNotice.value).toBe('Search filters updated because a Field or choice is no longer available.')

    const workspaceReset = createWorkspaceSnapshot(harness.workspace.value!)
    workspaceReset.id = 'replacement-workspace'
    harness.workspace.value = workspaceReset
    await nextTick()
    expect(mapFilters.criteria.value.fieldConditions).toEqual([])
    expect(searchFilters.criteria.value.fieldConditions).toEqual([])
    expect(mapFilters.invalidationNotice.value).toBeNull()
    expect(searchFilters.invalidationNotice.value).toBeNull()
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
    expect(deletion.status, JSON.stringify(deletion)).toBe('applied')
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

test('continuous Search rollback keeps selected members whose original focused owner was deleted @pure', async () => {
  const harness = createSearchHarness('Kestrel Reach', 'Vesper', Promise.resolve(), 'Altair', undefined, false, true)
  const ready = deferred<boolean>()
  let readyWaits = 0
  try {
    const [focusedSystem, memberSystem] = harness.workspace.value.cluster.systems
    const focusedObject = focusedSystem?.objects[0]
    if (!focusedSystem || !memberSystem || !focusedObject) throw new Error('Expected a focused system and a group member owner.')
    const memberB = { ...focusedObject, id: 'search-rollback-group-b', name: 'Member B' }
    const thirdSystem = {
      ...focusedSystem,
      id: 'search-rollback-third-system',
      name: 'Rigel',
      objects: [{ ...focusedObject, id: 'search-rollback-group-c', name: 'Member C' }],
      orbits: [],
    }
    memberSystem.objects = [memberB]
    harness.workspace.value.cluster.systems.push(thirdSystem)
    harness.workspace.value.layout.systemPositions[thirdSystem.id] = { x: 0.82, y: 0.52 }
    harness.store.setSelection({ activeView: 'cluster' })
    expect(await harness.workflows.navigation.inspectContinuousTarget({
      kind: 'object', systemId: focusedSystem.id, objectId: focusedObject.id,
    })).toBe(true)
    expect(await harness.workflows.navigation.replaceObjectSelection([memberB.id, thirdSystem.objects[0]!.id])).toBe(true)
    expect(harness.store.selectedObjectIds).toEqual([memberB.id, thirdSystem.objects[0]!.id])

    harness.workflows.mapControls.clusterMapRef.value = createMapHandle({
      whenReady: () => {
        readyWaits += 1
        return ready.promise
      },
      frameSearchTarget: () => true,
      focusMap: () => undefined,
    })
    const search = harness.workflows.search
    search.open.value = true
    search.query.value = focusedSystem.name
    const result = search.results.value.find(candidate => candidate.target.kind === 'system'
      && candidate.target.systemId === focusedSystem.id)
    if (!result || result.target.kind !== 'system') throw new Error('The focused owner did not produce a system search result.')

    const reveal = search.reveal(result.target)
    await expect.poll(() => readyWaits).toBe(1)
    const deletion = await harness.history.execute({
      action: {
        kind: 'delete',
        label: `Delete ${focusedSystem.name}`,
        target: { kind: 'system', id: focusedSystem.id },
        parent: { kind: 'cluster', id: harness.workspace.value.cluster.id },
      },
      prepare: current => planMapEntityDeletion(current, { kind: 'system', systemId: focusedSystem.id }).workspace,
    })
    expect(deletion.status, JSON.stringify(deletion)).toBe('applied')
    ready.resolve(true)

    expect(await reveal).toEqual({ status: 'rejected', reason: 'unavailable' })
    expect(harness.store.activeView).toBe('cluster')
    expect(harness.store.inspectedTarget).toBeNull()
    expect(harness.store.selectedSystemId).toBe(memberSystem.id)
    expect(harness.store.selectedObjectId).toBeNull()
    expect(harness.store.selectedObjectIds).toEqual([memberB.id, thirdSystem.objects[0]!.id])
  } finally {
    ready.resolve(false)
    harness.dispose()
  }
})

test('continuous membership survives deletion of the focused owner @pure', async () => {
  const harness = createSearchHarness('Kestrel Reach', 'Vesper', Promise.resolve(), 'Altair', undefined, false, true)
  try {
    const [focusedSystem, remainingSystem] = harness.workspace.value.cluster.systems
    const focusedObject = focusedSystem?.objects[0]
    if (!focusedSystem || !remainingSystem || !focusedObject) throw new Error('Expected two systems and a focused object.')
    const memberB = { ...focusedObject, id: 'deleted-focus-member-b', name: 'Member B' }
    const memberC = { ...focusedObject, id: 'deleted-focus-member-c', name: 'Member C', locationKey: 'B' }
    remainingSystem.objects = [memberB, memberC]
    harness.store.setSelection({ activeView: 'cluster' })
    expect(await harness.workflows.navigation.inspectContinuousTarget({
      kind: 'object', systemId: focusedSystem.id, objectId: focusedObject.id,
    })).toBe(true)
    expect(await harness.workflows.navigation.replaceObjectSelection([memberB.id, memberC.id])).toBe(true)

    const deletion = await harness.history.execute({
      action: {
        kind: 'delete',
        label: `Delete ${focusedSystem.name}`,
        target: { kind: 'system', id: focusedSystem.id },
        parent: { kind: 'cluster', id: harness.workspace.value.cluster.id },
      },
      prepare: current => planMapEntityDeletion(current, { kind: 'system', systemId: focusedSystem.id }).workspace,
    })
    expect(deletion.status, JSON.stringify(deletion)).toBe('applied')
    expect(harness.store.selectedSystemId).toBe(remainingSystem.id)
    expect(harness.store.inspectedTarget).toBeNull()
    expect(harness.store.selectedObjectId).toBeNull()
    expect(harness.store.selectedObjectIds).toEqual([memberB.id, memberC.id])
  } finally {
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
    harness.workflows.charts.hideEditing()
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
    expect(harness.workflows.charts.editing.value).toBe(true)
    expect(harness.workflows.charts.dialogOpen.value).toBe(false)
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
    harness.workflows.charts.hideEditing()
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

test('replacing the ready destination map during Search presentation rejects without publishing its prepared locator @pure', async () => {
  const presentation = deferred<SearchPresentationSettlement>()
  let presentationWaiting = false
  const harness = createSearchHarness(
    'Kestrel Reach',
    'Vesper',
    Promise.resolve(),
    undefined,
    () => {
      presentationWaiting = true
      return presentation.promise
    },
  )
  function createObservedMap() {
    const events: string[] = []
    const handle = createSystemMapHandle({
      whenReady: async () => { events.push('ready'); return true },
      frameSearchTarget: () => { events.push('frame'); return true },
      focusMap: () => { events.push('focus') },
      prepareSearchLocator: objectId => {
        events.push(`prepare:${objectId}`)
        return () => { events.push(`publish:${objectId}`) }
      },
    })
    return { handle, events }
  }
  try {
    const workspace = harness.workspace.value
    const system = workspace.cluster.systems[0]
    const object = system?.objects[0]
    if (!system || !object) throw new Error('The local workspace did not create its first system object.')
    harness.store.setSelection({ activeView: 'cluster', clusterSelectedSystemId: system.id })

    const oldMap = createObservedMap()
    harness.workflows.mapControls.systemMapRef.value = oldMap.handle

    const search = harness.workflows.search
    search.open.value = true
    search.query.value = object.locationKey
    const result = search.results.value.find(candidate => candidate.target.kind === 'object')
    if (!result) throw new Error('The first system object was not searchable.')

    const reveal = search.reveal(result.target)
    await expect.poll(() => presentationWaiting).toBe(true)
    expect(oldMap.events).toEqual(['ready', `prepare:${object.id}`])

    const replacementMap = createObservedMap()
    harness.workflows.mapControls.systemMapRef.value = replacementMap.handle
    presentation.resolve('settled')

    expect(await reveal).toEqual({ status: 'rejected', reason: 'stale' })
    expect(harness.workspace.value).toBe(workspace)
    expect(harness.store.activeView).toBe('system')
    expect(harness.store.selectedSystemId).toBe(system.id)
    expect(harness.store.selectedObjectId).toBe(object.id)
    expect(harness.store.clusterSelectedSystemId).toBeNull()
    expect(search.open.value).toBe(false)
    expect(search.query.value).toBe(object.locationKey)
    expect(oldMap.events).toEqual(['ready', `prepare:${object.id}`])
    expect(replacementMap.events).toEqual([])

    const destinationKey = `system:${workspace.cluster.id}:${system.id}`
    const viewport = { x: 14, y: 27, k: 1.4 }
    harness.workflows.mapControls.recordViewport(destinationKey, viewport)
    expect(harness.store.visits[destinationKey]).toEqual({
      viewport,
      selection: { kind: 'object', id: object.id },
    })
  } finally {
    presentation.resolve('settled')
    harness.dispose()
  }
})
