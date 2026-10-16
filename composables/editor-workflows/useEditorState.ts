/**
 * Owns chart names, selection, and navigation guards; workspace persistence remains on the injected commit.
 */
import { computed, ref, shallowRef, watch } from 'vue'
import {
  createLocalWorkspace,
  jumpPointsInCluster,
  renameLocalWorkspace,
  type JumpRoute,
} from '../../domain/workspace'
import type { MapImageExporter } from '../../utils/map-image-export'
import type {
  EditorWorkflowOptions,
  MapInspectorHandle,
  SystemMapHandle,
  TransitionDecision,
  TransitionGuard,
  TransitionOptions,
} from './types'

/**
 * Derives editor selections from workspace IDs and keeps navigation coherent as entities change.
 * @param options Shared workspace/save refs and the page-owned persistence callback.
 * @returns Name drafts, selection refs/computeds, map handles, status text, and guarded navigation actions.
 */
export function useEditorState({ workspace, saveState, saveError, commit, applyWorkspace }: EditorWorkflowOptions) {
  const clusterName = ref('New Jump Cluster')
  const systemName = ref('First System')
  const activeView = ref<'cluster' | 'system'>('system')
  const selectedSystemId = ref<string | null>(null)
  const selectedObjectId = ref<string | null>(null)
  const selectedOrbitId = ref<string | null>(null)
  const selectedRouteId = ref<string | null>(null)
  const chartNamesEditing = ref(false)
  const transitionGuard = ref<TransitionGuard>(null)
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
    resolve: (accepted: boolean) => void
  } | null = null
  const mapInspectorRef = shallowRef<MapInspectorHandle | null>(null)
  const clusterMapRef = shallowRef<MapImageExporter | null>(null)
  const systemMapRef = shallowRef<SystemMapHandle | null>(null)

  const selectedSystem = computed(() =>
    workspace.value?.cluster.systems.find(system => system.id === selectedSystemId.value),
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
  const jumpPoints = computed(() =>
    workspace.value ? jumpPointsInCluster(workspace.value.cluster) : [],
  )

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
      return
    }
    if (!currentWorkspace.cluster.systems.some(system => system.id === selectedSystemId.value)) {
      selectedSystemId.value = currentWorkspace.cluster.systems[0]?.id ?? null
    }
    if (!currentWorkspace.cluster.routes.some(route => route.id === selectedRouteId.value)) {
      selectedRouteId.value = null
    }
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
        syncNamesFromSelectedWorkspace()
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

  function syncNamesFromSelectedWorkspace(): void {
    const currentWorkspace = workspace.value
    const system = selectedSystem.value
    if (currentWorkspace) clusterName.value = currentWorkspace.cluster.name
    if (system) systemName.value = system.name
  }

  /** Starts name drafts from committed values after guarding any open inspector edit. */
  async function beginChartNamesEdit(): Promise<void> {
    const currentWorkspace = workspace.value
    const system = selectedSystem.value
    if (!currentWorkspace || !system) return
    if (chartNamesSession.value) {
      chartNamesEditing.value = true
      return
    }
    if (!await resolveTransition({ leaveChart: false })) return
    const latestWorkspace = workspace.value
    const latestSystem = latestWorkspace?.cluster.systems.find(candidate => candidate.id === system.id)
    if (!latestWorkspace || !latestSystem) return
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
    const system = selectedSystem.value
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
    const hasChartDraft = leaveChart && chartNamesSession.value !== null
    const hasInspectorDraft = mapInspectorRef.value?.hasUnsavedEdits() ?? false
    const chartNeedsResolution = hasChartDraft && hasUncommittedNames.value
    if (!chartNeedsResolution && !hasInspectorDraft) {
      if (hasChartDraft) cancelChartNamesEdit()
      return Promise.resolve(true)
    }

    return new Promise(resolve => {
      pendingTransition = { leaveChart, resolve }
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
    if (mapInspectorRef.value?.hasUnsavedEdits()) {
      transitionGuard.value = 'inspector'
      return
    }
    if (pending.leaveChart && chartNamesSession.value) cancelChartNamesEdit()
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
  async function selectImportedWorkspace(firstAddedSystemId: string | undefined): Promise<void> {
    const currentWorkspace = workspace.value
    if (!currentWorkspace) return
    const startingContext = {
      clusterId: currentWorkspace.cluster.id,
      selectedSystemId: selectedSystemId.value,
      selectedObjectId: selectedObjectId.value,
      selectedOrbitId: selectedOrbitId.value,
      selectedRouteId: selectedRouteId.value,
      activeView: activeView.value,
    }
    if (!await resolveTransition()) return

    const latestWorkspace = workspace.value
    if (
      !latestWorkspace
      || latestWorkspace.cluster.id !== startingContext.clusterId
      || selectedSystemId.value !== startingContext.selectedSystemId
      || selectedObjectId.value !== startingContext.selectedObjectId
      || selectedOrbitId.value !== startingContext.selectedOrbitId
      || selectedRouteId.value !== startingContext.selectedRouteId
      || activeView.value !== startingContext.activeView
    ) return

    const importedSystem = firstAddedSystemId
      ? latestWorkspace.cluster.systems.find(system => system.id === firstAddedSystemId)
      : undefined
    if (firstAddedSystemId && !importedSystem) return

    const retainedSystemId = latestWorkspace.cluster.systems.some(
      system => system.id === startingContext.selectedSystemId,
    )
      ? startingContext.selectedSystemId
      : latestWorkspace.cluster.systems[0]?.id ?? null
    selectedSystemId.value = importedSystem?.id ?? retainedSystemId
    selectedObjectId.value = null
    selectedOrbitId.value = null
    selectedRouteId.value = null
    activeView.value = 'cluster'
  }

  /** Shows the cluster map and clears map-entity selections after the transition guard accepts. */
  async function showClusterMap(): Promise<void> {
    if (!await resolveTransition()) return
    activeView.value = 'cluster'
    selectedObjectId.value = null
    selectedOrbitId.value = null
    selectedRouteId.value = null
    editorError.value = ''
  }

  /**
   * Selects an existing system and opens its map after the draft guard passes.
   * @param systemId System to select; unknown IDs are ignored.
   */
  async function selectSystem(systemId: string): Promise<void> {
    if (!workspace.value?.cluster.systems.some(system => system.id === systemId)) return
    if (!await resolveTransition()) return
    if (!workspace.value?.cluster.systems.some(system => system.id === systemId)) return
    selectedSystemId.value = systemId
    activeView.value = 'system'
    selectedObjectId.value = null
    selectedOrbitId.value = null
    selectedRouteId.value = null
    editorError.value = ''
  }

  /**
   * Selects an object in the current system after the draft guard passes.
   * @param objectId Object to select; unknown or already-selected IDs are ignored.
   */
  async function selectObject(objectId: string): Promise<void> {
    const currentWorkspace = workspace.value
    const clusterId = currentWorkspace?.cluster.id
    const systemId = selectedSystemId.value
    const entryView = activeView.value
    if (!clusterId || entryView !== 'system' || !systemId) return
    const entrySystem = currentWorkspace.cluster.systems.find(system => system.id === systemId)
    if (!entrySystem?.objects.some(object => object.id === objectId)) return
    if (selectedObjectId.value === objectId) return
    if (!await resolveTransition()) return
    const latestWorkspace = workspace.value
    if (
      !latestWorkspace
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
    editorError.value = ''
  }

  /**
   * Selects an Orbit in the current system after the draft guard passes.
   * @param orbitId Orbit to select; unknown or already-selected IDs are ignored.
   */
  async function selectOrbit(orbitId: string): Promise<void> {
    const currentWorkspace = workspace.value
    const clusterId = currentWorkspace?.cluster.id
    const systemId = selectedSystemId.value
    const entryView = activeView.value
    if (!clusterId || entryView !== 'system' || !systemId) return
    const entrySystem = currentWorkspace.cluster.systems.find(system => system.id === systemId)
    if (!entrySystem?.orbits.some(orbit => orbit.id === orbitId)) return
    if (selectedOrbitId.value === orbitId) return
    if (!await resolveTransition()) return
    const latestWorkspace = workspace.value
    if (
      !latestWorkspace
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
    editorError.value = ''
  }

  /**
   * Selects an existing cluster route and clears system-entity selections after the draft guard passes.
   * @param routeId Route to select; unknown or already-selected IDs are ignored.
   */
  async function selectRoute(routeId: string): Promise<void> {
    const currentWorkspace = workspace.value
    const clusterId = currentWorkspace?.cluster.id
    const systemId = selectedSystemId.value
    const entryView = activeView.value
    if (!currentWorkspace || !clusterId || entryView !== 'cluster') return
    const route = currentWorkspace.cluster.routes.find(candidate => candidate.id === routeId)
    if (!route) return
    if (selectedRouteId.value === routeId) return
    if (!await resolveTransition()) return
    const latestWorkspace = workspace.value
    if (
      !latestWorkspace
      || latestWorkspace.cluster.id !== clusterId
      || selectedSystemId.value !== systemId
      || activeView.value !== entryView
      || activeView.value !== 'cluster'
      || !latestWorkspace.cluster.routes.some(candidate => candidate.id === routeId)
    ) return

    selectedRouteId.value = route.id
    selectedObjectId.value = null
    selectedOrbitId.value = null
    editorError.value = ''
  }

  /** Clears map-entity selections while leaving a chart-name session attached to its captured target. */
  async function showChartDetails(): Promise<void> {
    if (!await resolveTransition({ leaveChart: false })) return
    selectedObjectId.value = null
    selectedOrbitId.value = null
    selectedRouteId.value = null
    editorError.value = ''
  }

  return {
    clusterName,
    systemName,
    activeView,
    selectedSystemId,
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
    saveMessage,
    submitNames,
    beginChartNamesEdit,
    hideChartNamesEdit,
    cancelChartNamesEdit,
    resolveTransition,
    resolveTransitionChoice,
    setChartNamesDialogOpen,
    isChartDraftTarget,
    selectImportedWorkspace,
    showClusterMap,
    selectSystem,
    selectObject,
    selectOrbit,
    selectRoute,
    showChartDetails,
  }
}
