/** Owns Cluster-system creation and explicit map-based movement previews. */
import { computed, nextTick, ref, watch, type Ref } from 'vue'
import { addStarSystem, type LocalWorkspace, type Point } from '../../domain/workspace'
import { clusterSystemPosition } from '../../utils/cluster-map-geometry'
import type { ClusterAddType, ClusterSystemMovePreview, MapNavigationHandle } from './types'
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

function scenePositionForNormalizedPoint(point: Point): Point {
  return {
    x: CLUSTER_MAP_POSITION_ORIGIN.x + point.x * CLUSTER_MAP_POSITION_SIZE.x,
    y: CLUSTER_MAP_POSITION_ORIGIN.y + point.y * CLUSTER_MAP_POSITION_SIZE.y,
  }
}

function normalizedPointForScenePosition(point: Point): Point {
  return {
    x: (point.x - CLUSTER_MAP_POSITION_ORIGIN.x) / CLUSTER_MAP_POSITION_SIZE.x,
    y: (point.y - CLUSTER_MAP_POSITION_ORIGIN.y) / CLUSTER_MAP_POSITION_SIZE.y,
  }
}

export function useClusterSystemPlacement({ workspace, clusterMapRef, applyWorkspace }: ClusterSystemPlacementOptions) {
  const store = useEditorUiStore()
  const clusterAddType = ref<ClusterAddType | null>(null)
  const formError = ref('')
  const systemMoveError = ref('')
  const systemMovePreview = ref<ClusterSystemMovePreview | null>(null)
  const clusterSystemMapMoveTargeting = ref(false)
  const systemMoveCandidateScene = ref<Point | null>(null)
  const systemMoveOrigin = ref<{ clusterId: string; systemId: string; position: Point } | null>(null)
  const nextPreviewToken = ref(0)
  const clusterAddError = computed(() => formError.value)
  const clusterSystemMoveError = computed(() => systemMoveError.value)
  const clusterMoveTargeting = computed(() => store.activeView === 'cluster'
    && store.mapMode === 'move'
    && store.clusterSelectedSystemId !== null)

  function clearErrors(): void {
    formError.value = ''
    systemMoveError.value = ''
  }

  function clearSystemMovePreview(): void {
    const preview = systemMovePreview.value
    if (preview) clusterMapRef.value?.setClusterSystemPositionPreview?.(preview.sourceSystemId, null)
    systemMovePreview.value = null
  }

  function cancelSystemMovePreview(): void {
    const wasTargeting = clusterSystemMapMoveTargeting.value || systemMovePreview.value !== null
    clearSystemMovePreview()
    systemMoveCandidateScene.value = null
    systemMoveOrigin.value = null
    clusterSystemMapMoveTargeting.value = false
    systemMoveError.value = ''
    if (wasTargeting) clusterMapRef.value?.focusMap?.()
  }

  function armSystemAdd(): void {
    if (!workspace.value || store.activeView !== 'cluster') return
    cancelSystemMovePreview()
    clusterAddType.value = 'system'
    clearErrors()
    clusterMapRef.value?.focusMap?.()
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

  function pointOverlapsSystem(
    scenePoint: Point,
    currentWorkspace: LocalWorkspace,
    ignoredSystemId?: string,
  ): boolean {
    return currentWorkspace.cluster.systems.some((system) => {
      if (system.id === ignoredSystemId) return false
      const existing = clusterSystemPosition(currentWorkspace.layout.systemPositions, system.id)
      return Math.abs(scenePoint.x - existing.x) < CLUSTER_SYSTEM_CARD_WIDTH
        && Math.abs(scenePoint.y - existing.y) < CLUSTER_SYSTEM_CARD_HEIGHT
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

    const targetScenePosition = scenePositionForNormalizedPoint(point)
    const liveSystemIds = new Set(currentWorkspace.cluster.systems.map(system => system.id))
    if (systemIds.some(id => liveSystemIds.has(id)) || pointOverlapsSystem(targetScenePosition, currentWorkspace)) {
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
      void durable.catch(() => undefined)
      return true
    } catch (error) {
      formError.value = error instanceof Error ? error.message : String(error)
      return false
    }
  }

  function beginClusterSystemMapMove(): boolean {
    if (!clusterMoveTargeting.value || clusterAddType.value !== null) return false
    const currentWorkspace = workspace.value
    const sourceSystemId = store.clusterSelectedSystemId
    const sourceSystem = currentWorkspace?.cluster.systems.find(system => system.id === sourceSystemId)
    if (!currentWorkspace || !sourceSystem || !sourceSystemId) {
      systemMoveError.value = 'Choose a system that is still on this Cluster.'
      return false
    }

    const originPosition = currentWorkspace.layout.systemPositions[sourceSystemId]
    if (!originPosition) {
      systemMoveError.value = 'The selected system has no saved Cluster position.'
      return false
    }

    clearSystemMovePreview()
    systemMoveError.value = ''
    systemMoveOrigin.value = {
      clusterId: currentWorkspace.cluster.id,
      systemId: sourceSystemId,
      position: { ...originPosition },
    }
    systemMoveCandidateScene.value = scenePositionForNormalizedPoint(originPosition)
    clusterSystemMapMoveTargeting.value = true
    clusterMapRef.value?.focusMap?.()
    return true
  }

  function previewSystemMoveAt(scenePoint: Point, systemIds: string[] = []): boolean {
    if (!clusterSystemMapMoveTargeting.value) return false
    if (Number.isFinite(scenePoint.x) && Number.isFinite(scenePoint.y)) {
      // Keep the keyboard candidate even when the current point is invalid, so arrows can leave
      // an occupied or out-of-bounds location and reach a valid destination.
      systemMoveCandidateScene.value = { ...scenePoint }
    }
    clearSystemMovePreview()
    systemMoveError.value = ''

    const currentWorkspace = workspace.value
    const origin = systemMoveOrigin.value
    if (!currentWorkspace || !origin) return false
    const sourceSystem = currentWorkspace.cluster.systems.find(system => system.id === origin.systemId)
    const currentOrigin = currentWorkspace.layout.systemPositions[origin.systemId]
    if (currentWorkspace.cluster.id !== origin.clusterId
      || !sourceSystem
      || currentOrigin?.x !== origin.position.x
      || currentOrigin?.y !== origin.position.y
      || store.clusterSelectedSystemId !== origin.systemId) {
      systemMoveError.value = 'The selected system changed. Choose a source and preview its destination again.'
      return false
    }
    if (!Number.isFinite(scenePoint.x) || !Number.isFinite(scenePoint.y)) {
      systemMoveError.value = 'Choose a finite map destination.'
      return false
    }

    const point = normalizedPointForScenePosition(scenePoint)
    if (point.x < 0 || point.x > 1 || point.y < 0 || point.y > 1) {
      systemMoveError.value = 'Choose a point inside the Cluster map.'
      return false
    }
    if (systemIds.some(id => id !== origin.systemId)
      || pointOverlapsSystem(scenePoint, currentWorkspace, origin.systemId)) {
      systemMoveError.value = 'Choose an open point clear of other systems.'
      return false
    }
    if (point.x === origin.position.x && point.y === origin.position.y) {
      systemMoveError.value = 'Choose a different point from the current location.'
      return false
    }

    const preview: ClusterSystemMovePreview = {
      token: ++nextPreviewToken.value,
      clusterId: currentWorkspace.cluster.id,
      sourceSystemId: origin.systemId,
      originPosition: { ...origin.position },
      targetPosition: point,
    }
    systemMovePreview.value = preview
    clusterMapRef.value?.setClusterSystemPositionPreview?.(origin.systemId, point)
    return true
  }

  function nudgeClusterSystemMove(delta: Point): boolean {
    if (!clusterSystemMapMoveTargeting.value
      || !Number.isFinite(delta.x)
      || !Number.isFinite(delta.y)) return false
    const candidate = systemMoveCandidateScene.value
    if (!candidate) return false
    return previewSystemMoveAt({ x: candidate.x + delta.x, y: candidate.y + delta.y })
  }

  function confirmSystemMove(): boolean {
    const preview = systemMovePreview.value
    const currentWorkspace = workspace.value
    if (!preview || !currentWorkspace) return false
    const currentSource = currentWorkspace.cluster.systems.find(system => system.id === preview.sourceSystemId)
    const currentOrigin = currentSource
      ? currentWorkspace.layout.systemPositions[preview.sourceSystemId]
      : undefined
    const isCurrent = clusterSystemMapMoveTargeting.value
      && systemMovePreview.value?.token === preview.token
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
    if (pointOverlapsSystem(scenePositionForNormalizedPoint(preview.targetPosition), currentWorkspace, preview.sourceSystemId)) {
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
    // The map's live marker should remain at the candidate until the new committed workspace
    // redraws it; clearing the preview here would briefly jump the marker back to its origin.
    systemMovePreview.value = null
    systemMoveCandidateScene.value = null
    systemMoveOrigin.value = null
    clusterSystemMapMoveTargeting.value = false
    systemMoveError.value = ''
    try {
      const { durable } = applyWorkspace(nextWorkspace)
      void durable.catch(() => undefined)
      clusterMapRef.value?.focusMap?.()
      return true
    } catch (error) {
      clusterMapRef.value?.setClusterSystemPositionPreview?.(preview.sourceSystemId, null)
      systemMoveError.value = error instanceof Error ? error.message : String(error)
      clusterMapRef.value?.focusMap?.()
      return false
    }
  }

  watch([() => store.activeView, () => store.mapMode, () => store.clusterSelectedSystemId], ([view, mode, systemId]) => {
    const preview = systemMovePreview.value
    const origin = systemMoveOrigin.value
    if (origin && (view !== 'cluster' || mode !== 'move' || systemId !== origin.systemId)) {
      cancelSystemMovePreview()
    } else if (preview && (view !== 'cluster' || mode !== 'move' || systemId !== preview.sourceSystemId)) {
      cancelSystemMovePreview()
    }
  }, { flush: 'sync' })

  watch(workspace, (currentWorkspace) => {
    const preview = systemMovePreview.value
    const origin = systemMoveOrigin.value
    if (!origin) return
    if (!currentWorkspace) {
      cancelSystemMovePreview()
      systemMoveError.value = 'The selected system changed. Choose a source and preview its destination again.'
      return
    }
    const sourceExists = currentWorkspace.cluster.id === origin.clusterId
      && currentWorkspace.cluster.systems.some(system => system.id === origin.systemId)
    const currentOrigin = sourceExists ? currentWorkspace.layout.systemPositions[origin.systemId] : undefined
    if (currentOrigin?.x !== origin.position.x || currentOrigin?.y !== origin.position.y) {
      cancelSystemMovePreview()
      systemMoveError.value = 'The selected system changed. Choose a source and preview its destination again.'
      return
    }

    if (!preview) return
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
    clusterSystemMapMoveTargeting,
    clusterSystemMovePreview: systemMovePreview,
    clusterSystemMoveError,
    armSystemAdd,
    armRouteAdd,
    quitClusterAdd,
    addSystemAt,
    beginClusterSystemMapMove,
    previewSystemMoveAt,
    nudgeClusterSystemMove,
    cancelSystemMovePreview,
    confirmSystemMove,
  }
}
