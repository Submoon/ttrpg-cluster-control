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
import type { EditorWorkflowOptions, MapInspectorHandle, SystemMapHandle } from './types'

/**
 * Derives editor selections from workspace IDs and keeps navigation coherent as entities change.
 * @param options Shared workspace/save refs and the page-owned persistence callback.
 * @returns Name drafts, selection refs/computeds, map handles, status text, and guarded navigation actions.
 */
export function useEditorState({ workspace, saveState, saveError, commit }: EditorWorkflowOptions) {
  const clusterName = ref('New Jump Cluster')
  const systemName = ref('First System')
  const activeView = ref<'cluster' | 'system'>('system')
  const selectedSystemId = ref<string | null>(null)
  const selectedObjectId = ref<string | null>(null)
  const selectedOrbitId = ref<string | null>(null)
  const selectedRouteId = ref<string | null>(null)
  const chartNamesEditing = ref(false)
  const formError = ref('')
  const editorError = ref('')
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

  const hasUncommittedNames = computed(() => {
    const currentWorkspace = workspace.value
    const currentSystem = selectedSystem.value
    return !!currentWorkspace && !!currentSystem && (
      clusterName.value.trim() !== currentWorkspace.cluster.name
      || systemName.value.trim() !== currentSystem.name
    )
  })
  const saveMessage = computed(() => {
    if (saveState.value === 'saving') return 'Saving to this browser...'
    if (saveState.value === 'error') return `Not saved. ${saveError.value ?? ''}`
    if (hasUncommittedNames.value) return 'Chart name edits are not committed.'
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
    if (value !== undefined) clusterName.value = value
  }, { immediate: true })
  watch(() => selectedSystem.value?.name, value => {
    if (value !== undefined) systemName.value = value
  }, { immediate: true })

  function errorText(error: unknown): string {
    return error instanceof Error ? error.message : String(error)
  }

  /**
   * Creates the first workspace or renames the current cluster and selected system.
   * Name drafts leave edit mode only after the injected commit succeeds.
   * @returns A promise that resolves after the attempt; errors populate formError.
   */
  async function submitNames(): Promise<void> {
    formError.value = ''
    try {
      const currentWorkspace = workspace.value
      const nextWorkspace = currentWorkspace
        ? renameLocalWorkspace(
            currentWorkspace,
            clusterName.value,
            systemName.value,
            selectedSystemId.value ?? undefined,
          )
        : createLocalWorkspace(clusterName.value, systemName.value)
      await commit(nextWorkspace)
      chartNamesEditing.value = false
    } catch (error) {
      formError.value = errorText(error)
    }
  }

  /** Starts name drafts from committed values after guarding any open inspector edit. */
  function beginChartNamesEdit(): void {
    if (!workspace.value || !selectedSystem.value || !confirmDiscardInspectorEdits()) return
    clusterName.value = workspace.value.cluster.name
    systemName.value = selectedSystem.value.name
    chartNamesEditing.value = true
    formError.value = ''
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
  }

  /**
   * Guards navigation across inspector and chart-name drafts with one confirmation.
   * @returns True when no draft is open or the user accepted discarding all guarded drafts.
   */
  function confirmDiscardInspectorEdits(): boolean {
    const hasOpenEdit = (mapInspectorRef.value?.hasUnsavedEdits() ?? false)
      || chartNamesEditing.value
    if (!hasOpenEdit) return true
    if (!window.confirm('Discard unsaved edits?')) return false

    mapInspectorRef.value?.cancelEdits()
    cancelChartNamesEdit()
    return true
  }

  /**
   * Selects the first imported system when available and switches to the cluster view.
   * @param firstAddedSystemId First added system from a prepared import, if one was included.
   */
  function selectImportedWorkspace(firstAddedSystemId: string | undefined): void {
    selectedSystemId.value = firstAddedSystemId ?? selectedSystemId.value
    selectedObjectId.value = null
    selectedOrbitId.value = null
    selectedRouteId.value = null
    activeView.value = 'cluster'
  }

  /** Shows the cluster map and clears map-entity selections after the draft guard passes. */
  function showClusterMap(): void {
    if (!confirmDiscardInspectorEdits()) return
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
  function selectSystem(systemId: string): void {
    if (!workspace.value?.cluster.systems.some(system => system.id === systemId)) return
    if (!confirmDiscardInspectorEdits()) return
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
  function selectObject(objectId: string): void {
    if (!selectedSystem.value?.objects.some(object => object.id === objectId)) return
    if (selectedObjectId.value === objectId) return
    if (!confirmDiscardInspectorEdits()) return
    selectedObjectId.value = objectId
    selectedOrbitId.value = null
    selectedRouteId.value = null
    editorError.value = ''
  }

  /**
   * Selects an Orbit in the current system after the draft guard passes.
   * @param orbitId Orbit to select; unknown or already-selected IDs are ignored.
   */
  function selectOrbit(orbitId: string): void {
    if (!selectedSystem.value?.orbits.some(orbit => orbit.id === orbitId)) return
    if (selectedOrbitId.value === orbitId) return
    if (!confirmDiscardInspectorEdits()) return
    selectedOrbitId.value = orbitId
    selectedObjectId.value = null
    selectedRouteId.value = null
    editorError.value = ''
  }

  /**
   * Selects an existing cluster route and clears system-entity selections after the draft guard passes.
   * @param routeId Route to select; unknown or already-selected IDs are ignored.
   */
  function selectRoute(routeId: string): void {
    const route = workspace.value?.cluster.routes.find(candidate => candidate.id === routeId)
    if (!route) return
    if (selectedRouteId.value === routeId) return
    if (!confirmDiscardInspectorEdits()) return

    selectedRouteId.value = route.id
    selectedObjectId.value = null
    selectedOrbitId.value = null
    editorError.value = ''
  }

  /** Clears map-entity selections so the chart-details panel can be shown after the draft guard passes. */
  function showChartDetails(): void {
    if (!confirmDiscardInspectorEdits()) return
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
    saveMessage,
    submitNames,
    beginChartNamesEdit,
    cancelChartNamesEdit,
    confirmDiscardInspectorEdits,
    selectImportedWorkspace,
    showClusterMap,
    selectSystem,
    selectObject,
    selectOrbit,
    selectRoute,
    showChartDetails,
  }
}
