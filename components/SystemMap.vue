<template>
  <div class="map-view flex h-full min-h-0 min-w-0 flex-1 flex-col">
    <div v-if="showZoomControls" class="map-navigation flex shrink-0 items-center gap-1 border-b border-[var(--line-soft)] bg-[var(--panel-bg)] px-2 py-1" role="toolbar" aria-label="Map navigation">
      <button type="button" aria-label="Zoom out" :disabled="zoomLevel <= MAP_ZOOM_MIN_SCALE * 100" @click="zoomBy(1 / 1.2)">−</button>
      <output aria-label="Zoom level" aria-live="polite">{{ zoomLevel }}%</output>
      <button type="button" aria-label="Zoom in" :disabled="zoomLevel >= MAP_ZOOM_MAX_SCALE * 100" @click="zoomBy(1.2)">+</button>
      <button type="button" aria-label="Fit map" @click="fitMap">Fit</button>
    </div>
    <svg
      ref="svgElement"
      class="system-map-svg block h-full min-h-0 w-full flex-1"
      :class="{ 'map-touch-surface': touchNavigation }"
      viewBox="0 0 960 560"
      role="group"
      :aria-label="`${system.name} star system map`"
      aria-description="Focus this map and use the arrow keys to pan. Focus an object or Orbit to use its keyboard controls."
      tabindex="0"
      @wheel.capture="captureOrbitRotationWheel"
      @click.capture="handleCreationClick"
      @touchstart.capture="startTouchNavigation"
      @dragover.prevent
      @drop.prevent="handleObjectDrop"
    />
  </div>
</template>

<script setup lang="ts">
/**
 * Vue owns map controls and component lifecycle; D3 owns the scene nodes created under the SVG element.
 * Unscoped styles intentionally reach those renderer-created nodes.
 */
import { pointer, select, zoomIdentity, zoomTransform } from 'd3'
import {
  type OrbitRadii,
  type Point,
  type StarSystem,
} from '../domain/workspace'
import type { EntityCommand } from '../composables/editor-workflows/types'
import type {
  OrbitCenterMoveCandidate,
  OrbitPlacementPreview,
  SystemCreationCandidate,
  SystemCreationPreview,
  SystemCreationType,
  SystemObjectMoveCandidate,
} from '../composables/editor-workflows/types'
import { exportMapImage, type MapImageFormat, type MapImagePalette } from '../utils/map-image-export'
import {
  clampMapViewport,
  fitMapViewport,
  getSvgViewportRect,
  MAP_ZOOM_MAX_SCALE,
  MAP_ZOOM_MIN_SCALE,
  normalizeSvgViewportRect,
  svgViewportExtent,
  type MapViewport,
  type SvgViewportRect,
} from '../utils/map-zoom'
import {
  getDetachedOrbitCenter as findDetachedOrbitCenter,
  type SystemMapGeometry,
} from '../utils/system-map-geometry'
import {
  renderSystemMap,
  type SystemMapEventHandlers,
  type SystemMapRenderer,
} from './maps/system-map-renderer'

const props = withDefaults(defineProps<{
  system: StarSystem
  orbitRadii: Record<string, OrbitRadii>
  orbitRotations: Record<string, number>
  objectAngles: Record<string, number>
  creationType?: SystemCreationType | null
  creationPreview?: SystemCreationPreview | null
  creationChooserOpen?: boolean
  selectedObjectId: string | null
  selectedOrbitId: string | null
  isObjectMoveBlocked?: (objectId: string) => boolean
  isEntityCommandBlocked?: (command: EntityCommand) => boolean
  moveEnabled?: boolean
  touchNavigation?: boolean
  showZoomControls?: boolean
}>(), {
  creationType: null,
  creationPreview: null,
  creationChooserOpen: false,
  moveEnabled: true,
  touchNavigation: false,
  showZoomControls: true,
})

const emit = defineEmits<{
  'select-object': [id: string]
  'select-orbit': [id: string]
  'object-move-blocked': [id: string]
  'object-move-candidates': [id: string, candidates: SystemObjectMoveCandidate[]]
  'orbit-center-candidates': [id: string, candidates: OrbitCenterMoveCandidate[]]
  'entity-command-blocked': [command: EntityCommand]
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
  'editing-gesture-change': [active: boolean]
  'viewport-change': [viewport: MapViewport]
}>()

const svgElement = ref<SVGSVGElement | null>(null)
const zoomLevel = ref(100)
const orbitRotationWheelEvents = new WeakSet<Event>()
const mapGeometry = computed<SystemMapGeometry>(() => ({
  objectAngles: props.objectAngles,
  orbitRadii: props.orbitRadii,
  orbitRotations: props.orbitRotations,
}))
let mapRenderer: SystemMapRenderer | undefined
type SystemTouchGesture =
  | { mode: 'pinch'; transform: ReturnType<typeof zoomTransform>; distance: number; anchor: [number, number] }
  | { mode: 'pan'; transform: ReturnType<typeof zoomTransform>; start: [number, number] }
let touchGesture: SystemTouchGesture | null = null
let viewPan: { transform: ReturnType<typeof zoomTransform>; start: [number, number] } | null = null
let zoomExtentOverride: SvgViewportRect | undefined
let cancelledCreationPreviewId: number | null = null
const objectPlacementPreviews = new Map<string, Point>()
const orbitPlacementPreviews = new Map<string, OrbitPlacementPreview>()

const handlers: SystemMapEventHandlers = {
  editingGestureChange: active => emit('editing-gesture-change', active),
  selectObject: id => { if (!props.creationType) emit('select-object', id) },
  selectOrbit: id => { if (!props.creationType) emit('select-orbit', id) },
  isObjectMoveBlocked: id => props.isObjectMoveBlocked?.(id) ?? false,
  isEntityCommandBlocked: command => props.isEntityCommandBlocked?.(command) ?? false,
  objectMoveBlocked: id => emit('object-move-blocked', id),
  objectMoveCandidates: (id, candidates) => emit('object-move-candidates', id, candidates),
  orbitCenterCandidates: (id, candidates) => emit('orbit-center-candidates', id, candidates),
  entityCommandBlocked: command => emit('entity-command-blocked', command),
  cancelObjectPlacementPreview: () => emit('cancel-object-placement-preview'),
  cancelOrbitPlacementPreview: () => emit('cancel-orbit-placement-preview'),
  moveObject: (id, position) => emit('move-object', id, position),
  moveOrbitCenter: (id, center, hostId) => emit('move-orbit-center', id, center, hostId),
  rotateObject: (id, angle) => emit('rotate-object', id, angle),
  resizeOrbit: (id, radii) => emit('resize-orbit', id, radii),
  rotateOrbit: (id, rotation) => emit('rotate-orbit', id, rotation),
  placeObjectInOrbit: (id, orbitId, angle) => emit('place-object-in-orbit', id, orbitId, angle),
  creationTarget: candidates => emit('creation-target', candidates),
  creationDropTarget: (type, candidates) => emit('creation-drop-target', type, candidates),
}

/** Forwards a captured wheel event so Orbit rotation cannot also zoom the map. */
function captureOrbitRotationWheel(event: WheelEvent): void {
  mapRenderer?.captureOrbitRotationWheel(event)
}

/** Forwards palette drops to the D3 renderer for scene-coordinate target resolution. */
function handleObjectDrop(event: DragEvent): void {
  mapRenderer?.handleObjectDrop(event)
}

/** Consumes a map click in Add and forwards its named candidates without selecting a map entity. */
function handleCreationClick(event: MouseEvent): void {
  mapRenderer?.handleCreationClick(event)
}

/** Returns the current D3 transform as the map's public viewport state. */
function getViewport(): MapViewport {
  const transform = svgElement.value ? zoomTransform(svgElement.value) : zoomIdentity
  return { x: transform.x, y: transform.y, k: transform.k }
}

/** Applies a finite viewport through D3 so scene transforms and zoom feedback stay synchronized. */
function setViewport(viewport: MapViewport): void {
  const element = svgElement.value
  const next = clampMapViewport(viewport)
  if (!element || !mapRenderer || !next) return
  select(element).call(
    mapRenderer.zoomBehavior.transform,
    zoomIdentity.translate(next.x, next.y).scale(next.k),
  )
}

/** Applies a positive relative D3 zoom factor to the mounted SVG. */
function zoomBy(factor: number): void {
  if (!Number.isFinite(factor) || factor <= 0 || !svgElement.value || !mapRenderer) return
  select(svgElement.value).call(mapRenderer.zoomBehavior.scaleBy, factor)
}

/** Pans by a delta in SVG viewport user coordinates. */
function panBy(dx: number, dy: number): void {
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return
  const viewport = getViewport()
  setViewport({ ...viewport, x: viewport.x + dx, y: viewport.y + dy })
}

function touchPoint(touch: Touch, element: SVGSVGElement): [number, number] {
  return pointer(touch, element) as [number, number]
}

function beginTouchPinch(touches: TouchList): void {
  const element = svgElement.value
  const zoomBehavior = mapRenderer?.zoomBehavior
  if (!element || !zoomBehavior || touches.length < 2) return
  const first = touchPoint(touches[0]!, element)
  const second = touchPoint(touches[1]!, element)
  const center: [number, number] = [(first[0] + second[0]) / 2, (first[1] + second[1]) / 2]
  const transform = zoomTransform(element)
  touchGesture = {
    mode: 'pinch',
    transform,
    distance: Math.max(1, Math.hypot(second[0] - first[0], second[1] - first[1])),
    anchor: transform.invert(center),
  }
}

function startTouchNavigation(event: TouchEvent): void {
  if (!props.touchNavigation || event.touches.length < 2) return
  emit('cancel-object-placement-preview')
  emit('cancel-orbit-placement-preview')
  cancelCreationPreview(true)
  cancelActiveGesture()
  beginTouchPinch(event.touches)
  event.preventDefault()
  event.stopPropagation()
}

function moveTouchNavigation(event: TouchEvent): void {
  const element = svgElement.value
  const zoomBehavior = mapRenderer?.zoomBehavior
  if (!props.touchNavigation || !element || !zoomBehavior || !touchGesture) return
  event.preventDefault()
  event.stopImmediatePropagation()
  if (touchGesture.mode === 'pinch' && event.touches.length >= 2) {
    const first = touchPoint(event.touches[0]!, element)
    const second = touchPoint(event.touches[1]!, element)
    const center: [number, number] = [(first[0] + second[0]) / 2, (first[1] + second[1]) / 2]
    const ratio = Math.hypot(second[0] - first[0], second[1] - first[1]) / touchGesture.distance
    const scale = Math.max(MAP_ZOOM_MIN_SCALE, Math.min(MAP_ZOOM_MAX_SCALE, touchGesture.transform.k * ratio))
    select(element).call(zoomBehavior.transform, zoomIdentity.translate(center[0] - touchGesture.anchor[0] * scale, center[1] - touchGesture.anchor[1] * scale).scale(scale))
  } else if (touchGesture.mode === 'pan' && event.touches.length >= 1) {
    const point = touchPoint(event.touches[0]!, element)
    select(element).call(zoomBehavior.transform, zoomIdentity
      .translate(touchGesture.transform.x + point[0] - touchGesture.start[0], touchGesture.transform.y + point[1] - touchGesture.start[1])
      .scale(touchGesture.transform.k))
  }
}

function endTouchNavigation(event: TouchEvent): void {
  const element = svgElement.value
  const zoomBehavior = mapRenderer?.zoomBehavior
  if (!props.touchNavigation || !element || !zoomBehavior || !touchGesture) return
  if (event.touches.length >= 2) {
    beginTouchPinch(event.touches)
  } else if (event.touches.length === 1) {
    touchGesture = { mode: 'pan', transform: zoomTransform(element), start: touchPoint(event.touches[0]!, element) }
  } else {
    touchGesture = null
  }
}

/** Cancels active edits and navigation previews. */
function cancelActiveGesture(): void {
  touchGesture = null
  viewPan = null
  mapRenderer?.cancelActiveGesture()
}

/** Replaces or clears a parent-owned object placement preview in scene coordinates. */
function setObjectPlacementPreview(objectId: string, scenePoint: Point | null): void {
  if (scenePoint) objectPlacementPreviews.set(objectId, { ...scenePoint })
  else objectPlacementPreviews.delete(objectId)
  mapRenderer?.setObjectPlacementPreview(objectId, scenePoint)
}

/** Replaces or clears a parent-owned proposed-host Orbit preview in scene coordinates. */
function setOrbitPlacementPreview(orbitId: string, preview: OrbitPlacementPreview | null): void {
  if (preview) {
    orbitPlacementPreviews.set(orbitId, {
      ...preview,
      center: { ...preview.center },
      radii: { ...preview.radii },
    })
  } else {
    orbitPlacementPreviews.delete(orbitId)
  }
  mapRenderer?.setOrbitPlacementPreview(orbitId, preview)
}

/** Cancels only the currently displayed geometric target, retaining the armed Add type. */
function cancelCreationPreview(preserveNavigation = false): void {
  const preview = props.creationPreview
  if (!props.creationType || !preview || cancelledCreationPreviewId === preview.id) return
  cancelledCreationPreviewId = preview.id
  if (!preserveNavigation) cancelActiveGesture()
  emit('cancel-creation-preview')
}

/** Starts a view-only pan and rolls back any unfinished object or Orbit preview. */
function startViewPan(event: MouseEvent): void {
  const element = svgElement.value
  if (!element || !mapRenderer) return
  emit('cancel-object-placement-preview')
  emit('cancel-orbit-placement-preview')
  cancelCreationPreview(true)
  cancelActiveGesture()
  viewPan = { transform: zoomTransform(element), start: pointer(event, element) as [number, number] }
}

function moveViewPan(event: MouseEvent): void {
  const element = svgElement.value
  if (!element || !mapRenderer || !viewPan) return
  const point = pointer(event, element)
  select(element).call(mapRenderer.zoomBehavior.transform, zoomIdentity
    .translate(viewPan.transform.x + point[0] - viewPan.start[0], viewPan.transform.y + point[1] - viewPan.start[1])
    .scale(viewPan.transform.k))
}

function endViewPan(): void { viewPan = null }

/** Rolls back an active D3 edit on Escape even when the pointer left focus on another control. */
function cancelActiveMapGestureOnEscape(event: KeyboardEvent): void {
  if (event.key !== 'Escape') return
  const element = svgElement.value
  if (!element?.querySelector('.is-resizing, .is-moving, .is-rotating, .is-dragging')) return

  const target = event.target
  const originatedInMap = target instanceof Node && element.contains(target)
  if (originatedInMap) {
    event.preventDefault()
    event.stopImmediatePropagation()
  }
  emit('cancel-object-placement-preview')
  emit('cancel-orbit-placement-preview')
  cancelActiveGesture()
}

/**
 * Exports the full system scene and includes the current system name in its title band.
 * @param format Requested SVG or PNG output.
 * @returns Export blob.
 * @throws If the SVG is not mounted or scene export/rasterization fails.
 */
async function exportImage(format: MapImageFormat, palette: MapImagePalette = 'active'): Promise<Blob> {
  const element = svgElement.value
  if (!element) throw new Error('The star system map is not ready to export.')
  return exportMapImage(
    element,
    format,
    props.system.name,
    palette,
    clone => mapRenderer?.prepareExportClone(clone),
  )
}

/**
 * Fits both object and Orbit scene bounds inside the drawable viewport, clamping to supported zoom limits.
 * If no valid map geometry exists, resets the view to the identity transform.
 */
function fitMap(usableRect?: SvgViewportRect): void {
  const element = svgElement.value
  const zoomBehavior = mapRenderer?.zoomBehavior
  if (!element || !zoomBehavior) return

  const requestedRect = usableRect ? normalizeSvgViewportRect(usableRect) : undefined
  const rect = requestedRect ?? getSvgViewportRect(element)
  zoomExtentOverride = requestedRect
  zoomBehavior.extent(() => svgViewportExtent(zoomExtentOverride ?? getSvgViewportRect(element)))

  let bounds: DOMRect[]
  try {
    bounds = ['.system-map-items', '.system-orbits']
      .map(selector => element.querySelector<SVGGElement>(selector)?.getBBox())
      .filter((box): box is DOMRect => box !== undefined && (box.width > 0 || box.height > 0))
  } catch {
    setViewport({ x: 0, y: 0, k: 1 })
    return
  }
  if (!bounds.length) {
    setViewport({ x: 0, y: 0, k: 1 })
    return
  }

  const left = Math.min(...bounds.map(box => box.x))
  const top = Math.min(...bounds.map(box => box.y))
  const right = Math.max(...bounds.map(box => box.x + box.width))
  const bottom = Math.max(...bounds.map(box => box.y + box.height))
  const viewport = fitMapViewport({ x: left, y: top, width: right - left, height: bottom - top }, rect)
  setViewport(viewport ?? { x: 0, y: 0, k: 1 })
}

/**
 * Rebuilds the D3 scene; creation-only redraws leave active view navigation intact.
 */
function render(preserveNavigation = false): void {
  const element = svgElement.value
  if (!element) return

  mapRenderer?.cancelActiveGesture()
  if (!preserveNavigation) {
    touchGesture = null
    viewPan = null
  }
  mapRenderer = renderSystemMap({
    element,
    system: props.system,
    geometry: mapGeometry.value,
    selectedObjectId: props.selectedObjectId,
    selectedOrbitId: props.selectedOrbitId,
    creationType: props.creationType,
    creationPreview: props.creationPreview,
    creationChooserOpen: props.creationChooserOpen,
    objectPlacementPreviews,
    orbitPlacementPreviews,
    moveEnabled: props.moveEnabled,
    orbitRotationWheelEvents,
    handlers,
    setZoomLevel: (value) => {
      zoomLevel.value = value
    },
    onViewportChange: viewport => emit('viewport-change', viewport),
  })
  const zoomExtent = zoomExtentOverride
  if (zoomExtent) mapRenderer.zoomBehavior.extent(() => svgViewportExtent(zoomExtent))
}

/**
 * Delegates to the geometry search used by detach workflows.
 * @param orbitId Hosted Orbit to detach.
 * @returns Normalized center with point clearance, or undefined when the Orbit is missing/unoccupied.
 */
function getDetachedOrbitCenter(orbitId: string): Point | undefined {
  return findDetachedOrbitCenter(props.system, orbitId, mapGeometry.value)
}

/** Returns all creation candidates around a raw SVG scene point using the live system geometry. */
function getCreationCandidates(point: Point, type: SystemCreationType): SystemCreationCandidate[] {
  return mapRenderer?.getCreationCandidates(point, type) ?? []
}

onMounted(() => {
  render()
  document.addEventListener('keydown', cancelActiveMapGestureOnEscape, true)
  window.addEventListener('blur', cancelActiveGesture)
})
onBeforeUnmount(() => {
  document.removeEventListener('keydown', cancelActiveMapGestureOnEscape, true)
  window.removeEventListener('blur', cancelActiveGesture)
  cancelActiveGesture()
})
watch(() => props.system, () => render(), { deep: true })
watch(() => props.orbitRadii, () => render(), { deep: true })
watch(() => props.orbitRotations, () => render(), { deep: true })
watch(() => props.objectAngles, () => render(), { deep: true })
watch(() => props.selectedObjectId, () => render())
watch(() => props.selectedOrbitId, () => render())
watch(() => props.moveEnabled, () => render())
watch(() => props.creationType, () => render(), { deep: true })
watch([
  () => props.creationPreview,
  () => props.creationChooserOpen,
], () => render(true), { deep: true })

defineExpose({
  exportImage,
  getDetachedOrbitCenter,
  getCreationCandidates,
  getViewport,
  setViewport,
  zoomBy,
  panBy,
  fitMap,
  cancelActiveGesture,
  cancelCreationPreview,
  setObjectPlacementPreview,
  setOrbitPlacementPreview,
  startViewPan,
  moveViewPan,
  endViewPan,
  startTouchNavigation,
  moveTouchNavigation,
  endTouchNavigation,
})
</script>

<style>
.map-view {
  position: relative;
}

.system-map-svg {
  background: var(--map-bg);
}

.map-touch-surface { touch-action: none; }

.map-navigation {
  position: absolute;
  z-index: 2;
  bottom: 0.75rem;
  left: 50%;
  transform: translateX(-50%);
  border: 1px solid var(--line);
  border-radius: 3px;
  background: rgba(18, 28, 30, 0.94);
  box-shadow: 0 0.7rem 2rem rgba(0, 0, 0, 0.32);
  backdrop-filter: blur(12px);
}

.map-navigation button {
  min-width: 2rem;
  border: 1px solid var(--line);
  border-radius: 2px;
  background: var(--control-bg);
  color: var(--text-primary);
  font: 12px Consolas, monospace;
  line-height: 1.5rem;
}

.map-navigation button:focus-visible {
  outline: 2px solid var(--focus);
  outline-offset: 1px;
}

.map-navigation button:disabled {
  cursor: not-allowed;
  opacity: 0.58;
}

.map-navigation output {
  min-width: 3.5rem;
  color: var(--text-primary);
  font: 11px Consolas, monospace;
  text-align: center;
}

.map-background {
  fill: var(--map-bg);
  pointer-events: none;
}

.map-grid {
  fill: url(#system-map-grid);
  pointer-events: none;
}

.map-grid-line {
  fill: none;
  stroke: var(--map-grid-line);
  stroke-width: 1;
}

.orbit-ring {
  fill: none;
  stroke: var(--map-orbit);
  stroke-width: 2;
  stroke-dasharray: 3 6;
  pointer-events: none;
}

.orbit-hit-target {
  fill: transparent;
  stroke: transparent;
  stroke-width: 16;
  pointer-events: stroke;
}

.orbit-mark {
  pointer-events: none;
}

.orbit-hit-target {
  cursor: grab;
}

.orbit-hit-target.is-resizing {
  cursor: grabbing;
}

.orbit-mark:has(.orbit-hit-target:hover, .orbit-hit-target:focus) .orbit-ring,
.orbit-mark.is-selected .orbit-ring {
  stroke: var(--map-selected);
  stroke-width: 2.4;
}

.orbit-axis-handle {
  fill: var(--map-bg);
  stroke: var(--map-selected);
  stroke-width: 2;
  opacity: 0;
  pointer-events: none;
  transition: opacity 120ms ease-out;
}

.orbit-center-handle {
  fill: var(--map-bg);
  stroke: var(--map-selected);
  stroke-width: 2;
  cursor: move;
  opacity: 0;
  pointer-events: none;
  transition: opacity 120ms ease-out;
}

.orbit-center-handle.is-moving {
  cursor: grabbing;
}

.orbit-rotation-stem {
  stroke: var(--map-selected);
  stroke-width: 1.5;
  opacity: 0;
  pointer-events: none;
  transition: opacity 120ms ease-out;
}

.orbit-rotation-handle {
  fill: var(--map-selected);
  stroke: var(--map-bg);
  stroke-width: 2;
  cursor: grab;
  opacity: 0;
  pointer-events: none;
  transition: opacity 120ms ease-out;
}

.orbit-rotation-handle.is-rotating {
  cursor: grabbing;
}

.orbit-mark.is-selected .orbit-axis-handle,
.orbit-mark:has(.orbit-hit-target:hover, .orbit-axis-handle:hover, .orbit-hit-target:focus) .orbit-axis-handle {
  opacity: 1;
  pointer-events: all;
}

.orbit-mark.is-selected .orbit-center-handle,
.orbit-mark:has(.orbit-hit-target:hover, .orbit-center-handle:hover, .orbit-hit-target:focus) .orbit-center-handle {
  opacity: 1;
  pointer-events: all;
}

.orbit-mark.is-selected .orbit-rotation-stem,
.orbit-mark.is-selected .orbit-rotation-handle,
.orbit-mark:has(.orbit-hit-target:hover, .orbit-rotation-handle:hover, .orbit-hit-target:focus) .orbit-rotation-stem,
.orbit-mark:has(.orbit-hit-target:hover, .orbit-rotation-handle:hover, .orbit-hit-target:focus) .orbit-rotation-handle {
  opacity: 1;
  pointer-events: all;
}

.orbit-hit-target:focus,
.system-object:focus {
  outline: none;
}

.system-object {
  cursor: pointer;
  pointer-events: none;
}

.system-object.is-dragging {
  cursor: grabbing;
}

.orbit-axis-handle:focus-visible,
.orbit-rotation-handle:focus-visible {
  stroke: var(--focus);
  stroke-width: 3;
}

.orbit-center-handle:focus-visible {
  stroke: var(--focus);
  stroke-width: 3;
}

.object-hit-target {
  fill: transparent;
  pointer-events: all;
}

.object-glyph-halo {
  fill: none;
  stroke: var(--map-star-halo);
  stroke-width: 1.2;
}

.system-object-glyph {
  fill: var(--map-text);
  font: 20px Consolas, monospace;
  pointer-events: none;
}

.system-object:hover .system-object-glyph,
.system-object:focus .system-object-glyph,
.system-object.is-selected .system-object-glyph {
  fill: var(--map-selected);
}

.object-key {
  fill: var(--map-unresolved);
  font: 9px Consolas, monospace;
  text-anchor: middle;
  pointer-events: none;
}

.object-name {
  fill: var(--map-text);
  font: 12px Georgia, serif;
  text-anchor: middle;
  pointer-events: none;
}

.object-type-mark {
  fill: var(--map-text);
  font: 10px Consolas, monospace;
  pointer-events: none;
}

.map-empty {
  fill: var(--map-muted);
  font: 16px Georgia, serif;
}

.system-creation-preview {
  pointer-events: none;
}

.system-creation-preview-orbit {
  fill: none;
  stroke: var(--map-selected);
  stroke-width: 2.5;
  stroke-dasharray: 8 6;
  opacity: 0.9;
}

.system-creation-preview-center {
  fill: var(--map-bg);
  stroke: var(--map-selected);
  stroke-width: 2.5;
}

.system-creation-preview-ring {
  fill: color-mix(in srgb, var(--map-bg) 72%, transparent);
  stroke: var(--map-selected);
  stroke-width: 2.5;
  stroke-dasharray: 5 4;
}

.system-creation-preview-glyph {
  fill: var(--map-selected);
  font: 20px Consolas, monospace;
}

.system-creation-preview-label {
  fill: var(--map-text);
  font: 12px Georgia, serif;
  stroke: var(--map-bg);
  stroke-width: 4px;
  paint-order: stroke;
}
</style>
