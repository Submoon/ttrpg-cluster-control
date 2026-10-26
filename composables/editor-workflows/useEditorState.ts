/**
 * Owns chart names, selection, and navigation guards; workspace persistence remains on the injected commit.
 */
import { computed, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue'
import {
  createLocalWorkspace,
  jumpPointsInCluster,
  renameLocalWorkspace,
  type MapDeletionPlan,
  type JumpRoute,
} from '../../domain/workspace'
import type {
  EditorWorkflowOptions,
  MapInteractionMode,
  MapInspectorHandle,
  MapNavigationHandle,
  MapVisitMemory,
  MapVisitSelection,
  SystemMapHandle,
  TransitionDecision,
  TransitionGuard,
  TransitionOptions,
  WorkspacePanel,
  EntityCommand,
} from './types'
import { MAP_ZOOM_MAX_SCALE, MAP_ZOOM_MIN_SCALE, type MapViewport } from '../../utils/map-zoom'
import { useEntityInspectorSession } from './useEntityInspectorSession'
import { useRouteInspectorSession } from './useRouteInspectorSession'

/**
 * Derives editor selections from workspace IDs and keeps navigation coherent as entities change.
 * @param options Shared workspace/save refs and the page-owned persistence callback.
 * @returns Name drafts, selection refs/computeds, map handles, status text, and guarded navigation actions.
 */
export function useEditorState({ workspace, saveState, saveError, commit, applyWorkspace }: EditorWorkflowOptions) {
  const clusterName = ref('New Jump Cluster')
  const systemName = ref('First System')
  const activeView = ref<'cluster' | 'system'>('system')
  const mapMode = ref<MapInteractionMode>('select')
  const selectedSystemId = ref<string | null>(null)
  const clusterSelectedSystemId = ref<string | null>(null)
  const inspectedClusterSystemId = ref<string | null>(null)
  const selectedObjectId = ref<string | null>(null)
  const selectedOrbitId = ref<string | null>(null)
  const selectedRouteId = ref<string | null>(null)
  const chartNamesEditing = ref(false)
  const transitionGuard = ref<TransitionGuard>(null)
  const hierarchyPanelOpen = ref(false)
  const inspectorPanelOpen = ref(true)
  const compactPanel = ref<WorkspacePanel | null>(null)
  const isCompactViewport = ref(false)
  const formError = ref('')
  const editorError = ref('')
  const chartNamesSession = shallowRef<{
    id: number
    clusterId: string
    systemId: string
    initialClusterName: string
    initialSystemName: string
  } | null>(null)
  let chartNamesSessionSequence = 0
  let pendingTransition: {
    leaveChart: boolean
    leaveEntitySession: boolean
    leaveRouteSession: boolean
    resolve: (accepted: boolean) => void
  } | null = null
  const mapInspectorRef = shallowRef<MapInspectorHandle | null>(null)
  const clusterMapRef = shallowRef<MapNavigationHandle | null>(null)
  const systemMapRef = shallowRef<SystemMapHandle | null>(null)
  const mapVisits = shallowRef(new Map<string, MapVisitMemory>())
  let lastRequestedPanel: WorkspacePanel = 'inspector'

  const activeMapKey = computed(() => {
    const clusterId = workspace.value?.cluster.id
    if (!clusterId) return null
    if (activeView.value === 'cluster') return `cluster:${clusterId}`
    return selectedSystemId.value ? `system:${clusterId}:${selectedSystemId.value}` : null
  })
  const initialViewport = computed(() => {
    const key = activeMapKey.value
    return key ? mapVisits.value.get(key)?.viewport ?? null : null
  })
  const zoomLevel = computed(() => Math.round((initialViewport.value?.k ?? 1) * 100))
  const hierarchyPanelVisible = computed(() => hierarchyPanelOpen.value
    && (!isCompactViewport.value || compactPanel.value === 'hierarchy'))
  const inspectorPanelVisible = computed(() => inspectorPanelOpen.value
    && (!isCompactViewport.value || compactPanel.value === 'inspector'))
  const compactPanelOpen = computed(() => isCompactViewport.value
    && (hierarchyPanelVisible.value || inspectorPanelVisible.value))

  function navigationContextStamp(): string {
    return JSON.stringify([
      workspace.value?.cluster.id ?? null,
      activeView.value,
      selectedSystemId.value,
      selectedObjectId.value,
      selectedOrbitId.value,
      selectedRouteId.value,
      clusterSelectedSystemId.value,
      inspectedClusterSystemId.value,
    ])
  }

  function contextStamp(): string {
    return JSON.stringify([navigationContextStamp(), chartNamesSession.value?.id ?? null])
  }

  /** Accepts guard-driven cleanup of the current draft, while rejecting a changed map or newly-owned draft. */
  function acceptNavigationTransition(expectedNavigationStamp: string, startingSessionId: number | null): boolean {
    const currentSessionId = chartNamesSession.value?.id ?? null
    if (navigationContextStamp() !== expectedNavigationStamp
      || (currentSessionId !== startingSessionId && currentSessionId !== null)) return false
    captureActiveMap()
    return true
  }

  const selectedSystem = computed(() =>
    workspace.value?.cluster.systems.find(system => system.id === selectedSystemId.value),
  )
  const clusterSelectedSystem = computed(() =>
    workspace.value?.cluster.systems.find(system => system.id === clusterSelectedSystemId.value),
  )
  const inspectedClusterSystem = computed(() =>
    workspace.value?.cluster.systems.find(system => system.id === inspectedClusterSystemId.value),
  )
  const selectedObject = computed(() =>
    selectedSystem.value?.objects.find(object => object.id === selectedObjectId.value),
  )
  const selectedOrbit = computed(() =>
    selectedSystem.value?.orbits.find(orbit => orbit.id === selectedOrbitId.value),
  )
  const selectedRoute = computed(() =>
    workspace.value?.cluster.routes.find(route => route.id === selectedRouteId.value),
  )
  const {
    entitySession,
    hasModifiedEntitySession,
    orbitPlacementPreview,
    beginObjectSession,
    beginOrbitSession,
    offerOrbitCenterCandidates,
    updateOrbitHost,
    previewOrbitPlacement,
    cancelOrbitPlacementPreview,
    applyEntitySession: applyEntitySessionDraft,
    discardEntitySession: discardEntitySessionDraft,
    isEntityCommandBlocked: isEntitySessionCommandBlocked,
    isEntityDraftTarget,
  } = useEntityInspectorSession({ workspace, applyWorkspace })
  const {
    routeSession,
    hasModifiedRouteSession,
    beginRouteSession,
    offerRouteSystems,
    chooseRoutePoint,
    updateRouteInput,
    applyRouteSession: applyRouteSessionDraft,
    discardRouteSession: discardRouteSessionDraft,
    cancelRouteCreation,
    isRouteCommandBlocked,
  } = useRouteInspectorSession({ workspace, applyWorkspace })

  function isEntityCommandBlocked(command: EntityCommand): boolean {
    return isEntitySessionCommandBlocked(command) || isRouteCommandBlocked(command)
  }

  function applyRouteSession(sessionId: number): boolean {
    const applied = applyRouteSessionDraft(sessionId)
    if (applied) editorError.value = ''
    return applied
  }

  function discardRouteSession(sessionId?: number): void {
    discardRouteSessionDraft(sessionId)
    editorError.value = ''
  }

  function applyEntitySession(expectedId?: number): boolean {
    const applied = applyEntitySessionDraft(expectedId)
    if (applied) editorError.value = ''
    return applied
  }

  function discardEntitySession(expectedId?: number): void {
    const active = entitySession.value
    if (!active || (expectedId !== undefined && active.id !== expectedId)) return
    discardEntitySessionDraft(expectedId)
    editorError.value = ''
  }

  const jumpPoints = computed(() =>
    workspace.value ? jumpPointsInCluster(workspace.value.cluster) : [],
  )

  function selectionForActiveMap(): MapVisitSelection {
    if (activeView.value === 'cluster') {
      if (clusterSelectedSystemId.value) {
        return {
          kind: 'system',
          id: clusterSelectedSystemId.value,
          inspect: inspectedClusterSystemId.value === clusterSelectedSystemId.value,
        }
      }
      if (selectedRouteId.value) return { kind: 'route', id: selectedRouteId.value }
      return { kind: 'none' }
    }
    if (selectedObjectId.value) return { kind: 'object', id: selectedObjectId.value }
    if (selectedOrbitId.value) return { kind: 'orbit', id: selectedOrbitId.value }
    return { kind: 'none' }
  }

  function storeVisit(key: string, viewport: MapViewport, selection: MapVisitSelection): void {
    const next = new Map(mapVisits.value)
    next.delete(key)
    next.set(key, { viewport, selection })
    while (next.size > 24) {
      const oldest = next.keys().next().value as string | undefined
      if (!oldest || oldest === activeMapKey.value) break
      next.delete(oldest)
    }
    mapVisits.value = next
  }

  function activeMapHandle(): MapNavigationHandle | null {
    return activeView.value === 'cluster' ? clusterMapRef.value : systemMapRef.value
  }

  function storeCurrentSelection(): void {
    const key = activeMapKey.value
    if (!key) return
    const viewport = activeMapHandle()?.getViewport() ?? mapVisits.value.get(key)?.viewport ?? { x: 0, y: 0, k: 1 }
    storeVisit(key, viewport, selectionForActiveMap())
  }

  /** Captures the current camera and selection before any accepted context assignment. */
  function captureActiveMap(): void {
    const key = activeMapKey.value
    if (!key) return
    const viewport = activeMapHandle()?.getViewport() ?? mapVisits.value.get(key)?.viewport ?? { x: 0, y: 0, k: 1 }
    storeVisit(key, viewport, selectionForActiveMap())
  }

  function validVisitSelection(key: string, selection: MapVisitSelection): MapVisitSelection {
    const currentWorkspace = workspace.value
    if (!currentWorkspace) return { kind: 'none' }
    const systemId = key.startsWith('system:') ? key.slice(key.lastIndexOf(':') + 1) : null
    if (selection.kind === 'system') {
      return key.startsWith('cluster:')
        && currentWorkspace.cluster.systems.some(system => system.id === selection.id)
        ? selection
        : { kind: 'none' }
    }
    if (selection.kind === 'route') {
      return key.startsWith('cluster:')
        && currentWorkspace.cluster.routes.some(route => route.id === selection.id)
        ? selection
        : { kind: 'none' }
    }
    if (selection.kind === 'object') {
      const system = currentWorkspace.cluster.systems.find(candidate => candidate.id === systemId)
      return system?.objects.some(object => object.id === selection.id) ? selection : { kind: 'none' }
    }
    if (selection.kind === 'orbit') {
      const system = currentWorkspace.cluster.systems.find(candidate => candidate.id === systemId)
      return system?.orbits.some(orbit => orbit.id === selection.id) ? selection : { kind: 'none' }
    }
    return selection
  }

  function restoreActiveSelection(): void {
    const key = activeMapKey.value
    const selection = key && mapVisits.value.get(key)
      ? validVisitSelection(key, mapVisits.value.get(key)!.selection)
      : { kind: 'none' as const }
    selectedRouteId.value = null
    selectedObjectId.value = null
    selectedOrbitId.value = null
    clusterSelectedSystemId.value = null
    inspectedClusterSystemId.value = null
    if (activeView.value === 'cluster') {
      if (selection.kind === 'system') {
        clusterSelectedSystemId.value = selection.id
        if (selection.inspect) inspectedClusterSystemId.value = selection.id
      } else if (selection.kind === 'route') {
        selectedRouteId.value = selection.id
      }
    } else if (selection.kind === 'object') {
      selectedObjectId.value = selection.id
    } else if (selection.kind === 'orbit') {
      selectedOrbitId.value = selection.id
    }
  }

  /** Accepts viewport feedback only from the map that still owns the active context. */
  function recordViewport(key: string, viewport: MapViewport): void {
    const currentWorkspace = workspace.value
    if (!currentWorkspace || key !== activeMapKey.value) return
    if (key.startsWith('system:')) {
      const [clusterId, systemId] = key.slice('system:'.length).split(':')
      if (clusterId !== currentWorkspace.cluster.id
        || !currentWorkspace.cluster.systems.some(system => system.id === systemId)) return
    } else if (key !== `cluster:${currentWorkspace.cluster.id}`) {
      return
    }
    if (![viewport.x, viewport.y, viewport.k].every(Number.isFinite)) return
    storeVisit(key, {
      x: viewport.x,
      y: viewport.y,
      k: Math.max(MAP_ZOOM_MIN_SCALE, Math.min(MAP_ZOOM_MAX_SCALE, viewport.k)),
    }, selectionForActiveMap())
  }

  function requestPanel(panel: WorkspacePanel): void {
    lastRequestedPanel = panel
    if (panel === 'hierarchy') hierarchyPanelOpen.value = true
    else inspectorPanelOpen.value = true
    if (isCompactViewport.value) compactPanel.value = panel
  }

  function closePanel(panel: WorkspacePanel): void {
    if (panel === 'hierarchy') hierarchyPanelOpen.value = false
    else inspectorPanelOpen.value = false
    if (compactPanel.value === panel) compactPanel.value = null
  }

  function togglePanel(panel: WorkspacePanel): void {
    const isVisible = panel === 'hierarchy'
      ? hierarchyPanelVisible.value
      : inspectorPanelVisible.value
    if (isVisible) closePanel(panel)
    else requestPanel(panel)
  }

  function setMapMode(mode: MapInteractionMode): void {
    mapMode.value = mode
  }

  function setViewportPercentage(percentage: number): void {
    const map = activeMapHandle()
    if (!map || !Number.isFinite(percentage)) return
    const viewport = map.getViewport()
    map.setViewport({ ...viewport, k: Math.max(MAP_ZOOM_MIN_SCALE, Math.min(MAP_ZOOM_MAX_SCALE, percentage / 100)) })
  }

  function fitActiveMap(): void { activeMapHandle()?.fitMap() }
  function zoomActiveMap(factor: number): void { activeMapHandle()?.zoomBy(factor) }
  function panActiveMap(dx: number, dy: number): void { activeMapHandle()?.panBy(dx, dy) }

  function updateCompactViewport(isCompact: boolean): void {
    const wasCompact = isCompactViewport.value
    isCompactViewport.value = isCompact
    if (isCompact && !wasCompact) {
      if (hierarchyPanelOpen.value && inspectorPanelOpen.value) {
        compactPanel.value = lastRequestedPanel
      } else if (hierarchyPanelOpen.value) {
        compactPanel.value = 'hierarchy'
      } else if (inspectorPanelOpen.value) {
        compactPanel.value = 'inspector'
      } else {
        compactPanel.value = null
      }
    } else if (!isCompact) {
      compactPanel.value = null
    }
  }

  let compactMedia: MediaQueryList | undefined
  const updateCompactFromMedia = (event?: MediaQueryListEvent): void => {
    updateCompactViewport(event?.matches ?? compactMedia?.matches ?? false)
  }
  onMounted(() => {
    compactMedia = window.matchMedia('(max-width: 760px), (max-height: 600px)')
    if (compactMedia.matches) {
      // A compact first visit has no requested panel; default desktop panels are
      // not evidence that the user asked to open one before this component mounted.
      isCompactViewport.value = true
      compactPanel.value = null
    } else {
      updateCompactFromMedia()
    }
    compactMedia.addEventListener('change', updateCompactFromMedia)
  })
  onUnmounted(() => compactMedia?.removeEventListener('change', updateCompactFromMedia))

  /**
   * Formats a route's current endpoints, retaining explicit labels for unresolved or dangling references.
   * @param route Route whose endpoint IDs are summarized.
   * @returns Human-readable endpoint names, including a fallback when either Jump Point is missing.
   */
  function routeEndpointSummary(route: JumpRoute): string {
    const origin = jumpPoints.value.find(({ point }) => point.id === route.fromPointId)
    let destination: string
    if (route.toPointId === null) {
      destination = `Unknown destination: ${route.unresolvedExit}`
    } else {
      const reference = jumpPoints.value.find(({ point }) => point.id === route.toPointId)
      destination = reference
        ? `${reference.point.name} (${reference.system.name})`
        : 'Missing Jump Point'
    }

    const originName = origin ? `${origin.point.name} (${origin.system.name})` : 'Missing Jump Point'
    return `${originName} -> ${destination}`
  }

  const hasChartNameDraft = computed(() => chartNamesSession.value !== null)
  const chartNamesDialogOpen = computed(() => chartNamesEditing.value || transitionGuard.value !== null)
  const chartDraftSystemId = computed(() => chartNamesSession.value?.systemId ?? null)
  const chartDraftSystemName = computed(() => {
    const targetId = chartNamesSession.value?.systemId
    return workspace.value?.cluster.systems.find(system => system.id === targetId)?.name ?? ''
  })
  const hasUncommittedNames = computed(() => {
    const session = chartNamesSession.value
    const currentWorkspace = workspace.value
    const targetStillExists = !!session
      && currentWorkspace?.cluster.id === session.clusterId
      && currentWorkspace.cluster.systems.some(system => system.id === session.systemId)
    return !!session && (!targetStillExists || (
      clusterName.value.trim() !== session.initialClusterName
      || systemName.value.trim() !== session.initialSystemName
    ))
  })
  const saveMessage = computed(() => {
    if (saveState.value === 'saving') {
      return saveError.value
        ? `Saving to this browser. A previous write failed: ${saveError.value}`
        : 'Saving to this browser...'
    }
    if (saveState.value === 'error') return `Not saved. ${saveError.value ?? ''}`
    if (saveState.value === 'saved') return 'Saved on this device'
    return 'No workspace is stored yet'
  })

  watch(workspace, currentWorkspace => {
    if (!currentWorkspace) {
      selectedSystemId.value = null
      selectedObjectId.value = null
      selectedOrbitId.value = null
      selectedRouteId.value = null
      clusterSelectedSystemId.value = null
      inspectedClusterSystemId.value = null
      mapVisits.value = new Map()
      return
    }
    if (!currentWorkspace.cluster.systems.some(system => system.id === selectedSystemId.value)) {
      selectedSystemId.value = currentWorkspace.cluster.systems[0]?.id ?? null
    }
    if (!currentWorkspace.cluster.routes.some(route => route.id === selectedRouteId.value)) {
      selectedRouteId.value = null
    }
    if (!currentWorkspace.cluster.systems.some(system => system.id === clusterSelectedSystemId.value)) {
      clusterSelectedSystemId.value = null
    }
    if (!currentWorkspace.cluster.systems.some(system => system.id === inspectedClusterSystemId.value)) {
      inspectedClusterSystemId.value = null
    }
    const survivingSystemIds = new Set(currentWorkspace.cluster.systems.map(system => system.id))
    const nextVisits = new Map<string, MapVisitMemory>()
    const clusterKeyPrefix = `cluster:${currentWorkspace.cluster.id}`
    const systemKeyPrefix = `system:${currentWorkspace.cluster.id}:`
    for (const [key, visit] of mapVisits.value) {
      if (!key.startsWith(clusterKeyPrefix) && !key.startsWith(systemKeyPrefix)) continue
      if (key.startsWith(systemKeyPrefix)) {
        const systemId = key.slice(systemKeyPrefix.length)
        if (!survivingSystemIds.has(systemId)) continue
      }
      nextVisits.set(key, { ...visit, selection: validVisitSelection(key, visit.selection) })
    }
    mapVisits.value = nextVisits
  }, { immediate: true })

  watch(() => selectedSystem.value, currentSystem => {
    if (!currentSystem) {
      selectedObjectId.value = null
      selectedOrbitId.value = null
      return
    }
    if (!currentSystem.objects.some(object => object.id === selectedObjectId.value)) {
      selectedObjectId.value = null
    }
    if (!currentSystem.orbits.some(orbit => orbit.id === selectedOrbitId.value)) {
      selectedOrbitId.value = null
    }
  })

  watch(() => workspace.value?.cluster.name, value => {
    if (chartNamesSession.value === null && value !== undefined) clusterName.value = value
  }, { immediate: true })
  watch(() => selectedSystem.value?.name, value => {
    if (chartNamesSession.value === null && value !== undefined) systemName.value = value
  }, { immediate: true })

  function errorText(error: unknown): string {
    return error instanceof Error ? error.message : String(error)
  }

  /**
   * Creates the first workspace or renames the current cluster and selected system.
   * An applied chart-name draft ends after synchronous domain validation and memory publication; durability is tracked separately.
   * @returns True when validated names publish to memory; false when validation or publication fails and the draft stays open.
   */
  function applyChartNames(): boolean {
    const currentWorkspace = workspace.value
    const session = chartNamesSession.value
    if (!currentWorkspace || !session) {
      formError.value = 'Start a chart-name edit before applying these names.'
      return false
    }

    try {
      if (currentWorkspace.cluster.id !== session.clusterId) {
        throw new Error('The Jump Cluster for this draft no longer exists.')
      }
      if (!currentWorkspace.cluster.systems.some(system => system.id === session.systemId)) {
        throw new Error('The star system for this draft no longer exists.')
      }
      const nextWorkspace = renameLocalWorkspace(
        currentWorkspace,
        clusterName.value,
        systemName.value,
        session.systemId,
      )
      const { durable } = applyWorkspace(nextWorkspace)
      if (chartNamesSession.value?.id === session.id) {
        chartNamesSession.value = null
        chartNamesEditing.value = false
        formError.value = ''
        syncNamesFromSelectedWorkspace(session.systemId)
      }
      void durable.catch(() => undefined)
      return true
    } catch (error) {
      formError.value = errorText(error)
      chartNamesEditing.value = true
      return false
    }
  }

  async function submitNames(): Promise<void> {
    formError.value = ''
    if (workspace.value) {
      applyChartNames()
      return
    }
    try {
      await commit(createLocalWorkspace(clusterName.value, systemName.value))
    } catch (error) {
      formError.value = errorText(error)
    }
  }

  function syncNamesFromSelectedWorkspace(targetSystemId?: string): void {
    const currentWorkspace = workspace.value
    const system = currentWorkspace?.cluster.systems.find(candidate => candidate.id === targetSystemId)
      ?? selectedSystem.value
    if (currentWorkspace) clusterName.value = currentWorkspace.cluster.name
    if (system) systemName.value = system.name
  }

  /** Starts or resumes a chart-name draft for its explicit system target without changing map context. */
  async function beginChartNamesEdit(targetSystemId?: string): Promise<void> {
    const currentWorkspace = workspace.value
    const targetId = targetSystemId ?? chartNamesSession.value?.systemId ?? selectedSystemId.value
    const system = currentWorkspace?.cluster.systems.find(candidate => candidate.id === targetId)
    if (!currentWorkspace || !system) return
    if (chartNamesSession.value) {
      if (chartNamesSession.value.clusterId === currentWorkspace.cluster.id
        && chartNamesSession.value.systemId === system.id) {
        chartNamesEditing.value = true
        return
      }
    }
    const startingNavigationStamp = navigationContextStamp()
    const startingSessionId = chartNamesSession.value?.id ?? null
    const startingClusterId = currentWorkspace.cluster.id
    if (!await resolveTransition({ leaveChart: chartNamesSession.value !== null })) return
    const latestWorkspace = workspace.value
    const latestSystem = latestWorkspace?.cluster.systems.find(candidate => candidate.id === targetId)
    const latestSessionId = chartNamesSession.value?.id ?? null
    if (navigationContextStamp() !== startingNavigationStamp
      || (latestSessionId !== startingSessionId && latestSessionId !== null)
      || !latestWorkspace
      || latestWorkspace.cluster.id !== startingClusterId
      || !latestSystem) return
    chartNamesSession.value = {
      id: ++chartNamesSessionSequence,
      clusterId: latestWorkspace.cluster.id,
      systemId: latestSystem.id,
      initialClusterName: latestWorkspace.cluster.name,
      initialSystemName: latestSystem.name,
    }
    clusterName.value = latestWorkspace.cluster.name
    systemName.value = latestSystem.name
    chartNamesEditing.value = true
    formError.value = ''
  }

  /** Hides the chart-name modal while leaving its exact parent-owned session available to resume. */
  function hideChartNamesEdit(): void {
    chartNamesEditing.value = false
  }

  /** Restores committed names and closes the name editor without changing workspace data. */
  function cancelChartNamesEdit(): void {
    const currentWorkspace = workspace.value
    const targetSystemId = chartNamesSession.value?.systemId
    const system = currentWorkspace?.cluster.systems.find(candidate => candidate.id === targetSystemId)
      ?? selectedSystem.value
    if (currentWorkspace && system) {
      clusterName.value = currentWorkspace.cluster.name
      systemName.value = system.name
    }
    chartNamesEditing.value = false
    formError.value = ''
    chartNamesSession.value = null
  }

  /**
   * Resolves drafts affected by a transition through Apply, Discard, or Stay.
   * Independent commands may preserve the chart-name session while resolving legacy inspector edits.
   * @returns True when no affected draft remains or the user accepted Apply or Discard; false for Stay or invalid Apply.
   */
  function resolveTransition(options: TransitionOptions = {}): Promise<boolean> {
    if (pendingTransition) return Promise.resolve(false)

    const leaveChart = options.leaveChart !== false
    const leaveEntitySession = options.leaveEntitySession !== false
    const leaveRouteSession = options.leaveRouteSession !== false
    const hasChartDraft = leaveChart && chartNamesSession.value !== null
    const hasInspectorDraft = mapInspectorRef.value?.hasUnsavedEdits() ?? false
    const chartNeedsResolution = hasChartDraft && hasUncommittedNames.value
    const entityNeedsResolution = leaveEntitySession && hasModifiedEntitySession.value
    const routeNeedsResolution = leaveRouteSession && hasModifiedRouteSession.value
    if (!chartNeedsResolution && !entityNeedsResolution && !routeNeedsResolution && !hasInspectorDraft) {
      if (hasChartDraft) cancelChartNamesEdit()
      if (leaveEntitySession && entitySession.value) discardEntitySession(entitySession.value.id)
      if (leaveRouteSession && routeSession.value) discardRouteSession(routeSession.value.id)
      return Promise.resolve(true)
    }

    return new Promise(resolve => {
      pendingTransition = { leaveChart, leaveEntitySession, leaveRouteSession, resolve }
      transitionGuard.value = chartNeedsResolution ? 'chart' : 'inspector'
    })
  }

  function finishPendingTransition(accepted: boolean): void {
    const pending = pendingTransition
    if (!pending) return
    pendingTransition = null
    transitionGuard.value = null
    pending.resolve(accepted)
  }

  function advancePendingTransition(): void {
    const pending = pendingTransition
    if (!pending) return

    if (pending.leaveChart && chartNamesSession.value && hasUncommittedNames.value) {
      transitionGuard.value = 'chart'
      return
    }
    if (pending.leaveEntitySession && hasModifiedEntitySession.value) {
      transitionGuard.value = 'inspector'
      return
    }
    if (pending.leaveRouteSession && hasModifiedRouteSession.value) {
      transitionGuard.value = 'inspector'
      return
    }
    if (mapInspectorRef.value?.hasUnsavedEdits()) {
      transitionGuard.value = 'inspector'
      return
    }
    if (pending.leaveChart && chartNamesSession.value) cancelChartNamesEdit()
    if (pending.leaveEntitySession && entitySession.value) discardEntitySession(entitySession.value.id)
    if (pending.leaveRouteSession && routeSession.value) discardRouteSession(routeSession.value.id)
    finishPendingTransition(true)
  }

  function resolveTransitionChoice(decision: TransitionDecision): void {
    const guard = transitionGuard.value
    if (!pendingTransition || !guard) return

    if (decision === 'stay') {
      if (guard === 'chart') chartNamesEditing.value = true
      finishPendingTransition(false)
      return
    }

    if (guard === 'chart') {
      if (decision === 'apply') {
        if (!applyChartNames()) {
          finishPendingTransition(false)
          return
        }
      } else {
        cancelChartNamesEdit()
      }
      advancePendingTransition()
      return
    }

    const routeDraft = routeSession.value
    if (pendingTransition.leaveRouteSession && routeDraft && hasModifiedRouteSession.value) {
      if (decision === 'apply') {
        if (!applyRouteSession(routeDraft.id)) {
          finishPendingTransition(false)
          return
        }
      } else {
        discardRouteSession(routeDraft.id)
      }
    }
    const session = entitySession.value
    if (pendingTransition.leaveEntitySession && session && hasModifiedEntitySession.value) {
      if (decision === 'apply') {
        if (!applyEntitySession(session.id)) {
          finishPendingTransition(false)
          return
        }
      } else {
        discardEntitySession(session.id)
      }
    }
    mapInspectorRef.value?.cancelEdits()
    advancePendingTransition()
  }

  /** Returns whether a system removal would invalidate the chart-name session's captured target. */
  function isChartDraftTarget(systemId: string): boolean {
    return chartNamesSession.value?.systemId === systemId
  }

  /** Closes the visible dialog; closing a guard means Stay, while closing an editor only hides it. */
  function setChartNamesDialogOpen(open: boolean): void {
    if (open) {
      chartNamesEditing.value = true
      return
    }
    if (transitionGuard.value) {
      resolveTransitionChoice('stay')
    } else {
      hideChartNamesEdit()
    }
  }

  /**
   * Selects the first imported system when available and switches to the cluster view.
   * @param firstAddedSystemId First added system from a prepared import, if one was included.
   */
  function captureImportOrigin(): { navigationStamp: string; selectedSystemId: string | null } | null {
    if (!workspace.value) return null
    const origin = { navigationStamp: navigationContextStamp(), selectedSystemId: selectedSystemId.value }
    captureActiveMap()
    return origin
  }

  async function selectImportedWorkspace(
    firstAddedSystemId: string | undefined,
    origin?: { navigationStamp: string; selectedSystemId: string | null },
  ): Promise<void> {
    if (!origin || navigationContextStamp() !== origin.navigationStamp) return
    const startingSessionId = chartNamesSession.value?.id ?? null
    if (!await resolveTransition()
      || !acceptNavigationTransition(origin.navigationStamp, startingSessionId)) return

    const latestWorkspace = workspace.value
    if (!latestWorkspace) return

    const importedSystem = firstAddedSystemId
      ? latestWorkspace.cluster.systems.find(system => system.id === firstAddedSystemId)
      : undefined
    if (firstAddedSystemId && !importedSystem) return

    const retainedSystemId = latestWorkspace.cluster.systems.some(
      system => system.id === origin.selectedSystemId,
    )
      ? origin.selectedSystemId
      : latestWorkspace.cluster.systems[0]?.id ?? null
    selectedSystemId.value = importedSystem?.id ?? retainedSystemId
    activeView.value = 'cluster'
    mapMode.value = 'select'
    restoreActiveSelection()
  }

  /** Shows the cluster map and clears map-entity selections after the transition guard accepts. */
  async function showClusterMap(): Promise<void> {
    const startingNavigationStamp = navigationContextStamp()
    const startingSessionId = chartNamesSession.value?.id ?? null
    if (!await resolveTransition() || !acceptNavigationTransition(startingNavigationStamp, startingSessionId)) return
    activeView.value = 'cluster'
    mapMode.value = 'select'
    restoreActiveSelection()
    editorError.value = ''
  }

  /**
   * Selects an existing system and opens its map after the draft guard passes.
   * @param systemId System to select; unknown IDs are ignored.
   */
  async function selectSystem(systemId: string): Promise<void> {
    if (!workspace.value?.cluster.systems.some(system => system.id === systemId)) return
    const startingNavigationStamp = navigationContextStamp()
    const startingSessionId = chartNamesSession.value?.id ?? null
    if (!await resolveTransition()) return
    if (!acceptNavigationTransition(startingNavigationStamp, startingSessionId)
      || !workspace.value?.cluster.systems.some(system => system.id === systemId)) return
    selectedSystemId.value = systemId
    activeView.value = 'system'
    mapMode.value = 'select'
    restoreActiveSelection()
    editorError.value = ''
  }

  async function selectCreatedSystem(systemId: string, originStamp: string): Promise<void> {
    if (contextStamp() !== originStamp || !workspace.value?.cluster.systems.some(system => system.id === systemId)) return
    await selectSystem(systemId)
  }

  /** Selects a cluster system and opens its read-only inspector without entering its system map. */
  async function selectClusterSystem(systemId: string, openInspector = true): Promise<void> {
    if (!workspace.value?.cluster.systems.some(system => system.id === systemId)) return
    const startingNavigationStamp = navigationContextStamp()
    const startingSessionId = chartNamesSession.value?.id ?? null
    if (!await resolveTransition()) return
    if (!acceptNavigationTransition(startingNavigationStamp, startingSessionId)
      || !workspace.value?.cluster.systems.some(system => system.id === systemId)) return
    clusterSelectedSystemId.value = systemId
    inspectedClusterSystemId.value = systemId
    selectedRouteId.value = null
    storeCurrentSelection()
    if (openInspector) requestPanel('inspector')
    editorError.value = ''
  }

  /**
   * Selects an object in the current system after the draft guard passes.
   * @param objectId Object to select; unknown or already-selected IDs are ignored.
   */
  async function selectObject(objectId: string, openInspector = true): Promise<void> {
    const currentWorkspace = workspace.value
    const clusterId = currentWorkspace?.cluster.id
    const systemId = selectedSystemId.value
    const entryView = activeView.value
    if (!clusterId || entryView !== 'system' || !systemId) return
    const entrySystem = currentWorkspace.cluster.systems.find(system => system.id === systemId)
    if (!entrySystem?.objects.some(object => object.id === objectId)) return
    if (selectedObjectId.value === objectId) {
      if (openInspector) requestPanel('inspector')
      return
    }
    const startingNavigationStamp = navigationContextStamp()
    const startingSessionId = chartNamesSession.value?.id ?? null
    const returningToDraft = isEntityDraftTarget('object', objectId)
    if (!await resolveTransition({ leaveEntitySession: !returningToDraft })) return
    const latestWorkspace = workspace.value
    if (
      !latestWorkspace
      || !acceptNavigationTransition(startingNavigationStamp, startingSessionId)
      || latestWorkspace.cluster.id !== clusterId
      || selectedSystemId.value !== systemId
      || activeView.value !== entryView
      || activeView.value !== 'system'
    ) return
    const currentSystem = latestWorkspace.cluster.systems.find(system => system.id === systemId)
    if (!currentSystem?.objects.some(object => object.id === objectId)) return
    selectedObjectId.value = objectId
    selectedOrbitId.value = null
    selectedRouteId.value = null
    storeCurrentSelection()
    if (openInspector) requestPanel('inspector')
    editorError.value = ''
  }

  /**
   * Selects an Orbit in the current system after the draft guard passes.
   * @param orbitId Orbit to select; unknown or already-selected IDs are ignored.
   */
  async function selectOrbit(orbitId: string, openInspector = true): Promise<void> {
    const currentWorkspace = workspace.value
    const clusterId = currentWorkspace?.cluster.id
    const systemId = selectedSystemId.value
    const entryView = activeView.value
    if (!clusterId || entryView !== 'system' || !systemId) return
    const entrySystem = currentWorkspace.cluster.systems.find(system => system.id === systemId)
    if (!entrySystem?.orbits.some(orbit => orbit.id === orbitId)) return
    if (selectedOrbitId.value === orbitId) {
      if (openInspector) requestPanel('inspector')
      return
    }
    const startingNavigationStamp = navigationContextStamp()
    const startingSessionId = chartNamesSession.value?.id ?? null
    const returningToDraft = isEntityDraftTarget('orbit', orbitId)
    if (!await resolveTransition({ leaveEntitySession: !returningToDraft })) return
    const latestWorkspace = workspace.value
    if (
      !latestWorkspace
      || !acceptNavigationTransition(startingNavigationStamp, startingSessionId)
      || latestWorkspace.cluster.id !== clusterId
      || selectedSystemId.value !== systemId
      || activeView.value !== entryView
      || activeView.value !== 'system'
    ) return
    const currentSystem = latestWorkspace.cluster.systems.find(system => system.id === systemId)
    if (!currentSystem?.orbits.some(orbit => orbit.id === orbitId)) return
    selectedOrbitId.value = orbitId
    selectedObjectId.value = null
    selectedRouteId.value = null
    storeCurrentSelection()
    if (openInspector) requestPanel('inspector')
    editorError.value = ''
  }

  /**
   * Selects an existing cluster route and clears system-entity selections after the draft guard passes.
   * @param routeId Route to select; unknown or already-selected IDs are ignored.
   */
  async function selectRoute(routeId: string, openInspector = true): Promise<void> {
    const currentWorkspace = workspace.value
    const clusterId = currentWorkspace?.cluster.id
    const systemId = selectedSystemId.value
    const entryView = activeView.value
    if (!currentWorkspace || !clusterId || entryView !== 'cluster') return
    const route = currentWorkspace.cluster.routes.find(candidate => candidate.id === routeId)
    if (!route) return
    if (selectedRouteId.value === routeId) {
      if (openInspector) requestPanel('inspector')
      return
    }
    const startingNavigationStamp = navigationContextStamp()
    const startingSessionId = chartNamesSession.value?.id ?? null
    if (!await resolveTransition()) return
    const latestWorkspace = workspace.value
    if (
      !latestWorkspace
      || !acceptNavigationTransition(startingNavigationStamp, startingSessionId)
      || latestWorkspace.cluster.id !== clusterId
      || selectedSystemId.value !== systemId
      || activeView.value !== entryView
      || activeView.value !== 'cluster'
      || !latestWorkspace.cluster.routes.some(candidate => candidate.id === routeId)
    ) return

    selectedRouteId.value = route.id
    selectedObjectId.value = null
    selectedOrbitId.value = null
    clusterSelectedSystemId.value = null
    inspectedClusterSystemId.value = null
    storeCurrentSelection()
    if (openInspector) requestPanel('inspector')
    editorError.value = ''
  }

  /** Clears map-entity selections while leaving a chart-name session attached to its captured target. */
  async function showChartDetails(): Promise<void> {
    const startingNavigationStamp = navigationContextStamp()
    const startingSessionId = chartNamesSession.value?.id ?? null
    if (!await resolveTransition({ leaveChart: false })
      || !acceptNavigationTransition(startingNavigationStamp, startingSessionId)) return
    selectedObjectId.value = null
    selectedOrbitId.value = null
    selectedRouteId.value = null
    clusterSelectedSystemId.value = null
    inspectedClusterSystemId.value = null
    storeCurrentSelection()
    editorError.value = ''
  }

  /** Clears only selections, visits, and resumable sessions invalidated by an applied cascade. */
  function cleanupAfterDeletion(plan: MapDeletionPlan): void {
    const removedSystems = new Set(plan.removedSystemIds)
    const removedObjects = new Set(plan.removedObjectIds)
    const removedOrbits = new Set(plan.removedOrbitIds)
    const removedRoutes = new Set(plan.removedRouteIds)
    const currentWorkspace = workspace.value
    if (!currentWorkspace) return

    if (selectedSystemId.value && removedSystems.has(selectedSystemId.value)) {
      selectedSystemId.value = currentWorkspace.cluster.systems[0]?.id ?? null
    }
    if (clusterSelectedSystemId.value && removedSystems.has(clusterSelectedSystemId.value)) {
      clusterSelectedSystemId.value = null
    }
    if (inspectedClusterSystemId.value && removedSystems.has(inspectedClusterSystemId.value)) {
      inspectedClusterSystemId.value = null
    }
    if (selectedObjectId.value && removedObjects.has(selectedObjectId.value)) selectedObjectId.value = null
    if (selectedOrbitId.value && removedOrbits.has(selectedOrbitId.value)) selectedOrbitId.value = null
    if (selectedRouteId.value && removedRoutes.has(selectedRouteId.value)) selectedRouteId.value = null

    const entityDraft = entitySession.value
    if (entityDraft && (removedSystems.has(entityDraft.systemId)
      || (entityDraft.kind === 'object' ? removedObjects : removedOrbits).has(entityDraft.targetId))) {
      discardEntitySession(entityDraft.id)
    }
    const routeDraft = routeSession.value
    if (routeDraft && ((routeDraft.routeId && removedRoutes.has(routeDraft.routeId))
      || [...plan.removedObjectIds].some(id => [
        routeDraft.initial.fromPointId,
        routeDraft.initial.toPointId,
        routeDraft.draft.fromPointId,
        routeDraft.draft.toPointId,
      ].includes(id)))) {
      discardRouteSession(routeDraft.id)
    }

    const nextVisits = new Map<string, MapVisitMemory>()
    for (const [key, visit] of mapVisits.value) {
      if (key.startsWith(`system:${currentWorkspace.cluster.id}:`)
        && removedSystems.has(key.slice(`system:${currentWorkspace.cluster.id}:`.length))) continue
      nextVisits.set(key, { ...visit, selection: validVisitSelection(key, visit.selection) })
    }
    mapVisits.value = nextVisits
    storeCurrentSelection()
  }

  return {
    clusterName,
    systemName,
    activeView,
    mapMode,
    selectedSystemId,
    clusterSelectedSystemId,
    selectedObjectId,
    selectedOrbitId,
    selectedRouteId,
    chartNamesEditing,
    chartNamesDialogOpen,
    transitionGuard,
    formError,
    editorError,
    mapInspectorRef,
    clusterMapRef,
    systemMapRef,
    selectedSystem,
    selectedObject,
    selectedOrbit,
    selectedRoute,
    jumpPoints,
    routeEndpointSummary,
    hasUncommittedNames,
    hasChartNameDraft,
    chartDraftSystemId,
    chartDraftSystemName,
    saveMessage,
    submitNames,
    beginChartNamesEdit,
    hideChartNamesEdit,
    cancelChartNamesEdit,
    resolveTransition,
    resolveTransitionChoice,
    entitySession,
    hasModifiedEntitySession,
    orbitPlacementPreview,
    beginObjectSession,
    beginOrbitSession,
    offerOrbitCenterCandidates,
    updateOrbitHost,
    previewOrbitPlacement,
    cancelOrbitPlacementPreview,
    applyEntitySession,
    discardEntitySession,
    routeSession,
    hasModifiedRouteSession,
    beginRouteSession,
    offerRouteSystems,
    chooseRoutePoint,
    updateRouteInput,
    applyRouteSession,
    discardRouteSession,
    cancelRouteCreation,
    isEntityDraftCommandBlocked: isEntitySessionCommandBlocked,
    isRouteCommandBlocked,
    isEntityCommandBlocked,
    isEntityDraftTarget,
    setChartNamesDialogOpen,
    isChartDraftTarget,
    selectImportedWorkspace,
    captureImportOrigin,
    contextStamp,
    showClusterMap,
    selectSystem,
    selectCreatedSystem,
    selectClusterSystem,
    setMapMode,
    hierarchyPanelVisible,
    inspectorPanelVisible,
    compactPanelOpen,
    isCompactViewport,
    compactPanel,
    requestPanel,
    closePanel,
    togglePanel,
    zoomLevel,
    setViewportPercentage,
    fitActiveMap,
    zoomActiveMap,
    recordViewport,
    panActiveMap,
    initialViewport,
    activeMapKey,
    clusterSelectedSystem,
    inspectedClusterSystem,
    selectObject,
    selectOrbit,
    selectRoute,
    showChartDetails,
    cleanupAfterDeletion,
  }
}
