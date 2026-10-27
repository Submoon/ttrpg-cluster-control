/** Owns map-only previews and durable placement of unresolved Jump Route endpoints. */
import { computed, ref, watch, type Ref } from 'vue'
import { isLocalWorkspace, jumpPointsInCluster, moveUnresolvedExitTarget, type LocalWorkspace, type Point } from '../../domain/workspace'
import { isPoint } from '../../domain/workspace-validation'
import { clusterRouteGeometry } from '../../utils/cluster-map-geometry'
import type { EditorWorkflowOptions, MapNavigationHandle } from './types'
import { useEditorUiStore } from '../../stores/editor-ui'

export interface UnresolvedExitMovePreview {
  routeId: string
  position: Point
}

interface UnresolvedExitPlacementOptions {
  workspace: Readonly<Ref<LocalWorkspace | null>>
  selectedRouteId: Readonly<Ref<string | null>>
  clusterMapRef: Readonly<Ref<MapNavigationHandle | null>>
  applyWorkspace: EditorWorkflowOptions['applyWorkspace']
}

/** Keeps endpoint layout independent from route drafts and the route's source-system placement. */
export function useUnresolvedExitPlacement({
  workspace,
  selectedRouteId,
  clusterMapRef,
  applyWorkspace,
}: UnresolvedExitPlacementOptions) {
  const store = useEditorUiStore()
  const targetingIntent = ref(false)
  const preview = ref<UnresolvedExitMovePreview | null>(null)
  const error = ref('')
  const available = computed(() => {
    const current = workspace.value
    const routeId = selectedRouteId.value
    return store.activeView === 'cluster'
      && !!current?.cluster.routes.some(route => route.id === routeId && route.toPointId === null)
  })
  const targeting = computed(() => available.value && store.mapMode === 'move' && targetingIntent.value)

  function currentRoute(routeId: string): LocalWorkspace['cluster']['routes'][number] | undefined {
    return workspace.value?.cluster.routes.find(route => route.id === routeId && route.toPointId === null)
  }

  function automaticPosition(routeId: string): Point | null {
    const current = workspace.value
    const routeIndex = current?.cluster.routes.findIndex(route => route.id === routeId) ?? -1
    const route = current?.cluster.routes[routeIndex]
    if (!current || !route || route.toPointId !== null) return null
    const jumpPoints = new Map(jumpPointsInCluster(current.cluster).map(reference => [reference.point.id, reference]))
    return clusterRouteGeometry(route, routeIndex, jumpPoints, current.layout.systemPositions).exitPoint ?? null
  }

  function positionFor(routeId: string): Point | null {
    const current = workspace.value
    if (!currentRoute(routeId) || !current) return null
    return current.layout.unresolvedExitPositions?.[routeId] ?? automaticPosition(routeId)
  }

  function candidateFor(routeId: string, position: Point): LocalWorkspace {
    const current = workspace.value
    if (!current) throw new Error('The Jump Cluster is no longer available.')
    const candidate = moveUnresolvedExitTarget(current, routeId, position)
    if (!isLocalWorkspace(candidate)) {
      throw new Error('This position creates invalid Jump Route geometry.')
    }
    return candidate
  }

  function clearPreview(): void {
    const active = preview.value
    if (active) clusterMapRef.value?.setUnresolvedExitPositionPreview?.(active.routeId, null)
    preview.value = null
  }

  function cancel(): void {
    const ownedMove = targetingIntent.value || preview.value !== null
    clearPreview()
    targetingIntent.value = false
    error.value = ''
    if (ownedMove) clusterMapRef.value?.focusMap?.()
  }

  function begin(): boolean {
    const routeId = selectedRouteId.value
    if (!available.value || store.mapMode !== 'move' || !routeId) return false
    const position = positionFor(routeId)
    if (!position) {
      error.value = 'The unresolved Jump Route target is unavailable.'
      return false
    }
    error.value = ''
    targetingIntent.value = true
    preview.value = { routeId, position: { ...position } }
    clusterMapRef.value?.setUnresolvedExitPositionPreview?.(routeId, position)
    clusterMapRef.value?.focusMap?.()
    return true
  }

  function previewAt(position: Point): boolean {
    const routeId = selectedRouteId.value
    if (!targeting.value || !routeId || !isPoint(position)) return false
    try {
      candidateFor(routeId, position)
      error.value = ''
      preview.value = { routeId, position: { x: position.x, y: position.y } }
      clusterMapRef.value?.setUnresolvedExitPositionPreview?.(routeId, position)
      clusterMapRef.value?.focusMap?.()
      return true
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : String(cause)
      return false
    }
  }

  function nudge(delta: Point): boolean {
    if (!isPoint(delta)) return false
    if (!targeting.value && !begin()) return false
    const active = preview.value
    if (!active) return false
    return previewAt({ x: active.position.x + delta.x, y: active.position.y + delta.y })
  }

  function publish(routeId: string, position: Point): boolean {
    try {
      const candidate = candidateFor(routeId, position)
      const { durable } = applyWorkspace(candidate)
      void durable.catch(() => undefined)
      error.value = ''
      return true
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : String(cause)
      return false
    }
  }

  function confirm(): boolean {
    const active = preview.value
    if (!targeting.value || !active) return false
    const appliedOverride = workspace.value?.layout.unresolvedExitPositions?.[active.routeId]
    const unchanged = appliedOverride !== undefined
      && appliedOverride.x === active.position.x
      && appliedOverride.y === active.position.y
    if (!unchanged && !publish(active.routeId, active.position)) return false
    clearPreview()
    targetingIntent.value = false
    clusterMapRef.value?.focusMap?.()
    return true
  }

  /** A completed marker drag is an immediate one-action commit, independent of selection drafts. */
  function move(routeId: string, position: Point): boolean {
    clearPreview()
    targetingIntent.value = false
    const applied = positionFor(routeId)
    if (applied?.x === position.x && applied.y === position.y) return true
    const result = publish(routeId, position)
    if (result) clusterMapRef.value?.focusMap?.()
    return result
  }

  watch([available, selectedRouteId, () => store.activeView, () => store.mapMode], ([isAvailable, routeId, activeView, mode]) => {
    if (!isAvailable || !preview.value || preview.value.routeId !== routeId
      || activeView !== 'cluster' || mode !== 'move') {
      clearPreview()
      targetingIntent.value = false
    }
  }, { flush: 'sync' })

  return { available, targeting, preview, error, begin, previewAt, nudge, confirm, cancel, move }
}
