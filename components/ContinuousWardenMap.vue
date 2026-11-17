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
        Zoom continuously to reveal each system interior independently. In Move, drag an object to move it within its owning system, or drag a system anchor or name to update its Cluster position.
      </desc>
      <g class="cluster-map-content" :transform="cameraTransform">
        <g class="cluster-map-items">
          <g
            v-for="projection in renderedProjections"
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
            >
              <g class="system-orbits">
                <ellipse
                  v-for="orbit in projection.orbits"
                  :key="orbit.id"
                  class="orbit-ring continuous-warden-orbit-target"
                  :class="{ 'is-selected': isSelectedOrbit(projection.id, orbit.id) }"
                  :data-system-id="projection.id"
                  :data-orbit-id="orbit.id"
                  role="button"
                  tabindex="0"
                  :aria-label="orbitLabel(projection.id, orbit.id)"
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
                  :class="{
                    'is-selected': isSelectedObject(projection.id, object.id),
                    'is-search-result': searchLocatorId === object.id,
                    'is-move-preview': objectMovePreview?.objectId === object.id,
                  }"
                  :transform="`translate(${object.position.x} ${object.position.y})`"
                  :data-object-id="object.id"
                  :data-system-id="projection.id"
                  role="button"
                  tabindex="0"
                  :aria-label="`Select ${object.locationKey}, ${object.name}`"
                  :aria-pressed="isSelectedObject(projection.id, object.id)"
                >
                  <circle class="continuous-warden-object-hit-target" r="18" />
                  <circle v-if="searchLocatorId === object.id" class="continuous-warden-search-locator" r="25" aria-hidden="true" />
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
              tabindex="0"
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
              :y2="label.y + label.height / 2"
              aria-hidden="true"
            />
            <g
              class="cluster-system-node continuous-warden-name-target"
              :class="{ 'is-selected': selectedSystemId === label.id, 'is-move-preview': previewPositions.has(label.id) }"
              :data-system-id="label.id"
              :transform="`translate(${label.x} ${label.y})`"
              role="button"
              tabindex="0"
              :aria-label="`Select ${label.name}`"
            >
              <rect
                class="continuous-warden-name-background"
                :x="-label.width / 2"
                y="0"
                :width="label.width"
                :height="label.height"
                rx="5"
              />
              <text
                class="continuous-warden-system-name"
                :style="{ fontSize: `${SYSTEM_NAME_FONT_PIXELS / svgPixelScale}px` }"
                :y="label.height * 0.68"
                text-anchor="middle"
              >
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
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, toRaw, watch } from 'vue'
import { pointer, select, zoom, zoomIdentity, zoomTransform, type ZoomBehavior } from 'd3'
import type { CatalogueSubtype, JumpCluster, LocalWorkspace, Point, StarSystem } from '../domain/workspace'
import type { EntityCommand, MapHistoryTarget, MapInteractionMode, SystemCreationType } from '../composables/editor-workflows/types'
import type { InspectedMapTarget } from '../stores/editor-ui'
import { initialClusterSystemPosition } from '../domain/workspace-cluster'
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
  continuousMapDetailScale,
  CONTINUOUS_MAP_LOCAL_ORIGIN,
  moveWardenClusterAnchorBySceneDelta,
  projectWardenSystem,
  unprojectWardenClusterAnchor,
  type ContinuousWardenSystemProjection,
} from '../utils/continuous-map-projection'
import { applySelectedObjectTranslation, planSelectedObjectTranslation } from '../utils/selected-object-placement'
import { creationCandidatesAtPoint, toNormalizedMapPoint, type SystemMapGeometry } from '../utils/system-map-geometry'
import {
  continuousOrbitAddKeyboardPoint,
  resolveContinuousObjectOwnerResolution,
  type ContinuousObjectAddOwner,
  type ContinuousObjectAddTarget,
} from '../utils/continuous-map-editing'
import { clusterSystemPosition } from '../utils/cluster-map-geometry'
import {
  centerMapTargetViewport,
  minimumHistoryRevealViewport,
  revealNearestAnchorViewport,
  rotatedEllipseBounds,
} from '../utils/continuous-map-history-reveal'
import type { ClientRectBounds } from '../utils/map-usable-area'
import { createMapTouchNavigation } from './maps/map-touch-navigation'
import { exportMapImage, type MapImageFormat, type MapImagePalette } from '../utils/map-image-export'
import { nextContinuousMapPreviewVersion } from '../utils/continuous-map-preview-version'
import { continuousMapKeyboardIntent } from '../utils/continuous-map-keyboard-intent'

const DETAIL_REVEAL_PIXELS = 250
const DETAIL_HIDE_PIXELS = 210
const MINIMUM_FIT_PADDING = 48
const SYSTEM_NAME_FONT_PIXELS = 18
const SYSTEM_NAME_HEIGHT_PIXELS = 28
const SYSTEM_NAME_VIEWPORT_MARGIN_PIXELS = 8

const props = defineProps<{
  cluster: JumpCluster
  workspace: LocalWorkspace
  systemPositions: Readonly<Record<string, Point>>
  objectAngles: Readonly<Record<string, number>>
  orbitRadii: Readonly<Record<string, { horizontal: number; vertical: number }>>
  orbitRotations: Readonly<Record<string, number>>
  selectedSystemId: string | null
  inspectedTarget: InspectedMapTarget | null
  mode: MapInteractionMode
  creationType: SystemCreationType | null
  creationOtherType: string | null
  objectAddPinnedOwnerId: string | null
  isEntityCommandBlocked?: (command: EntityCommand) => boolean
  clusterAddType: 'system' | 'route' | null
  clusterChooserOpen: boolean
  clusterMoveTargeting: boolean
  moveTargeting: boolean
  touchNavigation?: boolean
  initialViewport: MapViewport | null
  getUsableClientRect?: () => ClientRectBounds | undefined
}>()

const emit = defineEmits<{
  'activate-system': [id: string]
  'select-object': [systemId: string, objectId: string]
  'select-orbit': [systemId: string, orbitId: string]
  'cluster-target': [point: Point, systemIds: string[]]
  'continuous-object-add-target': [request: ContinuousObjectAddTarget]
  'move-object-in-system': [systemId: string, objectId: string, position: Point, workspaceSnapshot: LocalWorkspace]
  'move-system': [id: string, position: Point]
  'move-target': [point: Point]
  'editing-gesture-change': [active: boolean]
  'viewport-change': [viewport: MapViewport]
}>()

const svgElement = ref<SVGSVGElement | null>(null)
const viewport = ref<MapViewport>({ x: 0, y: 0, k: 1 })
const previewPositions = ref(new Map<string, Point>())
const objectMovePreview = shallowRef<{ systemId: string; objectId: string; projection: ContinuousWardenSystemProjection } | null>(null)
const previewVersions = ref(new Map<string, number>())
const detailSystemIds = ref(new Set<string>())
const minimumZoomScale = ref(MAP_ZOOM_MIN_SCALE)
const svgPixelScale = ref(1)
const svgViewport = ref<SvgViewportRect>({ x: 0, y: 0, width: 960, height: 560 })
const ready = ref(false)
const searchLocatorId = ref<string | null>(null)
let zoomBehavior: ZoomBehavior<SVGSVGElement, unknown> | undefined
let resizeObserver: ResizeObserver | undefined
let cameraInitialized = false
let searchInteractionGeneration = 0
let focusFallbackGeneration = 0
let viewPan: { transform: MapViewport; start: [number, number] } | null = null
interface ActiveObjectDrag {
  systemId: string
  objectId: string
  pointerId: number
  startClient: Point
  startScene: Point
  originLocal: Point
  anchorDelta: Point
  camera: MapViewport
  legacyAnchor: Point
  projection: ContinuousWardenSystemProjection
  workspaceSnapshot: LocalWorkspace
  moved: boolean
  targetPosition: Point
}

let activeObjectDrag: ActiveObjectDrag | null = null
let pendingObjectClickTarget: { systemId: string; objectId: string } | null = null
let pendingObjectClickTimer: ReturnType<typeof setTimeout> | undefined
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

const projections = computed(() => props.cluster.systems.map((system, index) => projectWardenSystem(
  system,
  props.systemPositions[system.id] ?? initialClusterSystemPosition(index),
  systemGeometry.value,
)))
const renderedProjections = computed(() => projections.value.map(projection =>
  objectMovePreview.value?.systemId === projection.id
    ? { ...projection, objects: objectMovePreview.value.projection.objects, orbits: objectMovePreview.value.projection.orbits }
    : projection,
))

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
  height: number
  anchorX: number
  anchorY: number
  hasLeader: boolean
}

let textMeasureContext: CanvasRenderingContext2D | null | undefined

function systemNameWidthPixels(name: string): number {
  if (textMeasureContext === undefined && typeof document !== 'undefined') {
    textMeasureContext = document.createElement('canvas').getContext('2d')
    if (textMeasureContext) textMeasureContext.font = `600 ${SYSTEM_NAME_FONT_PIXELS}px Georgia, serif`
  }
  const textWidth = textMeasureContext?.measureText(name).width ?? name.length * 9
  return Math.max(72, Math.ceil(textWidth + 24))
}

function namePlacementOffsets(widthPixels: number): Point[] {
  const side = widthPixels / 2 + 10
  const offsets: Point[] = []
  for (let ring = 0; ring <= 12; ring += 1) {
    const distance = ring * 38
    offsets.push(
      { x: 0, y: -SYSTEM_NAME_HEIGHT_PIXELS - 8 - distance },
      { x: 0, y: 8 + distance },
      { x: -side - distance, y: -SYSTEM_NAME_HEIGHT_PIXELS / 2 },
      { x: side + distance, y: -SYSTEM_NAME_HEIGHT_PIXELS / 2 },
      { x: -side - distance, y: -SYSTEM_NAME_HEIGHT_PIXELS - 8 },
      { x: side + distance, y: -SYSTEM_NAME_HEIGHT_PIXELS - 8 },
      { x: -side - distance, y: 8 },
      { x: side + distance, y: 8 },
    )
  }
  return offsets
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
  return `translate(${anchor.x} ${anchor.y}) scale(${1 / (viewport.value.k * svgPixelScale.value)})`
}

function clampToViewport(value: number, minimum: number, maximum: number): number {
  return maximum < minimum ? (minimum + maximum) / 2 : Math.max(minimum, Math.min(maximum, value))
}

const nameLabels = computed<NameLabel[]>(() => {
  const scale = svgPixelScale.value > 0 ? svgPixelScale.value : 1
  const viewportRect = svgViewport.value
  const margin = SYSTEM_NAME_VIEWPORT_MARGIN_PIXELS / scale
  const labels: NameLabel[] = []
  const occupied: Array<{ left: number; top: number; right: number; bottom: number }> = []
  const expandedViewport = {
    left: viewportRect.x - 96 / scale,
    top: viewportRect.y - 96 / scale,
    right: viewportRect.x + viewportRect.width + 96 / scale,
    bottom: viewportRect.y + viewportRect.height + 96 / scale,
  }
  const anchorPoints = projections.value.flatMap(projection => {
    const anchor = anchorFor(projection)
    const point = {
      id: projection.id,
      name: projection.name,
      x: viewport.value.x + anchor.x * viewport.value.k,
      y: viewport.value.y + anchor.y * viewport.value.k,
    }
    const delta = anchorDelta(projection)
    const envelope = projection.envelope
    const envelopeBounds = {
      left: viewport.value.x + (envelope.x + delta.x) * viewport.value.k,
      top: viewport.value.y + (envelope.y + delta.y) * viewport.value.k,
      right: viewport.value.x + (envelope.x + delta.x + envelope.width) * viewport.value.k,
      bottom: viewport.value.y + (envelope.y + delta.y + envelope.height) * viewport.value.k,
    }
    const anchorNearViewport = point.x >= expandedViewport.left && point.x <= expandedViewport.right
      && point.y >= expandedViewport.top && point.y <= expandedViewport.bottom
    const envelopeNearViewport = envelopeBounds.right >= expandedViewport.left
      && envelopeBounds.left <= expandedViewport.right
      && envelopeBounds.bottom >= expandedViewport.top
      && envelopeBounds.top <= expandedViewport.bottom
    return anchorNearViewport || envelopeNearViewport ? [point] : []
  })
  for (const anchor of anchorPoints) {
    const widthPixels = systemNameWidthPixels(anchor.name)
    const width = widthPixels / scale
    const height = SYSTEM_NAME_HEIGHT_PIXELS / scale
    const candidates = namePlacementOffsets(widthPixels).map(offset => ({ x: offset.x / scale, y: offset.y / scale }))
    let chosen = candidates[0]!
    let chosenScore = Number.POSITIVE_INFINITY
    for (const offset of candidates) {
      const centerX = clampToViewport(
        anchor.x + offset.x,
        viewportRect.x + margin + width / 2,
        viewportRect.x + viewportRect.width - margin - width / 2,
      )
      const top = clampToViewport(
        anchor.y + offset.y,
        viewportRect.y + margin,
        viewportRect.y + viewportRect.height - margin - height,
      )
      const candidateOffset = { x: centerX - anchor.x, y: top - anchor.y }
      const bounds = {
        left: centerX - width / 2,
        right: centerX + width / 2,
        top,
        bottom: top + height,
      }
      const outsideWidth = Math.max(0, viewportRect.x + margin - bounds.left)
        + Math.max(0, bounds.right - (viewportRect.x + viewportRect.width - margin))
      const outsideHeight = Math.max(0, viewportRect.y + margin - bounds.top)
        + Math.max(0, bounds.bottom - (viewportRect.y + viewportRect.height - margin))
      const outsideArea = outsideWidth * height + outsideHeight * width
      const labelOverlapArea = occupied.reduce((total, prior) => {
        const overlapWidth = Math.max(0, Math.min(bounds.right + 6 / scale, prior.right) - Math.max(bounds.left - 6 / scale, prior.left))
        const overlapHeight = Math.max(0, Math.min(bounds.bottom + 4 / scale, prior.bottom) - Math.max(bounds.top - 4 / scale, prior.top))
        return total + overlapWidth * overlapHeight
      }, 0)
      const anchorOverlapArea = anchorPoints.reduce((total, other) => {
        if (other.id === anchor.id) return total
        const radius = 18 / scale
        const overlapWidth = Math.max(0, Math.min(bounds.right, other.x + radius) - Math.max(bounds.left, other.x - radius))
        const overlapHeight = Math.max(0, Math.min(bounds.bottom, other.y + radius) - Math.max(bounds.top, other.y - radius))
        return total + overlapWidth * overlapHeight
      }, 0)
      const duplicatePosition = labels.some(prior => prior.x === centerX && prior.y === top)
      const score = labelOverlapArea * 100 + anchorOverlapArea * 30 + outsideArea * 10
        + (duplicatePosition ? 1_000_000_000 : 0) + Math.hypot(candidateOffset.x, candidateOffset.y) * 0.01
      if (score < chosenScore) {
        chosen = candidateOffset
        chosenScore = score
      }
      if (labelOverlapArea === 0 && anchorOverlapArea === 0 && outsideArea === 0 && !duplicatePosition) break
    }
    const x = anchor.x + chosen.x
    const y = anchor.y + chosen.y
    occupied.push({ left: x - width / 2, top: y, right: x + width / 2, bottom: y + height })
    labels.push({
      id: anchor.id,
      name: anchor.name,
      x,
      y,
      width,
      height,
      anchorX: anchor.x,
      anchorY: anchor.y,
      hasLeader: Math.abs(chosen.x * scale) > 0
        || Math.abs(chosen.y * scale + SYSTEM_NAME_HEIGHT_PIXELS + 8) > 6,
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

function isSelectedObject(systemId: string, objectId: string): boolean {
  const target = props.inspectedTarget
  return target?.kind === 'object' && target.systemId === systemId && target.objectId === objectId
}

function isSelectedOrbit(systemId: string, orbitId: string): boolean {
  const target = props.inspectedTarget
  return target?.kind === 'orbit' && target.systemId === systemId && target.orbitId === orbitId
}

function orbitLabel(systemId: string, orbitId: string): string {
  const orbit = props.cluster.systems.find(system => system.id === systemId)?.orbits.find(value => value.id === orbitId)
  return orbit ? `Select Orbit ${orbit.order}` : 'Select Orbit'
}

function updateDetailReveal(cameraScale: number): void {
  if (!cameraInitialized) return
  const current = detailSystemIds.value
  const next = new Set<string>()
  for (const projection of projections.value) {
    const threshold = current.has(projection.id) ? DETAIL_HIDE_PIXELS : DETAIL_REVEAL_PIXELS
    if (cameraScale >= continuousMapDetailScale(projection.envelope, svgPixelScale.value, threshold)) {
      next.add(projection.id)
    }
  }
  if (next.size !== current.size || [...next].some(id => !current.has(id))) {
    preserveFocusBeforeDetailCollapse(next)
    detailSystemIds.value = next
  }
}

function preserveFocusBeforeDetailCollapse(nextDetailSystemIds: ReadonlySet<string>): void {
  if (typeof document === 'undefined' || typeof Element === 'undefined') return
  const focusedMark = document.activeElement
  if (!(focusedMark instanceof Element)) return
  const focusedEntity = focusedMark.closest<SVGElement>(
    '.continuous-warden-object[data-system-id], .continuous-warden-orbit-target[data-system-id]',
  )
  const systemId = focusedEntity?.getAttribute('data-system-id')
  if (!focusedEntity || !systemId || nextDetailSystemIds.has(systemId)) return
  const capturedGeneration = ++focusFallbackGeneration
  void nextTick(() => {
    if (capturedGeneration !== focusFallbackGeneration || focusedEntity.isConnected) return
    const currentFocus = document.activeElement
    if (currentFocus !== document.body && currentFocus !== svgElement.value && currentFocus !== focusedMark) return
    const visibleName = [...(svgElement.value?.querySelectorAll<SVGElement>('.continuous-warden-name-target[data-system-id]') ?? [])]
      .find((candidate) => {
        if (candidate.getAttribute('data-system-id') !== systemId || candidate.getClientRects().length === 0) return false
        const usable = props.getUsableClientRect?.()
        if (!usable) return false
        const bounds = candidate.getBoundingClientRect()
        return bounds.left >= usable.left && bounds.top >= usable.top
          && bounds.right <= usable.right && bounds.bottom <= usable.bottom
      })
    if (visibleName) visibleName.focus({ preventScroll: true })
    else focusMap()
  })
}

function updateSvgPixelScale(): void {
  const matrix = svgElement.value?.getScreenCTM()
  if (!matrix) return
  const horizontal = Math.hypot(matrix.a, matrix.b)
  const vertical = Math.hypot(matrix.c, matrix.d)
  const measured = Math.min(horizontal, vertical)
  if (Number.isFinite(measured) && measured > 0 && Math.abs(svgPixelScale.value - measured) > 0.0001) {
    svgPixelScale.value = measured
  }
}

function updateSvgViewport(): void {
  if (!svgElement.value) return
  const measured = getSvgViewportRect(svgElement.value)
  const current = svgViewport.value
  if (measured.x !== current.x || measured.y !== current.y
    || measured.width !== current.width || measured.height !== current.height) {
    svgViewport.value = measured
  }
}

function getViewport(): MapViewport {
  const element = svgElement.value
  const transform = element ? zoomTransform(element) : zoomIdentity
  return { x: transform.x, y: transform.y, k: transform.k }
}

function getRenderedSystemProjections(): readonly ContinuousWardenSystemProjection[] {
  return renderedProjections.value
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
  const element = svgElement.value
  if (!projection || !element || !zoomBehavior) return false
  const delta = anchorDelta(projection)
  const rect = normalizeSvgViewportRect(usableRect ?? getSvgViewportRect(element))
  if (!rect) return false
  const current = getViewport()
  const targetBounds = {
    ...projection.envelope,
    x: projection.envelope.x + delta.x,
    y: projection.envelope.y + delta.y,
  }
  const detailScaleFloor = continuousMapDetailScale(
    projection.envelope,
    svgPixelScale.value,
    detailSystemIds.value.has(projection.id) ? DETAIL_HIDE_PIXELS : DETAIL_REVEAL_PIXELS,
  )
  const next = centerMapTargetViewport({
    current,
    targetBounds,
    usableRect: rect,
    minimumScale: detailScaleFloor,
    maximumScale: MAP_ZOOM_MAX_SCALE,
  })
  if (!next) return false
  if (Math.abs(next.x - current.x) >= 0.01 || Math.abs(next.y - current.y) >= 0.01
    || next.k !== current.k) setViewport(next)
  return true
}

function frameEntityTarget(
  systemId: string,
  kind: 'object' | 'orbit',
  entityId: string,
  usableRect?: SvgViewportRect,
  centerTarget = false,
): boolean {
  const projection = projections.value.find(candidate => candidate.id === systemId)
  const element = svgElement.value
  if (!projection || !element || !zoomBehavior) return false
  const targetPoint = kind === 'object'
    ? projection.objects.find(object => object.id === entityId)?.scenePosition
    : projection.orbits.find(orbit => orbit.id === entityId)?.sceneCenter
  if (!targetPoint) return false
  const delta = anchorDelta(projection)
  const center = { x: targetPoint.x + delta.x, y: targetPoint.y + delta.y }
  const object = kind === 'object' ? projection.objects.find(candidate => candidate.id === entityId) : undefined
  const orbit = kind === 'orbit' ? projection.orbits.find(candidate => candidate.id === entityId) : undefined
  const orbitBounds = orbit
    ? rotatedEllipseBounds(center, orbit.sceneRadii, orbit.rotation, 2)
    : null
  const halfWidth = object ? Math.max(18, object.name.length * 3.6, object.locationKey.length * 2.8) : 18
  const halfHeight = object ? 27 : 18
  const bounds = orbitBounds ?? {
    x: center.x - halfWidth,
    y: center.y - halfHeight,
    width: halfWidth * 2,
    height: halfHeight * 2,
  }
  const rect = normalizeSvgViewportRect(usableRect ?? getSvgViewportRect(element))
  if (!rect) return false
  const current = getViewport()
  const minimumScale = detailSystemIds.value.has(projection.id)
    ? undefined
    : continuousMapDetailScale(projection.envelope, svgPixelScale.value, DETAIL_REVEAL_PIXELS)
  const next = centerTarget
    ? centerMapTargetViewport({
        current,
        targetBounds: bounds,
        usableRect: rect,
        minimumScale,
        maximumScale: MAP_ZOOM_MAX_SCALE,
      })
    : minimumHistoryRevealViewport({
        current,
        targetBounds: bounds,
        usableRect: rect,
        minimumScale,
        maximumScale: MAP_ZOOM_MAX_SCALE,
      })
  if (!next) return false
  if (Math.abs(next.x - current.x) >= 0.01 || Math.abs(next.y - current.y) >= 0.01
    || next.k !== current.k) setViewport(next)
  return true
}

function frameSearchTarget(target: import('../utils/workspace-search').SearchTarget, usableRect?: SvgViewportRect): boolean {
  if (target.kind === 'cluster') {
    fitMap(usableRect)
    return true
  }
  if (target.kind === 'system') return frameSystem(target.systemId, usableRect)
  return frameEntityTarget(target.systemId, 'object', target.objectId, usableRect)
}

function centerInspectedTarget(target: InspectedMapTarget, usableRect?: SvgViewportRect): boolean {
  if (target.kind === 'cluster') {
    fitMap(usableRect)
    return true
  }
  if (target.kind === 'system') return frameSystem(target.systemId, usableRect)
  if (target.kind === 'object' || target.kind === 'orbit') {
    return frameEntityTarget(
      target.systemId,
      target.kind,
      target.kind === 'object' ? target.objectId : target.orbitId,
      usableRect,
      true,
    )
  }
  return false
}

function prepareSearchLocator(objectId: string): () => void {
  const generation = searchInteractionGeneration
  const clusterId = props.cluster.id
  const target = props.inspectedTarget
  return () => {
    const currentTarget = props.inspectedTarget
    if (generation !== searchInteractionGeneration
      || props.cluster.id !== clusterId
      || currentTarget?.kind !== 'object'
      || target?.kind !== 'object'
      || target.objectId !== objectId
      || currentTarget.systemId !== target.systemId
      || currentTarget.objectId !== objectId) return
    searchLocatorId.value = objectId
  }
}

function dismissSearchLocator(): void {
  searchInteractionGeneration += 1
  searchLocatorId.value = null
}

watch(() => props.inspectedTarget, (target) => {
  if (searchLocatorId.value !== null
    && !(target?.kind === 'object' && target.objectId === searchLocatorId.value)) dismissSearchLocator()
}, { flush: 'sync' })

function revealHistoryTarget(target: MapHistoryTarget, usableRect?: SvgViewportRect): boolean {
  if (!usableRect) return false
  if (target.kind === 'route') return false
  const systemId = target.kind === 'system' ? target.id : target.systemId
  const projection = projections.value.find(candidate => candidate.id === systemId)
  const element = svgElement.value
  const rect = normalizeSvgViewportRect(usableRect)
  if (!projection || !element || !zoomBehavior || !rect) return false

  const delta = anchorDelta(projection)
  const current = getViewport()
  let bounds: SvgViewportRect
  let minimumScale: number | undefined
  if (target.kind === 'system') {
    const anchor = { x: projection.anchor.x + delta.x, y: projection.anchor.y + delta.y }
    bounds = { x: anchor.x - 16, y: anchor.y - 16, width: 32, height: 32 }
  } else if (target.kind === 'object') {
    const object = projection.objects.find(candidate => candidate.id === target.id)
    if (!object) return false
    const center = { x: object.scenePosition.x + delta.x, y: object.scenePosition.y + delta.y }
    const halfWidth = Math.max(18, object.name.length * 3.6, object.locationKey.length * 2.8)
    bounds = { x: center.x - halfWidth, y: center.y - 27, width: halfWidth * 2, height: 54 }
    if (!detailSystemIds.value.has(projection.id)) {
      minimumScale = continuousMapDetailScale(projection.envelope, svgPixelScale.value, DETAIL_REVEAL_PIXELS)
    }
  } else if (target.kind === 'orbit') {
    const orbit = projection.orbits.find(candidate => candidate.id === target.id)
    if (!orbit) return false
    const center = { x: orbit.sceneCenter.x + delta.x, y: orbit.sceneCenter.y + delta.y }
    const orbitBounds = rotatedEllipseBounds(center, orbit.sceneRadii, orbit.rotation, 2)
    if (!orbitBounds) return false
    bounds = orbitBounds
    if (!detailSystemIds.value.has(projection.id)) {
      minimumScale = continuousMapDetailScale(projection.envelope, svgPixelScale.value, DETAIL_REVEAL_PIXELS)
    }
  } else {
    return false
  }

  const next = minimumHistoryRevealViewport({
    current,
    targetBounds: bounds,
    usableRect: rect,
    minimumScale,
    maximumScale: MAP_ZOOM_MAX_SCALE,
  })
  if (!next) return false
  if (Math.abs(next.x - current.x) < 0.01 && Math.abs(next.y - current.y) < 0.01
    && next.k === current.k) return true
  setViewport(next)
  return true
}

function revealHistoryCluster(usableRect?: SvgViewportRect): boolean {
  const element = svgElement.value
  if (projections.value.length === 0 || !element || !zoomBehavior) return false
  const rect = normalizeSvgViewportRect(usableRect ?? getSvgViewportRect(element))
  if (!rect) return false
  const anchorBounds = projections.value.map((projection) => {
    const delta = anchorDelta(projection)
    const anchor = { x: projection.anchor.x + delta.x, y: projection.anchor.y + delta.y }
    return { x: anchor.x - 16, y: anchor.y - 16, width: 32, height: 32 }
  })
  const current = getViewport()
  const next = revealNearestAnchorViewport({ current, anchorBounds, usableRect: rect })
  if (!next) return false
  if (Math.abs(next.x - current.x) >= 0.01 || Math.abs(next.y - current.y) >= 0.01
    || Math.abs(next.k - current.k) >= 0.0001) setViewport(next)
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
  const transform = zoomTransform(element)
  return { x: (x - transform.x) / transform.k, y: (y - transform.y) / transform.k }
}

function cameraPointAt(event: PointerEvent, camera: MapViewport): Point | null {
  const element = svgElement.value
  if (!element || camera.k <= 0) return null
  const [x, y] = pointer(event, element)
  return { x: (x - camera.x) / camera.k, y: (y - camera.y) / camera.k }
}

function systemIdAtTarget(target: EventTarget | null): string | null {
  if (!(target instanceof Element)) return null
  const mark = target.closest<SVGElement>('.cluster-system-node[data-system-id]')
  return mark?.getAttribute('data-system-id') ?? null
}

function objectTargetAtTarget(target: EventTarget | null): { systemId: string; objectId: string } | null {
  if (!(target instanceof Element)) return null
  const mark = target.closest<SVGElement>('.continuous-warden-object[data-system-id][data-object-id]')
  const systemId = mark?.getAttribute('data-system-id')
  const objectId = mark?.getAttribute('data-object-id')
  return systemId && objectId ? { systemId, objectId } : null
}

function orbitTargetAtTarget(target: EventTarget | null): { systemId: string; orbitId: string } | null {
  if (!(target instanceof Element)) return null
  const mark = target.closest<SVGElement>('.continuous-warden-orbit-target[data-system-id][data-orbit-id]')
  const systemId = mark?.getAttribute('data-system-id')
  const orbitId = mark?.getAttribute('data-orbit-id')
  return systemId && orbitId ? { systemId, orbitId } : null
}

function systemMapGeometry(workspace: LocalWorkspace): SystemMapGeometry {
  return {
    objectAngles: workspace.layout.objectAngles,
    orbitRadii: workspace.layout.orbitRadii,
    orbitRotations: workspace.layout.orbitRotations,
  }
}

function addOwnersAtPoint(
  point: Point,
  subtype: CatalogueSubtype,
  definiteOwnerId: string | null,
): { owners: ContinuousObjectAddOwner[]; requiresOwnerChoice: boolean } {
  const systems = projections.value.map(projection => ({
    id: projection.id,
    envelope: {
      x: projection.envelope.x + anchorDelta(projection).x,
      y: projection.envelope.y + anchorDelta(projection).y,
      width: projection.envelope.width,
      height: projection.envelope.height,
    },
  }))
  const ownerResolution = resolveContinuousObjectOwnerResolution(point, systems, definiteOwnerId)
  const geometry = systemMapGeometry(props.workspace)
  const owners = ownerResolution.systemIds.flatMap(systemId => {
    const projection = projections.value.find(candidate => candidate.id === systemId)
    const system = props.cluster.systems.find(candidate => candidate.id === systemId)
    if (!projection || !system) return []
    const delta = anchorDelta(projection)
    const localPoint = projection.unprojectLocalPoint({ x: point.x - delta.x, y: point.y - delta.y })
    const candidates = creationCandidatesAtPoint(
      system,
      localPoint,
      { kind: 'object', subtype },
      geometry,
      detailSystemIds.value.has(systemId),
    )
      .map(candidate => candidate.target.kind === 'orbit'
        && props.isEntityCommandBlocked?.({ kind: 'object-create', orbitId: candidate.target.orbitId })
        ? { ...candidate, error: 'Resolve the Inspector draft before adding an object to this Orbit.' }
        : candidate)
    return [{ systemId, candidates }]
  })
  return { owners, requiresOwnerChoice: ownerResolution.requiresOwnerChoice }
}

function offerObjectAdd(point: Point, target: EventTarget | null): void {
  const type = props.creationType
  if (type?.kind !== 'object') return
  const object = objectTargetAtTarget(target)
  const orbit = orbitTargetAtTarget(target)
  const hitOwnerId = object?.systemId ?? orbit?.systemId ?? null
  const pinnedOwnerId = props.objectAddPinnedOwnerId
  const foreignHit = pinnedOwnerId && hitOwnerId && pinnedOwnerId !== hitOwnerId
  const directTarget = foreignHit
    ? null
    : object
      ? { kind: 'object' as const, id: object.objectId }
      : orbit
        ? { kind: 'orbit' as const, id: orbit.orbitId }
        : null
  const ownerResolution = foreignHit && pinnedOwnerId
    ? { owners: [{ systemId: pinnedOwnerId, candidates: [] }], requiresOwnerChoice: false }
    : addOwnersAtPoint(point, type.subtype, pinnedOwnerId ?? hitOwnerId)
  emit('continuous-object-add-target', {
    subtype: type.subtype,
    workspaceSnapshot: props.workspace,
    directTarget,
    ...(type.subtype === 'other' && props.creationOtherType ? { otherType: props.creationOtherType } : {}),
    requiresOwnerChoice: ownerResolution.requiresOwnerChoice,
    owners: ownerResolution.owners,
  })
}

function updateObjectMovePreview(drag: ActiveObjectDrag, scenePoint: Point): void {
  const localPoint = drag.projection.unprojectLocalPoint({
    x: scenePoint.x - drag.anchorDelta.x,
    y: scenePoint.y - drag.anchorDelta.y,
  })
  const delta = { x: localPoint.x - drag.originLocal.x, y: localPoint.y - drag.originLocal.y }
  const plan = planSelectedObjectTranslation(drag.workspaceSnapshot, drag.systemId, [drag.objectId], delta)
  const previewPosition = plan?.positions.get(drag.objectId)
  const system = plan
    ? applySelectedObjectTranslation(drag.workspaceSnapshot, drag.systemId, plan).cluster.systems.find(candidate => candidate.id === drag.systemId)
    : undefined
  if (!plan || !previewPosition || !system) return
  const previewWorkspace = applySelectedObjectTranslation(drag.workspaceSnapshot, drag.systemId, plan)
  const projection = projectWardenSystem(system, drag.legacyAnchor, systemMapGeometry(previewWorkspace), drag.projection.scale)
  drag.targetPosition = toNormalizedMapPoint(previewPosition)
  drag.moved = Math.hypot(scenePoint.x - drag.startScene.x, scenePoint.y - drag.startScene.y) >= 4
  objectMovePreview.value = { systemId: drag.systemId, objectId: drag.objectId, projection }
}

function clearObjectMovePreview(): void {
  objectMovePreview.value = null
}

function finishObjectDrag(cancelled: boolean): void {
  const drag = activeObjectDrag
  if (!drag) return
  activeObjectDrag = null
  const element = svgElement.value
  if (element?.hasPointerCapture(drag.pointerId)) {
    try { element.releasePointerCapture(drag.pointerId) } catch { /* Capture may already have been released. */ }
  }
  emit('editing-gesture-change', false)
  if (!cancelled && drag.moved) {
    const position = drag.targetPosition
    clearObjectMovePreview()
    emit('move-object-in-system', drag.systemId, drag.objectId, position, drag.workspaceSnapshot)
    return
  }
  clearObjectMovePreview()
}

function onPointerDownCapture(event: PointerEvent): void {
  pendingObjectClickTarget = null
  if (pendingObjectClickTimer) clearTimeout(pendingObjectClickTimer)
  pendingObjectClickTimer = undefined
  if (event.button !== 0 || props.mode !== 'move' || props.moveTargeting || props.clusterMoveTargeting
    || props.clusterAddType !== null || props.creationType !== null) return
  const objectTarget = objectTargetAtTarget(event.target)
  const element = svgElement.value
  if (objectTarget && element) {
    const projection = projections.value.find(candidate => candidate.id === objectTarget.systemId)
    const localObject = projection?.objects.find(candidate => candidate.id === objectTarget.objectId)
    const system = props.cluster.systems.find(candidate => candidate.id === objectTarget.systemId)
    const legacyAnchor = props.systemPositions[objectTarget.systemId]
    const scene = cameraPoint(event)
    if (!projection || !localObject || !system || !legacyAnchor || !scene) return
    const camera = getViewport()
    const delta = anchorDelta(projection)
    activeObjectDrag = {
      systemId: objectTarget.systemId,
      objectId: objectTarget.objectId,
      pointerId: event.pointerId,
      startClient: { x: event.clientX, y: event.clientY },
      startScene: scene,
      originLocal: localObject.position,
      anchorDelta: delta,
      camera,
      legacyAnchor: { ...legacyAnchor },
      projection,
      workspaceSnapshot: props.workspace,
      moved: false,
      targetPosition: toNormalizedMapPoint(localObject.position),
    }
    event.preventDefault()
    event.stopPropagation()
    event.stopImmediatePropagation()
    try { element.setPointerCapture(event.pointerId) } catch { /* Pointer capture is best effort for synthetic input. */ }
    emit('editing-gesture-change', true)
    return
  }
  const systemId = systemIdAtTarget(event.target)
  const projection = projections.value.find(candidate => candidate.id === systemId)
  const origin = props.systemPositions[systemId ?? '']
  const scene = cameraPoint(event)
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
  const objectDrag = activeObjectDrag
  if (objectDrag?.pointerId === event.pointerId) {
    if (Math.hypot(event.clientX - objectDrag.startClient.x, event.clientY - objectDrag.startClient.y) < 4 && !objectDrag.moved) return
    const point = cameraPointAt(event, objectDrag.camera)
    if (point) updateObjectMovePreview(objectDrag, point)
    event.preventDefault()
    return
  }
  const drag = activeAnchorDrag
  if (!drag || drag.pointerId !== event.pointerId) return
  const startDistance = Math.hypot(event.clientX - drag.startClient.x, event.clientY - drag.startClient.y)
  if (startDistance < 4 && !drag.moved) return
  drag.moved = true
  const point = cameraPoint(event)
  if (!point) return
  drag.preview = moveWardenClusterAnchorBySceneDelta(drag.origin, {
    x: point.x - drag.startScene.x,
    y: point.y - drag.startScene.y,
  })
  publishSystemPositionPreview(drag.systemId, drag.preview)
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
  publishSystemPositionPreview(drag.systemId, null)
}

function onPointerEndCapture(event: PointerEvent): void {
  if (activeObjectDrag?.pointerId === event.pointerId) {
    const moved = activeObjectDrag.moved
    if (!moved && event.type === 'pointerup') {
      pendingObjectClickTarget = { systemId: activeObjectDrag.systemId, objectId: activeObjectDrag.objectId }
      if (pendingObjectClickTimer) clearTimeout(pendingObjectClickTimer)
      pendingObjectClickTimer = setTimeout(() => { pendingObjectClickTarget = null }, 900)
    }
    finishObjectDrag(event.type === 'pointercancel')
    if (moved) {
      event.preventDefault()
      event.stopPropagation()
      event.stopImmediatePropagation()
    }
    return
  }
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
  if (activeObjectDrag?.pointerId === event.pointerId) finishObjectDrag(true)
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
  if (props.creationType?.kind === 'object' && !props.clusterChooserOpen) {
    const point = cameraPoint(event)
    if (!point) return
    event.preventDefault()
    event.stopPropagation()
    event.stopImmediatePropagation()
    offerObjectAdd(point, event.target)
    return
  }
  const objectTarget = objectTargetAtTarget(event.target) ?? pendingObjectClickTarget
  pendingObjectClickTarget = null
  if (pendingObjectClickTimer) clearTimeout(pendingObjectClickTimer)
  pendingObjectClickTimer = undefined
  if (objectTarget) {
    event.preventDefault()
    event.stopPropagation()
    event.stopImmediatePropagation()
    emit('select-object', objectTarget.systemId, objectTarget.objectId)
    return
  }
  const orbitTarget = orbitTargetAtTarget(event.target)
  if (orbitTarget) {
    event.preventDefault()
    event.stopPropagation()
    event.stopImmediatePropagation()
    emit('select-orbit', orbitTarget.systemId, orbitTarget.orbitId)
    return
  }
  const systemId = systemIdAtTarget(event.target)
  if (systemId) emit('activate-system', systemId)
}

function onKeydownCapture(event: KeyboardEvent): void {
  if (event.defaultPrevented) return
  const objectTarget = objectTargetAtTarget(event.target)
  const orbitTarget = orbitTargetAtTarget(event.target)
  const systemId = systemIdAtTarget(event.target)
  if (props.creationType?.kind === 'object'
    && (event.key === 'Enter' || event.key === ' ')
    && !props.clusterChooserOpen && !props.moveTargeting && !props.clusterMoveTargeting) {
    const point = keyboardTargetScenePoint(event.target, systemId, objectTarget, orbitTarget, true)
    if (point) {
      event.preventDefault()
      event.stopPropagation()
      offerObjectAdd(point, event.target)
      return
    }
  }
  const action = continuousMapKeyboardIntent({
    key: event.key,
    targetKind: objectTarget ? 'object' : orbitTarget ? 'orbit' : systemId ? 'system' : 'map',
    addArmed: props.clusterAddType !== null,
    chooserOpen: props.clusterChooserOpen,
    moveTargeting: props.moveTargeting,
    clusterMoveTargeting: props.clusterMoveTargeting,
  })
  if (!action) return

  if (action === 'add-target' || action === 'move-target') {
    const scenePoint = keyboardTargetScenePoint(event.target, systemId, objectTarget, orbitTarget)
    if (!scenePoint) return
    event.preventDefault()
    event.stopPropagation()
    if (action === 'move-target') {
      emit('move-target', scenePoint)
      return
    }
    const normalized = clampWardenClusterAnchor(unprojectWardenClusterAnchor(scenePoint))
    const systemIds = systemId
      ? [systemId]
      : projections.value
        .filter(projection => {
          const delta = anchorDelta(projection)
          const bounds = projection.envelope
          return scenePoint.x >= bounds.x + delta.x && scenePoint.x <= bounds.x + delta.x + bounds.width
            && scenePoint.y >= bounds.y + delta.y && scenePoint.y <= bounds.y + delta.y + bounds.height
        })
        .map(projection => projection.id)
    emit('cluster-target', normalized, systemIds)
    return
  }

  if (action === 'inspect-object' && objectTarget) {
    event.preventDefault()
    event.stopPropagation()
    emit('select-object', objectTarget.systemId, objectTarget.objectId)
    return
  }
  if (action === 'inspect-orbit' && orbitTarget) {
    event.preventDefault()
    event.stopPropagation()
    emit('select-orbit', orbitTarget.systemId, orbitTarget.orbitId)
    return
  }
  if (action !== 'activate-system' || !systemId) return
  event.preventDefault()
  event.stopPropagation()
  emit('activate-system', systemId)
}

function keyboardTargetScenePoint(
  target: EventTarget | null,
  systemId: string | null,
  objectTarget: { systemId: string; objectId: string } | null,
  orbitTarget: { systemId: string; orbitId: string } | null,
  forObjectAdd = false,
): Point | null {
  if (systemId) {
    const projection = projections.value.find(candidate => candidate.id === systemId)
    return projection ? anchorFor(projection) : null
  }
  const objectProjection = objectTarget
    ? projections.value.find(candidate => candidate.id === objectTarget.systemId)
    : undefined
  if (objectTarget && objectProjection) {
    const object = objectProjection.objects.find(candidate => candidate.id === objectTarget.objectId)
    const delta = anchorDelta(objectProjection)
    if (object) return { x: object.scenePosition.x + delta.x, y: object.scenePosition.y + delta.y }
  }
  const orbitProjection = orbitTarget
    ? projections.value.find(candidate => candidate.id === orbitTarget.systemId)
    : undefined
  if (orbitTarget && orbitProjection) {
    const orbit = orbitProjection.orbits.find(candidate => candidate.id === orbitTarget.orbitId)
    const delta = anchorDelta(orbitProjection)
    if (orbit) {
      if (forObjectAdd) return continuousOrbitAddKeyboardPoint(orbit, delta)
      return { x: orbit.sceneCenter.x + delta.x, y: orbit.sceneCenter.y + delta.y }
    }
  }
  if (!(target instanceof SVGSVGElement) || target !== svgElement.value) return null
  const current = getViewport()
  return {
    x: (svgViewport.value.x + svgViewport.value.width / 2 - current.x) / current.k,
    y: (svgViewport.value.y + svgViewport.value.height / 2 - current.y) / current.k,
  }
}

function publishSystemPositionPreview(systemId: string, position: Point | null, expectedVersion?: number): number {
  const currentVersion = previewVersions.value.get(systemId) ?? 0
  if (position === null && expectedVersion !== undefined && expectedVersion !== currentVersion) return currentVersion
  const next = new Map(previewPositions.value)
  if (position) next.set(systemId, clampWardenClusterAnchor(position))
  else next.delete(systemId)
  previewPositions.value = next
  const nextVersion = nextContinuousMapPreviewVersion()
  previewVersions.value = new Map(previewVersions.value).set(systemId, nextVersion)
  return nextVersion
}

function setClusterSystemPositionPreview(systemId: string, position: Point | null, expectedVersion?: number): number {
  return publishSystemPositionPreview(systemId, position, expectedVersion)
}

function getClusterSystemPositionPreviewVersion(systemId: string): number {
  return previewVersions.value.get(systemId) ?? 0
}

function exportImage(format: MapImageFormat, palette: MapImagePalette = 'active'): Promise<Blob> {
  const element = svgElement.value
  return element ? exportMapImage(element, format, undefined, palette)
    : Promise.reject(new Error('The continuous map is not ready to export.'))
}

function cancelActiveGesture(): void {
  viewPan = null
  if (activeObjectDrag) finishObjectDrag(true)
  if (activeAnchorDrag) finishAnchorDrag(true)
  touchCameraNavigation.cancel()
}

function onZoom(event: { transform: { x: number; y: number; k: number } }): void {
  viewport.value = { x: event.transform.x, y: event.transform.y, k: event.transform.k }
  if (cameraInitialized) updateDetailReveal(event.transform.k)
  emit('viewport-change', viewport.value)
}

function startTouchNavigation(event: TouchEvent): void {
  if (activeObjectDrag) {
    if (event.touches.length <= 1) return
    finishObjectDrag(true)
  }
  if (activeAnchorDrag) return
  touchCameraNavigation.start(event)
}

function moveTouchNavigation(event: TouchEvent): void {
  if (activeAnchorDrag || activeObjectDrag) return
  touchCameraNavigation.move(event)
}

function endTouchNavigation(event: TouchEvent): void {
  if (activeAnchorDrag || activeObjectDrag) return
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
    updateSvgPixelScale()
    updateSvgViewport()
    updateDetailReveal(viewport.value.k)
  })
  resizeObserver.observe(element)
  updateSvgPixelScale()
  updateSvgViewport()
  window.addEventListener('blur', cancelActiveGesture)
  if (props.initialViewport) setViewport(props.initialViewport)
  else fitMap()
  cameraInitialized = true
  updateDetailReveal(getViewport().k)
  ready.value = true
  resolveReady(true)
})

onBeforeUnmount(() => {
  window.removeEventListener('blur', cancelActiveGesture)
  if (pendingObjectClickTimer) clearTimeout(pendingObjectClickTimer)
  pendingObjectClickTimer = undefined
  pendingObjectClickTarget = null
  resizeObserver?.disconnect()
  resizeObserver = undefined
  cancelActiveGesture()
  if (!ready.value) resolveReady(false)
})

watch(() => props.mode, () => cancelActiveGesture(), { flush: 'sync' })
watch(() => props.workspace, workspace => {
  if (activeObjectDrag && toRaw(activeObjectDrag.workspaceSnapshot) !== toRaw(workspace)) cancelActiveGesture()
}, { flush: 'sync' })
watch(() => props.cluster.systems.map(system => system.id).join('\u0000'), ids => {
  if (activeObjectDrag && !ids.split('\u0000').includes(activeObjectDrag.systemId)) cancelActiveGesture()
  if (activeAnchorDrag && !ids.split('\u0000').includes(activeAnchorDrag.systemId)) cancelActiveGesture()
})
watch(projections, () => {
  updateDetailReveal(viewport.value.k)
  const existingIds = new Set(projections.value.map(projection => projection.id))
  previewPositions.value = new Map([...previewPositions.value].filter(([id]) => existingIds.has(id)))
}, { flush: 'sync' })

defineExpose({
  exportImage,
  getRenderedSystemProjections,
  getMinimumZoomScale: () => minimumZoomScale.value,
  getViewport,
  setViewport,
  zoomBy,
  panBy,
  fitMap,
  frameSystem,
  frameSearchTarget,
  centerInspectedTarget,
  prepareSearchLocator,
  dismissSearchLocator,
  revealHistoryTarget,
  revealHistoryCluster,
  focusMap,
  cancelActiveGesture,
  startViewPan,
  moveViewPan,
  endViewPan,
  startTouchNavigation,
  moveTouchNavigation,
  endTouchNavigation,
  setClusterSystemPositionPreview,
  getClusterSystemPositionPreviewVersion,
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

.continuous-warden-system-detail .continuous-warden-orbit-target {
  pointer-events: stroke;
  cursor: pointer;
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
  cursor: pointer;
  pointer-events: all;
}

.continuous-warden-object-hit-target {
  fill: transparent;
  pointer-events: all;
}

.continuous-warden-object.is-selected .continuous-warden-object-hit-target,
.continuous-warden-object:focus .continuous-warden-object-hit-target {
  stroke: var(--map-selected);
  stroke-width: 2;
  vector-effect: non-scaling-stroke;
}

.continuous-warden-object.is-move-preview {
  cursor: grabbing;
}

.continuous-warden-object.is-move-preview .continuous-warden-object-hit-target {
  stroke: var(--focus);
  stroke-width: 2;
  stroke-dasharray: 3 3;
  vector-effect: non-scaling-stroke;
}

.continuous-warden-search-locator {
  fill: none;
  stroke: var(--focus);
  stroke-width: 2;
  stroke-dasharray: 2 3;
  vector-effect: non-scaling-stroke;
  pointer-events: none;
}

.continuous-warden-orbit-target.is-selected,
.continuous-warden-orbit-target:focus {
  stroke: var(--map-selected);
  stroke-width: 3;
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
  vector-effect: non-scaling-stroke;
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
  font-family: Georgia, serif;
  font-weight: 600;
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
