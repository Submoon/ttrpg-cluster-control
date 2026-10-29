/** Owns map-only previews and durable placement of unresolved Jump Route endpoints. */
import { computed, ref, watch, type Ref } from 'vue'
import { isLocalWorkspace, jumpPointsInCluster, moveUnresolvedExitTarget, type LocalWorkspace, type Point } from '../../domain/workspace'
import { isPoint } from '../../domain/workspace-validation'
import { clusterRouteGeometry, hasSafeClusterSceneBounds, isSafeClusterScenePoint } from '../../utils/cluster-map-geometry'
import type { MapNavigationHandle } from './types'
import type { WorkspaceMutationExecutor, WorkspaceMutationResult } from './workspace-mutations'
import { useEditorUiStore } from '../../stores/editor-ui'

export interface UnresolvedExitMovePreview {
  token: number
  clusterId: string
  routeId: string
  position: Point
}

interface UnresolvedExitPlacementOptions {
  workspace: Readonly<Ref<LocalWorkspace | null>>
  selectedRouteId: Readonly<Ref<string | null>>
  clusterMapRef: Readonly<Ref<MapNavigationHandle | null>>
  mutations: WorkspaceMutationExecutor
  beforeWorkspaceOperation: () => Promise<boolean>
}

/** Keeps endpoint layout independent from route drafts; automatic points follow their source systems. */
export function useUnresolvedExitPlacement({
  workspace,
  selectedRouteId,
  clusterMapRef,
  mutations,
  beforeWorkspaceOperation,
}: UnresolvedExitPlacementOptions) {
  const store = useEditorUiStore()
  const targetingIntent = ref(false)
  const preview = ref<UnresolvedExitMovePreview | null>(null)
  const error = ref('')
  let nextPreviewToken = 0
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
    const route = current?.cluster.routes.find(candidate => candidate.id === routeId)
    if (!current || !route || route.toPointId !== null) return null
    const jumpPoints = new Map(jumpPointsInCluster(current.cluster).map(reference => [reference.point.id, reference]))
    return clusterRouteGeometry(
      route,
      current.cluster,
      jumpPoints,
      current.layout.systemPositions,
      undefined,
      current.layout.unresolvedExitPositions,
    ).exitPoint ?? null
  }

  function positionFor(routeId: string): Point | null {
    const current = workspace.value
    if (!currentRoute(routeId) || !current) return null
    return current.layout.unresolvedExitPositions?.[routeId] ?? automaticPosition(routeId)
  }

  function candidateFor(current: LocalWorkspace, routeId: string, position: Point): LocalWorkspace {
    if (!isSafeClusterScenePoint(position)) {
      throw new Error("This position exceeds the map renderer's supported numeric range.")
    }
    const candidate = moveUnresolvedExitTarget(current, routeId, position)
    if (!hasSafeClusterSceneBounds(candidate.cluster, candidate.layout.systemPositions, candidate.layout.unresolvedExitPositions)) {
      throw new Error("This position exceeds the map renderer's supported numeric range.")
    }
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
    const clusterId = workspace.value?.cluster.id
    if (!clusterId) return false
    preview.value = { token: ++nextPreviewToken, clusterId, routeId, position: { ...position } }
    clusterMapRef.value?.setUnresolvedExitPositionPreview?.(routeId, position)
    clusterMapRef.value?.focusMap?.()
    return true
  }

  function previewAt(position: Point): boolean {
    const routeId = selectedRouteId.value
    if (!targeting.value || !routeId) return false
    if (!isPoint(position)) {
      clearPreview()
      targetingIntent.value = false
      error.value = "This position exceeds the map renderer's supported numeric range."
      return false
    }
    try {
      const current = workspace.value
      if (!current) throw new Error('The Jump Cluster is no longer available.')
      candidateFor(current, routeId, position)
      error.value = ''
      preview.value = {
        token: ++nextPreviewToken,
        clusterId: current.cluster.id,
        routeId,
        position: { x: position.x, y: position.y },
      }
      clusterMapRef.value?.setUnresolvedExitPositionPreview?.(routeId, position)
      clusterMapRef.value?.focusMap?.()
      return true
    } catch (cause) {
      clearPreview()
      targetingIntent.value = false
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

  function throwIfRejected(result: WorkspaceMutationResult): void {
    if (result.status === 'rejected') throw new Error(result.message)
  }

  async function publish(routeId: string, clusterId: string, position: Point, previewToken?: number): Promise<boolean> {
    try {
      const result = await mutations.execute({
        action: {
          kind: 'move',
          label: 'Move unresolved Jump Route target',
          target: { kind: 'route', id: routeId },
          parent: { kind: 'cluster', id: clusterId },
        },
        isCurrent: () => {
          const latest = workspace.value
          return latest?.cluster.id === clusterId
            && latest.cluster.routes.some(route => route.id === routeId && route.toPointId === null)
            && (previewToken === undefined || preview.value?.token === previewToken
              && store.activeView === 'cluster' && selectedRouteId.value === routeId)
        },
        prepare: (latest) => {
          if (latest.cluster.id !== clusterId) throw new Error('The Jump Cluster changed before this target could be moved.')
          return candidateFor(latest, routeId, position)
        },
      })
      if (result.status === 'applied') void result.durable.catch(() => undefined)
      throwIfRejected(result)
      error.value = ''
      return true
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : String(cause)
      return false
    }
  }

  async function confirm(): Promise<boolean> {
    if (!await beforeWorkspaceOperation()) return false
    const active = preview.value
    const current = workspace.value
    if (!targeting.value || !active || !current) return false
    if (active.clusterId !== current.cluster.id
      || !current.cluster.routes.some(route => route.id === active.routeId && route.toPointId === null)
      || selectedRouteId.value !== active.routeId || store.activeView !== 'cluster') {
      error.value = 'The selected Jump Route changed. Preview the target again.'
      return false
    }
    if (!await publish(active.routeId, active.clusterId, active.position, active.token)) return false
    if (preview.value?.token !== active.token) return false
    clearPreview()
    targetingIntent.value = false
    clusterMapRef.value?.focusMap?.()
    return true
  }

  /** A completed marker drag is an immediate one-action commit, independent of selection drafts. */
  async function move(routeId: string, position: Point): Promise<boolean> {
    const startingClusterId = workspace.value?.cluster.id
    if (!startingClusterId || !await beforeWorkspaceOperation()) return false
    const current = workspace.value
    if (!current || current.cluster.id !== startingClusterId
      || !current.cluster.routes.some(route => route.id === routeId && route.toPointId === null)) return false
    const applied = positionFor(routeId)
    if (applied?.x === position.x && applied.y === position.y) return true
    const result = await publish(routeId, startingClusterId, position)
    if (result) {
      clearPreview()
      targetingIntent.value = false
      clusterMapRef.value?.focusMap?.()
    }
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
