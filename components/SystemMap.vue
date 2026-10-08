<template>
  <div class="map-view flex h-full min-h-0 min-w-0 flex-1 flex-col">
    <div class="map-navigation flex shrink-0 items-center gap-1 border-b border-[var(--line-soft)] bg-[var(--panel-bg)] px-2 py-1" role="toolbar" aria-label="Map navigation">
      <button type="button" aria-label="Zoom out" :disabled="zoomLevel <= MAP_ZOOM_MIN_SCALE * 100" @click="zoomBy(1 / 1.2)">−</button>
      <output aria-label="Zoom level" aria-live="polite">{{ zoomLevel }}%</output>
      <button type="button" aria-label="Zoom in" :disabled="zoomLevel >= MAP_ZOOM_MAX_SCALE * 100" @click="zoomBy(1.2)">+</button>
      <button type="button" aria-label="Fit map" @click="fitMap">Fit</button>
    </div>
    <svg
      ref="svgElement"
      class="system-map-svg block h-full min-h-0 w-full flex-1"
      viewBox="0 0 960 560"
      role="group"
      :aria-label="`${system.name} star system map`"
      @wheel.capture="captureOrbitRotationWheel"
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
import { select, zoomIdentity } from 'd3'
import {
  type CatalogueSubtype,
  type OrbitRadii,
  type Point,
  type StarSystem,
} from '../domain/workspace'
import { exportMapImage, type MapImageFormat } from '../utils/map-image-export'
import { MAP_ZOOM_MAX_SCALE, MAP_ZOOM_MIN_SCALE } from '../utils/map-zoom'
import {
  getDetachedOrbitCenter as findDetachedOrbitCenter,
  type SystemMapGeometry,
} from '../utils/system-map-geometry'
import {
  renderSystemMap,
  type SystemMapEventHandlers,
  type SystemMapRenderer,
} from './maps/system-map-renderer'

const props = defineProps<{
  system: StarSystem
  orbitRadii: Record<string, OrbitRadii>
  orbitRotations: Record<string, number>
  objectAngles: Record<string, number>
  selectedObjectId: string | null
  selectedOrbitId: string | null
}>()

const emit = defineEmits<{
  'select-object': [id: string]
  'select-orbit': [id: string]
  'move-object': [id: string, position: Point]
  'move-orbit-center': [id: string, center: Point, hostId: string | null]
  'rotate-object': [id: string, angle: number]
  'resize-orbit': [id: string, radii: OrbitRadii]
  'rotate-orbit': [id: string, rotation: number]
  'place-object-in-orbit': [id: string, orbitId: string, angle: number]
  'drop-orbit': [point: Point, hostId: string | null]
  'drop-object': [subtype: CatalogueSubtype, point: Point, orbitId: string | null, angle: number | null]
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

const handlers: SystemMapEventHandlers = {
  selectObject: id => emit('select-object', id),
  selectOrbit: id => emit('select-orbit', id),
  moveObject: (id, position) => emit('move-object', id, position),
  moveOrbitCenter: (id, center, hostId) => emit('move-orbit-center', id, center, hostId),
  rotateObject: (id, angle) => emit('rotate-object', id, angle),
  resizeOrbit: (id, radii) => emit('resize-orbit', id, radii),
  rotateOrbit: (id, rotation) => emit('rotate-orbit', id, rotation),
  placeObjectInOrbit: (id, orbitId, angle) => emit('place-object-in-orbit', id, orbitId, angle),
  dropOrbit: (point, hostId) => emit('drop-orbit', point, hostId),
  dropObject: (subtype, point, orbitId, angle) =>
    emit('drop-object', subtype, point, orbitId, angle),
}

/** Forwards a captured wheel event so Orbit rotation cannot also zoom the map. */
function captureOrbitRotationWheel(event: WheelEvent): void {
  mapRenderer?.captureOrbitRotationWheel(event)
}

/** Forwards palette drops to the D3 renderer for scene-coordinate target resolution. */
function handleObjectDrop(event: DragEvent): void {
  mapRenderer?.handleObjectDrop(event)
}

/** Applies a relative D3 zoom factor to the mounted SVG. */
function zoomBy(factor: number): void {
  if (svgElement.value && mapRenderer) {
    select(svgElement.value).call(mapRenderer.zoomBehavior.scaleBy, factor)
  }
}

/**
 * Exports the full system scene and includes the current system name in its title band.
 * @param format Requested SVG or PNG output.
 * @returns Export blob.
 * @throws If the SVG is not mounted or scene export/rasterization fails.
 */
async function exportImage(format: MapImageFormat): Promise<Blob> {
  const element = svgElement.value
  if (!element) throw new Error('The star system map is not ready to export.')
  return exportMapImage(element, format, props.system.name)
}

/**
 * Fits both object and Orbit scene bounds inside the viewport, clamping to supported zoom limits.
 * If no map geometry exists, resets the view to the identity transform.
 */
function fitMap(): void {
  const element = svgElement.value
  const zoomBehavior = mapRenderer?.zoomBehavior
  if (!element || !zoomBehavior) return

  const bounds = ['.system-map-items', '.system-orbits']
    .map(selector => element.querySelector<SVGGElement>(selector)?.getBBox())
    .filter((box): box is DOMRect => box !== undefined && (box.width > 0 || box.height > 0))
  if (!bounds.length) {
    select(element).call(zoomBehavior.transform, zoomIdentity)
    return
  }

  const left = Math.min(...bounds.map(box => box.x))
  const top = Math.min(...bounds.map(box => box.y))
  const right = Math.max(...bounds.map(box => box.x + box.width))
  const bottom = Math.max(...bounds.map(box => box.y + box.height))
  const width = right - left
  const height = bottom - top
  const scale = Math.max(MAP_ZOOM_MIN_SCALE, Math.min(
    MAP_ZOOM_MAX_SCALE,
    (960 - 80) / width,
    (560 - 80) / height,
  ))
  const x = (960 - width * scale) / 2 - left * scale
  const y = (560 - height * scale) / 2 - top * scale
  select(element).call(zoomBehavior.transform, zoomIdentity.translate(x, y).scale(scale))
}

/**
 * Rebuilds the D3 scene from current props; zoom and scene gestures remain renderer-owned.
 */
function render(): void {
  const element = svgElement.value
  if (!element) return

  mapRenderer = renderSystemMap({
    element,
    system: props.system,
    geometry: mapGeometry.value,
    selectedObjectId: props.selectedObjectId,
    selectedOrbitId: props.selectedOrbitId,
    orbitRotationWheelEvents,
    handlers,
    setZoomLevel: (value) => {
      zoomLevel.value = value
    },
  })
}

/**
 * Delegates to the geometry search used by detach workflows.
 * @param orbitId Hosted Orbit to detach.
 * @returns Normalized center with point clearance, or undefined when the Orbit is missing/unoccupied.
 */
function getDetachedOrbitCenter(orbitId: string): Point | undefined {
  return findDetachedOrbitCenter(props.system, orbitId, mapGeometry.value)
}

onMounted(render)
watch(() => props.system, render, { deep: true })
watch(() => props.orbitRadii, render, { deep: true })
watch(() => props.orbitRotations, render, { deep: true })
watch(() => props.objectAngles, render, { deep: true })
watch(() => props.selectedObjectId, render)
watch(() => props.selectedOrbitId, render)

defineExpose({ exportImage, getDetachedOrbitCenter })
</script>

<style>
.map-view {
  position: relative;
}

.system-map-svg {
  background: var(--map-bg);
}

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
</style>
