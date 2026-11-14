import { computed, nextTick, watch, type Ref } from 'vue'
import {
  jumpPointsInCluster,
  type JumpRoute,
  type LocalWorkspace,
  type MapDeletionPlan,
} from '../../domain/workspace'
import type { EditorUiSelection, useEditorUiStore } from '../../stores/editor-ui'
import type { EntityCommand, MapHistoryTarget, MapInteractionMode, SearchPresentationSettlement, TransitionOptions } from './types'
import type { WorkspaceHistoryTraversalContext, WorkspaceMutationTarget } from './workspace-mutations'
import type { useEditorMapControls } from './useEditorMapControls'
import type { useChartNamesSession } from './useChartNamesSession'
import type { useEditorTransitions } from './useEditorTransitions'
import type { useEditorViewport } from './useEditorViewport'
import type { useEntityInspectorSession } from './useEntityInspectorSession'
import type { useRouteInspectorSession } from './useRouteInspectorSession'
import { snapshotEditorSelection } from './editor-selection-snapshot'
import { useWardenSearchReveal } from './useWardenSearchReveal'

type EditorUiStore = ReturnType<typeof useEditorUiStore>
type MapControls = ReturnType<typeof useEditorMapControls>
type ChartController = ReturnType<typeof useChartNamesSession>
type Transitions = ReturnType<typeof useEditorTransitions>
type EntityController = ReturnType<typeof useEntityInspectorSession>
type RouteController = ReturnType<typeof useRouteInspectorSession>
/** Owns guarded navigation and selection restoration; accepted state is published through focused Pinia actions. */
export function useEditorNavigation(options: {
  workspace: Readonly<Ref<LocalWorkspace | null>>
  waitForSearchPresentation?: (signal: AbortSignal) => Promise<SearchPresentationSettlement>
  captureAddCleanup: () => (() => void) | null
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
  const selectedObjectIds = computed(() => store.selectedObjectIds)
  const selectedOrbitId = computed(() => store.selectedOrbitId)
  const selectedRouteId = computed(() => store.selectedRouteId)
  const selectedSystem = computed(() => workspace.value?.cluster.systems.find(system => system.id === store.selectedSystemId))
  const clusterSelectedSystem = computed(() => workspace.value?.cluster.systems.find(system => system.id === store.clusterSelectedSystemId))
  const inspectedClusterSystem = computed(() => workspace.value?.cluster.systems.find(system => system.id === store.inspectedClusterSystemId))
  const selectedObject = computed(() => selectedSystem.value?.objects.find(object => object.id === store.selectedObjectId))
  const selectedOrbit = computed(() => selectedSystem.value?.orbits.find(orbit => orbit.id === store.selectedOrbitId))
  const selectedRoute = computed(() => workspace.value?.cluster.routes.find(item => item.id === store.selectedRouteId))
  const jumpPoints = computed(() => workspace.value ? jumpPointsInCluster(workspace.value.cluster) : [])
  const searchReveal = useWardenSearchReveal({
    workspace,
    store,
    mapControls,
    resolveTransition: transitions.resolveTransition,
    getChartSession: () => chart.session.value,
    getEntitySession: () => entity.entitySession.value,
    compactViewport: viewport.isCompactViewport,
    editorError,
    setSelection,
    restoreActiveSelection,
    waitForSearchPresentation: options.waitForSearchPresentation,
    captureAddCleanup: options.captureAddCleanup,
  })
  const invalidatePendingSearchReveal = searchReveal.invalidatePendingSearchReveal
  const revealSearchTarget = searchReveal.revealSearchTarget
  function setSelection(patch: Partial<EditorUiSelection>): void {
    const changesObjectContext = ['activeView', 'selectedSystemId', 'selectedObjectId', 'selectedOrbitId', 'selectedRouteId']
      .some(key => Object.hasOwn(patch, key))
    const providesObjectIds = Object.hasOwn(patch, 'selectedObjectIds')
    const requestedObjectIds = patch.selectedObjectIds ?? store.selectedObjectIds
    const nextObjectIds = changesObjectContext && !providesObjectIds && requestedObjectIds.length
      ? []
      : requestedObjectIds
    const objectIdsUnchanged = nextObjectIds.length === store.selectedObjectIds.length
      && nextObjectIds.every((id, index) => id === store.selectedObjectIds[index])
    const stableObjectIds = objectIdsUnchanged ? store.selectedObjectIds : nextObjectIds
    const next: EditorUiSelection = {
      activeView: store.activeView,
      selectedSystemId: store.selectedSystemId,
      clusterSelectedSystemId: store.clusterSelectedSystemId,
      inspectedClusterSystemId: store.inspectedClusterSystemId,
      selectedObjectId: store.selectedObjectId,
      selectedOrbitId: store.selectedOrbitId,
      selectedRouteId: store.selectedRouteId,
      ...patch,
      selectedObjectIds: stableObjectIds,
    }
    store.setSelection(next)
  }

  function navigationContextStamp(): string {
    const selection = snapshotEditorSelection(store)
    return JSON.stringify([
      store.workspaceId,
      workspace.value?.id ?? null,
      workspace.value?.cluster.id ?? null,
      selection.activeView,
      selection.selectedSystemId,
      selection.selectedObjectId,
      selection.selectedObjectIds,
      selection.selectedOrbitId,
      selection.selectedRouteId,
      selection.clusterSelectedSystemId,
      selection.inspectedClusterSystemId,
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
      selectedObjectIds: [],
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

  async function setMapMode(mode: MapInteractionMode, isCurrent: () => boolean = () => true): Promise<boolean> {
    invalidatePendingSearchReveal()
    if (options.beforeWorkspaceOperation && !await options.beforeWorkspaceOperation()) return false
    if (!isCurrent()) return false
    if (store.activeView === 'system') mapControls.systemMapRef.value?.dismissSearchLocator?.()
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
    if (store.selectedRouteId && !currentWorkspace.cluster.routes.some(item => item.id === store.selectedRouteId)) next.selectedRouteId = null
    if (!currentWorkspace.cluster.systems.some(system => system.id === store.clusterSelectedSystemId)) next.clusterSelectedSystemId = null
    if (!currentWorkspace.cluster.systems.some(system => system.id === store.inspectedClusterSystemId)) next.inspectedClusterSystemId = null
    if (Object.keys(next).length) setSelection(next)
    mapControls.pruneVisits(mapControls.validVisitSelection)
  }, { immediate: true })

  watch(selectedSystem, currentSystem => {
    if (!currentSystem) {
      if (store.selectedObjectId || store.selectedObjectIds.length || store.selectedOrbitId) {
        setSelection({ selectedObjectId: null, selectedObjectIds: [], selectedOrbitId: null })
      }
      return
    }
    const next: Partial<EditorUiSelection> = {}
    if (store.selectedObjectId && !currentSystem.objects.some(object => object.id === store.selectedObjectId)) next.selectedObjectId = null
    const survivingObjectIds = store.selectedObjectIds.filter(id => currentSystem.objects.some(object => object.id === id))
    if (survivingObjectIds.length !== store.selectedObjectIds.length) next.selectedObjectIds = survivingObjectIds
    if (survivingObjectIds.length === 1) {
      next.selectedObjectId = survivingObjectIds[0]!
      next.selectedObjectIds = []
    } else if (survivingObjectIds.length === 0 && store.selectedObjectIds.length) {
      next.selectedObjectId = null
    }
    if (store.selectedOrbitId && !currentSystem.orbits.some(orbit => orbit.id === store.selectedOrbitId)) next.selectedOrbitId = null
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
      viewport.requestPanel('inspector')
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
    viewport.requestPanel('inspector')
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

  function currentObjectSelection(): string[] {
    return store.selectedObjectIds.length
      ? [...store.selectedObjectIds]
      : store.selectedObjectId ? [store.selectedObjectId] : []
  }

  async function replaceObjectSelectionInContext(
    objectIds: readonly string[],
    isCurrent: () => boolean,
    allowContextModes: boolean,
  ): Promise<boolean> {
    if (!isCurrent()) return false
    invalidatePendingSearchReveal()
    const entryMode = store.mapMode
    if (objectIds.length > 0 && entryMode !== 'select' && !allowContextModes) return false
    const currentWorkspace = workspace.value
    const clusterId = currentWorkspace?.cluster.id
    const systemId = store.selectedSystemId
    if (!clusterId || store.activeView !== 'system' || !systemId) return false
    const entrySystem = currentWorkspace.cluster.systems.find(system => system.id === systemId)
    if (!entrySystem) return false
    const availableIds = new Set(entrySystem.objects.map(object => object.id))
    const nextIds = [...new Set(objectIds)].filter(id => availableIds.has(id))
    const currentIds = currentObjectSelection()
    if (currentIds.length === nextIds.length && currentIds.every((id, index) => id === nextIds[index])) return isCurrent()
    if (nextIds.length === 0 && currentIds.length === 0) return false

    const startingStamp = navigationContextStamp()
    const startingSessionId = chart.session.value?.id ?? null
    const returningToDraft = nextIds.length === 1 && entity.isEntityDraftTarget('object', nextIds[0]!)
    if (!await transitions.resolveTransition({ leaveEntitySession: !returningToDraft }, isCurrent)) return false
    const latestWorkspace = workspace.value
    if (!latestWorkspace || !acceptNavigationTransition(startingStamp, startingSessionId)
      || latestWorkspace.cluster.id !== clusterId || store.selectedSystemId !== systemId
      || store.activeView !== 'system' || store.mapMode !== entryMode || !isCurrent()) return false
    const latestSystem = latestWorkspace.cluster.systems.find(system => system.id === systemId)
    if (!latestSystem || nextIds.some(id => !latestSystem.objects.some(object => object.id === id))) return false

    setSelection({
      selectedObjectId: nextIds.length === 1 ? nextIds[0]! : null,
      selectedObjectIds: nextIds.length > 1 ? nextIds : [],
      selectedOrbitId: null,
      selectedRouteId: null,
    })
    storeCurrentSelection()
    editorError.value = ''
    return true
  }

  /** Replaces the transient map selection through the Select-mode draft and context guard. */
  async function replaceObjectSelection(
    objectIds: readonly string[],
    isCurrent: () => boolean = () => true,
  ): Promise<boolean> {
    return replaceObjectSelectionInContext(objectIds, isCurrent, false)
  }

  /** Selects a context-menu target without collapsing a multiple selection that already contains it. */
  async function selectContextObject(objectId: string, isCurrent: () => boolean): Promise<boolean> {
    if (!isCurrent()) return false
    if (currentObjectSelection().includes(objectId)) return true
    return replaceObjectSelectionInContext([objectId], isCurrent, true)
  }

  /** Adds or removes one object from the shared map and Hierarchy selection. */
  async function toggleObjectSelection(objectId: string): Promise<void> {
    if (store.mapMode !== 'select') return
    const currentIds = currentObjectSelection()
    const nextIds = currentIds.includes(objectId)
      ? currentIds.filter(id => id !== objectId)
      : [...currentIds, objectId]
    await replaceObjectSelection(nextIds)
  }

  /** Clears a multiple selection only while an active-system Move drag owns an outside object. */
  function clearObjectSelectionForMove(expectedObjectIds: readonly string[]): boolean {
    if (store.activeView !== 'system' || store.mapMode !== 'move'
      || store.selectedObjectIds.length < 2
      || store.selectedObjectIds.length !== expectedObjectIds.length
      || !expectedObjectIds.every((id, index) => store.selectedObjectIds[index] === id)) return false
    const currentWorkspace = workspace.value
    const systemId = store.selectedSystemId
    const system = currentWorkspace?.cluster.systems.find(candidate => candidate.id === systemId)
    if (!system || store.selectedObjectIds.some(id => !system.objects.some(object => object.id === id))) return false
    setSelection({ selectedObjectId: null, selectedObjectIds: [] })
    storeCurrentSelection()
    editorError.value = ''
    return true
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
      selectedObjectIds: [],
      selectedOrbitId: null,
      selectedRouteId: null,
    })
    chart.hideEditing()
    storeCurrentSelection()
    viewport.requestPanel('inspector')
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
    const survivingObjectIds = store.selectedObjectIds.filter(id => !removedObjects.has(id))
    if (survivingObjectIds.length !== store.selectedObjectIds.length) {
      next.selectedObjectIds = survivingObjectIds.length > 1 ? survivingObjectIds : []
      if (survivingObjectIds.length === 1) next.selectedObjectId = survivingObjectIds[0]!
      else if (survivingObjectIds.length === 0) next.selectedObjectId = null
    }
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
    selectedObjectIds,
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
    replaceObjectSelection,
    selectContextObject,
    toggleObjectSelection,
    clearObjectSelectionForMove,
    selectOrbit,
    selectRoute,
    resumeEntitySession,
    showChartDetails,
    cleanupAfterDeletion,
    revealHistoryContext,
    revealSearchTarget,
    isSearchContextChangeHeld: searchReveal.isContextChangeHeld,
    setMapMode,
    isEntityCommandBlocked: (command: EntityCommand) => entity.isEntityCommandBlocked(command),
  }
}
