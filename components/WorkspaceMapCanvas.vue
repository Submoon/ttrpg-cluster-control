<template>
  <div
    ref="canvasRoot"
    class="workspace-map-canvas"
    @pointerdown.capture="onPointerDownCapture"
    @contextmenu.capture="onContextMenuCapture"
    @click.capture="onClickCapture"
    @keydown.capture="onKeyDownCapture"
    @touchstart.capture="onTouchStartCapture"
    @touchmove.capture="onTouchMoveCapture"
    @touchend.capture="onTouchEndCapture"
    @touchcancel.capture="onTouchEndCapture"
  >
    <ClusterMap
      v-if="props.activeView === 'cluster'"
      ref="clusterMapRef"
      :cluster="props.workspace.cluster"
      :system-positions="props.workspace.layout.systemPositions"
      :selected-system-id="props.selectedSystemId"
      :selected-route-id="props.selectedRouteId"
      :move-enabled="props.mode === 'move'"
      :system-activation="props.mode === 'select' || props.mode === 'move' ? 'select' : 'open'"
      touch-navigation
      :show-zoom-controls="false"
      @activate-system="handleSystemActivation"
      @select-route="handleRouteSelection"
      @move-system="forwardMoveSystem"
      @viewport-change="emitViewport"
    />
    <SystemMap
      v-else-if="props.system"
      ref="systemMapRef"
      :system="props.system"
      :orbit-radii="props.workspace.layout.orbitRadii"
      :orbit-rotations="props.workspace.layout.orbitRotations"
      :object-angles="props.workspace.layout.objectAngles"
      :selected-object-id="props.selectedObjectId"
      :selected-orbit-id="props.selectedOrbitId"
      :is-object-move-blocked="props.isObjectMoveBlocked"
      :is-entity-command-blocked="props.isEntityCommandBlocked"
      :move-enabled="props.mode === 'move'"
      touch-navigation
      :show-zoom-controls="false"
      @select-object="handleObjectSelection"
      @select-orbit="handleOrbitSelection"
      @object-move-blocked="forwardBlockedObjectMove"
      @entity-command-blocked="emit('entity-command-blocked', $event)"
      @move-object="forwardMoveObject"
      @move-orbit-center="forwardMoveOrbitCenter"
      @rotate-object="forwardRotateObject"
      @resize-orbit="forwardResizeOrbit"
      @rotate-orbit="forwardRotateOrbit"
      @place-object-in-orbit="forwardPlaceObject"
      @drop-orbit="forwardDropOrbit"
      @drop-object="forwardDropObject"
      @viewport-change="emitViewport"
    />
  </div>
</template>

<script setup lang="ts">
/** Owns pointer arbitration around one stable map surface and forwards validated renderer commands. */
import { onBeforeUnmount, onMounted, nextTick, shallowRef, watch } from 'vue'
import type {
  CatalogueSubtype,
  LocalWorkspace,
  OrbitRadii,
  Point,
  StarSystem,
} from '../domain/workspace'
import type { MapInteractionMode, SystemMapHandle } from '../composables/editor-workflows/types'
import type { EntityCommand } from '../composables/editor-workflows/types'
import type { MapImageFormat } from '../utils/map-image-export'
import type { MapViewport } from '../utils/map-zoom'
import { clientRectToSvgViewportRect, type SvgViewportRect } from '../utils/map-zoom'
import { largestUnobstructedClientRect, type ClientRectBounds } from '../utils/map-usable-area'
import ClusterMap from './ClusterMap.vue'
import SystemMap from './SystemMap.vue'

const props = defineProps<{
  activeView: 'cluster' | 'system'
  mapKey: string
  initialViewport: MapViewport | null
  workspace: LocalWorkspace
  system: StarSystem | undefined
  selectedSystemId: string | null
  selectedObjectId: string | null
  selectedOrbitId: string | null
  selectedRouteId: string | null
  mode: MapInteractionMode
  isObjectMoveBlocked?: (objectId: string) => boolean
  isEntityCommandBlocked?: (command: EntityCommand) => boolean
  feedbackElement?: HTMLElement | null
}>()

const emit = defineEmits<{
  'navigate-system': [id: string]
  'select-cluster-system': [id: string]
  'move-select-cluster-system': [id: string]
  'select-route': [id: string]
  'move-select-route': [id: string]
  'select-object': [id: string]
  'move-select-object': [id: string]
  'select-orbit': [id: string]
  'move-select-orbit': [id: string]
  'object-move-blocked': [id: string]
  'entity-command-blocked': [command: EntityCommand]
  'move-system': [id: string, position: Point]
  'move-object': [id: string, position: Point]
  'move-orbit-center': [id: string, center: Point, hostId: string | null]
  'rotate-object': [id: string, angle: number]
  'resize-orbit': [id: string, radii: OrbitRadii]
  'rotate-orbit': [id: string, rotation: number]
  'place-object-in-orbit': [id: string, orbitId: string, angle: number]
  'drop-orbit': [point: Point, hostId: string | null]
  'drop-object': [subtype: CatalogueSubtype, point: Point, orbitId: string | null, angle: number | null]
  'viewport-change': [change: { key: string; viewport: MapViewport }]
}>()

type ClusterMapHandle = InstanceType<typeof ClusterMap>
type SystemMapInstance = InstanceType<typeof SystemMap>
const clusterMapRef = shallowRef<ClusterMapHandle | null>(null)
const systemMapRef = shallowRef<SystemMapInstance | null>(null)
const canvasRoot = shallowRef<HTMLElement | null>(null)
const currentMap = () => props.activeView === 'cluster' ? clusterMapRef.value : systemMapRef.value
let activePointerPan: { id: number; button: number; x: number; y: number; moved: boolean } | null = null
let pointerLongPress: { id: number; x: number; y: number; target: EventTarget | null; timer: ReturnType<typeof setTimeout> } | null = null
const sourceMapKey = props.mapKey
let mapReady = false
let suppressNextClick = false
let suppressClickTimer: ReturnType<typeof setTimeout> | undefined
let suppressNextContextMenu = false
let suppressContextMenuTimer: ReturnType<typeof setTimeout> | undefined
let longPressTimer: ReturnType<typeof setTimeout> | undefined
let touchStart: { x: number; y: number; target: EventTarget | null } | null = null

function holdClickSuppression(): void {
  suppressNextClick = true
  if (suppressClickTimer) clearTimeout(suppressClickTimer)
  suppressClickTimer = setTimeout(() => { suppressNextClick = false }, 900)
}

function holdContextMenuSuppression(): void {
  suppressNextContextMenu = true
  if (suppressContextMenuTimer) clearTimeout(suppressContextMenuTimer)
  suppressContextMenuTimer = setTimeout(() => { suppressNextContextMenu = false }, 900)
}

function clearStaleGestureSuppression(): void {
  suppressNextClick = false
  suppressNextContextMenu = false
  if (suppressClickTimer) clearTimeout(suppressClickTimer)
  if (suppressContextMenuTimer) clearTimeout(suppressContextMenuTimer)
}

function clearLongPress(): void {
  if (longPressTimer) clearTimeout(longPressTimer)
  longPressTimer = undefined
}

function clearPointerLongPress(): void {
  if (pointerLongPress) clearTimeout(pointerLongPress.timer)
  pointerLongPress = null
}

function cancelMapGesture(): void { currentMap()?.cancelActiveGesture() }

function cancelCanvasGesture(suppressRelease = false): void {
  clearLongPress()
  clearPointerLongPress()
  touchStart = null
  activePointerPan = null
  currentMap()?.cancelActiveGesture()
  if (suppressRelease) holdClickSuppression()
}

function onWindowBlur(): void { cancelCanvasGesture(true) }

function onDocumentVisibilityChange(): void {
  if (document.visibilityState === 'hidden') cancelCanvasGesture(true)
}

function isMapEntityTarget(target: EventTarget | null): boolean {
  return target instanceof Element
    && !!target.closest('.cluster-system-node, .cluster-route, .system-object, .orbit-mark, .orbit-hit-target, .orbit-edit-control')
}

function inspectLongPress(target: EventTarget | null): void {
  if (!(target instanceof Element)) return
  const systemId = target.closest<SVGGElement>('.cluster-system-node')?.getAttribute('data-system-id')
  if (systemId) {
    emit('select-cluster-system', systemId)
    return
  }
  const routeId = target.closest<SVGGElement>('.cluster-route')?.getAttribute('data-route-id')
  if (routeId) {
    emit('select-route', routeId)
    return
  }
  const objectId = target.closest<SVGGElement>('.system-object')?.getAttribute('data-object-id')
  if (objectId) {
    emit('select-object', objectId)
    return
  }
  const orbitId = target.closest<SVGGElement>('.orbit-mark, .orbit-hit-target, .orbit-edit-control')?.getAttribute('data-orbit-id')
  if (orbitId) emit('select-orbit', orbitId)
}

function onPointerDownCapture(event: PointerEvent): void {
  // A fresh pointer sequence is a separate user intent. Any synthetic click
  // from the prior gesture has already had its chance to arrive.
  if (!activePointerPan) clearStaleGestureSuppression()
  if (event.pointerType === 'touch' || (event.button !== 0 && event.button !== 2)) return
  if ((props.mode === 'navigate' || props.mode === 'move') && event.button === 0 && isMapEntityTarget(event.target)) {
    clearPointerLongPress()
    const pointerId = event.pointerId
    const target = event.target
    const timer = setTimeout(() => {
      if (pointerLongPress?.id !== pointerId) return
      pointerLongPress = null
      cancelMapGesture()
      holdClickSuppression()
      inspectLongPress(target)
    }, 560)
    pointerLongPress = { id: pointerId, x: event.clientX, y: event.clientY, target, timer }
  }
  const isRightPan = event.button === 2
  const isBackgroundPan = props.mode === 'move' && event.button === 0 && !isMapEntityTarget(event.target)
  const isNavigationPan = props.mode !== 'move' && event.button === 0
  if (!isRightPan && !isBackgroundPan && !isNavigationPan) return

  currentMap()?.startViewPan(event)
  activePointerPan = { id: event.pointerId, button: event.button, x: event.clientX, y: event.clientY, moved: false }
  // Prevent D3's map gesture from competing with this view-only pan. Click activation still runs on release.
  event.stopImmediatePropagation()
}

function onKeyDownCapture(event: KeyboardEvent): void {
  if (!(event.target instanceof SVGSVGElement)) return
  const deltas: Record<string, [number, number]> = {
    ArrowLeft: [-80, 0],
    ArrowRight: [80, 0],
    ArrowUp: [0, -80],
    ArrowDown: [0, 80],
  }
  const delta = deltas[event.key]
  if (!delta) return
  event.preventDefault()
  event.stopPropagation()
  currentMap()?.panBy(delta[0], delta[1])
}

function onWindowPointerMove(event: PointerEvent): void {
  if (pointerLongPress?.id === event.pointerId
    && Math.hypot(event.clientX - pointerLongPress.x, event.clientY - pointerLongPress.y) > 9) {
    clearPointerLongPress()
  }
  const pan = activePointerPan
  if (!pan || event.pointerId !== pan.id) return
  const dx = event.clientX - pan.x
  const dy = event.clientY - pan.y
  if (!pan.moved && Math.hypot(dx, dy) < 4) return
  pan.moved = true
  if (pan.button === 2) {
    event.preventDefault()
    holdContextMenuSuppression()
  }
  currentMap()?.moveViewPan(event)
  holdClickSuppression()
}

function onWindowPointerUp(event: PointerEvent): void {
  if (event.type === 'pointercancel') {
    cancelCanvasGesture(true)
    return
  }
  if (pointerLongPress?.id === event.pointerId) clearPointerLongPress()
  if (!activePointerPan || event.pointerId !== activePointerPan.id) return
  currentMap()?.endViewPan()
  activePointerPan = null
}

function onContextMenuCapture(event: MouseEvent): void {
  if ((activePointerPan?.button === 2 && activePointerPan.moved) || suppressNextContextMenu) {
    event.preventDefault()
    event.stopPropagation()
    suppressNextContextMenu = false
    if (suppressContextMenuTimer) clearTimeout(suppressContextMenuTimer)
  }
}

function onClickCapture(event: MouseEvent): void {
  if (!suppressNextClick || event.detail === 0) return
  event.preventDefault()
  event.stopPropagation()
  event.stopImmediatePropagation()
  suppressNextClick = false
  if (suppressClickTimer) clearTimeout(suppressClickTimer)
}

function onTouchStartCapture(event: TouchEvent): void {
  if (event.touches.length !== 1) {
    clearLongPress()
    touchStart = null
    if (event.touches.length > 1) {
      cancelCanvasGesture()
      holdClickSuppression()
    }
    return
  }
  const touch = event.touches[0]!
  touchStart = { x: touch.clientX, y: touch.clientY, target: event.target }
  clearLongPress()
  if (props.mode !== 'navigate' && props.mode !== 'move') return
  longPressTimer = setTimeout(() => {
    if (!touchStart) return
    const target = touchStart.target
    cancelMapGesture()
    holdClickSuppression()
    inspectLongPress(target)
    touchStart = null
  }, 560)
}

function onTouchMoveCapture(event: TouchEvent): void {
  if (event.touches.length > 1) {
    clearLongPress()
    touchStart = null
    holdClickSuppression()
  } else {
    const touch = event.touches[0]
    if (touchStart && touch && Math.hypot(touch.clientX - touchStart.x, touch.clientY - touchStart.y) > 9) {
      clearLongPress()
    }
  }
  currentMap()?.moveTouchNavigation(event)
}

function onTouchEndCapture(event: TouchEvent): void {
  clearLongPress()
  touchStart = null
  if (event.type === 'touchcancel') {
    cancelCanvasGesture(true)
    return
  }
  currentMap()?.endTouchNavigation(event)
}

function handleSystemActivation(systemId: string): void {
  if (props.mode === 'navigate') emit('navigate-system', systemId)
  else if (props.mode === 'select') emit('select-cluster-system', systemId)
  else if (props.mode === 'move') emit('move-select-cluster-system', systemId)
}

function handleRouteSelection(routeId: string): void {
  if (props.mode === 'select') emit('select-route', routeId)
  else if (props.mode === 'move') emit('move-select-route', routeId)
}

function handleObjectSelection(objectId: string): void {
  if (props.mode === 'select') emit('select-object', objectId)
  else if (props.mode === 'move') emit('move-select-object', objectId)
}

function handleOrbitSelection(orbitId: string): void {
  if (props.mode === 'select') emit('select-orbit', orbitId)
  else if (props.mode === 'move') emit('move-select-orbit', orbitId)
}

function forwardMoveSystem(id: string, position: Point): void { if (props.mode === 'move') emit('move-system', id, position) }
function forwardMoveObject(id: string, position: Point): void { if (props.mode === 'move') emit('move-object', id, position) }
function forwardBlockedObjectMove(id: string): void { emit('object-move-blocked', id) }
function forwardMoveOrbitCenter(id: string, center: Point, hostId: string | null): void {
  if (props.mode === 'move') emit('move-orbit-center', id, center, hostId)
}
function forwardRotateObject(id: string, angle: number): void { if (props.mode === 'move') emit('rotate-object', id, angle) }
function forwardResizeOrbit(id: string, radii: OrbitRadii): void { if (props.mode === 'move') emit('resize-orbit', id, radii) }
function forwardRotateOrbit(id: string, rotation: number): void { if (props.mode === 'move') emit('rotate-orbit', id, rotation) }
function forwardPlaceObject(id: string, orbitId: string, angle: number): void {
  if (props.mode === 'move') emit('place-object-in-orbit', id, orbitId, angle)
}
function forwardDropOrbit(point: Point, hostId: string | null): void { emit('drop-orbit', point, hostId) }
function forwardDropObject(subtype: CatalogueSubtype, point: Point, orbitId: string | null, angle: number | null): void {
  emit('drop-object', subtype, point, orbitId, angle)
}

function emitViewport(viewport: MapViewport): void {
  if (mapReady) emit('viewport-change', { key: sourceMapKey, viewport })
}

function fitMap(usableRect?: SvgViewportRect): void {
  const map = currentMap()
  if (!map) return
  if (usableRect !== undefined) {
    map.fitMap(usableRect)
    return
  }

  const svg = canvasRoot.value?.querySelector<SVGSVGElement>('svg')
  if (!svg) return
  const svgBounds = svg.getBoundingClientRect()
  const board = svg.closest<HTMLElement>('[data-map-board]')
  const dashboard = svg.closest<HTMLElement>('[data-workspace-dashboard]')
  if (!board || !dashboard || !isUsableClientRect(svgBounds)) return

  const svgRect: ClientRectBounds = {
    left: svgBounds.left,
    top: svgBounds.top,
    right: svgBounds.right,
    bottom: svgBounds.bottom,
  }
  const markerNodes = new Set<Element>(dashboard.querySelectorAll('[data-map-obstruction]'))
  for (const element of document.querySelectorAll('[data-map-obstruction]')) {
    // These named popovers are teleported to body, outside the stable DashboardGroup subtree.
    if (!dashboard.contains(element)
      && element.matches('.workspace-map-files-content, .workspace-add-menu, .workspace-zoom-navigation')) {
      markerNodes.add(element)
    }
  }
  const feedback = props.feedbackElement
  if (feedback && dashboard.contains(feedback) && !feedback.hasAttribute('data-map-obstruction')) markerNodes.add(feedback)

  const obstructions = [...markerNodes]
    .filter(isVisibleObstruction)
    .map(element => element.getBoundingClientRect())
    .filter(isUsableClientRect)
    .map(rect => ({ left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom }))
  const usableClientRect = largestUnobstructedClientRect(svgRect, obstructions)
  if (!usableClientRect) return
  const measuredRect = clientRectToSvgViewportRect(svg, usableClientRect)
  if (measuredRect) map.fitMap(measuredRect)
}

function isUsableClientRect(rect: Pick<DOMRect, 'left' | 'top' | 'right' | 'bottom' | 'width' | 'height'>): boolean {
  return [rect.left, rect.top, rect.right, rect.bottom, rect.width, rect.height].every(Number.isFinite)
    && rect.width > 0 && rect.height > 0
}

function isVisibleObstruction(element: Element): boolean {
  if (!element.isConnected || element.closest('[inert]') || element.closest('[aria-hidden="true"]')) return false
  if (element.getClientRects().length === 0) return false
  const style = window.getComputedStyle(element)
  return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0'
}

onMounted(async () => {
  window.addEventListener('pointermove', onWindowPointerMove, true)
  window.addEventListener('pointerup', onWindowPointerUp, true)
  window.addEventListener('pointercancel', onWindowPointerUp, true)
  window.addEventListener('blur', onWindowBlur)
  document.addEventListener('visibilitychange', onDocumentVisibilityChange)
  await nextTick()
  const map = currentMap()
  if (!map) return
  if (props.initialViewport) map.setViewport(props.initialViewport)
  else {
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
    await nextTick()
    fitMap()
  }
  await nextTick()
  mapReady = true
  emitViewport(map.getViewport())
})

onBeforeUnmount(() => {
  cancelCanvasGesture()
  if (suppressClickTimer) clearTimeout(suppressClickTimer)
  if (suppressContextMenuTimer) clearTimeout(suppressContextMenuTimer)
  window.removeEventListener('pointermove', onWindowPointerMove, true)
  window.removeEventListener('pointerup', onWindowPointerUp, true)
  window.removeEventListener('pointercancel', onWindowPointerUp, true)
  window.removeEventListener('blur', onWindowBlur)
  document.removeEventListener('visibilitychange', onDocumentVisibilityChange)
})

watch(() => props.mode, () => cancelCanvasGesture(true), { flush: 'sync' })

defineExpose({
  exportImage: async (format: MapImageFormat) => currentMap()?.exportImage(format)
    ?? Promise.reject(new Error('The map is not ready to export.')),
  getViewport: () => currentMap()?.getViewport() ?? { x: 0, y: 0, k: 1 },
  setViewport: (viewport: MapViewport) => currentMap()?.setViewport(viewport),
  zoomBy: (factor: number) => currentMap()?.zoomBy(factor),
  panBy: (dx: number, dy: number) => currentMap()?.panBy(dx, dy),
  fitMap,
  cancelActiveGesture: () => cancelCanvasGesture(true),
  startViewPan: (event: MouseEvent) => currentMap()?.startViewPan(event),
  moveViewPan: (event: MouseEvent) => currentMap()?.moveViewPan(event),
  endViewPan: () => currentMap()?.endViewPan(),
  startTouchNavigation: (event: TouchEvent) => currentMap()?.startTouchNavigation(event),
  moveTouchNavigation: (event: TouchEvent) => currentMap()?.moveTouchNavigation(event),
  endTouchNavigation: (event: TouchEvent) => currentMap()?.endTouchNavigation(event),
  getDetachedOrbitCenter: (orbitId: string) => systemMapRef.value?.getDetachedOrbitCenter(orbitId),
})
</script>

<style scoped>
.workspace-map-canvas {
  display: flex;
  width: 100%;
  min-width: 0;
  min-height: 0;
  flex: 1 1 auto;
  touch-action: none;
  overscroll-behavior: contain;
}

.workspace-map-canvas > :deep(.map-view) {
  min-height: 0;
  flex: 1 1 auto;
}

</style>
