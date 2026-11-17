/** Owns click and keyboard previews for an existing unoccupied Orbit center. */
import { computed, onBeforeUnmount, ref, watch, type ComputedRef, type Ref } from 'vue'
import type { LocalWorkspace, Point, StarSystem, Orbit } from '../../domain/workspace'
import { toNormalizedMapPoint } from '../../utils/system-map-geometry'
import type { EntityCommand, OrbitCenterMovePreview, MapNavigationHandle } from './types'
import { useEditorUiStore } from '../../stores/editor-ui'

interface OrbitCenterPlacementOptions {
  workspace: Readonly<Ref<LocalWorkspace | null>>
  creationActive: Readonly<ComputedRef<boolean>>
  systemMapRef: Readonly<Ref<MapNavigationHandle | null>>
  continuousMap?: Readonly<Ref<boolean>>
  isEntityCommandBlocked: (command: EntityCommand) => boolean
  moveOrbitCenter: (
    orbitId: string,
    center: Point,
    hostId: string | null,
    isCurrent?: () => boolean,
    systemId?: string,
  ) => Promise<boolean>
}

interface OrbitCenterMoveSource {
  clusterId: string
  systemId: string
  orbitId: string
  previousCenter: Point
}

function samePoint(left: Point, right: Point): boolean {
  return left.x === right.x && left.y === right.y
}

function toScenePoint(center: Point): Point {
  return { x: 64 + center.x * 832, y: 72 + center.y * 416 }
}

/**
 * Provides a focused Move preview while leaving durable center changes to the existing map workflow.
 * Radius and rotation edits do not invalidate an active center preview; changing its source center,
 * host, selection, system or map mode does.
 */
export function useOrbitCenterPlacement({
  workspace,
  creationActive,
  systemMapRef,
  continuousMap,
  isEntityCommandBlocked,
  moveOrbitCenter,
}: OrbitCenterPlacementOptions) {
  const store = useEditorUiStore()
  const orbitCenterMapMoveTargeting = ref(false)
  const orbitCenterMovePreview = ref<OrbitCenterMovePreview | null>(null)
  const orbitCenterMoveError = ref('')
  const orbitCenterMoveAvailable = computed(() => {
    return store.mapMode === 'move'
      && !creationActive.value
      && currentFreeOrbit() !== null
  })

  let source: OrbitCenterMoveSource | null = null
  let targetScenePoint: Point | null = null
  let nextToken = 0
  let pendingConfirmationToken: number | null = null
  let pendingConfirmationContextInvalidated = false
  let appliedPreview: { map: MapNavigationHandle; orbitId: string; systemId: string } | null = null

  function currentOwnerOrbitSelection(): { systemId: string; orbitId: string } | null {
    if (continuousMap?.value && store.activeView === 'cluster') {
      const target = store.inspectedTarget
      return target?.kind === 'orbit' ? { systemId: target.systemId, orbitId: target.orbitId } : null
    }
    return store.activeView === 'system' && store.selectedSystemId && store.selectedOrbitId
      ? { systemId: store.selectedSystemId, orbitId: store.selectedOrbitId }
      : null
  }

  function ownsCurrentOrbitSelection(systemId: string, orbitId: string): boolean {
    const selection = currentOwnerOrbitSelection()
    return selection?.systemId === systemId && selection.orbitId === orbitId
  }

  function currentFreeOrbit(): { workspace: LocalWorkspace; system: StarSystem; orbit: Orbit } | null {
    const currentWorkspace = workspace.value
    const selection = currentOwnerOrbitSelection()
    if (!currentWorkspace || !selection) return null
    const system = currentWorkspace.cluster.systems.find(candidate => candidate.id === selection.systemId)
    const orbit = system?.orbits.find(candidate => candidate.id === selection.orbitId)
    if (!system || !orbit || orbit.hostId !== null) return null
    return { workspace: currentWorkspace, system, orbit }
  }

  function currentMatchesSource(): boolean {
    const current = currentFreeOrbit()
    const center = current?.orbit.center
    return !!source && !!current && !!center
      && current.workspace.cluster.id === source.clusterId
      && current.system.id === source.systemId
      && current.orbit.id === source.orbitId
      && current.orbit.hostId === null
      && samePoint(center, source.previousCenter)
  }

  function cancelOrbitCenterMove(returnFocus = true): void {
    const preview = orbitCenterMovePreview.value
    const orbitId = source?.orbitId ?? preview?.orbitId
    if (orbitId) systemMapRef.value?.setOrbitCenterMovePreview?.(orbitId, null, source?.systemId ?? preview?.systemId)
    orbitCenterMapMoveTargeting.value = false
    orbitCenterMovePreview.value = null
    orbitCenterMoveError.value = ''
    source = null
    targetScenePoint = null
    if (returnFocus) systemMapRef.value?.focusMap?.()
  }

  function canMoveCurrentCenter(): boolean {
    return !!source && !isEntityCommandBlocked({ kind: 'orbit-center-position', orbitId: source.orbitId })
  }

  function beginOrbitCenterMapMove(): boolean {
    if (!orbitCenterMoveAvailable.value) return false
    if (orbitCenterMapMoveTargeting.value && source && currentMatchesSource()) return true

    cancelOrbitCenterMove(false)
    const current = currentFreeOrbit()
    if (!current) return false
    const command: Extract<EntityCommand, { kind: 'orbit-center-position' }> = {
      kind: 'orbit-center-position',
      orbitId: current.orbit.id,
    }
    if (isEntityCommandBlocked(command)) {
      orbitCenterMoveError.value = 'Resolve the Inspector host draft before moving this Orbit center.'
      return false
    }
    const center = current.orbit.center
    if (!center || ![center.x, center.y].every(Number.isFinite)) {
      orbitCenterMoveError.value = 'This Orbit center has invalid map coordinates and cannot be moved.'
      return false
    }

    source = {
      clusterId: current.workspace.cluster.id,
      systemId: current.system.id,
      orbitId: current.orbit.id,
      previousCenter: { ...center },
    }
    targetScenePoint = toScenePoint(center)
    orbitCenterMoveError.value = ''
    orbitCenterMapMoveTargeting.value = true
    systemMapRef.value?.focusMap?.()
    return true
  }

  function previewOrbitCenterMoveAt(scenePoint: Point): boolean {
    const current = currentFreeOrbit()
    if (!current) return false
    const localPoint = continuousMap?.value && store.activeView === 'cluster'
      ? systemMapRef.value?.toSystemScenePoint?.(current.system.id, scenePoint) ?? null
      : scenePoint
    if (!localPoint) {
      orbitCenterMoveError.value = 'The owning system is no longer visible for this Orbit-center move.'
      return false
    }
    return previewOrbitCenterMoveAtLocal(localPoint)
  }

  function previewOrbitCenterMoveAtLocal(scenePoint: Point): boolean {
    if (!orbitCenterMapMoveTargeting.value && !beginOrbitCenterMapMove()) return false
    if (!source || !currentMatchesSource()) {
      cancelOrbitCenterMove(false)
      orbitCenterMoveError.value = 'The Orbit center or map changed. Start the move again.'
      return false
    }
    if (![scenePoint.x, scenePoint.y].every(Number.isFinite)) {
      orbitCenterMoveError.value = 'Choose a finite map destination.'
      return false
    }
    if (!canMoveCurrentCenter()) {
      cancelOrbitCenterMove(false)
      orbitCenterMoveError.value = 'Resolve the Inspector host draft before moving this Orbit center.'
      return false
    }

    targetScenePoint = { ...scenePoint }
    orbitCenterMoveError.value = ''
    orbitCenterMovePreview.value = {
      token: ++nextToken,
      clusterId: source.clusterId,
      systemId: source.systemId,
      orbitId: source.orbitId,
      previousCenter: { ...source.previousCenter },
      targetCenter: toNormalizedMapPoint(scenePoint),
    }
    systemMapRef.value?.focusMap?.()
    return true
  }

  function nudgeOrbitCenterMove(delta: Point): boolean {
    if (![delta.x, delta.y].every(Number.isFinite)) return false
    if (!orbitCenterMapMoveTargeting.value && !beginOrbitCenterMapMove()) return false
    const current = targetScenePoint
    if (!current) return false
    return previewOrbitCenterMoveAtLocal({ x: current.x + delta.x, y: current.y + delta.y })
  }

  async function confirmOrbitCenterMove(token: number): Promise<boolean> {
    const preview = orbitCenterMovePreview.value
    if (!preview || preview.token !== token || !currentMatchesSource()) {
      cancelOrbitCenterMove()
      orbitCenterMoveError.value = 'The Orbit center or map changed. Preview the move again.'
      return false
    }
    if (!canMoveCurrentCenter()) {
      cancelOrbitCenterMove()
      orbitCenterMoveError.value = 'Resolve the Inspector host draft before moving this Orbit center.'
      return false
    }

    pendingConfirmationToken = preview.token
    try {
      const isCurrent = (): boolean => orbitCenterMovePreview.value?.token === preview.token
        && !pendingConfirmationContextInvalidated
        && source !== null
        && source.clusterId === preview.clusterId
        && source.systemId === preview.systemId
        && source.orbitId === preview.orbitId
        && source.previousCenter.x === preview.previousCenter.x
        && source.previousCenter.y === preview.previousCenter.y
        && store.mapMode === 'move'
        && ownsCurrentOrbitSelection(preview.systemId, preview.orbitId)
        && !creationActive.value
        && currentMatchesSource()
        && canMoveCurrentCenter()
      const applied = await moveOrbitCenter(preview.orbitId, { ...preview.targetCenter }, null, isCurrent, preview.systemId)
      if (!applied) {
        const stillOwnsPreview = orbitCenterMovePreview.value?.token === preview.token
        const contextIsStillValid = orbitCenterMoveAvailable.value
          && currentMatchesSource()
          && canMoveCurrentCenter()
          && !pendingConfirmationContextInvalidated
        if (stillOwnsPreview && !contextIsStillValid) {
          cancelOrbitCenterMove(false)
          orbitCenterMoveError.value = 'The Orbit-center move context changed. Start the move again.'
        }
        return false
      }
      if (orbitCenterMovePreview.value?.token === preview.token) {
        cancelOrbitCenterMove(false)
        systemMapRef.value?.focusMap?.()
      }
      return true
    } catch (error) {
      if (orbitCenterMovePreview.value?.token === preview.token) {
        orbitCenterMoveError.value = error instanceof Error ? error.message : String(error)
      }
      return false
    } finally {
      if (pendingConfirmationToken === preview.token) {
        pendingConfirmationToken = null
        pendingConfirmationContextInvalidated = false
      }
    }
  }

  watch(
    [systemMapRef, orbitCenterMovePreview],
    ([map, preview]) => {
      if (appliedPreview && (appliedPreview.map !== map
        || !preview || appliedPreview.orbitId !== preview.orbitId)) {
        appliedPreview.map.setOrbitCenterMovePreview?.(appliedPreview.orbitId, null, appliedPreview.systemId)
        appliedPreview = null
      }
      if (map && preview) {
        map.setOrbitCenterMovePreview?.(preview.orbitId, toScenePoint(preview.targetCenter), preview.systemId)
        appliedPreview = { map, orbitId: preview.orbitId, systemId: preview.systemId }
      }
    },
    { flush: 'post', immediate: true },
  )

  watch(
    [workspace, () => store.activeView, () => store.mapMode, () => store.selectedSystemId,
      () => store.selectedOrbitId, () => store.inspectedTarget, () => continuousMap?.value, creationActive, () => source
        ? isEntityCommandBlocked({ kind: 'orbit-center-position', orbitId: source.orbitId })
        : false],
    () => {
      if (!source) return
      if (pendingConfirmationToken !== null) {
        if (!orbitCenterMoveAvailable.value || !currentMatchesSource() || !canMoveCurrentCenter()) {
          pendingConfirmationContextInvalidated = true
        }
        return
      }
      if (!orbitCenterMoveAvailable.value || !currentMatchesSource() || !canMoveCurrentCenter()) {
        cancelOrbitCenterMove(false)
        return
      }
      // An Inspector may apply a radius or rotation draft while this center target is pending.
      // The separate renderer overlay uses the newly committed Orbit geometry automatically.
      if (orbitCenterMovePreview.value && targetScenePoint) {
        orbitCenterMovePreview.value = { ...orbitCenterMovePreview.value }
      }
    },
    { flush: 'sync', deep: true },
  )

  onBeforeUnmount(() => {
    if (appliedPreview) appliedPreview.map.setOrbitCenterMovePreview?.(appliedPreview.orbitId, null, appliedPreview.systemId)
    appliedPreview = null
  })

  return {
    orbitCenterMoveAvailable,
    orbitCenterMapMoveTargeting,
    orbitCenterMovePreview,
    orbitCenterMoveError,
    beginOrbitCenterMapMove,
    previewOrbitCenterMoveAt,
    nudgeOrbitCenterMove,
    confirmOrbitCenterMove,
    cancelOrbitCenterMove,
  }
}
