import { computed, getCurrentScope, nextTick, onScopeDispose, watch, type Ref } from 'vue'
import {
  jumpPointsInCluster,
  type JumpRoute,
  type LocalWorkspace,
  type MapDeletionPlan,
} from '../../domain/workspace'
import type { EditorUiSelection, useEditorUiStore } from '../../stores/editor-ui'
import type { EntityCommand, MapHistoryTarget, MapInteractionMode, TransitionOptions } from './types'
import type { WorkspaceHistoryTraversalContext, WorkspaceMutationTarget } from './workspace-mutations'
import type { useEditorMapControls } from './useEditorMapControls'
import type { useChartNamesSession } from './useChartNamesSession'
import type { useEditorTransitions } from './useEditorTransitions'
import type { useEditorViewport } from './useEditorViewport'
import type { useEntityInspectorSession } from './useEntityInspectorSession'
import type { useRouteInspectorSession } from './useRouteInspectorSession'
import type { SearchTarget } from '../../utils/workspace-search'

type EditorUiStore = ReturnType<typeof useEditorUiStore>
type MapControls = ReturnType<typeof useEditorMapControls>
type ChartController = ReturnType<typeof useChartNamesSession>
type Transitions = ReturnType<typeof useEditorTransitions>
type EntityController = ReturnType<typeof useEntityInspectorSession>
type RouteController = ReturnType<typeof useRouteInspectorSession>

/** Owns guarded navigation and selection restoration; accepted state is published through focused Pinia actions. */
export function useEditorNavigation(options: {
  workspace: Readonly<Ref<LocalWorkspace | null>>
  waitForSearchPresentation?: () => Promise<void>
  store: EditorUiStore
  mapControls: MapControls
  chart: ChartController
  transitions: Transitions
  viewport: ReturnType<typeof useEditorViewport>
  entity: EntityController
  route: RouteController
  editorError: Ref<string>
  beforeWorkspaceOperation?: () => Promise<boolean>
}) {
  const { workspace, store, mapControls, chart, transitions, viewport, entity, route, editorError } = options
  const activeView = computed(() => store.activeView)
  const mapMode = computed(() => store.mapMode)
  const selectedSystemId = computed(() => store.selectedSystemId)
  const clusterSelectedSystemId = computed(() => store.clusterSelectedSystemId)
  const selectedObjectId = computed(() => store.selectedObjectId)
  const selectedOrbitId = computed(() => store.selectedOrbitId)
  const selectedRouteId = computed(() => store.selectedRouteId)
  const selectedSystem = computed(() => workspace.value?.cluster.systems.find(system => system.id === store.selectedSystemId))
  const clusterSelectedSystem = computed(() => workspace.value?.cluster.systems.find(system => system.id === store.clusterSelectedSystemId))
  const inspectedClusterSystem = computed(() => workspace.value?.cluster.systems.find(system => system.id === store.inspectedClusterSystemId))
  const selectedObject = computed(() => selectedSystem.value?.objects.find(object => object.id === store.selectedObjectId))
  const selectedOrbit = computed(() => selectedSystem.value?.orbits.find(orbit => orbit.id === store.selectedOrbitId))
  const selectedRoute = computed(() => workspace.value?.cluster.routes.find(item => item.id === store.selectedRouteId))
  const jumpPoints = computed(() => workspace.value ? jumpPointsInCluster(workspace.value.cluster) : [])
  let searchContextGeneration = 0
  let searchRequestSequence = 0
  let publishingSearchContext = false
  if (getCurrentScope()) onScopeDispose(() => { searchRequestSequence += 1 })

  /** Prevents a deferred search camera action from overriding a newer navigation command. */
  function invalidatePendingSearchReveal(): void {
    searchRequestSequence += 1
  }

  watch([
    () => workspace.value?.id,
    () => workspace.value?.cluster.id,
    () => store.activeView,
    () => store.mapMode,
    () => store.selectedSystemId,
    () => store.clusterSelectedSystemId,
    () => store.inspectedClusterSystemId,
    () => store.selectedObjectId,
    () => store.selectedOrbitId,
    () => store.selectedRouteId,
  ], () => {
    if (!publishingSearchContext) searchContextGeneration += 1
  }, { flush: 'sync' })

  function setSelection(patch: Partial<EditorUiSelection>): void {
    store.setSelection({
      activeView: store.activeView,
      selectedSystemId: store.selectedSystemId,
      clusterSelectedSystemId: store.clusterSelectedSystemId,
      inspectedClusterSystemId: store.inspectedClusterSystemId,
      selectedObjectId: store.selectedObjectId,
      selectedOrbitId: store.selectedOrbitId,
      selectedRouteId: store.selectedRouteId,
      ...patch,
    })
  }

  function navigationContextStamp(): string {
    return JSON.stringify([
      workspace.value?.cluster.id ?? null,
      store.activeView,
      store.selectedSystemId,
      store.selectedObjectId,
      store.selectedOrbitId,
      store.selectedRouteId,
      store.clusterSelectedSystemId,
      store.inspectedClusterSystemId,
    ])
  }

  /** Accepts guard-driven cleanup only while the starting map context still owns the command. */
  function acceptNavigationTransition(expectedStamp: string, startingSessionId: number | null): boolean {
    const currentSessionId = chart.session.value?.id ?? null
    if (navigationContextStamp() !== expectedStamp
      || (currentSessionId !== startingSessionId && currentSessionId !== null)) return false
    mapControls.captureActiveMap()
    return true
  }

  function restoreActiveSelection(): void {
    const key = mapControls.activeMapKey.value
    const stored = key ? store.visits[key]?.selection : undefined
    const selection = stored ? mapControls.validVisitSelection(key!, stored) : { kind: 'none' as const }
    const next: Partial<EditorUiSelection> = {
      selectedRouteId: null,
      selectedObjectId: null,
      selectedOrbitId: null,
      clusterSelectedSystemId: null,
      inspectedClusterSystemId: null,
    }
    if (store.activeView === 'cluster') {
      if (selection.kind === 'system') {
        next.clusterSelectedSystemId = selection.id
        if (selection.inspect) next.inspectedClusterSystemId = selection.id
      } else if (selection.kind === 'route') {
        next.selectedRouteId = selection.id
      }
    } else if (selection.kind === 'object') {
      next.selectedObjectId = selection.id
    } else if (selection.kind === 'orbit') {
      next.selectedOrbitId = selection.id
    }
    setSelection(next)
  }

  function storeCurrentSelection(): void {
    mapControls.captureActiveMap()
  }

  async function setMapMode(mode: MapInteractionMode): Promise<boolean> {
    invalidatePendingSearchReveal()
    if (options.beforeWorkspaceOperation && !await options.beforeWorkspaceOperation()) return false
    store.setMode(mode)
    return true
  }

  watch(workspace, currentWorkspace => {
    if (!currentWorkspace) {
      setSelection({
        selectedSystemId: null,
        selectedObjectId: null,
        selectedOrbitId: null,
        selectedRouteId: null,
        clusterSelectedSystemId: null,
        inspectedClusterSystemId: null,
      })
      mapControls.pruneVisits(() => ({ kind: 'none' }))
      return
    }
    const next: Partial<EditorUiSelection> = {}
    if (!currentWorkspace.cluster.systems.some(system => system.id === store.selectedSystemId)) {
      next.selectedSystemId = currentWorkspace.cluster.systems[0]?.id ?? null
    }
    if (!currentWorkspace.cluster.routes.some(item => item.id === store.selectedRouteId)) next.selectedRouteId = null
    if (!currentWorkspace.cluster.systems.some(system => system.id === store.clusterSelectedSystemId)) next.clusterSelectedSystemId = null
    if (!currentWorkspace.cluster.systems.some(system => system.id === store.inspectedClusterSystemId)) next.inspectedClusterSystemId = null
    if (Object.keys(next).length) setSelection(next)
    mapControls.pruneVisits(mapControls.validVisitSelection)
  }, { immediate: true })

  watch(selectedSystem, currentSystem => {
    if (!currentSystem) {
      if (store.selectedObjectId || store.selectedOrbitId) setSelection({ selectedObjectId: null, selectedOrbitId: null })
      return
    }
    const next: Partial<EditorUiSelection> = {}
    if (!currentSystem.objects.some(object => object.id === store.selectedObjectId)) next.selectedObjectId = null
    if (!currentSystem.orbits.some(orbit => orbit.id === store.selectedOrbitId)) next.selectedOrbitId = null
    if (Object.keys(next).length) setSelection(next)
  })

  /** Formats route endpoints with explicit unresolved and missing-reference fallbacks. */
  function routeEndpointSummary(routeValue: JumpRoute): string {
    const origin = jumpPoints.value.find(({ point }) => point.id === routeValue.fromPointId)
    let destination: string
    if (routeValue.toPointId === null) {
      destination = `Unknown destination: ${routeValue.unresolvedExit}`
    } else {
      const reference = jumpPoints.value.find(({ point }) => point.id === routeValue.toPointId)
      destination = reference ? `${reference.point.name} (${reference.system.name})` : 'Missing Jump Point'
    }
    const originName = origin ? `${origin.point.name} (${origin.system.name})` : 'Missing Jump Point'
    return `${originName} -> ${destination}`
  }

  /** Starts or resumes a chart-name session after the transition guard and captured-context checks pass. */
  async function beginChartNamesEdit(targetSystemId?: string): Promise<void> {
    const currentWorkspace = workspace.value
    const targetId = targetSystemId ?? chart.session.value?.systemId ?? store.selectedSystemId
    const target = currentWorkspace?.cluster.systems.find(system => system.id === targetId)
    if (!currentWorkspace || !target) return
    if (chart.session.value?.clusterId === currentWorkspace.cluster.id && chart.session.value.systemId === target.id) {
      if (options.beforeWorkspaceOperation && !await options.beforeWorkspaceOperation()) return
      chart.beginAccepted(currentWorkspace, target)
      return
    }
    const startingStamp = navigationContextStamp()
    const startingSessionId = chart.session.value?.id ?? null
    const startingClusterId = currentWorkspace.cluster.id
    if (!await transitions.resolveTransition({ leaveChart: chart.session.value !== null })) return
    const latestWorkspace = workspace.value
    const latestTarget = latestWorkspace?.cluster.systems.find(system => system.id === targetId)
    const latestSessionId = chart.session.value?.id ?? null
    if (navigationContextStamp() !== startingStamp
      || (latestSessionId !== startingSessionId && latestSessionId !== null)
      || !latestWorkspace
      || latestWorkspace.cluster.id !== startingClusterId
      || !latestTarget) return
    chart.beginAccepted(latestWorkspace, latestTarget)
  }

  function isChartDraftTarget(systemId: string): boolean {
    return chart.session.value?.systemId === systemId
  }

  async function showClusterMap(): Promise<void> {
    invalidatePendingSearchReveal()
    const startingStamp = navigationContextStamp()
    const startingSessionId = chart.session.value?.id ?? null
    if (!await transitions.resolveTransition() || !acceptNavigationTransition(startingStamp, startingSessionId)) return
    setSelection({ activeView: 'cluster' })
    store.setMode('select')
    restoreActiveSelection()
    editorError.value = ''
  }

  async function selectSystem(systemId: string): Promise<void> {
    invalidatePendingSearchReveal()
    if (!workspace.value?.cluster.systems.some(system => system.id === systemId)) return
    const startingStamp = navigationContextStamp()
    const startingSessionId = chart.session.value?.id ?? null
    if (!await transitions.resolveTransition()) return
    if (!acceptNavigationTransition(startingStamp, startingSessionId)
      || !workspace.value?.cluster.systems.some(system => system.id === systemId)) return
    setSelection({ selectedSystemId: systemId, activeView: 'system' })
    store.setMode('select')
    restoreActiveSelection()
    editorError.value = ''
  }

  async function selectClusterSystem(systemId: string, openInspector = true): Promise<void> {
    invalidatePendingSearchReveal()
    if (!workspace.value?.cluster.systems.some(system => system.id === systemId)) return
    const startingStamp = navigationContextStamp()
    const startingSessionId = chart.session.value?.id ?? null
    if (!await transitions.resolveTransition()) return
    if (!acceptNavigationTransition(startingStamp, startingSessionId)
      || !workspace.value?.cluster.systems.some(system => system.id === systemId)) return
    setSelection({
      clusterSelectedSystemId: systemId,
      inspectedClusterSystemId: systemId,
      selectedRouteId: null,
    })
    storeCurrentSelection()
    if (openInspector) viewport.requestPanel('inspector')
    editorError.value = ''
  }

  function sameSearchWorkspace(currentWorkspace: LocalWorkspace | null, target: SearchTarget): boolean {
    return currentWorkspace?.id === target.workspaceId
      && currentWorkspace.cluster.id === target.clusterId
  }

  function searchTargetExists(currentWorkspace: LocalWorkspace | null, target: SearchTarget): boolean {
    if (!currentWorkspace || !sameSearchWorkspace(currentWorkspace, target)) return false
    return target.kind === 'cluster'
      || currentWorkspace.cluster.systems.some(system => system.id === target.systemId)
  }

  function ownsAcceptedSearchState(
    requestId: number,
    acceptedGeneration: number,
    target: SearchTarget,
    previousSelectedSystemId: string | null,
  ): boolean {
    const currentWorkspace = workspace.value
    return searchRequestSequence === requestId
      && searchContextGeneration === acceptedGeneration
      && store.activeView === 'cluster'
      && store.mapMode === 'select'
      && store.selectedSystemId === previousSelectedSystemId
      && currentWorkspace !== null
      && currentWorkspace.id === target.workspaceId
      && currentWorkspace.cluster.id === target.clusterId
      && !store.searchOpen
  }

  /** Allows rollback only for a removed destination when no newer navigation command took ownership. */
  function ownsSearchStateAfterTargetRemoval(
    requestId: number,
    target: SearchTarget,
    previousSelectedSystemId: string | null,
  ): boolean {
    const currentWorkspace = workspace.value
    return searchRequestSequence === requestId
      && sameSearchWorkspace(currentWorkspace, target)
      && !searchTargetExists(currentWorkspace, target)
      && store.activeView === 'cluster'
      && store.mapMode === 'select'
      && store.selectedSystemId === previousSelectedSystemId
      && !store.searchOpen
  }

  function survivingSearchSelection(
    selection: EditorUiSelection,
    currentWorkspace: LocalWorkspace | null,
  ): EditorUiSelection {
    if (!currentWorkspace) return selection
    const next = { ...selection }
    const selectedSystem = currentWorkspace.cluster.systems.find(system => system.id === next.selectedSystemId)
    if (!selectedSystem) {
      next.selectedSystemId = currentWorkspace.cluster.systems[0]?.id ?? null
      next.activeView = 'cluster'
      next.selectedObjectId = null
      next.selectedOrbitId = null
    } else {
      if (!selectedSystem.objects.some(object => object.id === next.selectedObjectId)) next.selectedObjectId = null
      if (!selectedSystem.orbits.some(orbit => orbit.id === next.selectedOrbitId)) next.selectedOrbitId = null
    }
    if (!currentWorkspace.cluster.systems.some(system => system.id === next.clusterSelectedSystemId)) {
      next.clusterSelectedSystemId = null
    }
    if (!currentWorkspace.cluster.systems.some(system => system.id === next.inspectedClusterSystemId)) {
      next.inspectedClusterSystemId = null
    }
    if (!currentWorkspace.cluster.routes.some(routeValue => routeValue.id === next.selectedRouteId)) {
      next.selectedRouteId = null
    }
    return next
  }

  function rejectSearchAfterAcceptedState(
    requestId: number,
    acceptedGeneration: number,
    target: SearchTarget,
    reason: 'stale' | 'unavailable',
    initialSelection: EditorUiSelection,
    initialMode: MapInteractionMode,
    initialCompactPanel: ReturnType<typeof useEditorUiStore>['compactPanel'],
    initialSearchOpen: boolean,
  ): { status: 'rejected'; reason: 'stale' | 'unavailable' } {
    const currentWorkspace = workspace.value
    const canRestore = ownsAcceptedSearchState(requestId, acceptedGeneration, target, initialSelection.selectedSystemId)
      || ownsSearchStateAfterTargetRemoval(requestId, target, initialSelection.selectedSystemId)
    if (canRestore) {
      publishingSearchContext = true
      setSelection(survivingSearchSelection(initialSelection, currentWorkspace))
      store.setMode(initialMode)
      store.setCompactPanel(initialCompactPanel)
      store.setSearchOpen(initialSearchOpen)
      publishingSearchContext = false
    }
    return { status: 'rejected', reason }
  }

  /** Performs the one guarded transition for a search result and frames it only after canvas restoration. */
  async function revealSearchTarget(target: SearchTarget): Promise<
    { status: 'revealed' } | { status: 'rejected'; reason: 'guard' | 'stale' | 'unavailable' }
  > {
    const requestId = ++searchRequestSequence
    const startingGeneration = searchContextGeneration
    const currentWorkspace = workspace.value
    if (!searchTargetExists(currentWorkspace, target)) return { status: 'rejected', reason: 'unavailable' }

    const initialSelection: EditorUiSelection = {
      activeView: store.activeView,
      selectedSystemId: store.selectedSystemId,
      clusterSelectedSystemId: store.clusterSelectedSystemId,
      inspectedClusterSystemId: store.inspectedClusterSystemId,
      selectedObjectId: store.selectedObjectId,
      selectedOrbitId: store.selectedOrbitId,
      selectedRouteId: store.selectedRouteId,
    }
    const initialMode = store.mapMode
    const initialCompactPanel = store.compactPanel
    const initialSearchOpen = store.searchOpen
    const activeMap = store.activeView === 'cluster' ? mapControls.clusterMapRef.value : mapControls.systemMapRef.value
    activeMap?.cancelActiveGesture()

    const chartSessionMatches = target.kind === 'system' && chart.session.value?.systemId === target.systemId
    const accepted = await transitions.resolveTransition({
      leaveChart: !chartSessionMatches,
      leaveEntitySession: true,
    })
    if (searchRequestSequence !== requestId) return { status: 'rejected', reason: 'stale' }
    if (!accepted) return { status: 'rejected', reason: 'guard' }
    if (searchContextGeneration !== startingGeneration) return { status: 'rejected', reason: 'stale' }

    const latestWorkspace = workspace.value
    if (!searchTargetExists(latestWorkspace, target)) return { status: 'rejected', reason: 'unavailable' }
    if (!latestWorkspace) return { status: 'rejected', reason: 'unavailable' }

    mapControls.captureActiveMap()
    publishingSearchContext = true
    if (target.kind === 'cluster') {
      setSelection({ activeView: 'cluster' })
      restoreActiveSelection()
    } else {
      setSelection({
        activeView: 'cluster',
        clusterSelectedSystemId: target.systemId,
        inspectedClusterSystemId: null,
        selectedObjectId: null,
        selectedOrbitId: null,
        selectedRouteId: null,
      })
    }
    store.setMode('select')
    if (viewport.isCompactViewport.value) store.setCompactPanel(null)
    store.setSearchOpen(false)
    publishingSearchContext = false
    const acceptedGeneration = searchContextGeneration

    await nextTick()
    const workspaceAfterMount = workspace.value
    if (searchRequestSequence !== requestId) return { status: 'rejected', reason: 'stale' }
    if (!sameSearchWorkspace(workspaceAfterMount, target)) return { status: 'rejected', reason: 'stale' }
    if (!searchTargetExists(workspaceAfterMount, target)) {
      return rejectSearchAfterAcceptedState(
        requestId, acceptedGeneration, target, 'unavailable', initialSelection, initialMode,
        initialCompactPanel, initialSearchOpen,
      )
    }
    if (!ownsAcceptedSearchState(requestId, acceptedGeneration, target, initialSelection.selectedSystemId)) {
      return { status: 'rejected', reason: 'stale' }
    }

    const clusterMap = mapControls.clusterMapRef.value
    if (!clusterMap?.whenReady || !await clusterMap.whenReady()) {
      return rejectSearchAfterAcceptedState(
        requestId, acceptedGeneration, target, 'unavailable', initialSelection, initialMode,
        initialCompactPanel, initialSearchOpen,
      )
    }
    await options.waitForSearchPresentation?.()
    await nextTick()
    if (typeof requestAnimationFrame === 'function') {
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
    }
    const latestSearchWorkspace = workspace.value
    if (searchRequestSequence !== requestId) return { status: 'rejected', reason: 'stale' }
    if (!sameSearchWorkspace(latestSearchWorkspace, target)) return { status: 'rejected', reason: 'stale' }
    if (!searchTargetExists(latestSearchWorkspace, target)) {
      return rejectSearchAfterAcceptedState(
        requestId, acceptedGeneration, target, 'unavailable', initialSelection, initialMode,
        initialCompactPanel, initialSearchOpen,
      )
    }
    if (!ownsAcceptedSearchState(requestId, acceptedGeneration, target, initialSelection.selectedSystemId)) {
      return { status: 'rejected', reason: 'stale' }
    }
    if (!clusterMap.frameSearchTarget?.(target)) {
      return rejectSearchAfterAcceptedState(
        requestId, acceptedGeneration, target, 'unavailable', initialSelection, initialMode,
        initialCompactPanel, initialSearchOpen,
      )
    }
    if (!ownsAcceptedSearchState(requestId, acceptedGeneration, target, initialSelection.selectedSystemId)) {
      return { status: 'rejected', reason: 'stale' }
    }
    clusterMap.focusMap?.()
    editorError.value = ''
    return { status: 'revealed' }
  }

  async function selectObject(
    objectId: string,
    openInspector = true,
    transitionOptions: TransitionOptions = {},
  ): Promise<void> {
    invalidatePendingSearchReveal()
    const currentWorkspace = workspace.value
    const clusterId = currentWorkspace?.cluster.id
    const systemId = store.selectedSystemId
    const entryView = store.activeView
    if (!clusterId || entryView !== 'system' || !systemId) return
    const entrySystem = currentWorkspace.cluster.systems.find(system => system.id === systemId)
    if (!entrySystem?.objects.some(object => object.id === objectId)) return
    if (store.selectedObjectId === objectId) {
      if (options.beforeWorkspaceOperation && !await options.beforeWorkspaceOperation()) return
      if (openInspector) viewport.requestPanel('inspector')
      return
    }
    const startingStamp = navigationContextStamp()
    const startingSessionId = chart.session.value?.id ?? null
    const returningToDraft = entity.isEntityDraftTarget('object', objectId)
    if (!await transitions.resolveTransition({
      ...transitionOptions,
      leaveEntitySession: transitionOptions.leaveEntitySession ?? !returningToDraft,
    })) return
    const latestWorkspace = workspace.value
    if (!latestWorkspace || !acceptNavigationTransition(startingStamp, startingSessionId)
      || latestWorkspace.cluster.id !== clusterId || store.selectedSystemId !== systemId
      || store.activeView !== entryView || store.activeView !== 'system') return
    const latestSystem = latestWorkspace.cluster.systems.find(system => system.id === systemId)
    if (!latestSystem?.objects.some(object => object.id === objectId)) return
    setSelection({ selectedObjectId: objectId, selectedOrbitId: null, selectedRouteId: null })
    storeCurrentSelection()
    if (openInspector) viewport.requestPanel('inspector')
    editorError.value = ''
  }

  async function selectOrbit(orbitId: string, openInspector = true): Promise<void> {
    invalidatePendingSearchReveal()
    const currentWorkspace = workspace.value
    const clusterId = currentWorkspace?.cluster.id
    const systemId = store.selectedSystemId
    const entryView = store.activeView
    if (!clusterId || entryView !== 'system' || !systemId) return
    const entrySystem = currentWorkspace.cluster.systems.find(system => system.id === systemId)
    if (!entrySystem?.orbits.some(orbit => orbit.id === orbitId)) return
    if (store.selectedOrbitId === orbitId) {
      if (options.beforeWorkspaceOperation && !await options.beforeWorkspaceOperation()) return
      if (openInspector) viewport.requestPanel('inspector')
      return
    }
    const startingStamp = navigationContextStamp()
    const startingSessionId = chart.session.value?.id ?? null
    const returningToDraft = entity.isEntityDraftTarget('orbit', orbitId)
    if (!await transitions.resolveTransition({ leaveEntitySession: !returningToDraft })) return
    const latestWorkspace = workspace.value
    if (!latestWorkspace || !acceptNavigationTransition(startingStamp, startingSessionId)
      || latestWorkspace.cluster.id !== clusterId || store.selectedSystemId !== systemId
      || store.activeView !== entryView || store.activeView !== 'system') return
    const latestSystem = latestWorkspace.cluster.systems.find(system => system.id === systemId)
    if (!latestSystem?.orbits.some(orbit => orbit.id === orbitId)) return
    setSelection({ selectedOrbitId: orbitId, selectedObjectId: null, selectedRouteId: null })
    storeCurrentSelection()
    if (openInspector) viewport.requestPanel('inspector')
    editorError.value = ''
  }

  async function selectRoute(routeId: string, openInspector = true): Promise<void> {
    invalidatePendingSearchReveal()
    const currentWorkspace = workspace.value
    const clusterId = currentWorkspace?.cluster.id
    const systemId = store.selectedSystemId
    const entryView = store.activeView
    if (!currentWorkspace || !clusterId || entryView !== 'cluster') return
    const targetRoute = currentWorkspace.cluster.routes.find(candidate => candidate.id === routeId)
    if (!targetRoute) return
    if (store.selectedRouteId === routeId) {
      if (options.beforeWorkspaceOperation && !await options.beforeWorkspaceOperation()) return
      if (openInspector) viewport.requestPanel('inspector')
      return
    }
    const startingStamp = navigationContextStamp()
    const startingSessionId = chart.session.value?.id ?? null
    if (!await transitions.resolveTransition()) return
    const latestWorkspace = workspace.value
    if (!latestWorkspace || !acceptNavigationTransition(startingStamp, startingSessionId)
      || latestWorkspace.cluster.id !== clusterId || store.selectedSystemId !== systemId
      || store.activeView !== entryView || store.activeView !== 'cluster'
      || !latestWorkspace.cluster.routes.some(candidate => candidate.id === routeId)) return
    setSelection({
      selectedRouteId: targetRoute.id,
      selectedObjectId: null,
      selectedOrbitId: null,
      clusterSelectedSystemId: null,
      inspectedClusterSystemId: null,
    })
    storeCurrentSelection()
    if (openInspector) viewport.requestPanel('inspector')
    editorError.value = ''
  }

  /** Resumes a hidden draft only when its captured session is still current. */
  function resumeEntitySession(sessionId: number): void {
    const session = entity.entitySession.value
    if (!session || session.id !== sessionId) return
    if (session.kind === 'object') void selectObject(session.targetId)
    else void selectOrbit(session.targetId)
  }

  async function showChartDetails(): Promise<void> {
    const startingStamp = navigationContextStamp()
    const startingSessionId = chart.session.value?.id ?? null
    if (!await transitions.resolveTransition({ leaveChart: false })
      || !acceptNavigationTransition(startingStamp, startingSessionId)) return
    setSelection({
      selectedObjectId: null,
      selectedOrbitId: null,
      selectedRouteId: null,
      clusterSelectedSystemId: null,
      inspectedClusterSystemId: null,
    })
    storeCurrentSelection()
    editorError.value = ''
  }

  function cleanupAfterDeletion(plan: MapDeletionPlan): void {
    const removedSystems = new Set(plan.removedSystemIds)
    const removedObjects = new Set(plan.removedObjectIds)
    const removedOrbits = new Set(plan.removedOrbitIds)
    const removedRoutes = new Set(plan.removedRouteIds)
    const currentWorkspace = workspace.value
    if (!currentWorkspace) return
    const next: Partial<EditorUiSelection> = {}
    if (store.selectedSystemId && removedSystems.has(store.selectedSystemId)) {
      next.selectedSystemId = currentWorkspace.cluster.systems[0]?.id ?? null
    }
    if (store.clusterSelectedSystemId && removedSystems.has(store.clusterSelectedSystemId)) next.clusterSelectedSystemId = null
    if (store.inspectedClusterSystemId && removedSystems.has(store.inspectedClusterSystemId)) next.inspectedClusterSystemId = null
    if (store.selectedObjectId && removedObjects.has(store.selectedObjectId)) next.selectedObjectId = null
    if (store.selectedOrbitId && removedOrbits.has(store.selectedOrbitId)) next.selectedOrbitId = null
    if (store.selectedRouteId && removedRoutes.has(store.selectedRouteId)) next.selectedRouteId = null
    if (Object.keys(next).length) setSelection(next)

    const entityDraft = entity.entitySession.value
    if (entityDraft && (removedSystems.has(entityDraft.systemId)
      || (entityDraft.kind === 'object' ? removedObjects : removedOrbits).has(entityDraft.targetId))) {
      entity.discardEntitySession(entityDraft.id)
    }
    const routeDraft = route.routeSession.value
    if (routeDraft && ((routeDraft.routeId && removedRoutes.has(routeDraft.routeId))
      || [...plan.removedObjectIds].some(id => [
        routeDraft.initial.fromPointId,
        routeDraft.initial.toPointId,
        routeDraft.draft.fromPointId,
        routeDraft.draft.toPointId,
      ].includes(id)))) route.discardRouteSession(routeDraft.id)

    mapControls.pruneVisits((key, selection) => mapControls.validVisitSelection(key, selection))
    storeCurrentSelection()
  }

  function retainedTargetExists(target: WorkspaceMutationTarget | undefined): MapHistoryTarget | null {
    const current = workspace.value
    if (!current || !target) return null
    if (target.kind === 'system') {
      return current.cluster.systems.some(system => system.id === target.id)
        ? { kind: 'system', id: target.id }
        : null
    }
    if (target.kind === 'route') {
      return current.cluster.routes.some(routeValue => routeValue.id === target.id)
        ? { kind: 'route', id: target.id }
        : null
    }
    if (target.kind === 'object' || target.kind === 'orbit') {
      const system = current.cluster.systems.find(value => value.id === target.systemId)
      const exists = target.kind === 'object'
        ? system?.objects.some(value => value.id === target.id)
        : system?.orbits.some(value => value.id === target.id)
      return exists ? { kind: target.kind, id: target.id, systemId: target.systemId } : null
    }
    return null
  }

  /** Reveals a traversal's surviving target without resolving drafts or restoring map visits/panels. */
  async function revealHistoryContext(context: WorkspaceHistoryTraversalContext): Promise<void> {
    const { action } = context
    const workspaceAtSelection = workspace.value
    const initiatingFocus = typeof document === 'undefined' ? null : document.activeElement
    if (action.target.kind === 'field') {
      const acceptedContextStamp = navigationContextStamp()
      await nextTick()
      if (workspace.value !== workspaceAtSelection || navigationContextStamp() !== acceptedContextStamp) return
      if (typeof HTMLElement !== 'undefined'
        && initiatingFocus instanceof HTMLElement
        && initiatingFocus.isConnected
        && !initiatingFocus.hasAttribute('disabled')) {
        initiatingFocus.focus({ preventScroll: true })
      } else {
        mapControls.focusActiveMap()
      }
      editorError.value = ''
      return
    }

    const target = retainedTargetExists(action.target) ?? retainedTargetExists(action.parent ?? undefined)
    const targetKind = target?.kind ?? action.target.kind
    const systemId = target && (target.kind === 'object' || target.kind === 'orbit')
      ? target.systemId
      : action.target.kind === 'object' || action.target.kind === 'orbit'
        ? action.target.systemId
        : target?.kind === 'system'
          ? target.id
          : store.selectedSystemId

    if (targetKind === 'object' || targetKind === 'orbit' || action.target.kind === 'object' || action.target.kind === 'orbit') {
      const survivingSystemId = workspace.value?.cluster.systems.some(system => system.id === systemId)
        ? systemId
        : workspace.value?.cluster.systems[0]?.id ?? null
      setSelection({
        activeView: 'system',
        selectedSystemId: survivingSystemId,
        selectedObjectId: target?.kind === 'object' ? target.id : null,
        selectedOrbitId: target?.kind === 'orbit' ? target.id : null,
        selectedRouteId: null,
        clusterSelectedSystemId: null,
        inspectedClusterSystemId: null,
      })
    } else {
      setSelection({
        activeView: 'cluster',
        selectedSystemId: workspace.value?.cluster.systems.some(system => system.id === store.selectedSystemId)
          ? store.selectedSystemId
          : workspace.value?.cluster.systems[0]?.id ?? null,
        selectedRouteId: target?.kind === 'route' ? target.id : null,
        selectedObjectId: null,
        selectedOrbitId: null,
        clusterSelectedSystemId: target?.kind === 'system' ? target.id : null,
        inspectedClusterSystemId: null,
      })
    }

    const acceptedContextStamp = navigationContextStamp()
    await nextTick()
    if (workspace.value !== workspaceAtSelection || navigationContextStamp() !== acceptedContextStamp) return
    if (typeof requestAnimationFrame === 'function') {
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
      if (workspace.value !== workspaceAtSelection || navigationContextStamp() !== acceptedContextStamp) return
    }
    if (typeof HTMLElement !== 'undefined'
      && initiatingFocus instanceof HTMLElement
      && initiatingFocus.isConnected
      && !initiatingFocus.hasAttribute('disabled')) {
      initiatingFocus.focus({ preventScroll: true })
    } else {
      mapControls.focusActiveMap()
    }
    if (target) mapControls.revealHistoryTarget(target)
    editorError.value = ''
  }

  return {
    activeView,
    mapMode,
    selectedSystemId,
    clusterSelectedSystemId,
    selectedObjectId,
    selectedOrbitId,
    selectedRouteId,
    selectedSystem,
    clusterSelectedSystem,
    inspectedClusterSystem,
    selectedObject,
    selectedOrbit,
    selectedRoute,
    routeEndpointSummary,
    beginChartNamesEdit,
    isChartDraftTarget,
    showClusterMap,
    selectSystem,
    selectClusterSystem,
    selectObject,
    selectOrbit,
    selectRoute,
    resumeEntitySession,
    showChartDetails,
    cleanupAfterDeletion,
    revealHistoryContext,
    revealSearchTarget,
    setMapMode,
    isEntityCommandBlocked: (command: EntityCommand) => entity.isEntityCommandBlocked(command),
  }
}
