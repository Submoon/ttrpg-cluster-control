import { computed, ref, shallowRef, watch } from 'vue'
import {
  createLocalWorkspace,
  jumpPointsInCluster,
  renameLocalWorkspace,
  type JumpRoute,
} from '../../domain/workspace'
import type { MapImageExporter } from '../../utils/map-image-export'
import type { EditorWorkflowOptions, MapInspectorHandle, SystemMapHandle } from './types'

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

  function beginChartNamesEdit(): void {
    if (!workspace.value || !selectedSystem.value || !confirmDiscardInspectorEdits()) return
    clusterName.value = workspace.value.cluster.name
    systemName.value = selectedSystem.value.name
    chartNamesEditing.value = true
    formError.value = ''
  }

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

  function confirmDiscardInspectorEdits(): boolean {
    const hasOpenEdit = (mapInspectorRef.value?.hasUnsavedEdits() ?? false)
      || chartNamesEditing.value
    if (!hasOpenEdit) return true
    if (!window.confirm('Discard unsaved edits?')) return false

    mapInspectorRef.value?.cancelEdits()
    cancelChartNamesEdit()
    return true
  }

  function selectImportedWorkspace(firstAddedSystemId: string | undefined): void {
    selectedSystemId.value = firstAddedSystemId ?? selectedSystemId.value
    selectedObjectId.value = null
    selectedOrbitId.value = null
    selectedRouteId.value = null
    activeView.value = 'cluster'
  }

  function showClusterMap(): void {
    if (!confirmDiscardInspectorEdits()) return
    activeView.value = 'cluster'
    selectedObjectId.value = null
    selectedOrbitId.value = null
    selectedRouteId.value = null
    editorError.value = ''
  }

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

  function selectObject(objectId: string): void {
    if (!selectedSystem.value?.objects.some(object => object.id === objectId)) return
    if (selectedObjectId.value === objectId) return
    if (!confirmDiscardInspectorEdits()) return
    selectedObjectId.value = objectId
    selectedOrbitId.value = null
    selectedRouteId.value = null
    editorError.value = ''
  }

  function selectOrbit(orbitId: string): void {
    if (!selectedSystem.value?.orbits.some(orbit => orbit.id === orbitId)) return
    if (selectedOrbitId.value === orbitId) return
    if (!confirmDiscardInspectorEdits()) return
    selectedOrbitId.value = orbitId
    selectedObjectId.value = null
    selectedRouteId.value = null
    editorError.value = ''
  }

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
