/** Owns the independent Cluster Add System intent and its single-use placement inputs. */
import { computed, nextTick, reactive, ref, watch, type Ref } from 'vue'
import { addStarSystem, type LocalWorkspace, type Point } from '../../domain/workspace'
import { clusterSystemPosition } from '../../utils/cluster-map-geometry'
import type { ClusterAddType, ClusterSystemMovePreview, ClusterSystemPositionInput, ClusterSystemPositionInputs, MapNavigationHandle } from './types'
import type { EditorWorkflowOptions } from './types'
import { useEditorUiStore } from '../../stores/editor-ui'

interface ClusterSystemPlacementOptions {
  workspace: Readonly<Ref<LocalWorkspace | null>>
  clusterMapRef: Readonly<Ref<MapNavigationHandle | null>>
  applyWorkspace: EditorWorkflowOptions['applyWorkspace']
}

const CLUSTER_SYSTEM_CARD_WIDTH = 156
const CLUSTER_SYSTEM_CARD_HEIGHT = 76
const CLUSTER_MAP_POSITION_ORIGIN = { x: 112, y: 96 }
const CLUSTER_MAP_POSITION_SIZE = { x: 736, y: 368 }

export function useClusterSystemPlacement({ workspace, clusterMapRef, applyWorkspace }: ClusterSystemPlacementOptions) {
  const store = useEditorUiStore()
  const clusterAddType = ref<ClusterAddType | null>(null)
  const inputs = reactive<ClusterSystemPositionInputs>({ x: '0.5', y: '0.5' })
  const inputErrors = reactive<Record<ClusterSystemPositionInput, string>>({ x: '', y: '' })
  const formError = ref('')
  const systemMoveError = ref('')
  const systemMovePreview = ref<ClusterSystemMovePreview | null>(null)
  const nextPreviewToken = ref(0)
  const clusterAddError = computed(() => formError.value || inputErrors.x || inputErrors.y)
  const clusterSystemMoveError = computed(() => systemMoveError.value || inputErrors.x || inputErrors.y)
  const clusterMoveTargeting = computed(() => store.activeView === 'cluster'
    && store.mapMode === 'move'
    && store.clusterSelectedSystemId !== null)

  function clearErrors(): void {
    inputErrors.x = ''
    inputErrors.y = ''
    formError.value = ''
    systemMoveError.value = ''
  }

  function clearSystemMovePreview(): void {
    const preview = systemMovePreview.value
    if (preview) clusterMapRef.value?.setClusterSystemPositionPreview?.(preview.sourceSystemId, null)
    systemMovePreview.value = null
  }

  function cancelSystemMovePreview(): void {
    const preview = systemMovePreview.value
    clearSystemMovePreview()
    systemMoveError.value = ''
    if (!preview) return
    const currentWorkspace = workspace.value
    const currentPosition = currentWorkspace?.cluster.systems.some(system => system.id === preview.sourceSystemId)
      ? currentWorkspace.layout.systemPositions[preview.sourceSystemId]
      : null
    if (currentPosition) {
      inputs.x = String(currentPosition.x)
      inputs.y = String(currentPosition.y)
    }
  }

  function armSystemAdd(): void {
    if (!workspace.value || store.activeView !== 'cluster') return
    cancelSystemMovePreview()
    clusterAddType.value = 'system'
    clearErrors()
  }

  function armRouteAdd(): void {
    if (!workspace.value || store.activeView !== 'cluster') return
    cancelSystemMovePreview()
    clusterAddType.value = 'route'
    clearErrors()
  }

  function quitClusterAdd(): void {
    cancelSystemMovePreview()
    clusterAddType.value = null
    clearErrors()
  }

  function updateInput(key: ClusterSystemPositionInput, value: string): void {
    inputs[key] = value
    inputErrors[key] = ''
    formError.value = ''
    systemMoveError.value = ''
  }

  function validateCoordinate(key: ClusterSystemPositionInput): number | null {
    const raw = inputs[key].trim()
    const label = key.toUpperCase()
    if (!raw) {
      inputErrors[key] = `${label} is required.`
      return null
    }

    const value = Number(raw)
    if (!Number.isFinite(value)) {
      inputErrors[key] = `${label} must be a finite number.`
      return null
    }
    if (value < 0 || value > 1) {
      inputErrors[key] = `${label} must be between 0 and 1.`
      return null
    }

    inputErrors[key] = ''
    return value
  }

  function pointOverlapsSystem(
    point: Point,
    currentWorkspace: LocalWorkspace,
    ignoredSystemId?: string,
  ): boolean {
    const target = {
      x: CLUSTER_MAP_POSITION_ORIGIN.x + point.x * CLUSTER_MAP_POSITION_SIZE.x,
      y: CLUSTER_MAP_POSITION_ORIGIN.y + point.y * CLUSTER_MAP_POSITION_SIZE.y,
    }

    return currentWorkspace.cluster.systems.some((system) => {
      if (system.id === ignoredSystemId) return false
      const existing = clusterSystemPosition(currentWorkspace.layout.systemPositions, system.id)
      return Math.abs(target.x - existing.x) < CLUSTER_SYSTEM_CARD_WIDTH
        && Math.abs(target.y - existing.y) < CLUSTER_SYSTEM_CARD_HEIGHT
    })
  }

  function addSystemAt(point: Point, systemIds: string[] = []): boolean {
    if (clusterAddType.value !== 'system' || store.activeView !== 'cluster') return false
    const currentWorkspace = workspace.value
    if (!currentWorkspace) return false
    clearErrors()

    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)
      || point.x < 0 || point.x > 1 || point.y < 0 || point.y > 1) {
      formError.value = 'Choose a point inside the Cluster map.'
      return false
    }

    const liveSystemIds = new Set(currentWorkspace.cluster.systems.map(system => system.id))
    if (systemIds.some(id => liveSystemIds.has(id)) || pointOverlapsSystem(point, currentWorkspace)) {
      formError.value = 'Choose an open point clear of existing systems.'
      return false
    }

    try {
      const { workspace: withSystem, system } = addStarSystem(currentWorkspace)
      const nextWorkspace: LocalWorkspace = {
        ...withSystem,
        layout: {
          ...withSystem.layout,
          systemPositions: {
            ...withSystem.layout.systemPositions,
            [system.id]: { x: point.x, y: point.y },
          },
        },
      }
      const { durable } = applyWorkspace(nextWorkspace)
      inputs.x = String(point.x)
      inputs.y = String(point.y)
      void durable.catch(() => undefined)
      return true
    } catch (error) {
      formError.value = error instanceof Error ? error.message : String(error)
      return false
    }
  }

  function addSystemFromInputs(): boolean {
    if (clusterAddType.value !== 'system' || store.activeView !== 'cluster') return false
    clearErrors()
    const x = validateCoordinate('x')
    const y = validateCoordinate('y')
    if (x === null || y === null) {
      formError.value = inputErrors.x || inputErrors.y
      return false
    }
    return addSystemAt({ x, y })
  }

  function previewSystemMoveAt(point: Point, systemIds: string[] = []): boolean {
    const sourceSystemId = store.clusterSelectedSystemId
    if (!clusterMoveTargeting.value || !sourceSystemId) return false
    clearSystemMovePreview()
    systemMoveError.value = ''
    inputErrors.x = ''
    inputErrors.y = ''
    const currentWorkspace = workspace.value
    if (!currentWorkspace) return false
    const sourceSystem = currentWorkspace.cluster.systems.find(system => system.id === sourceSystemId)
    if (!sourceSystem) {
      systemMoveError.value = 'Choose a system that is still on this Cluster.'
      return false
    }
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)
      || point.x < 0 || point.x > 1 || point.y < 0 || point.y > 1) {
      systemMoveError.value = 'Choose a point inside the Cluster map.'
      return false
    }
    if (systemIds.some(id => id !== sourceSystemId)
      || pointOverlapsSystem(point, currentWorkspace, sourceSystemId)) {
      systemMoveError.value = 'Choose an open point clear of other systems.'
      return false
    }

    const originPosition = currentWorkspace.layout.systemPositions[sourceSystemId]
    if (!originPosition) {
      systemMoveError.value = 'The selected system has no saved Cluster position.'
      return false
    }
    if (point.x === originPosition.x && point.y === originPosition.y) {
      systemMoveError.value = 'Choose a different point from the current location.'
      return false
    }

    const preview: ClusterSystemMovePreview = {
      token: ++nextPreviewToken.value,
      clusterId: currentWorkspace.cluster.id,
      sourceSystemId,
      originPosition: { ...originPosition },
      targetPosition: { x: point.x, y: point.y },
    }
    systemMovePreview.value = preview
    inputs.x = String(point.x)
    inputs.y = String(point.y)
    clusterMapRef.value?.setClusterSystemPositionPreview?.(sourceSystemId, preview.targetPosition)
    return true
  }

  function previewSystemMoveFromInputs(): boolean {
    if (!clusterMoveTargeting.value) return false
    systemMoveError.value = ''
    const x = validateCoordinate('x')
    const y = validateCoordinate('y')
    if (x === null || y === null) {
      systemMoveError.value = inputErrors.x || inputErrors.y
      return false
    }
    return previewSystemMoveAt({ x, y })
  }

  function confirmSystemMove(): boolean {
    const preview = systemMovePreview.value
    const currentWorkspace = workspace.value
    if (!preview || !currentWorkspace) return false
    const currentSource = currentWorkspace.cluster.systems.find(system => system.id === preview.sourceSystemId)
    const currentOrigin = currentSource
      ? currentWorkspace.layout.systemPositions[preview.sourceSystemId]
      : undefined
    const isCurrent = systemMovePreview.value?.token === preview.token
      && currentWorkspace.cluster.id === preview.clusterId
      && currentSource !== undefined
      && currentOrigin?.x === preview.originPosition.x
      && currentOrigin?.y === preview.originPosition.y
      && store.activeView === 'cluster'
      && store.mapMode === 'move'
      && store.clusterSelectedSystemId === preview.sourceSystemId
    if (!isCurrent) {
      cancelSystemMovePreview()
      systemMoveError.value = 'The selected system changed. Choose a source and preview its destination again.'
      return false
    }
    if (pointOverlapsSystem(preview.targetPosition, currentWorkspace, preview.sourceSystemId)) {
      cancelSystemMovePreview()
      systemMoveError.value = 'That destination is no longer clear. Choose another point.'
      return false
    }

    const nextWorkspace: LocalWorkspace = {
      ...currentWorkspace,
      layout: {
        ...currentWorkspace.layout,
        systemPositions: {
          ...currentWorkspace.layout.systemPositions,
          [preview.sourceSystemId]: { ...preview.targetPosition },
        },
      },
    }
    systemMovePreview.value = null
    systemMoveError.value = ''
    try {
      const { durable } = applyWorkspace(nextWorkspace)
      inputs.x = String(preview.targetPosition.x)
      inputs.y = String(preview.targetPosition.y)
      void durable.catch(() => undefined)
      return true
    } catch (error) {
      clusterMapRef.value?.setClusterSystemPositionPreview?.(preview.sourceSystemId, null)
      systemMoveError.value = error instanceof Error ? error.message : String(error)
      return false
    }
  }

  watch([() => store.activeView, () => store.mapMode, () => store.clusterSelectedSystemId], ([view, mode, systemId]) => {
    const preview = systemMovePreview.value
    if (preview && (view !== 'cluster' || mode !== 'move' || systemId !== preview.sourceSystemId)) {
      cancelSystemMovePreview()
    }
    if (view === 'cluster' && mode === 'move' && systemId) {
      const currentWorkspace = workspace.value
      if (currentWorkspace?.cluster.systems.some(system => system.id === systemId)) {
        const normalized = currentWorkspace.layout.systemPositions[systemId]
        if (!normalized) {
          systemMoveError.value = 'The selected system has no saved Cluster position.'
          return
        }
        inputs.x = String(normalized.x)
        inputs.y = String(normalized.y)
      }
    }
  }, { flush: 'sync' })

  watch(workspace, (currentWorkspace) => {
    const preview = systemMovePreview.value
    if (!preview) return
    if (!currentWorkspace) {
      cancelSystemMovePreview()
      systemMoveError.value = 'The selected system changed. Choose a source and preview its destination again.'
      return
    }
    const sourceExists = currentWorkspace.cluster.id === preview.clusterId
      && currentWorkspace.cluster.systems.some(system => system.id === preview.sourceSystemId)
    const currentOrigin = sourceExists
      ? currentWorkspace.layout.systemPositions[preview.sourceSystemId]
      : undefined
    if (currentOrigin?.x !== preview.originPosition.x || currentOrigin?.y !== preview.originPosition.y) {
      cancelSystemMovePreview()
      systemMoveError.value = 'The selected system changed. Choose a source and preview its destination again.'
      return
    }

    // Workspace edits rebuild the SVG. Reapply the still-valid transient preview after that render.
    void nextTick(() => {
      if (systemMovePreview.value?.token !== preview.token) return
      const latestWorkspace = workspace.value
      const latestPosition = latestWorkspace?.cluster.id === preview.clusterId
        ? latestWorkspace.layout.systemPositions[preview.sourceSystemId]
        : undefined
      if (latestPosition?.x !== preview.originPosition.x || latestPosition?.y !== preview.originPosition.y) {
        cancelSystemMovePreview()
        systemMoveError.value = 'The selected system changed. Choose a source and preview its destination again.'
        return
      }
      clusterMapRef.value?.setClusterSystemPositionPreview?.(preview.sourceSystemId, preview.targetPosition)
    })
  }, { flush: 'post' })

  return {
    clusterAddType,
    clusterAddError,
    clusterMoveTargeting,
    clusterSystemMovePreview: systemMovePreview,
    clusterSystemMoveError,
    clusterSystemPositionInputs: inputs,
    clusterSystemPositionInputErrors: inputErrors,
    armSystemAdd,
    armRouteAdd,
    quitClusterAdd,
    updateClusterSystemPositionInput: updateInput,
    addSystemAt,
    addSystemFromInputs,
    previewSystemMoveAt,
    previewSystemMoveFromInputs,
    cancelSystemMovePreview,
    confirmSystemMove,
  }
}
