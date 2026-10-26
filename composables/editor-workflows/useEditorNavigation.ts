import { computed, watch, type Ref } from 'vue'
import {
  jumpPointsInCluster,
  type JumpRoute,
  type LocalWorkspace,
  type MapDeletionPlan,
} from '../../domain/workspace'
import type { EditorUiSelection, useEditorUiStore } from '../../stores/editor-ui'
import type { EntityCommand, MapInteractionMode, TransitionOptions } from './types'
import type { useEditorMapControls } from './useEditorMapControls'
import type { useChartNamesSession } from './useChartNamesSession'
import type { useEditorTransitions } from './useEditorTransitions'
import type { useEditorViewport } from './useEditorViewport'
import type { useEntityInspectorSession } from './useEntityInspectorSession'
import type { useRouteInspectorSession } from './useRouteInspectorSession'

type EditorUiStore = ReturnType<typeof useEditorUiStore>
type MapControls = ReturnType<typeof useEditorMapControls>
type ChartController = ReturnType<typeof useChartNamesSession>
type Transitions = ReturnType<typeof useEditorTransitions>
type EntityController = ReturnType<typeof useEntityInspectorSession>
type RouteController = ReturnType<typeof useRouteInspectorSession>

/** Owns guarded navigation and selection restoration; accepted state is published through focused Pinia actions. */
export function useEditorNavigation(options: {
  workspace: Readonly<Ref<LocalWorkspace | null>>
  store: EditorUiStore
  mapControls: MapControls
  chart: ChartController
  transitions: Transitions
  viewport: ReturnType<typeof useEditorViewport>
  entity: EntityController
  route: RouteController
  editorError: Ref<string>
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

  function setMapMode(mode: MapInteractionMode): void { store.setMode(mode) }

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
    const startingStamp = navigationContextStamp()
    const startingSessionId = chart.session.value?.id ?? null
    if (!await transitions.resolveTransition() || !acceptNavigationTransition(startingStamp, startingSessionId)) return
    setSelection({ activeView: 'cluster' })
    store.setMode('select')
    restoreActiveSelection()
    editorError.value = ''
  }

  async function selectSystem(systemId: string): Promise<void> {
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

  async function selectObject(
    objectId: string,
    openInspector = true,
    transitionOptions: TransitionOptions = {},
  ): Promise<void> {
    const currentWorkspace = workspace.value
    const clusterId = currentWorkspace?.cluster.id
    const systemId = store.selectedSystemId
    const entryView = store.activeView
    if (!clusterId || entryView !== 'system' || !systemId) return
    const entrySystem = currentWorkspace.cluster.systems.find(system => system.id === systemId)
    if (!entrySystem?.objects.some(object => object.id === objectId)) return
    if (store.selectedObjectId === objectId) {
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
    const currentWorkspace = workspace.value
    const clusterId = currentWorkspace?.cluster.id
    const systemId = store.selectedSystemId
    const entryView = store.activeView
    if (!clusterId || entryView !== 'system' || !systemId) return
    const entrySystem = currentWorkspace.cluster.systems.find(system => system.id === systemId)
    if (!entrySystem?.orbits.some(orbit => orbit.id === orbitId)) return
    if (store.selectedOrbitId === orbitId) {
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
    const currentWorkspace = workspace.value
    const clusterId = currentWorkspace?.cluster.id
    const systemId = store.selectedSystemId
    const entryView = store.activeView
    if (!currentWorkspace || !clusterId || entryView !== 'cluster') return
    const targetRoute = currentWorkspace.cluster.routes.find(candidate => candidate.id === routeId)
    if (!targetRoute) return
    if (store.selectedRouteId === routeId) {
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
    setMapMode,
    isEntityCommandBlocked: (command: EntityCommand) => entity.isEntityCommandBlocked(command),
  }
}
