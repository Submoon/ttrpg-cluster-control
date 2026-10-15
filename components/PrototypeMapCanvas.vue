<template>
  <div
    class="prototype-map-canvas"
    @click.capture="captureMapIntent"
    @pointerdown.capture="onPointerDownCapture"
    @mousedown.capture="onMouseDownCapture"
    @touchstart.capture="onTouchStartCapture"
    @touchend.capture="onTouchEndCapture"
    @touchcancel.capture="onTouchEndCapture"
  >
    <ClientOnly>
      <KeepAlive>
        <ClusterMap
          v-if="view === 'cluster'"
          :key="'cluster'"
          ref="clusterMap"
          :cluster="workspace.cluster"
          :system-positions="workspace.layout.systemPositions"
          :selected-system-id="selectedSystemId"
          :selected-route-id="selectedRouteId"
          :move-enabled="tool === 'move'"
          :system-activation="tool === 'select' ? 'inspect' : selectSystemsInMove && tool === 'move' ? 'select' : 'open'"
          :touch-navigation="touchNavigation"
          :show-zoom-controls="showZoomControls"
          @open-system="emit('open-system', $event)"
          @select-route="emit('select-route', $event)"
          @move-system="onMoveSystem"
        />
        <SystemMap
          v-else-if="system"
          :key="system.id"
          ref="systemMap"
          :system="system"
          :orbit-radii="workspace.layout.orbitRadii"
          :orbit-rotations="workspace.layout.orbitRotations"
          :object-angles="workspace.layout.objectAngles"
          :selected-object-id="selectedObjectId"
          :selected-orbit-id="selectedOrbitId"
          :move-enabled="tool === 'move'"
          :touch-navigation="touchNavigation"
          :show-zoom-controls="showZoomControls"
          @select-object="emit('select-object', $event)"
          @select-orbit="emit('select-orbit', $event)"
          @move-object="onMoveObject"
          @move-orbit-center="onMoveOrbitCenter"
          @rotate-object="onRotateObject"
          @resize-orbit="onResizeOrbit"
          @rotate-orbit="onRotateOrbit"
          @place-object-in-orbit="onPlaceObjectInOrbit"
        />
      </KeepAlive>
      <template #fallback>
        <div class="prototype-map-wait">Preparing the chart…</div>
      </template>
    </ClientOnly>
  </div>
</template>

<script setup lang="ts">
import type { CatalogueSubtype, LocalWorkspace, Point, StarSystem } from '../domain/workspace'
import type { MapImageFormat } from '../utils/map-image-export'

type View = 'cluster' | 'system'
type Tool = 'navigation' | 'select' | 'move' | 'add-object' | 'add-orbit' | 'add-system' | 'add-route'

const props = withDefaults(defineProps<{
  workspace: LocalWorkspace
  view: View
  system: StarSystem | null
  selectedSystemId: string | null
  selectedRouteId: string | null
  selectedObjectId: string | null
  selectedOrbitId: string | null
  tool: Tool
  selectSystemsInMove?: boolean
  touchNavigation?: boolean
  longPressEnabled?: boolean
  showZoomControls?: boolean
}>(), { selectSystemsInMove: false, touchNavigation: false, longPressEnabled: false, showZoomControls: true })

const emit = defineEmits<{
  'open-system': [id: string]
  'select-route': [id: string]
  'select-object': [id: string]
  'select-orbit': [id: string]
  'move-system': [id: string, position: Point]
  'move-object': [id: string, position: Point]
  'move-orbit-center': [id: string, center: Point, hostId: string | null]
  'rotate-object': [id: string, angle: number]
  'resize-orbit': [id: string, radii: { horizontal: number; vertical: number }]
  'rotate-orbit': [id: string, rotation: number]
  'place-object-in-orbit': [id: string, orbitId: string, angle: number]
  'inspect-entity': [target: { kind: 'system' | 'route' | 'object' | 'orbit'; id: string }]
  'map-target': [target: { kind: 'empty'; point: Point } | { kind: 'orbit'; id: string } | { kind: 'object'; id: string } | { kind: 'system'; id: string }]
}>()

type MapControls = {
  exportImage(format: MapImageFormat): Promise<Blob>
  zoomBy(factor: number): void
  fitMap(): void
  cancelActiveGesture(): void
  startViewPan(event: MouseEvent): void
  moveViewPan(event: MouseEvent): void
  endViewPan(): void
  startTouchNavigation(event: TouchEvent): void
  moveTouchNavigation(event: TouchEvent): void
  endTouchNavigation(event: TouchEvent): void
}

const clusterMap = ref<MapControls | null>(null)
const systemMap = ref<MapControls | null>(null)

type Inspectable = { kind: 'system' | 'route' | 'object' | 'orbit'; id: string }
type LongPressCandidate = { pointerId: number; target: Inspectable; x: number; y: number; triggered: boolean }
type SelectPanGesture = { pointerId: number; x: number; y: number; dragged: boolean }
const activePointers = new Set<number>()
let longPressTimer: ReturnType<typeof setTimeout> | undefined
let longPressCandidate: LongPressCandidate | undefined
let selectPanGesture: SelectPanGesture | undefined
let touchNavigationOwned = false
let suppressNextMapClickUntil = 0
let touchNavigationEndTimer: ReturnType<typeof setTimeout> | undefined
type RightPanGesture = { startEvent: MouseEvent; map: MapControls; dragged: boolean }
let rightPanGesture: RightPanGesture | undefined
let rightPanReleasePending = false
let suppressRightGestureUntil = 0

function activeMap(): MapControls | null {
  return props.view === 'cluster' ? clusterMap.value : systemMap.value
}

function inspectableTarget(target: EventTarget | null): Inspectable | null {
  if (!(target instanceof Element)) return null
  const system = target.closest('.cluster-system-node[data-system-id]')
  if (system) return { kind: 'system', id: system.getAttribute('data-system-id') ?? '' }
  const route = target.closest('.cluster-route[data-route-id]')
  if (route) return { kind: 'route', id: route.getAttribute('data-route-id') ?? '' }
  const object = target.closest('.system-object[data-object-id]')
  if (object) return { kind: 'object', id: object.getAttribute('data-object-id') ?? '' }
  const orbit = target.closest('.orbit-hit-target[data-orbit-id], .orbit-mark[data-orbit-id]')
  if (orbit) return { kind: 'orbit', id: orbit.getAttribute('data-orbit-id') ?? '' }
  return null
}

function cancelLongPress(): void {
  if (longPressTimer) clearTimeout(longPressTimer)
  longPressTimer = undefined
  longPressCandidate = undefined
}

function onPointerDownCapture(event: PointerEvent): void {
  if (activePointers.size === 0 && Date.now() <= suppressNextMapClickUntil) {
    // A previous long-press/pinch did not produce a browser click; do not eat a later deliberate tap.
    suppressNextMapClickUntil = 0
  }
  if (activePointers.size === 0 && !rightPanReleasePending) suppressRightGestureUntil = 0
  activePointers.add(event.pointerId)
  if (event.button !== 0) {
    cancelLongPress()
    return
  }
  if (activePointers.size > 1 || (event.pointerType === 'touch' && touchNavigationOwned)) {
    selectPanGesture = undefined
    cancelLongPress()
    return
  }
  if (props.tool === 'select' && event.target instanceof Element
    && event.target.closest('svg.cluster-map-svg, svg.system-map-svg')) {
    selectPanGesture = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, dragged: false }
  }
  if (!props.longPressEnabled || (props.tool !== 'navigation' && props.tool !== 'move')) return
  const target = inspectableTarget(event.target)
  if (!target?.id) return

  cancelLongPress()
  const candidate: LongPressCandidate = {
    pointerId: event.pointerId,
    target,
    x: event.clientX,
    y: event.clientY,
    triggered: false,
  }
  longPressCandidate = candidate
  longPressTimer = setTimeout(() => {
    if (longPressCandidate !== candidate || activePointers.size !== 1 || touchNavigationOwned) return
    candidate.triggered = true
    activeMap()?.cancelActiveGesture()
    emit('inspect-entity', candidate.target)
    suppressNextMapClickUntil = Date.now() + 1000
  }, 520)
}

function onMouseDownCapture(event: MouseEvent): void {
  if (event.button !== 2 || !(event.target instanceof Element)
    || !event.target.closest('svg.cluster-map-svg, svg.system-map-svg')) return
  const map = activeMap()
  if (!map) return
  cancelLongPress()
  rightPanGesture = { startEvent: event, map, dragged: false }
  suppressRightGestureUntil = 0
  // Keep the stationary right click available; D3 must never start an editorial drag from this press.
  event.stopImmediatePropagation()
}

function onWindowMouseDown(): void {
  // A new deliberate press outside the map must not inherit an earlier pan's release guard.
  if (!rightPanGesture && !rightPanReleasePending) suppressRightGestureUntil = 0
}

function onWindowMouseMove(event: MouseEvent): void {
  const gesture = rightPanGesture
  if (!gesture || !(event.buttons & 2)) return
  if (!gesture.dragged) {
    if (Math.hypot(event.clientX - gesture.startEvent.clientX, event.clientY - gesture.startEvent.clientY) <= 6) return
    gesture.dragged = true
    rightPanReleasePending = true
    cancelLongPress()
    gesture.map.startViewPan(gesture.startEvent)
  }
  gesture.map.moveViewPan(event)
  event.preventDefault()
  event.stopImmediatePropagation()
}

function onWindowMouseUp(event: MouseEvent): void {
  const gesture = rightPanGesture
  if (gesture && event.button === 2) {
    if (gesture.dragged) {
      gesture.map.moveViewPan(event)
      gesture.map.endViewPan()
      suppressRightGestureUntil = Date.now() + 1000
      event.preventDefault()
    } else if (event.buttons & 1) {
      // An incidental secondary-button release must not finish D3's primary-button edit.
      event.stopImmediatePropagation()
    }
    rightPanGesture = undefined
  }
  if (rightPanReleasePending && event.buttons === 0) {
    rightPanReleasePending = false
    suppressRightGestureUntil = Date.now() + 1000
    event.preventDefault()
    // Let cancelled D3 gestures receive mouseup so their native listeners are cleaned up.
  }
}

function captureRightGestureRelease(event: MouseEvent): void {
  if (event.type === 'click' && event.detail === 0) return
  if (!rightPanGesture?.dragged && !rightPanReleasePending && Date.now() > suppressRightGestureUntil) return
  event.preventDefault()
  event.stopImmediatePropagation()
}

function onWindowBlur(): void {
  if (rightPanGesture?.dragged) {
    rightPanGesture.map.endViewPan()
    suppressRightGestureUntil = Date.now() + 1000
  }
  rightPanGesture = undefined
  rightPanReleasePending = false
  selectPanGesture = undefined
  activePointers.clear()
  cancelLongPress()
}

function onPointerMoveCapture(event: PointerEvent): void {
  if (selectPanGesture?.pointerId === event.pointerId && !selectPanGesture.dragged
    && Math.hypot(event.clientX - selectPanGesture.x, event.clientY - selectPanGesture.y) > 6) {
    selectPanGesture.dragged = true
  }
  const candidate = longPressCandidate
  if (candidate?.pointerId !== event.pointerId) return
  if (candidate.triggered) return
  if (Math.hypot(event.clientX - candidate.x, event.clientY - candidate.y) > 9) cancelLongPress()
}

function onPointerEndCapture(event: PointerEvent): void {
  if (selectPanGesture?.pointerId === event.pointerId) {
    if (selectPanGesture.dragged) suppressNextMapClickUntil = Date.now() + 1000
    selectPanGesture = undefined
  }
  const candidate = longPressCandidate
  if (candidate?.pointerId === event.pointerId) {
    if (candidate.triggered) suppressNextMapClickUntil = Date.now() + 1000
    cancelLongPress()
  }
  activePointers.delete(event.pointerId)
}

function onTouchStartCapture(event: TouchEvent): void {
  if (!props.touchNavigation) return
  if (event.touches.length < 2) {
    if (touchNavigationEndTimer) {
      clearTimeout(touchNavigationEndTimer)
      touchNavigationEndTimer = undefined
      touchNavigationOwned = false
    }
    return
  }
  cancelLongPress()
  selectPanGesture = undefined
  touchNavigationOwned = true
  if (touchNavigationEndTimer) clearTimeout(touchNavigationEndTimer)
  activeMap()?.cancelActiveGesture()
  activeMap()?.startTouchNavigation(event)
  event.preventDefault()
  event.stopImmediatePropagation()
}

function onTouchEndCapture(event: TouchEvent): void {
  if (event.type === 'touchcancel') {
    cancelLongPress()
    activeMap()?.cancelActiveGesture()
    suppressNextMapClickUntil = Date.now() + 1000
  }
  if (!touchNavigationOwned) return
  activeMap()?.endTouchNavigation(event)
  if (event.touches.length === 0) {
    // Keep ownership through the browser's synthesized click after touchend.
    suppressNextMapClickUntil = Date.now() + 1000
    touchNavigationEndTimer = setTimeout(() => {
      touchNavigationOwned = false
      touchNavigationEndTimer = undefined
    }, 80)
  }
}

function onWindowTouchMove(event: TouchEvent): void {
  if (!touchNavigationOwned) return
  event.preventDefault()
  event.stopImmediatePropagation()
  activeMap()?.moveTouchNavigation(event)
}

function onWindowPointerMove(event: PointerEvent): void { onPointerMoveCapture(event) }
function onWindowPointerEnd(event: PointerEvent): void { onPointerEndCapture(event) }

onMounted(() => {
  window.addEventListener('touchmove', onWindowTouchMove, { capture: true, passive: false })
  window.addEventListener('pointermove', onWindowPointerMove, true)
  window.addEventListener('pointerup', onWindowPointerEnd, true)
  window.addEventListener('pointercancel', onWindowPointerEnd, true)
  window.addEventListener('mousemove', onWindowMouseMove, true)
  window.addEventListener('mousedown', onWindowMouseDown, true)
  window.addEventListener('mouseup', onWindowMouseUp, true)
  window.addEventListener('contextmenu', captureRightGestureRelease, true)
  window.addEventListener('auxclick', captureRightGestureRelease, true)
  window.addEventListener('click', captureRightGestureRelease, true)
  window.addEventListener('blur', onWindowBlur)
})
onBeforeUnmount(() => {
  window.removeEventListener('touchmove', onWindowTouchMove, true)
  window.removeEventListener('pointermove', onWindowPointerMove, true)
  window.removeEventListener('pointerup', onWindowPointerEnd, true)
  window.removeEventListener('pointercancel', onWindowPointerEnd, true)
  window.removeEventListener('mousemove', onWindowMouseMove, true)
  window.removeEventListener('mousedown', onWindowMouseDown, true)
  window.removeEventListener('mouseup', onWindowMouseUp, true)
  window.removeEventListener('contextmenu', captureRightGestureRelease, true)
  window.removeEventListener('auxclick', captureRightGestureRelease, true)
  window.removeEventListener('click', captureRightGestureRelease, true)
  window.removeEventListener('blur', onWindowBlur)
  rightPanGesture?.map.endViewPan()
  cancelLongPress()
  selectPanGesture = undefined
  if (touchNavigationEndTimer) clearTimeout(touchNavigationEndTimer)
})
watch(() => [props.tool, props.view], () => {
  cancelLongPress()
  selectPanGesture = undefined
})

function captureMapIntent(event: MouseEvent): void {
  const target = event.target
  if (!(target instanceof Element)) return
  const svg = target.closest('svg.cluster-map-svg, svg.system-map-svg') as SVGSVGElement | null
  if (!svg) return

  if (event.detail > 0 && (touchNavigationOwned || Date.now() <= suppressNextMapClickUntil
    || rightPanReleasePending || rightPanGesture?.dragged || Date.now() <= suppressRightGestureUntil)) {
    suppressNextMapClickUntil = 0
    event.preventDefault()
    event.stopImmediatePropagation()
    return
  }
  if (props.tool === 'navigation' || props.tool === 'move') return

  const systemObject = target.closest('.system-object')
  const orbit = target.closest('.orbit-hit-target, .orbit-mark')
  const systemNode = target.closest('.cluster-system-node')
  const route = target.closest('.cluster-route')

  event.preventDefault()
  event.stopImmediatePropagation()

  if (props.tool === 'select') {
    if (props.view === 'cluster') {
      if (systemNode) emit('inspect-entity', { kind: 'system', id: systemNode.getAttribute('data-system-id') ?? '' })
      else if (route) emit('inspect-entity', { kind: 'route', id: route.getAttribute('data-route-id') ?? '' })
    } else if (systemObject) {
      emit('inspect-entity', { kind: 'object', id: systemObject.getAttribute('data-object-id') ?? '' })
    } else if (orbit) {
      emit('inspect-entity', { kind: 'orbit', id: orbit.getAttribute('data-orbit-id') ?? '' })
    }
    return
  }

  if (props.view === 'cluster') {
    if (systemNode && props.tool === 'add-route') {
      emit('map-target', { kind: 'system', id: systemNode.getAttribute('data-system-id') ?? '' })
      return
    }
    if (systemNode && props.tool === 'add-system') {
      emit('map-target', { kind: 'system', id: systemNode.getAttribute('data-system-id') ?? '' })
      return
    }
    if (!systemNode && !route) {
      emit('map-target', { kind: 'empty', point: clusterPoint(event, svg) })
    }
    return
  }

  if (props.tool === 'add-object') {
    if (orbit) {
      emit('map-target', { kind: 'orbit', id: orbit.getAttribute('data-orbit-id') ?? '' })
    } else if (systemObject) {
      emit('map-target', { kind: 'object', id: systemObject.getAttribute('data-object-id') ?? '' })
    } else {
      emit('map-target', { kind: 'empty', point: systemPoint(event, svg) })
    }
    return
  }

  if (props.tool === 'add-orbit') {
    emit('map-target', orbit
      ? { kind: 'orbit', id: orbit.getAttribute('data-orbit-id') ?? '' }
      : systemObject
      ? { kind: 'object', id: systemObject.getAttribute('data-object-id') ?? '' }
      : { kind: 'empty', point: systemPoint(event, svg) })
  }
}

function clusterPoint(event: MouseEvent, svg: SVGSVGElement): Point {
  const point = svg.createSVGPoint()
  point.x = event.clientX
  point.y = event.clientY
  const content = svg.querySelector<SVGGElement>('.cluster-map-content')
  const matrix = content?.getScreenCTM()
  if (!matrix) return { x: 0.5, y: 0.5 }
  const local = point.matrixTransform(matrix.inverse())
  return {
    x: Math.max(0, Math.min(1, (local.x - 112) / 736)),
    y: Math.max(0, Math.min(1, (local.y - 96) / 368)),
  }
}

function systemPoint(event: MouseEvent, svg: SVGSVGElement): Point {
  const content = svg.querySelector<SVGGElement>('.system-map-content')
  const matrix = content?.getScreenCTM()
  if (!matrix) return { x: 0.5, y: 0.5 }
  const point = svg.createSVGPoint()
  point.x = event.clientX
  point.y = event.clientY
  const local = point.matrixTransform(matrix.inverse())
  return {
    x: Math.max(-1, Math.min(2, (local.x - 64) / 832)),
    y: Math.max(-1, Math.min(2, (local.y - 72) / 416)),
  }
}

async function exportImage(format: MapImageFormat): Promise<Blob> {
  const map = props.view === 'cluster' ? clusterMap.value : systemMap.value
  if (!map) throw new Error('The chart is not ready yet.')
  return map.exportImage(format)
}

function zoomBy(factor: number): void {
  const map = props.view === 'cluster' ? clusterMap.value : systemMap.value
  map?.zoomBy(factor)
}

function fitMap(): void {
  const map = props.view === 'cluster' ? clusterMap.value : systemMap.value
  map?.fitMap()
}

function onMoveSystem(id: string, point: Point): void { emit('move-system', id, point) }
function onMoveObject(id: string, point: Point): void { emit('move-object', id, point) }
function onMoveOrbitCenter(id: string, point: Point, hostId: string | null): void {
  emit('move-orbit-center', id, point, hostId)
}
function onRotateObject(id: string, angle: number): void { emit('rotate-object', id, angle) }
function onResizeOrbit(id: string, radii: { horizontal: number; vertical: number }): void {
  emit('resize-orbit', id, radii)
}
function onRotateOrbit(id: string, rotation: number): void { emit('rotate-orbit', id, rotation) }
function onPlaceObjectInOrbit(id: string, orbitId: string, angle: number): void {
  emit('place-object-in-orbit', id, orbitId, angle)
}

defineExpose({ exportImage, zoomBy, fitMap })
</script>

<style scoped>
.prototype-map-canvas,
.prototype-map-canvas :deep(.map-view) {
  width: 100%;
  height: 100%;
  min-height: 0;
}

.prototype-map-wait {
  display: grid;
  min-height: 100%;
  place-items: center;
  color: var(--proto-muted);
  font: 0.8rem var(--proto-ui-font);
}
</style>
