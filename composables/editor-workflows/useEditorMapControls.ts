import { computed, onBeforeUnmount, shallowRef, watch, type Ref } from 'vue'
import type { LocalWorkspace } from '../../domain/workspace'
import type { EntityInspectorSession, MapNavigationHandle, MapVisitMemory, MapVisitSelection, OrbitPlacementPreview, SystemMapHandle } from './types'
import type { useEditorUiStore } from '../../stores/editor-ui'
import { MAP_ZOOM_MAX_SCALE, MAP_ZOOM_MIN_SCALE, type MapViewport } from '../../utils/map-zoom'

type EditorUiStore = ReturnType<typeof useEditorUiStore>

/** Owns mounted map handles and viewport operations; visit snapshots remain serializable Pinia state. */
export function useEditorMapControls(
  workspace: Readonly<{ value: LocalWorkspace | null }>,
  store: EditorUiStore,
  previews: {
    orbitPlacementPreview: Readonly<Ref<{ sessionId: number; orbitId: string; preview: OrbitPlacementPreview } | null>>
    entitySession: Readonly<Ref<EntityInspectorSession | null>>
  },
) {
  const clusterMapRef = shallowRef<MapNavigationHandle | null>(null)
  const systemMapRef = shallowRef<SystemMapHandle | null>(null)
  const activeMapKey = computed(() => {
    const clusterId = workspace.value?.cluster.id
    if (!clusterId) return null
    if (store.activeView === 'cluster') return `cluster:${clusterId}`
    return store.selectedSystemId ? `system:${clusterId}:${store.selectedSystemId}` : null
  })
  const initialViewport = computed(() => {
    const key = activeMapKey.value
    return key ? store.visits[key]?.viewport ?? null : null
  })
  const zoomLevel = computed(() => Math.round((initialViewport.value?.k ?? 1) * 100))

  let appliedOrbitPreview: { map: SystemMapHandle; orbitId: string } | null = null
  watch(
    [systemMapRef, previews.orbitPlacementPreview, () => store.activeView, () => store.selectedSystemId, previews.entitySession],
    ([map, preview, view, systemId, session]) => {
      const activePreview = preview !== null
        && view === 'system'
        && session?.kind === 'orbit'
        && session.id === preview.sessionId
        && session.systemId === systemId
        ? preview
        : null
      if (appliedOrbitPreview && (appliedOrbitPreview.map !== map
        || !activePreview || appliedOrbitPreview.orbitId !== activePreview.orbitId)) {
        appliedOrbitPreview.map.setOrbitPlacementPreview(appliedOrbitPreview.orbitId, null)
        appliedOrbitPreview = null
      }
      if (map && activePreview) {
        map.setOrbitPlacementPreview(activePreview.orbitId, activePreview.preview)
        appliedOrbitPreview = { map, orbitId: activePreview.orbitId }
      }
    },
    { flush: 'post', immediate: true },
  )
  onBeforeUnmount(() => {
    appliedOrbitPreview?.map.setOrbitPlacementPreview(appliedOrbitPreview.orbitId, null)
    appliedOrbitPreview = null
  })

  function activeMapHandle(): MapNavigationHandle | null {
    return store.activeView === 'cluster' ? clusterMapRef.value : systemMapRef.value
  }

  function selectionForActiveMap(): MapVisitSelection {
    if (store.activeView === 'cluster') {
      if (store.clusterSelectedSystemId) {
        return {
          kind: 'system',
          id: store.clusterSelectedSystemId,
          inspect: store.inspectedClusterSystemId === store.clusterSelectedSystemId,
        }
      }
      if (store.selectedRouteId) return { kind: 'route', id: store.selectedRouteId }
      return { kind: 'none' }
    }
    if (store.selectedObjectId) return { kind: 'object', id: store.selectedObjectId }
    if (store.selectedOrbitId) return { kind: 'orbit', id: store.selectedOrbitId }
    return { kind: 'none' }
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

  function rememberCurrent(key: string, viewport: MapViewport): void {
    const visit: MapVisitMemory = { viewport, selection: selectionForActiveMap() }
    store.rememberVisit(key, visit, activeMapKey.value ?? undefined)
  }

  /** Captures the current camera and selection before an accepted context change. */
  function captureActiveMap(): void {
    const key = activeMapKey.value
    if (!key) return
    const viewport = activeMapHandle()?.getViewport() ?? store.visits[key]?.viewport ?? { x: 0, y: 0, k: 1 }
    rememberCurrent(key, viewport)
  }

  /** Accepts viewport feedback only from the still-active map context. */
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
    rememberCurrent(key, {
      x: viewport.x,
      y: viewport.y,
      k: Math.max(MAP_ZOOM_MIN_SCALE, Math.min(MAP_ZOOM_MAX_SCALE, viewport.k)),
    })
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

  function pruneVisits(normalizeSelection: (key: string, selection: MapVisitSelection) => MapVisitSelection): void {
    const currentWorkspace = workspace.value
    if (!currentWorkspace) {
      store.pruneVisits([], normalizeSelection)
      return
    }
    const systemIds = new Set(currentWorkspace.cluster.systems.map(system => system.id))
    const validKeys = Object.keys(store.visits).filter((key) => {
      const clusterPrefix = `cluster:${currentWorkspace.cluster.id}`
      const systemPrefix = `system:${currentWorkspace.cluster.id}:`
      if (key === clusterPrefix) return true
      if (!key.startsWith(systemPrefix)) return false
      return systemIds.has(key.slice(systemPrefix.length))
    })
    store.pruneVisits(validKeys, normalizeSelection)
  }

  return {
    clusterMapRef,
    systemMapRef,
    activeMapKey,
    initialViewport,
    zoomLevel,
    selectionForActiveMap,
    validVisitSelection,
    captureActiveMap,
    recordViewport,
    pruneVisits,
    setViewportPercentage,
    fitActiveMap,
    zoomActiveMap,
    panActiveMap,
  }
}
