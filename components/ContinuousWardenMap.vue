<template>
  <div class="map-view flex h-full min-h-0 min-w-0 flex-1 flex-col">
    <svg
      ref="svgElement"
      class="cluster-map-svg continuous-warden-map-svg block h-full min-h-0 w-full flex-1"
      :class="{ 'map-touch-surface': touchNavigation }"
      viewBox="0 0 960 560"
      role="group"
      :aria-label="`${cluster.name} continuous map`"
      aria-describedby="workspace-map-tool-shortcut-help continuous-warden-map-keyboard-help"
      tabindex="0"
      @pointerdown.capture="onPointerDownCapture"
      @pointermove.capture="onPointerMoveCapture"
      @pointerup.capture="onPointerEndCapture"
      @pointercancel.capture="onPointerEndCapture"
      @lostpointercapture.capture="onLostPointerCapture"
      @click.capture="onClickCapture"
      @keydown.capture="onKeydownCapture"
      @touchstart.capture="startTouchNavigation"
    >
      <title>{{ cluster.name }} continuous Warden map</title>
      <desc id="continuous-warden-map-keyboard-help">
        Zoom continuously to reveal each system interior independently. In Move, drag a system anchor or name to update its Cluster position.
      </desc>
      <g class="cluster-map-content" :transform="cameraTransform">
        <g class="cluster-map-items">
          <g
            v-for="projection in projections"
            :key="projection.id"
            class="continuous-warden-system"
            :data-system-id="projection.id"
          >
            <rect
              class="continuous-warden-system-envelope"
              :class="{ 'is-detailed': detailSystemIds.has(projection.id), 'is-move-preview': previewPositions.has(projection.id) }"
              :x="projection.envelope.x + anchorDelta(projection).x"
              :y="projection.envelope.y + anchorDelta(projection).y"
              :width="projection.envelope.width"
              :height="projection.envelope.height"
              rx="18"
              aria-hidden="true"
            />

            <g
              v-if="detailSystemIds.has(projection.id)"
              class="continuous-warden-system-detail"
              :transform="systemTransform(projection)"
              aria-hidden="true"
            >
              <g class="system-orbits">
                <ellipse
                  v-for="orbit in projection.orbits"
                  :key="orbit.id"
                  class="orbit-ring"
                  :cx="orbit.center.x"
                  :cy="orbit.center.y"
                  :rx="orbit.radii.horizontal"
                  :ry="orbit.radii.vertical"
                  :transform="`rotate(${orbit.rotation} ${orbit.center.x} ${orbit.center.y})`"
                />
              </g>
              <g class="system-map-items">
                <g
                  v-for="object in projection.objects"
                  :key="object.id"
                  class="continuous-warden-object"
                  :transform="`translate(${object.position.x} ${object.position.y})`"
                  :data-object-id="object.id"
                >
                  <circle v-if="objectSubtype(projection.id, object.id) === 'star'" class="continuous-warden-star-halo" r="18" />
                  <text class="continuous-warden-object-glyph" y="8" text-anchor="middle">
                    {{ objectGlyph(projection.id, object.id) }}
                  </text>
                  <text class="continuous-warden-object-key" y="31" text-anchor="middle">
                    {{ object.locationKey }}
                  </text>
                  <text class="continuous-warden-object-name" y="46" text-anchor="middle">
                    {{ object.name }}
                  </text>
                </g>
              </g>
            </g>

            <g
              class="cluster-system-node continuous-warden-system-anchor"
              :class="{ 'is-selected': selectedSystemId === projection.id, 'is-move-preview': previewPositions.has(projection.id) }"
              :data-system-id="projection.id"
              :transform="anchorTransform(projection)"
              role="button"
              tabindex="-1"
              :aria-label="`Select ${projection.name}`"
            >
              <circle class="continuous-warden-anchor-hit-target" r="16" />
              <circle class="continuous-warden-anchor-mark" r="7" />
              <circle class="continuous-warden-anchor-core" r="2" />
            </g>
          </g>
        </g>
        <g class="continuous-warden-name-layer" :transform="screenLayerTransform">
          <g v-for="label in nameLabels" :key="label.id">
            <line
              v-if="label.hasLeader"
              class="continuous-warden-name-leader"
              :x1="label.anchorX"
              :y1="label.anchorY"
              :x2="label.x"
              :y2="label.y + 14"
              aria-hidden="true"
            />
            <g
              class="cluster-system-node continuous-warden-name-target"
              :class="{ 'is-selected': selectedSystemId === label.id, 'is-move-preview': previewPositions.has(label.id) }"
              :data-system-id="label.id"
              :transform="`translate(${label.x} ${label.y})`"
              role="button"
              tabindex="-1"
              :aria-label="`Select ${label.name}`"
            >
              <rect
                class="continuous-warden-name-background"
                :x="-label.width / 2"
                y="0"
                :width="label.width"
                height="28"
                rx="5"
              />
              <text class="continuous-warden-system-name" y="19" text-anchor="middle">
                {{ label.name }}
              </text>
            </g>
          </g>
        </g>
      </g>
    </svg>
  </div>
</template>

<script setup lang="ts">
/** Warden continuous scene with one D3 camera and independent system-envelope reveal. */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { pointer, select, zoom, zoomIdentity, zoomTransform, type ZoomBehavior } from 'd3'
import type { JumpCluster, Point, StarSystem } from '../domain/workspace'
import type { MapInteractionMode } from '../composables/editor-workflows/types'
import type { MapViewport, SvgViewportRect } from '../utils/map-zoom'
import {
  clampMapViewport,
  fitMapViewport,
  getSvgViewportRect,
  MAP_ZOOM_MAX_SCALE,
  MAP_ZOOM_MIN_SCALE,
  normalizeSvgViewportRect,
  svgViewportExtent,
} from '../utils/map-zoom'
import {
  clampWardenClusterAnchor,
  CONTINUOUS_MAP_LOCAL_ORIGIN,
  projectWardenSystem,
  unprojectWardenClusterAnchor,
  type ContinuousWardenSystemProjection,
} from '../utils/continuous-map-projection'
import { clusterSystemPosition } from '../utils/cluster-map-geometry'
import { createMapTouchNavigation } from './maps/map-touch-navigation'
import { exportMapImage, type MapImageFormat, type MapImagePalette } from '../utils/map-image-export'

const DETAIL_REVEAL_PIXELS = 250
const DETAIL_HIDE_PIXELS = 210
const MINIMUM_FIT_PADDING = 48

const props = defineProps<{
  cluster: JumpCluster
  systemPositions: Readonly<Record<string, Point>>
  objectAngles: Readonly<Record<string, number>>
  orbitRadii: Readonly<Record<string, { horizontal: number; vertical: number }>>
  orbitRotations: Readonly<Record<string, number>>
  selectedSystemId: string | null
  mode: MapInteractionMode
  clusterAddType: 'system' | 'route' | null
  clusterChooserOpen: boolean
  clusterMoveTargeting: boolean
  moveTargeting: boolean
  touchNavigation?: boolean
  initialViewport: MapViewport | null
}>()

const emit = defineEmits<{
  'activate-system': [id: string]
  'cluster-target': [point: Point, systemIds: string[]]
  'move-system': [id: string, position: Point]
  'move-target': [point: Point]
  'editing-gesture-change': [active: boolean]
  'viewport-change': [viewport: MapViewport]
}>()

const svgElement = ref<SVGSVGElement | null>(null)
const viewport = ref<MapViewport>({ x: 0, y: 0, k: 1 })
const previewPositions = ref(new Map<string, Point>())
const detailSystemIds = ref(new Set<string>())
const minimumZoomScale = ref(MAP_ZOOM_MIN_SCALE)
const ready = ref(false)
let zoomBehavior: ZoomBehavior<SVGSVGElement, unknown> | undefined
let resizeObserver: ResizeObserver | undefined
let viewPan: { transform: MapViewport; start: [number, number] } | null = null
let activeAnchorDrag: {
  systemId: string
  pointerId: number
  startClient: Point
  startScene: Point
  origin: Point
  preview: Point
  moved: boolean
} | null = null
let resolveReady: (value: boolean) => void = () => undefined
const readiness = new Promise<boolean>(resolve => { resolveReady = resolve })

const systemGeometry = computed(() => ({
  objectAngles: props.objectAngles,
  orbitRadii: props.orbitRadii,
  orbitRotations: props.orbitRotations,
}))

const projections = computed(() => props.cluster.systems.map(system => projectWardenSystem(
  system,
  props.systemPositions[system.id],
  systemGeometry.value,
)))

const sceneBounds = computed<SvgViewportRect | null>(() => {
  if (projections.value.length === 0) return null
  let left = Number.POSITIVE_INFINITY
  let top = Number.POSITIVE_INFINITY
  let right = Number.NEGATIVE_INFINITY
  let bottom = Number.NEGATIVE_INFINITY
  for (const projection of projections.value) {
    const delta = anchorDelta(projection)
    left = Math.min(left, projection.envelope.x + delta.x)
    top = Math.min(top, projection.envelope.y + delta.y)
    right = Math.max(right, projection.envelope.x + delta.x + projection.envelope.width)
    bottom = Math.max(bottom, projection.envelope.y + delta.y + projection.envelope.height)
  }
  return [left, top, right, bottom].every(Number.isFinite)
    ? { x: left - MINIMUM_FIT_PADDING, y: top - MINIMUM_FIT_PADDING, width: right - left + MINIMUM_FIT_PADDING * 2, height: bottom - top + MINIMUM_FIT_PADDING * 2 }
    : null
})

const cameraTransform = computed(() => `translate(${viewport.value.x} ${viewport.value.y}) scale(${viewport.value.k})`)
const screenLayerTransform = computed(() => {
  const { x, y, k } = viewport.value
  return `translate(${-x / k} ${-y / k}) scale(${1 / k})`
})

interface NameLabel {
  id: string
  name: string
  x: number
  y: number
  width: number
  anchorX: number
  anchorY: number
  hasLeader: boolean
}

function anchorFor(projection: ContinuousWardenSystemProjection): Point {
  const preview = previewPositions.value.get(projection.id)
  return preview
    ? clusterSystemPosition({ [projection.id]: preview }, projection.id)
    : projection.anchor
}

function anchorDelta(projection: ContinuousWardenSystemProjection): Point {
  const anchor = anchorFor(projection)
  return { x: anchor.x - projection.anchor.x, y: anchor.y - projection.anchor.y }
}

function systemTransform(projection: ContinuousWardenSystemProjection): string {
  const anchor = anchorFor(projection)
  return `translate(${anchor.x - CONTINUOUS_MAP_LOCAL_ORIGIN.x * projection.scale} ${anchor.y - CONTINUOUS_MAP_LOCAL_ORIGIN.y * projection.scale}) scale(${projection.scale})`
}

function anchorTransform(projection: ContinuousWardenSystemProjection): string {
  const anchor = anchorFor(projection)
  return `translate(${anchor.x} ${anchor.y}) scale(${1 / viewport.value.k})`
}

const nameLabels = computed<NameLabel[]>(() => {
  const labels: NameLabel[] = []
  const occupied: Array<{ left: number; top: number; right: number; bottom: number }> = []
  const anchorPoints = projections.value.map(projection => {
    const anchor = anchorFor(projection)
    return {
      id: projection.id,
      name: projection.name,
      x: viewport.value.x + anchor.x * viewport.value.k,
      y: viewport.value.y + anchor.y * viewport.value.k,
    }
  })
  const candidates = [
    { x: 0, y: -31 }, { x: 0, y: -59 }, { x: -84, y: -31 }, { x: 84, y: -31 },
    { x: -112, y: 6 }, { x: 112, y: 6 }, { x: 0, y: 34 }, { x: 0, y: -87 },
    { x: -144, y: -31 }, { x: 144, y: -31 }, { x: -84, y: 34 }, { x: 84, y: 34 },
    { x: 0, y: 62 }, { x: -168, y: 4 }, { x: 168, y: 4 }, { x: 0, y: -115 },
  ]
  for (const anchor of anchorPoints) {
    const width = Math.max(72, anchor.name.length * 10 + 20)
    let chosen = candidates[0]!
    for (const offset of candidates) {
      const bounds = {
        left: anchor.x + offset.x - width / 2,
        right: anchor.x + offset.x + width / 2,
        top: anchor.y + offset.y,
        bottom: anchor.y + offset.y + 28,
      }
      const overlapsLabel = occupied.some(prior => bounds.left < prior.right + 6
        && bounds.right + 6 > prior.left && bounds.top < prior.bottom + 5 && bounds.bottom + 5 > prior.top)
      const coversAnchor = anchorPoints.some(other => other.id !== anchor.id
        && bounds.left < other.x + 18 && bounds.right > other.x - 18
        && bounds.top < other.y + 18 && bounds.bottom > other.y - 18)
      if (!overlapsLabel && !coversAnchor) {
        chosen = offset
        break
      }
    }
    const x = anchor.x + chosen.x
    const y = anchor.y + chosen.y
    occupied.push({ left: x - width / 2, top: y, right: x + width / 2, bottom: y + 28 })
    labels.push({
      id: anchor.id,
      name: anchor.name,
      x,
      y,
      width,
      anchorX: anchor.x,
      anchorY: anchor.y,
      hasLeader: Math.abs(chosen.x) > 0 || Math.abs(chosen.y + 31) > 6,
    })
  }
  return labels
})

function localObject(projectionId: string, objectId: string): StarSystem['objects'][number] | undefined {
  return props.cluster.systems.find(system => system.id === projectionId)?.objects.find(object => object.id === objectId)
}

function objectGlyph(projectionId: string, objectId: string): string {
  const object = localObject(projectionId, objectId)
  if (!object) return '◇'
  const glyphs: Record<string, string> = {
    star: '✦', planet: '◉', moon: '☾', asteroid: '◆', belt: '⋯', station: '⌂', base: '▤', colony: '⚑',
    vessel: '△', derelict: '▽', 'jump-point': '⊕', anomaly: '✧', nebula: '◌', hazard: '⚠', other: '◇',
  }
  return glyphs[object.subtype] ?? '◇'
}

function objectSubtype(projectionId: string, objectId: string): string {
  return localObject(projectionId, objectId)?.subtype ?? ''
}

function updateDetailReveal(cameraScale: number): void {
  const current = detailSystemIds.value
  const next = new Set<string>()
  for (const projection of projections.value) {
    const threshold = current.has(projection.id) ? DETAIL_HIDE_PIXELS : DETAIL_REVEAL_PIXELS
    if (Math.max(projection.envelope.width, projection.envelope.height) * cameraScale >= threshold) {
      next.add(projection.id)
    }
  }
  if (next.size !== current.size || [...next].some(id => !current.has(id))) detailSystemIds.value = next
}

function getViewport(): MapViewport {
  const element = svgElement.value
  const transform = element ? zoomTransform(element) : zoomIdentity
  return { x: transform.x, y: transform.y, k: transform.k }
}

function getFitBounds(): SvgViewportRect | undefined {
  return sceneBounds.value ?? undefined
}

function updateMinimumZoomScale(rect: SvgViewportRect, allowIncrease = false): void {
  const bounds = getFitBounds()
  const fit = bounds ? fitMapViewport(bounds, rect, Number.MIN_VALUE) : undefined
  const fittedMinimum = fit ? Math.min(MAP_ZOOM_MIN_SCALE, fit.k) : MAP_ZOOM_MIN_SCALE
  minimumZoomScale.value = allowIncrease ? fittedMinimum : Math.min(minimumZoomScale.value, fittedMinimum)
  zoomBehavior?.scaleExtent([minimumZoomScale.value, MAP_ZOOM_MAX_SCALE])
}

function setViewport(nextViewport: MapViewport): void {
  const element = svgElement.value
  if (!element || !zoomBehavior) return
  if (Number.isFinite(nextViewport.k) && nextViewport.k > 0) {
    minimumZoomScale.value = Math.min(minimumZoomScale.value, nextViewport.k)
    zoomBehavior.scaleExtent([minimumZoomScale.value, MAP_ZOOM_MAX_SCALE])
  }
  const next = clampMapViewport(nextViewport, minimumZoomScale.value)
  if (!next) return
  select(element).call(zoomBehavior.transform, zoomIdentity.translate(next.x, next.y).scale(next.k))
}

function fitMap(usableRect?: SvgViewportRect): void {
  const element = svgElement.value
  const bounds = getFitBounds()
  if (!element || !zoomBehavior || !bounds) return
  const requestedRect = usableRect ? normalizeSvgViewportRect(usableRect) : undefined
  const rect = requestedRect ?? getSvgViewportRect(element)
  zoomBehavior.extent(() => svgViewportExtent(rect))
  updateMinimumZoomScale(rect, true)
  const fitted = fitMapViewport(bounds, rect, minimumZoomScale.value)
  if (fitted) setViewport(fitted)
}

function frameSystem(systemId: string, usableRect?: SvgViewportRect): boolean {
  const projection = projections.value.find(candidate => candidate.id === systemId)
  if (!projection || !svgElement.value || !zoomBehavior) return false
  const delta = anchorDelta(projection)
  const bounds = {
    ...projection.envelope,
    x: projection.envelope.x + delta.x,
    y: projection.envelope.y + delta.y,
  }
  const rect = normalizeSvgViewportRect(usableRect ?? getSvgViewportRect(svgElement.value))
  if (!rect) return false
  const fitted = fitMapViewport(bounds, rect, minimumZoomScale.value)
  if (!fitted) return false
  setViewport(fitted)
  return true
}

function zoomBy(factor: number): void {
  const element = svgElement.value
  if (!element || !zoomBehavior || !Number.isFinite(factor) || factor <= 0) return
  select(element).call(zoomBehavior.scaleBy, factor)
}

function panBy(dx: number, dy: number): void {
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return
  const current = getViewport()
  setViewport({ ...current, x: current.x + dx, y: current.y + dy })
}

function focusMap(): void { svgElement.value?.focus({ preventScroll: true }) }

function startViewPan(event: MouseEvent): void {
  const element = svgElement.value
  if (!element || !zoomBehavior) return
  cancelActiveGesture()
  viewPan = { transform: getViewport(), start: pointer(event, element) as [number, number] }
}

function moveViewPan(event: MouseEvent): void {
  const element = svgElement.value
  if (!element || !zoomBehavior || !viewPan) return
  const point = pointer(event, element)
  setViewport({
    x: viewPan.transform.x + point[0] - viewPan.start[0],
    y: viewPan.transform.y + point[1] - viewPan.start[1],
    k: viewPan.transform.k,
  })
}

function endViewPan(): void { viewPan = null }

function cameraPoint(event: MouseEvent | PointerEvent): Point | null {
  const element = svgElement.value
  if (!element) return null
  const [x, y] = pointer(event, element)
  const [worldX, worldY] = zoomTransform(element).invert([x, y])
  return { x: worldX, y: worldY }
}

function systemIdAtTarget(target: EventTarget | null): string | null {
  if (!(target instanceof Element)) return null
  const mark = target.closest<SVGElement>('.cluster-system-node[data-system-id]')
  return mark?.getAttribute('data-system-id') ?? null
}

function onPointerDownCapture(event: PointerEvent): void {
  if (event.button !== 0 || props.mode !== 'move' || props.moveTargeting || props.clusterMoveTargeting || props.clusterAddType !== null) return
  const systemId = systemIdAtTarget(event.target)
  const projection = projections.value.find(candidate => candidate.id === systemId)
  const origin = props.systemPositions[systemId ?? '']
  const scene = cameraPoint(event)
  const element = svgElement.value
  if (!projection || !origin || !scene || !element) return
  event.preventDefault()
  event.stopPropagation()
  event.stopImmediatePropagation()
  activeAnchorDrag = {
    systemId: projection.id,
    pointerId: event.pointerId,
    startClient: { x: event.clientX, y: event.clientY },
    startScene: scene,
    origin: { ...origin },
    preview: { ...origin },
    moved: false,
  }
  try { element.setPointerCapture(event.pointerId) } catch { /* Pointer capture is best effort for synthetic input. */ }
  emit('editing-gesture-change', true)
}

function onPointerMoveCapture(event: PointerEvent): void {
  const drag = activeAnchorDrag
  if (!drag || drag.pointerId !== event.pointerId) return
  const startDistance = Math.hypot(event.clientX - drag.startClient.x, event.clientY - drag.startClient.y)
  if (startDistance < 4 && !drag.moved) return
  drag.moved = true
  const point = cameraPoint(event)
  if (!point) return
  const target = {
    x: drag.origin.x + point.x - drag.startScene.x,
    y: drag.origin.y + point.y - drag.startScene.y,
  }
  drag.preview = clampWardenClusterAnchor(unprojectWardenClusterAnchor(target))
  previewPositions.value = new Map(previewPositions.value).set(drag.systemId, drag.preview)
  event.preventDefault()
}

function finishAnchorDrag(cancelled: boolean): void {
  const drag = activeAnchorDrag
  if (!drag) return
  activeAnchorDrag = null
  const element = svgElement.value
  if (element?.hasPointerCapture(drag.pointerId)) {
    try { element.releasePointerCapture(drag.pointerId) } catch { /* Capture may already have been released. */ }
  }
  emit('editing-gesture-change', false)
  if (!cancelled && drag.moved) {
    emit('move-system', drag.systemId, drag.preview)
    return
  }
  const next = new Map(previewPositions.value)
  next.delete(drag.systemId)
  previewPositions.value = next
}

function onPointerEndCapture(event: PointerEvent): void {
  if (activeAnchorDrag?.pointerId !== event.pointerId) return
  const moved = activeAnchorDrag.moved
  finishAnchorDrag(event.type === 'pointercancel')
  if (moved) {
    event.preventDefault()
    event.stopPropagation()
    event.stopImmediatePropagation()
  }
}

function onLostPointerCapture(event: PointerEvent): void {
  if (activeAnchorDrag?.pointerId === event.pointerId) finishAnchorDrag(true)
}

function onClickCapture(event: MouseEvent): void {
  if (event.detail === 0) return
  if (props.moveTargeting || props.clusterMoveTargeting) {
    const point = cameraPoint(event)
    if (point) {
      event.preventDefault()
      event.stopPropagation()
      event.stopImmediatePropagation()
      emit('move-target', point)
    }
    return
  }
  if (props.clusterAddType !== null && !props.clusterChooserOpen) {
    const point = cameraPoint(event)
    if (!point) return
    event.preventDefault()
    event.stopPropagation()
    event.stopImmediatePropagation()
    const normalized = clampWardenClusterAnchor(unprojectWardenClusterAnchor(point))
    const directSystemId = systemIdAtTarget(event.target)
    const systemIds = directSystemId
      ? [directSystemId]
      : projections.value
        .filter(projection => {
          const delta = anchorDelta(projection)
          const bounds = projection.envelope
          return point.x >= bounds.x + delta.x && point.x <= bounds.x + delta.x + bounds.width
            && point.y >= bounds.y + delta.y && point.y <= bounds.y + delta.y + bounds.height
        })
        .map(projection => projection.id)
    emit('cluster-target', normalized, systemIds)
    return
  }
  const systemId = systemIdAtTarget(event.target)
  if (systemId) emit('activate-system', systemId)
}

function onKeydownCapture(event: KeyboardEvent): void {
  if (event.defaultPrevented || (event.key !== 'Enter' && event.key !== ' ')) return
  const systemId = systemIdAtTarget(event.target)
  if (props.clusterAddType !== null && !props.clusterChooserOpen) {
    const projection = projections.value.find(candidate => candidate.id === systemId)
    const position = projection ? anchorFor(projection) : null
    const point = position
      ? clampWardenClusterAnchor(unprojectWardenClusterAnchor(position))
      : null
    if (point) {
      event.preventDefault()
      event.stopPropagation()
      emit('cluster-target', point, systemId ? [systemId] : [])
    }
    return
  }
  if (!systemId) return
  event.preventDefault()
  event.stopPropagation()
  emit('activate-system', systemId)
}

function setClusterSystemPositionPreview(systemId: string, position: Point | null): void {
  const next = new Map(previewPositions.value)
  if (position) next.set(systemId, clampWardenClusterAnchor(position))
  else next.delete(systemId)
  previewPositions.value = next
}

function exportImage(format: MapImageFormat, palette: MapImagePalette = 'active'): Promise<Blob> {
  const element = svgElement.value
  return element ? exportMapImage(element, format, undefined, palette)
    : Promise.reject(new Error('The continuous map is not ready to export.'))
}

function cancelActiveGesture(): void {
  viewPan = null
  if (activeAnchorDrag) finishAnchorDrag(true)
  touchCameraNavigation.cancel()
}

function onZoom(event: { transform: { x: number; y: number; k: number } }): void {
  viewport.value = { x: event.transform.x, y: event.transform.y, k: event.transform.k }
  updateDetailReveal(event.transform.k)
  emit('viewport-change', viewport.value)
}

function startTouchNavigation(event: TouchEvent): void {
  if (activeAnchorDrag) return
  touchCameraNavigation.start(event)
}

function moveTouchNavigation(event: TouchEvent): void {
  if (activeAnchorDrag) return
  touchCameraNavigation.move(event)
}

function endTouchNavigation(event: TouchEvent): void {
  if (activeAnchorDrag) return
  touchCameraNavigation.end(event)
}

const touchCameraNavigation = createMapTouchNavigation({
  surface: 'cluster',
  isEnabled: () => props.touchNavigation ?? true,
  moveEnabled: () => props.mode === 'move',
  getCamera: () => {
    const element = svgElement.value
    if (!element) return null
    return {
      isPinchReady: () => zoomBehavior !== undefined,
      getViewport,
      pointFromClient: touch => pointer(touch, element) as [number, number],
      minimumZoomScale: () => minimumZoomScale.value,
      applyViewport: setViewport,
      interrupt: () => select(element).interrupt(),
    }
  },
  onPinchTakeover: () => cancelActiveGesture(),
})

onMounted(async () => {
  await nextTick()
  const element = svgElement.value
  if (!element) {
    resolveReady(false)
    return
  }
  zoomBehavior = zoom<SVGSVGElement, unknown>()
    .extent(() => svgViewportExtent(getSvgViewportRect(element)))
    .scaleExtent([minimumZoomScale.value, MAP_ZOOM_MAX_SCALE])
    .filter(event => event.type === 'wheel')
    .on('zoom', onZoom)
  zoomBehavior.touchable(() => false)
  select(element).call(zoomBehavior)
  resizeObserver = new ResizeObserver(() => {
    const current = svgElement.value
    if (!current) return
    const rect = getSvgViewportRect(current)
    zoomBehavior?.extent(() => svgViewportExtent(rect))
    updateMinimumZoomScale(rect)
  })
  resizeObserver.observe(element)
  window.addEventListener('blur', cancelActiveGesture)
  if (props.initialViewport) setViewport(props.initialViewport)
  else fitMap()
  ready.value = true
  resolveReady(true)
})

onBeforeUnmount(() => {
  window.removeEventListener('blur', cancelActiveGesture)
  resizeObserver?.disconnect()
  resizeObserver = undefined
  cancelActiveGesture()
  if (!ready.value) resolveReady(false)
})

watch(() => props.mode, () => cancelActiveGesture(), { flush: 'sync' })
watch(() => props.cluster.systems.map(system => system.id).join('\u0000'), ids => {
  if (activeAnchorDrag && !ids.split('\u0000').includes(activeAnchorDrag.systemId)) cancelActiveGesture()
})
watch(projections, () => {
  updateDetailReveal(viewport.value.k)
  const existingIds = new Set(projections.value.map(projection => projection.id))
  previewPositions.value = new Map([...previewPositions.value].filter(([id]) => existingIds.has(id)))
}, { flush: 'sync' })

defineExpose({
  exportImage,
  getMinimumZoomScale: () => minimumZoomScale.value,
  getViewport,
  setViewport,
  zoomBy,
  panBy,
  fitMap,
  frameSystem,
  focusMap,
  cancelActiveGesture,
  startViewPan,
  moveViewPan,
  endViewPan,
  startTouchNavigation,
  moveTouchNavigation,
  endTouchNavigation,
  setClusterSystemPositionPreview,
  whenReady: () => readiness,
})
</script>

<style scoped>
.continuous-warden-map-svg {
  touch-action: none;
  overscroll-behavior: contain;
  background: var(--map-bg);
}

.continuous-warden-system-envelope {
  fill: color-mix(in srgb, var(--map-orbit) 5%, transparent);
  stroke: color-mix(in srgb, var(--map-orbit) 48%, transparent);
  stroke-width: 1.25;
  stroke-dasharray: 5 5;
  vector-effect: non-scaling-stroke;
  pointer-events: none;
}

.continuous-warden-system-envelope.is-detailed {
  fill: color-mix(in srgb, var(--map-selected) 5%, transparent);
  stroke: color-mix(in srgb, var(--map-selected) 70%, transparent);
  stroke-dasharray: none;
}

.continuous-warden-system-envelope.is-move-preview {
  stroke: var(--map-selected);
  stroke-width: 2;
}

.continuous-warden-system-detail {
  pointer-events: none;
}

.continuous-warden-system-detail .orbit-ring {
  fill: none;
  stroke: var(--map-orbit);
  stroke-width: 2;
  stroke-dasharray: 3 6;
  vector-effect: non-scaling-stroke;
}

.continuous-warden-object {
  fill: var(--map-text);
}

.continuous-warden-star-halo {
  fill: none;
  stroke: var(--map-star-halo);
  stroke-width: 1.2;
  vector-effect: non-scaling-stroke;
}

.continuous-warden-object-glyph {
  fill: var(--map-text);
  font: 20px Consolas, monospace;
}

.continuous-warden-object-key {
  fill: var(--map-unresolved);
  font: 9px Consolas, monospace;
}

.continuous-warden-object-name {
  fill: var(--map-text);
  font: 12px Georgia, serif;
}

.continuous-warden-anchor-hit-target {
  fill: transparent;
  pointer-events: all;
}

.continuous-warden-anchor-mark {
  fill: var(--map-bg);
  stroke: var(--map-selected);
  stroke-width: 2;
  vector-effect: non-scaling-stroke;
}

.continuous-warden-anchor-core {
  fill: var(--map-selected);
  pointer-events: none;
}

.continuous-warden-system-anchor,
.continuous-warden-name-target {
  cursor: pointer;
}

.continuous-warden-system-anchor.is-move-preview .continuous-warden-anchor-mark,
.continuous-warden-name-target.is-move-preview .continuous-warden-name-background {
  stroke: var(--focus);
  stroke-width: 2;
}

.continuous-warden-name-leader {
  fill: none;
  stroke: color-mix(in srgb, var(--map-selected) 72%, transparent);
  stroke-width: 1;
  pointer-events: none;
}

.continuous-warden-name-background {
  fill: color-mix(in srgb, var(--map-bg) 96%, transparent);
  stroke: color-mix(in srgb, var(--line-soft) 82%, transparent);
  stroke-width: 1;
  vector-effect: non-scaling-stroke;
}

.continuous-warden-system-name {
  fill: var(--map-text);
  font: 600 18px Georgia, serif;
  paint-order: stroke;
  stroke: var(--map-bg);
  stroke-width: 1;
  pointer-events: none;
}

.continuous-warden-name-target:hover .continuous-warden-name-background,
.continuous-warden-name-target:focus .continuous-warden-name-background,
.continuous-warden-name-target.is-selected .continuous-warden-name-background,
.continuous-warden-system-anchor:hover .continuous-warden-anchor-mark,
.continuous-warden-system-anchor:focus .continuous-warden-anchor-mark,
.continuous-warden-system-anchor.is-selected .continuous-warden-anchor-mark {
  stroke: var(--map-selected);
  stroke-width: 2;
}
</style>
