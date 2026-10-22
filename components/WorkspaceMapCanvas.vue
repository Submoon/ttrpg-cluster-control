<template>
  <div
    ref="canvasRoot"
    class="workspace-map-canvas"
    @pointerdown.capture="onPointerDownCapture"
    @mousedown.capture="onMouseDownCapture"
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
      :move-enabled="props.mode === 'move' && props.clusterAddType == null"
      :system-activation="props.mode === 'select' || props.mode === 'move' ? 'select' : 'open'"
      :cluster-add-type="props.clusterAddType ?? null"
      :cluster-chooser-open="props.clusterChooserOpen ?? false"
      :cluster-move-targeting="props.clusterMoveTargeting ?? false"
      touch-navigation
      :show-zoom-controls="false"
      @activate-system="handleSystemActivation"
      @select-route="handleRouteSelection"
      @move-system="forwardMoveSystem"
      @cluster-target="forwardClusterTarget"
      @cancel-cluster-preview="emit('cancel-cluster-preview')"
      @viewport-change="emitViewport"
    />
    <SystemMap
      v-else-if="props.system"
      ref="systemMapRef"
      :system="props.system"
      :orbit-radii="props.workspace.layout.orbitRadii"
      :orbit-rotations="props.workspace.layout.orbitRotations"
      :object-angles="props.workspace.layout.objectAngles"
      :creation-type="props.creationType ?? null"
      :creation-preview="props.creationPreview ?? null"
      :creation-chooser-open="props.creationChooserOpen ?? false"
      :selected-object-id="props.selectedObjectId"
      :selected-orbit-id="props.selectedOrbitId"
      :is-object-move-blocked="props.isObjectMoveBlocked"
      :is-entity-command-blocked="props.isEntityCommandBlocked"
      :move-enabled="props.mode === 'move' && !props.creationType"
      touch-navigation
      :show-zoom-controls="false"
      @select-object="handleObjectSelection"
      @select-orbit="handleOrbitSelection"
      @object-move-blocked="forwardBlockedObjectMove"
      @object-move-candidates="forwardObjectMoveCandidates"
      @orbit-center-candidates="forwardOrbitCenterCandidates"
      @entity-command-blocked="emit('entity-command-blocked', $event)"
      @move-object="forwardMoveObject"
      @move-orbit-center="forwardMoveOrbitCenter"
      @rotate-object="forwardRotateObject"
      @resize-orbit="forwardResizeOrbit"
      @rotate-orbit="forwardRotateOrbit"
      @place-object-in-orbit="forwardPlaceObject"
      @creation-target="forwardCreationTarget"
      @creation-drop-target="forwardCreationDropTarget"
      @cancel-creation-preview="forwardCancelCreationPreview"
      @cancel-object-placement-preview="emit('cancel-object-placement-preview')"
      @cancel-orbit-placement-preview="emit('cancel-orbit-placement-preview')"
      @viewport-change="emitViewport"
    />
  </div>
</template>

<script setup lang="ts">
/** Owns pointer arbitration around one stable map surface and forwards validated renderer commands. */
import { onBeforeUnmount, onMounted, nextTick, shallowRef, watch } from 'vue'
import type {
  LocalWorkspace,
  OrbitRadii,
  Point,
  StarSystem,
} from '../domain/workspace'
import type {
  MapInteractionMode,
  OrbitCenterMoveCandidate,
  OrbitPlacementPreview,
  SystemCreationCandidate,
  SystemCreationPreview,
  SystemCreationType,
  SystemMapHandle,
  SystemObjectMoveCandidate,
} from '../composables/editor-workflows/types'
import type { EntityCommand } from '../composables/editor-workflows/types'
import type { MapImageFormat, MapImagePalette } from '../utils/map-image-export'
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
  creationType?: SystemCreationType | null
  creationPreview?: SystemCreationPreview | null
  creationChooserOpen?: boolean
  clusterAddType?: 'system' | 'route' | null
  clusterChooserOpen?: boolean
  clusterMoveTargeting?: boolean
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
  'object-move-candidates': [id: string, candidates: SystemObjectMoveCandidate[]]
  'orbit-center-candidates': [id: string, candidates: OrbitCenterMoveCandidate[]]
  'entity-command-blocked': [command: EntityCommand]
  'move-system': [id: string, position: Point]
  'cluster-target': [point: Point, systemIds: string[]]
  'cancel-cluster-preview': []
  'cancel-object-placement-preview': []
  'cancel-orbit-placement-preview': []
  'move-object': [id: string, position: Point]
  'move-orbit-center': [id: string, center: Point, hostId: string | null]
  'rotate-object': [id: string, angle: number]
  'resize-orbit': [id: string, radii: OrbitRadii]
  'rotate-orbit': [id: string, rotation: number]
  'place-object-in-orbit': [id: string, orbitId: string, angle: number]
  'creation-target': [candidates: SystemCreationCandidate[]]
  'creation-drop-target': [type: SystemCreationType, candidates: SystemCreationCandidate[]]
  'cancel-creation-preview': []
  'viewport-change': [change: { key: string; viewport: MapViewport }]
}>()

type ClusterMapHandle = InstanceType<typeof ClusterMap>
type SystemMapInstance = InstanceType<typeof SystemMap>
const clusterMapRef = shallowRef<ClusterMapHandle | null>(null)
const systemMapRef = shallowRef<SystemMapInstance | null>(null)
const canvasRoot = shallowRef<HTMLElement | null>(null)
const currentMap = () => props.activeView === 'cluster' ? clusterMapRef.value : systemMapRef.value
let activePointerPan: { id: number; button: number; x: number; y: number; moved: boolean } | null = null
let activeMousePointerId: number | null = null
let pointerLongPress: {
  id: number
  x: number
  y: number
  target: EventTarget | null
  addHold: boolean
  timer: ReturnType<typeof setTimeout>
} | null = null
let consumedAddPointerId: number | null = null
let consumedAddTouchId: number | null = null
const sourceMapKey = props.mapKey
let mapReady = false
let suppressNextClick = false
let suppressClickTimer: ReturnType<typeof setTimeout> | undefined
let suppressNextContextMenu = false
let suppressContextMenuTimer: ReturnType<typeof setTimeout> | undefined
let longPressTimer: ReturnType<typeof setTimeout> | undefined
let touchStart: { id: number; x: number; y: number; target: EventTarget | null } | null = null
let touchPanStarted = false

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

function cancelCanvasGesture(suppressRelease = false, cancelClusterPreview = true): void {
  if (cancelClusterPreview && props.activeView === 'cluster') emit('cancel-cluster-preview')
  clearLongPress()
  clearPointerLongPress()
  touchStart = null
  touchPanStarted = false
  activePointerPan = null
  if (props.activeView === 'system') {
    emit('cancel-object-placement-preview')
    emit('cancel-orbit-placement-preview')
    systemMapRef.value?.cancelCreationPreview()
  }
  currentMap()?.cancelActiveGesture()
  if (suppressRelease) holdClickSuppression()
}

function cancelForFocusInterruption(): void {
  // This parent-owned preview exists even when the map renderer has no active gesture to cancel.
  if (props.activeView === 'cluster') emit('cancel-cluster-preview')
  cancelCanvasGesture(true, false)
}

function onWindowBlur(): void { cancelForFocusInterruption() }

function onDocumentVisibilityChange(): void {
  if (document.visibilityState === 'hidden') cancelForFocusInterruption()
}

function onDocumentFreeze(): void { cancelForFocusInterruption() }

function hasClusterAddIntent(): boolean {
  return props.activeView === 'cluster' && props.clusterAddType != null
}

function hasMapAddIntent(): boolean {
  return hasClusterAddIntent() || (props.activeView === 'system' && props.creationType != null)
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
  const isMouseButtonChord = event.pointerType === 'mouse'
    && event.button === 2
    && (event.buttons & 1) !== 0
  if (!isMouseButtonChord) consumedAddPointerId = null
  if (event.pointerType === 'mouse') activeMousePointerId = event.pointerId
  // A fresh pointer sequence is a separate user intent. Any synthetic click
  // from the prior gesture has already had its chance to arrive.
  if (!activePointerPan) clearStaleGestureSuppression()
  if (event.pointerType === 'touch' || (event.button !== 0 && event.button !== 2)) return
  const entityPress = event.button === 0 && isMapEntityTarget(event.target)
  const addHold = hasMapAddIntent() && entityPress
  const inspectHold = !hasMapAddIntent()
    && (props.mode === 'navigate' || props.mode === 'move')
    && entityPress
  if (addHold || inspectHold) {
    clearPointerLongPress()
    const pointerId = event.pointerId
    const target = event.target
    const timer = setTimeout(() => {
      if (pointerLongPress?.id !== pointerId) return
      pointerLongPress = null
      if (addHold) {
        consumedAddPointerId = pointerId
        cancelMapGesture()
        return
      }
      if (props.activeView === 'cluster') emit('cancel-cluster-preview')
      if (props.activeView === 'system') {
        emit('cancel-object-placement-preview')
        emit('cancel-orbit-placement-preview')
      }
      cancelMapGesture()
      holdClickSuppression()
      inspectLongPress(target)
    }, 560)
    pointerLongPress = { id: pointerId, x: event.clientX, y: event.clientY, target, addHold, timer }
  }
  const isRightPan = event.button === 2
  const isBackgroundPan = props.mode === 'move' && event.button === 0 && !isMapEntityTarget(event.target)
  const isNavigationPan = props.mode !== 'move' && event.button === 0
  if (!isRightPan && !isBackgroundPan && !isNavigationPan) return

  currentMap()?.startViewPan(event)
  activePointerPan = { id: event.pointerId, button: event.button, x: event.clientX, y: event.clientY, moved: false }
  if (isRightPan) holdClickSuppression()
  // Prevent D3's map gesture from competing with this view-only pan. Click activation still runs on release.
  event.stopImmediatePropagation()
}

/** Takes over a held left-button gesture when the browser reports right-button chord only as mousedown. */
function onMouseDownCapture(event: MouseEvent): void {
  if (event.button !== 2 || (event.buttons & 1) === 0 || activeMousePointerId === null) return
  // Browsers that emit a second pointerdown already entered the ordinary right-pan path.
  if (activePointerPan?.button === 2) return

  cancelCanvasGesture()
  currentMap()?.startViewPan(event)
  activePointerPan = {
    id: activeMousePointerId,
    button: 2,
    x: event.clientX,
    y: event.clientY,
    moved: false,
  }
  holdClickSuppression()
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
    const addHold = pointerLongPress.addHold
    clearPointerLongPress()
    if (addHold) holdClickSuppression()
  }
  const pan = activePointerPan
  if (!pan || event.pointerId !== pan.id) return
  const dx = event.clientX - pan.x
  const dy = event.clientY - pan.y
  if (!pan.moved && Math.hypot(dx, dy) < 4) return
  const firstPanMove = !pan.moved
  pan.moved = true
  if (firstPanMove && props.activeView === 'cluster') emit('cancel-cluster-preview')
  if (pan.button === 2) {
    event.preventDefault()
    holdContextMenuSuppression()
  }
  currentMap()?.moveViewPan(event)
  holdClickSuppression()
}

function onWindowPointerUp(event: PointerEvent): void {
  if (event.type === 'pointercancel') {
    if (consumedAddPointerId === event.pointerId) {
      holdClickSuppression()
      consumedAddPointerId = null
    }
    if (activeMousePointerId === event.pointerId) activeMousePointerId = null
    cancelCanvasGesture(true)
    return
  }
  if (pointerLongPress?.id === event.pointerId) clearPointerLongPress()
  if (consumedAddPointerId === event.pointerId) {
    holdClickSuppression()
    consumedAddPointerId = null
  }
  if (event.pointerType === 'mouse' && activeMousePointerId === event.pointerId) activeMousePointerId = null
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
    touchPanStarted = false
    if (event.touches.length > 1) {
      cancelCanvasGesture()
      holdClickSuppression()
    }
    return
  }
  const touch = event.touches[0]!
  consumedAddTouchId = null
  touchStart = { id: touch.identifier, x: touch.clientX, y: touch.clientY, target: event.target }
  touchPanStarted = false
  clearLongPress()
  if (hasMapAddIntent()) {
    if (!isMapEntityTarget(event.target)) return
    const touchId = touch.identifier
    longPressTimer = setTimeout(() => {
      if (touchStart?.id !== touchId) return
      longPressTimer = undefined
      consumedAddTouchId = touchId
      cancelMapGesture()
    }, 560)
    return
  }
  if (props.mode !== 'navigate' && props.mode !== 'move') return
  longPressTimer = setTimeout(() => {
    if (!touchStart) return
    const target = touchStart.target
    if (props.activeView === 'cluster') emit('cancel-cluster-preview')
    if (props.activeView === 'system') {
      emit('cancel-object-placement-preview')
      emit('cancel-orbit-placement-preview')
    }
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
    if (touchStart && touch && !touchPanStarted
      && Math.hypot(touch.clientX - touchStart.x, touch.clientY - touchStart.y) > 9) {
      touchPanStarted = true
      clearLongPress()
      if (props.activeView === 'cluster') emit('cancel-cluster-preview')
      if (props.activeView === 'system') {
        emit('cancel-object-placement-preview')
        emit('cancel-orbit-placement-preview')
      }
      holdClickSuppression()
    }
  }
  currentMap()?.moveTouchNavigation(event)
}

function onTouchEndCapture(event: TouchEvent): void {
  if (consumedAddTouchId !== null
    && Array.from(event.changedTouches).some(touch => touch.identifier === consumedAddTouchId)) {
    holdClickSuppression()
    consumedAddTouchId = null
  }
  clearLongPress()
  touchStart = null
  touchPanStarted = false
  if (event.type === 'touchcancel') {
    cancelCanvasGesture(true)
    return
  }
  currentMap()?.endTouchNavigation(event)
}

function handleSystemActivation(systemId: string): void {
  if (hasClusterAddIntent()) return
  if (props.mode === 'navigate') emit('navigate-system', systemId)
  else if (props.mode === 'select') emit('select-cluster-system', systemId)
  else if (props.mode === 'move') emit('move-select-cluster-system', systemId)
}

function handleRouteSelection(routeId: string): void {
  if (hasClusterAddIntent()) return
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
function forwardClusterTarget(point: Point, systemIds: string[]): void {
  if (props.activeView !== 'cluster'
    || (!hasClusterAddIntent() && !props.clusterMoveTargeting)
    || props.clusterChooserOpen) return
  emit('cluster-target', point, systemIds)
}
function forwardMoveObject(id: string, position: Point): void { if (props.mode === 'move') emit('move-object', id, position) }
function forwardBlockedObjectMove(id: string): void { emit('object-move-blocked', id) }
function forwardObjectMoveCandidates(id: string, candidates: SystemObjectMoveCandidate[]): void {
  if (props.activeView === 'system' && props.mode === 'move') emit('object-move-candidates', id, candidates)
}
function forwardOrbitCenterCandidates(id: string, candidates: OrbitCenterMoveCandidate[]): void {
  if (props.activeView === 'system' && props.mode === 'move') emit('orbit-center-candidates', id, candidates)
}
function forwardMoveOrbitCenter(id: string, center: Point, hostId: string | null): void {
  if (props.mode === 'move') emit('move-orbit-center', id, center, hostId)
}
function forwardRotateObject(id: string, angle: number): void { if (props.mode === 'move') emit('rotate-object', id, angle) }
function forwardResizeOrbit(id: string, radii: OrbitRadii): void { if (props.mode === 'move') emit('resize-orbit', id, radii) }
function forwardRotateOrbit(id: string, rotation: number): void { if (props.mode === 'move') emit('rotate-orbit', id, rotation) }
function forwardPlaceObject(id: string, orbitId: string, angle: number): void {
  if (props.mode === 'move') emit('place-object-in-orbit', id, orbitId, angle)
}
function forwardCreationTarget(candidates: SystemCreationCandidate[]): void {
  if (!props.creationType || props.creationChooserOpen) return
  emit('creation-target', candidates)
}

function forwardCreationDropTarget(type: SystemCreationType, candidates: SystemCreationCandidate[]): void {
  if (props.activeView !== 'system') return
  emit('creation-drop-target', type, candidates)
}

function forwardCancelCreationPreview(): void {
  if (!props.creationType || !props.creationPreview) return
  emit('cancel-creation-preview')
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
  document.addEventListener('freeze', onDocumentFreeze)
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
  document.removeEventListener('freeze', onDocumentFreeze)
})

watch(() => props.mode, () => cancelCanvasGesture(true), { flush: 'sync' })
watch(() => props.creationType, () => {
  emit('cancel-object-placement-preview')
  emit('cancel-orbit-placement-preview')
}, { deep: true, flush: 'sync' })
watch(
  [
    () => props.activeView,
    () => props.mapKey,
    () => props.system?.id,
    () => props.selectedSystemId,
    () => props.selectedObjectId,
    () => props.selectedOrbitId,
  ],
  () => {
    emit('cancel-object-placement-preview')
    emit('cancel-orbit-placement-preview')
  },
  { flush: 'sync' },
)

defineExpose({
  exportImage: async (format: MapImageFormat, palette: MapImagePalette = 'active') => currentMap()?.exportImage(format, palette)
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
  setClusterSystemPositionPreview: (systemId: string, position: Point | null) => {
    if (props.activeView === 'cluster') clusterMapRef.value?.setClusterSystemPositionPreview(systemId, position)
  },
  setObjectPlacementPreview: (objectId: string, scenePoint: Point | null) => {
    if (props.activeView === 'system') systemMapRef.value?.setObjectPlacementPreview(objectId, scenePoint)
  },
  setOrbitPlacementPreview: (orbitId: string, preview: OrbitPlacementPreview | null) => {
    if (props.activeView === 'system') systemMapRef.value?.setOrbitPlacementPreview(orbitId, preview)
  },
  startTouchNavigation: (event: TouchEvent) => currentMap()?.startTouchNavigation(event),
  moveTouchNavigation: (event: TouchEvent) => currentMap()?.moveTouchNavigation(event),
  endTouchNavigation: (event: TouchEvent) => currentMap()?.endTouchNavigation(event),
  getDetachedOrbitCenter: (orbitId: string) => systemMapRef.value?.getDetachedOrbitCenter(orbitId),
  getCreationCandidates: (point: Point, type: SystemCreationType) =>
    systemMapRef.value?.getCreationCandidates(point, type) ?? [],
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
