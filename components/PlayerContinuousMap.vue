<template>
  <section
    class="player-continuous-map"
    :class="{ 'player-continuous-map--workspace': props.workspacePresentation }"
    aria-label="Player-visible continuous map"
    data-player-continuous-map
  >
    <div class="player-continuous-map-navigation" role="group" aria-label="Player map navigation" data-player-map-obstruction>
      <UButton color="neutral" variant="outline" size="xs" icon="i-lucide-arrow-left" aria-label="Pan left" @click="panBy(40, 0)" />
      <UButton color="neutral" variant="outline" size="xs" icon="i-lucide-arrow-up" aria-label="Pan up" @click="panBy(0, 40)" />
      <UButton color="neutral" variant="outline" size="xs" icon="i-lucide-arrow-down" aria-label="Pan down" @click="panBy(0, -40)" />
      <UButton color="neutral" variant="outline" size="xs" icon="i-lucide-arrow-right" aria-label="Pan right" @click="panBy(-40, 0)" />
      <UButton color="neutral" variant="outline" size="xs" icon="i-lucide-minus" aria-label="Zoom out" :disabled="!canZoomOut" @click="zoomBy(1 / 1.2)" />
      <UButton color="neutral" variant="outline" size="xs" icon="i-lucide-plus" aria-label="Zoom in" :disabled="!canZoomIn" @click="zoomBy(1.2)" />
      <UButton
        color="neutral"
        variant="outline"
        size="xs"
        icon="i-lucide-crosshair"
        aria-label="Center selection"
        :disabled="!hasSelection"
        @click="centerSelectionManually"
      />
      <UButton color="neutral" variant="outline" size="xs" icon="i-lucide-maximize" aria-label="Fit player map" @click="fitPlayerMapManually" />
    </div>

    <svg
      ref="mapElement"
      class="player-continuous-map-scene"
      role="group"
      :aria-label="`${props.document.title} continuous player map`"
      aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight + - 0"
      viewBox="0 0 960 560"
      preserveAspectRatio="xMidYMid meet"
      tabindex="0"
      @click.capture="inspectRouteFromClick"
      @keydown.capture="inspectRouteFromKeyboard"
      @keydown="handleMapKeydown"
      @contextmenu.prevent.stop
      @pointerdown.capture="emit('map-interaction')"
      @wheel.capture="emit('map-interaction')"
      @touchstart.capture="emit('map-interaction')"
    >
      <g :transform="sceneTransform">
        <ContinuousMapRouteLayer
          ref="routeLayer"
          :routes="routeMarks"
          :geometries="routeGeometries"
          :detail-system-ids="detailSystemIds"
          :selected-route-id="props.selectedRouteId ?? null"
          :viewport="camera"
          :viewport-rect="nameViewport"
          :svg-pixel-scale="svgPixelScale"
          :label-obstacles="routeLabelObstacles"
          destinations-in-foreground
        />

        <g v-for="system in projection.systems" :key="system.id" class="player-continuous-system" :data-player-system-id="system.id">
          <rect
            v-if="system.geometry"
            class="player-continuous-system-envelope"
            :class="{ 'is-detailed': detailSystemIds.has(system.id) }"
            :x="system.geometry.envelope.x"
            :y="system.geometry.envelope.y"
            :width="system.geometry.envelope.width"
            :height="system.geometry.envelope.height"
            rx="18"
            aria-hidden="true"
          />

          <g v-if="system.geometry && detailSystemIds.has(system.id)" class="player-continuous-system-detail">
            <g class="player-continuous-system-orbits" aria-hidden="true">
              <ellipse
                v-for="orbit in system.geometry.orbits"
                :key="orbit.id"
                :class="{ 'player-continuous-orbit--selected': isOrbitSelected(system.id, orbit.id) }"
                :cx="orbit.sceneCenter.x"
                :cy="orbit.sceneCenter.y"
                :rx="orbit.sceneRadii.horizontal"
                :ry="orbit.sceneRadii.vertical"
                :transform="`rotate(${orbit.rotation} ${orbit.sceneCenter.x} ${orbit.sceneCenter.y})`"
              />
            </g>
            <g class="player-continuous-orbit-interactions">
              <ellipse
                v-for="orbit in system.geometry.orbits"
                :key="`hit-${orbit.id}`"
                class="player-continuous-orbit-hit-target"
                :cx="orbit.sceneCenter.x"
                :cy="orbit.sceneCenter.y"
                :rx="orbit.sceneRadii.horizontal"
                :ry="orbit.sceneRadii.vertical"
                :transform="`rotate(${orbit.rotation} ${orbit.sceneCenter.x} ${orbit.sceneCenter.y})`"
                :aria-label="`Inspect ${orbitLabel(system, orbit.id)}`"
                :aria-pressed="isOrbitSelected(system.id, orbit.id)"
                :data-player-system-id="system.id"
                :data-player-orbit-id="orbit.id"
                role="button"
                tabindex="0"
                @click.stop="inspectOrbit(system.id, orbit.id)"
                @keydown="event => inspectOrbitFromKeyboard(event, system.id, orbit.id)"
              />
            </g>
            <g class="player-continuous-object-interactions">
              <g
                v-for="object in system.geometry.objects"
                :key="object.id"
                class="player-continuous-object"
                :class="[
                  objectClass(system, object.id),
                  { 'player-continuous-object--selected': isObjectSelected(system.id, object.id) },
                  { 'player-continuous-object--dimmed': isDimmed(system.id, object.id) },
                ]"
                :transform="`translate(${object.scenePosition.x} ${object.scenePosition.y})`"
                :aria-label="`Inspect ${objectPresentation(system, object.id).label}`"
                :aria-pressed="isObjectSelected(system.id, object.id)"
                :data-player-system-id="system.id"
                :data-player-object-id="object.id"
                role="button"
                tabindex="0"
                @click.stop="inspectObject(system.id, object.id)"
                @keydown="event => inspectObjectFromKeyboard(event, system.id, object.id)"
              >
                <circle
                  class="player-continuous-object-hit-target"
                  r="8"
                  fill="transparent"
                  stroke="none"
                  pointer-events="all"
                  aria-hidden="true"
                />
                <circle v-if="objectIsUnknown(system, object.id)" class="player-continuous-object-unknown" r="4" aria-hidden="true" />
                <text
                  v-else-if="objectPresentation(system, object.id).glyph"
                  class="player-continuous-object-glyph"
                  :style="{ fill: objectMarkerColor(system, object.id) }"
                  y="5"
                  text-anchor="middle"
                  aria-hidden="true"
                >{{ objectPresentation(system, object.id).glyph }}</text>
                <circle
                  v-if="objectMarkerColor(system, object.id)"
                  class="player-continuous-object-marker-outline"
                  r="7"
                  aria-hidden="true"
                />
                <text class="player-continuous-object-label" x="9" y="4" aria-hidden="true">
                  {{ objectPresentation(system, object.id).label }}
                </text>
              </g>
            </g>
            <circle
              v-if="props.searchLocatorObjectId && isObjectSelected(system.id, props.searchLocatorObjectId)"
              class="map-search-locator player-continuous-search-locator"
              data-map-search-locator
              :cx="system.geometry.objects.find(object => object.id === props.searchLocatorObjectId)?.scenePosition.x"
              :cy="system.geometry.objects.find(object => object.id === props.searchLocatorObjectId)?.scenePosition.y"
              r="10"
              aria-hidden="true"
            />
            <circle
              v-for="orbit in unoccupiedOrbits(system)"
              :key="`center-${orbit.id}`"
              class="player-continuous-unoccupied-center"
              :cx="orbit.sceneCenter.x"
              :cy="orbit.sceneCenter.y"
              r="2"
              aria-hidden="true"
            />
          </g>

          <g
            class="player-continuous-system-anchor"
            :class="[`player-continuous-system-anchor--${system.disclosure}`, { 'is-selected': props.selectedSystemId === system.id }]"
            :transform="screenMarkTransform(system.anchor)"
            :data-player-system-id="system.id"
            :data-player-disclosure="system.disclosure"
            :aria-label="`Inspect ${system.label}`"
            :aria-pressed="props.selectedSystemId === system.id"
            role="button"
            tabindex="0"
            @click.stop="emit('select-system', system.id)"
            @keydown="event => selectSystemFromKeyboard(event, system.id)"
          >
            <circle v-if="system.disclosure === 'unknown'" class="player-continuous-system-unknown" r="18" aria-hidden="true" />
            <template v-else-if="system.disclosure === 'known-type'">
              <circle class="player-continuous-system-known" r="12" aria-hidden="true" />
              <circle class="player-continuous-system-core" r="3" aria-hidden="true" />
            </template>
            <template v-else>
              <circle class="player-continuous-system-revealed" r="9" aria-hidden="true" />
              <circle class="player-continuous-system-core" r="3" aria-hidden="true" />
            </template>
          </g>
        </g>

      <g class="player-continuous-name-layer" :transform="screenLayerTransform">
        <g
          v-for="label in systemNameLabels"
          :key="label.systemId"
          class="player-continuous-name-target"
          :class="{ 'is-selected': props.selectedSystemId === label.systemId }"
          :transform="`translate(${label.x} ${label.y})`"
          :data-player-system-id="label.systemId"
          :aria-label="`Inspect ${label.name}`"
          :aria-pressed="props.selectedSystemId === label.systemId"
          role="button"
          tabindex="0"
          @click.stop="emit('select-system', label.systemId)"
          @keydown="event => selectSystemFromKeyboard(event, label.systemId)"
        >
          <line
            v-if="label.hasLeader"
            class="player-continuous-name-leader"
            :x1="label.anchorX - label.x"
            :y1="label.anchorY - label.y"
            :x2="0"
            :y2="label.height / 2"
            pointer-events="none"
            aria-hidden="true"
          />
          <rect class="player-continuous-name-background" :x="-label.width / 2" :width="label.width" :height="label.height" rx="5" aria-hidden="true" />
          <text
            class="player-continuous-name"
            :style="{ fontSize: `${SYSTEM_NAME_FONT_PIXELS / svgPixelScale}px` }"
            :y="label.height * .68"
            :textLength="label.textWidth"
            lengthAdjust="spacingAndGlyphs"
            text-anchor="middle"
            aria-hidden="true"
          >{{ label.displayName }}</text>
        </g>
      </g>
      <g class="player-continuous-route-destinations" aria-hidden="true">
        <g
          v-for="route in anonymousRoutes"
          :key="route.id"
          :data-player-destination-route-id="route.id"
          :class="{ 'is-selected': route.id === props.selectedRouteId }"
          :transform="screenMarkTransform(route.end)"
        >
          <text class="player-continuous-destination-caption" x="8" y="4">{{ route.destinationCaption }}</text>
          <circle class="player-continuous-destination-hit" r="12" fill="transparent" />
          <circle class="cluster-exit-mark" r="7" />
        </g>
      </g>
      </g>
    </svg>
  </section>
</template>

<script setup lang="ts">
/** Renders one public Cluster canvas with a local camera and public-only semantic detail. */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { usePlayerContinuousMapViewport } from '../composables/usePlayerContinuousMapViewport'
import type { PlayerClusterDocument, PlayerObjectMarker, PlayerOrbit, PlayerSystemDocument } from '../domain/player-projection'
import type { PlayerUsableRectReader, PlayerInspectionTarget } from '../utils/player-inspection'
import { getSvgViewportRect, type SvgViewportRect } from '../utils/map-zoom'
import type { PlayerImageViewportSnapshot } from '../utils/continuous-player-image-export'
import type { ContinuousMapRouteGeometry } from '../utils/continuous-map-route-geometry'
import type { PlayerContinuousSystemProjection } from '../utils/player-continuous-map-projection'
import { buildContinuousMapRouteGeometries } from '../utils/continuous-map-route-geometry'
import {
  playerContinuousDetailSystemIds,
  projectPlayerContinuousMap,
} from '../utils/player-continuous-map-projection'
import {
  layoutPlayerContinuousNameLabels,
  playerContinuousTargetBounds,
  playerContinuousTargetMinimumScale,
  type PlayerContinuousNameLabel,
} from '../utils/player-continuous-map-layout'
import { playerObjectPresentation } from '../utils/player-object-presentation'
import { PLAYER_CLUSTER_UNKNOWN_MARKER_RADIUS } from '../utils/cluster-system-presentation'
import { centerContinuousMapRouteViewport } from '../utils/continuous-map-route-viewport'
import { projectPlayerContinuousRouteEndpoints } from '../utils/player-continuous-route-projection'
import ContinuousMapRouteLayer from './maps/ContinuousMapRouteLayer.vue'

const props = withDefaults(defineProps<{
  document: PlayerClusterDocument
  active?: boolean
  selectedSystemId: string | null
  selectedRouteId?: string | null
  selectedObjectId?: string | null
  selectedOrbitId?: string | null
  searchLocatorObjectId?: string | null
  dimmedObjectIds: ReadonlySet<string>
  getUsableClientRect?: PlayerUsableRectReader
  workspacePresentation?: boolean
}>(), { active: true, selectedObjectId: null, selectedOrbitId: null, searchLocatorObjectId: null, workspacePresentation: false })

const emit = defineEmits<{
  'select-system': [publicSystemId: string]
  'inspect-object': [publicSystemId: string, publicObjectId: string]
  'inspect-orbit': [publicSystemId: string, publicOrbitId: string]
  'inspect-route': [publicRouteId: string]
  'map-interaction': []
}>()

const SYSTEM_NAME_FONT_PIXELS = 18
const VIEWPORT = { x: 0, y: 0, width: 960, height: 560 }
const mapElement = ref<SVGSVGElement | null>(null)
const routeLayer = ref<InstanceType<typeof ContinuousMapRouteLayer> | null>(null)
const projection = computed(() => projectPlayerContinuousMap(props.document))
const contentBounds = computed(() => projection.value.bounds)
const usableRectReader = computed(() => props.getUsableClientRect)
const mapViewport = usePlayerContinuousMapViewport({
  element: mapElement,
  contentBounds,
  active: computed(() => props.active !== false),
  getUsableClientRect: usableRectReader,
  onCameraChange: updateDetailReveal,
  onManualCameraInteraction: () => emit('map-interaction'),
})
const {
  camera,
  canZoomIn,
  canZoomOut,
  fitPlayerMap,
  frameBounds,
  handleMapKeydown,
  panBy,
  sceneTransform,
  screenLayerTransform,
  setViewport,
  getUsableViewportRect,
  measureSvg,
  svgPixelScale,
  zoomBy,
} = mapViewport
const detailSystemIds = shallowRef<ReadonlySet<string>>(new Set())
const nameViewport = shallowRef<SvgViewportRect>(VIEWPORT)
const scenePixelScale = computed(() => camera.value.k * svgPixelScale.value)
const routeDescriptors = computed(() => projectPlayerContinuousRouteEndpoints(
  props.document,
  projection.value.systems,
  detailSystemIds.value,
))
const anonymousRoutes = computed(() => routeDescriptors.value.filter(route => route.unresolved))
const routeMarks = computed(() => routeDescriptors.value.map(route => ({
  id: route.id,
  jumpLevel: route.jumpLevel,
  accessibleLabel: route.accessibleLabel,
  unresolved: route.unresolved,
  ...(route.destinationCaption ? { destinationCaption: route.destinationCaption } : {}),
})))
const routeFanOutLimitPixels = computed(() => Math.min(
  96,
  Math.min(nameViewport.value.width, nameViewport.value.height) * svgPixelScale.value / 4,
))
const routeGeometries = computed(() => buildContinuousMapRouteGeometries(
  routeDescriptors.value,
  {
    pixelsPerSceneUnit: scenePixelScale.value,
    fanOutLimitPixels: routeFanOutLimitPixels.value,
  },
))
const routeLabelObstacles = computed(() => systemNameLabels.value.map(label => ({
  x: label.x - label.width / 2,
  y: label.y,
  width: label.width,
  height: label.height,
})))
const hasSelection = computed(() => props.selectedSystemId !== null || props.selectedRouteId != null)
const systemNameLabels = computed<PlayerContinuousNameLabel[]>(() => layoutPlayerContinuousNameLabels(
  projection.value.systems,
  camera.value,
  svgPixelScale.value,
  nameViewport.value,
))

let resizeObserver: ResizeObserver | undefined
let suppressDetailFocusHandoff = false
let pendingDetailFocusHandoff: {
  document: PlayerClusterDocument
  element: SVGSVGElement
  systemId: string
  activeElement: Element
} | null = null

watch(() => props.document, () => {
  suppressDetailFocusHandoff = true
  pendingDetailFocusHandoff = null
  detailSystemIds.value = new Set()
  fitPlayerMap()
  void nextTick().then(() => { suppressDetailFocusHandoff = false })
}, { flush: 'post' })

watch(detailSystemIds, (next, previous) => {
  pendingDetailFocusHandoff = null
  if (suppressDetailFocusHandoff) return
  const element = mapElement.value
  const activeElement = element?.ownerDocument.activeElement
  if (!element || !(activeElement instanceof Element) || !element.contains(activeElement)) return
  const detail = activeElement.closest<SVGGElement>('.player-continuous-system-detail')
  const owner = detail?.closest<SVGGElement>('.player-continuous-system')
  const systemId = owner?.getAttribute('data-player-system-id')
  if (!systemId || next.has(systemId) || !previous.has(systemId)) return
  pendingDetailFocusHandoff = { document: props.document, element, systemId, activeElement }
}, { flush: 'pre' })

watch(detailSystemIds, async () => {
  const handoff = pendingDetailFocusHandoff
  pendingDetailFocusHandoff = null
  if (!handoff) return
  await nextTick()
  if (props.document !== handoff.document || !props.active || mapElement.value !== handoff.element
    || !handoff.element.isConnected) return
  const activeElement = handoff.element.ownerDocument.activeElement
  if (activeElement !== handoff.element.ownerDocument.body && activeElement !== handoff.activeElement) return
  const name = [...handoff.element.querySelectorAll<SVGElement>('.player-continuous-name-target')]
    .find(candidate => candidate.getAttribute('data-player-system-id') === handoff.systemId
      && isVisibleFocusTarget(candidate, handoff.element))
  if (name) name.focus({ preventScroll: true })
  else handoff.element.focus({ preventScroll: true })
}, { flush: 'post' })

watch(usableRectReader, refreshNameViewport, { flush: 'post' })

onMounted(() => {
  const element = mapElement.value
  refreshNameViewport()
  if (!element || typeof ResizeObserver === 'undefined') return
  resizeObserver = new ResizeObserver(() => {
    refreshNameViewport()
    updateDetailReveal(camera.value)
  })
  resizeObserver.observe(element)
})
onBeforeUnmount(() => resizeObserver?.disconnect())

function updateDetailReveal(nextCamera: { x: number; y: number; k: number }): void {
  const current = detailSystemIds.value
  detailSystemIds.value = playerContinuousDetailSystemIds(
    projection.value.systems,
    nextCamera.k,
    svgPixelScale.value,
    current,
  )
}

function isObjectSelected(systemId: string, objectId: string): boolean {
  return props.selectedSystemId === systemId && props.selectedObjectId === objectId
}

function isOrbitSelected(systemId: string, orbitId: string): boolean {
  return props.selectedSystemId === systemId && props.selectedOrbitId === orbitId
}

function isDimmed(systemId: string, objectId: string): boolean {
  return props.selectedSystemId === systemId && props.dimmedObjectIds.has(objectId)
}

function objectFromProjection(system: PlayerContinuousSystemProjection, objectId: string): PlayerObjectMarker | undefined {
  if (system.disclosure !== 'revealed') return undefined
  const marker = props.document.systems.find(candidate => candidate.id === system.id)
  return marker?.disclosure === 'revealed' ? marker.map.objects.find(object => object.id === objectId) : undefined
}

function objectPresentation(system: PlayerContinuousSystemProjection, objectId: string) {
  const object = objectFromProjection(system, objectId)
  if (!object) return { label: 'Unknown presence', glyph: null }
  const presentation = playerObjectPresentation(object)
  return { label: presentation.label, glyph: presentation.glyph }
}

function objectClass(system: PlayerContinuousSystemProjection, objectId: string): string | undefined {
  const object = objectFromProjection(system, objectId)
  return object?.disclosure === 'unknown' ? 'player-continuous-object--unknown' : undefined
}

function objectIsUnknown(system: PlayerContinuousSystemProjection, objectId: string): boolean {
  return objectFromProjection(system, objectId)?.disclosure === 'unknown'
}

function objectMarkerColor(system: PlayerContinuousSystemProjection, objectId: string): string | undefined {
  const object = objectFromProjection(system, objectId)
  return object?.disclosure === 'unknown' ? undefined : object?.markerColor
}

function orbitFromProjection(system: PlayerContinuousSystemProjection, orbitId: string): PlayerOrbit | undefined {
  if (system.disclosure !== 'revealed') return undefined
  const marker = props.document.systems.find(candidate => candidate.id === system.id)
  return marker?.disclosure === 'revealed' ? marker.map.orbits.find(orbit => orbit.id === orbitId) : undefined
}

function orbitLabel(system: PlayerContinuousSystemProjection, orbitId: string): string {
  const orbit = orbitFromProjection(system, orbitId)
  if (!orbit || orbit.hostId === null) return 'Orbit around unoccupied center'
  const host = objectFromProjection(system, orbit.hostId)
  return host ? `Orbit around ${playerObjectPresentation(host).label}` : 'Orbit'
}

function unoccupiedOrbits(system: PlayerContinuousSystemProjection) {
  if (system.disclosure !== 'revealed' || !system.geometry) return []
  const marker = props.document.systems.find(candidate => candidate.id === system.id)
  if (marker?.disclosure !== 'revealed') return []
  const unoccupiedIds = new Set(marker.map.orbits.filter(orbit => orbit.hostId === null).map(orbit => orbit.id))
  return system.geometry.orbits.filter(orbit => unoccupiedIds.has(orbit.id))
}

function selectSystemFromKeyboard(event: KeyboardEvent, systemId: string): void {
  if (event.key !== 'Enter' && event.key !== ' ') return
  event.preventDefault()
  event.stopPropagation()
  emit('select-system', systemId)
}

function inspectObjectFromKeyboard(event: KeyboardEvent, systemId: string, objectId: string): void {
  if (event.key !== 'Enter' && event.key !== ' ') return
  event.preventDefault()
  event.stopPropagation()
  inspectObject(systemId, objectId)
}

function inspectOrbitFromKeyboard(event: KeyboardEvent, systemId: string, orbitId: string): void {
  if (event.key !== 'Enter' && event.key !== ' ') return
  event.preventDefault()
  event.stopPropagation()
  inspectOrbit(systemId, orbitId)
}

function inspectRouteFromClick(event: MouseEvent): void {
  if (!props.active) return
  const destinationId = event.target instanceof Element
    ? event.target.closest('[data-player-destination-route-id]')?.getAttribute('data-player-destination-route-id')
    : null
  const routeId = destinationId ?? routeLayer.value?.routeIdAtStroke(event) ?? routeIdAtTarget(event.target)
  if (!routeId || !routeDescriptors.value.some(route => route.id === routeId)) return
  if (destinationId) routeLayer.value?.focusRoute(routeId)
  emit('inspect-route', routeId)
}

function inspectRouteFromKeyboard(event: KeyboardEvent): void {
  if (event.key !== 'Enter' && event.key !== ' ') return
  const routeId = routeIdAtTarget(event.target)
  if (!routeId || !routeDescriptors.value.some(route => route.id === routeId)) return
  event.preventDefault()
  event.stopPropagation()
  emit('inspect-route', routeId)
}

function routeIdAtTarget(target: EventTarget | null): string | null {
  return target instanceof Element
    ? target.closest('.cluster-route[data-route-id]')?.getAttribute('data-route-id') ?? null
    : null
}

function inspectObject(systemId: string, objectId: string): void {
  if (!props.active) return
  emit('inspect-object', systemId, objectId)
}

function inspectOrbit(systemId: string, orbitId: string): void {
  if (!props.active) return
  emit('inspect-orbit', systemId, orbitId)
}

function screenMarkTransform(anchor: { x: number; y: number }): string {
  const inverseScale = 1 / Math.max(scenePixelScale.value, Number.MIN_VALUE)
  return `translate(${anchor.x} ${anchor.y}) scale(${inverseScale})`
}

function systemBounds(systemId: string): SvgViewportRect | undefined {
  const system = projection.value.systems.find(candidate => candidate.id === systemId)
  if (!system) return undefined
  const envelope = system.geometry?.envelope
  return envelope
    ? { ...envelope }
    : {
        x: system.anchor.x - PLAYER_CLUSTER_UNKNOWN_MARKER_RADIUS - 12,
        y: system.anchor.y - PLAYER_CLUSTER_UNKNOWN_MARKER_RADIUS - 12,
        width: (PLAYER_CLUSTER_UNKNOWN_MARKER_RADIUS + 12) * 2,
        height: (PLAYER_CLUSTER_UNKNOWN_MARKER_RADIUS + 12) * 2,
      }
}

function targetBounds(systemId: string, target: PlayerInspectionTarget): SvgViewportRect | undefined {
  const system = projection.value.systems.find(candidate => candidate.id === systemId)
  if (!system?.geometry) return undefined
  return playerContinuousTargetBounds(system.geometry, target)
}

function centerSystem(systemId: string): boolean {
  const bounds = systemBounds(systemId)
  return bounds ? frameBounds(bounds, camera.value.k) : false
}

function centerSelection(): boolean {
  if (props.selectedRouteId) return centerRoute(props.selectedRouteId)
  const systemId = props.selectedSystemId
  if (!systemId) return false
  if (props.selectedObjectId) return centerTarget({ kind: 'object', id: props.selectedObjectId }, systemId)
  if (props.selectedOrbitId) return centerTarget({ kind: 'orbit', id: props.selectedOrbitId }, systemId)
  return centerSystem(systemId)
}

function routeGeometryAt(routeId: string, scale: number): ContinuousMapRouteGeometry | undefined {
  const details = playerContinuousDetailSystemIds(
    projection.value.systems,
    scale,
    svgPixelScale.value,
    detailSystemIds.value,
  )
  const endpoints = projectPlayerContinuousRouteEndpoints(props.document, projection.value.systems, details)
  return buildContinuousMapRouteGeometries(endpoints, {
    pixelsPerSceneUnit: scale * svgPixelScale.value,
    fanOutLimitPixels: routeFanOutLimitPixels.value,
  }).get(routeId)
}

function centerRoute(routeId: string): boolean {
  if (!props.active || !routeDescriptors.value.some(route => route.id === routeId)) return false
  const usableRect = getUsableViewportRect()
  if (!usableRect) return false
  const fitted = centerContinuousMapRouteViewport({
    current: camera.value,
    usableRect,
    padding: 14 / Math.max(svgPixelScale.value, Number.MIN_VALUE),
    svgPixelScale: svgPixelScale.value,
    geometryAt: scale => routeGeometryAt(routeId, scale),
  })
  return fitted ? setViewport(fitted) : false
}

function centerTarget(target: PlayerInspectionTarget, systemId: string): boolean {
  const system = projection.value.systems.find(candidate => candidate.id === systemId)
  if (!system?.geometry) return false
  const bounds = targetBounds(systemId, target)
  if (!bounds) return false
  const minimumScale = playerContinuousTargetMinimumScale(
    system,
    svgPixelScale.value,
    detailSystemIds.value.has(systemId),
  )
  return frameBounds(bounds, camera.value.k, minimumScale)
}

function centerSelectionManually(): void {
  emit('map-interaction')
  centerSelection()
}

function fitPlayerMapManually(): void {
  emit('map-interaction')
  fitPlayerMap()
}

/** Search and explicit Center requests are fenced by their exact detached system document. */
function revealTarget(target: PlayerInspectionTarget, expectedDocument: PlayerSystemDocument): boolean {
  if (!props.active) return false
  const system = props.document.systems.find(candidate => candidate.id === props.selectedSystemId)
  if (system?.disclosure !== 'revealed' || system.map !== expectedDocument) return false
  return centerTarget(target, system.id)
}

function centerSystemForDocument(systemId: string, expectedClusterDocument: PlayerClusterDocument): boolean {
  if (props.document !== expectedClusterDocument) return false
  return centerSystem(systemId)
}

function centerRouteForDocument(routeId: string, expectedClusterDocument: PlayerClusterDocument): boolean {
  if (props.document !== expectedClusterDocument) return false
  return centerRoute(routeId)
}

function refreshNameViewport(): void {
  measureSvg()
  const next = getUsableViewportRect()
  if (next) nameViewport.value = next
}

function isVisibleFocusTarget(target: SVGElement, viewport: SVGSVGElement): boolean {
  if (!target.isConnected || target.getClientRects().length === 0) return false
  const targetBounds = target.getBoundingClientRect()
  const viewportBounds = viewport.getBoundingClientRect()
  return targetBounds.right > viewportBounds.left && targetBounds.left < viewportBounds.right
    && targetBounds.bottom > viewportBounds.top && targetBounds.top < viewportBounds.bottom
    && getComputedStyle(target).visibility !== 'hidden'
    && !target.closest('[inert], [aria-hidden="true"]')
}

/** Captures applied public display state without copying transient marks or animated route frames. */
function captureImageViewport(expectedDocument: PlayerClusterDocument): PlayerImageViewportSnapshot | null {
  const element = mapElement.value
  if (!props.active || props.document !== expectedDocument || !element?.isConnected
    || element.clientWidth <= 0 || element.clientHeight <= 0) return null
  const dimmedOwner = props.selectedSystemId && detailSystemIds.value.has(props.selectedSystemId)
    ? props.selectedSystemId
    : null
  return {
    camera: { ...camera.value },
    drawable: getSvgViewportRect(element),
    nameViewport: { ...nameViewport.value },
    svgPixelScale: svgPixelScale.value,
    detailSystemIds: [...detailSystemIds.value].sort(),
    dimmedObjects: dimmedOwner && props.dimmedObjectIds.size
      ? { systemId: dimmedOwner, ids: [...props.dimmedObjectIds].sort() }
      : null,
    selectedRouteId: props.selectedRouteId ?? null,
  }
}

defineExpose({ captureImageViewport, centerRoute: centerRouteForDocument, centerSystem: centerSystemForDocument, fitPlayerMap, revealTarget })
</script>

<style scoped>
.player-continuous-map {
  position: relative;
  display: flex;
  min-width: 0;
  min-height: 14rem;
  flex-direction: column;
  gap: .25rem;
  overflow: hidden;
  border: 1px solid var(--line-soft);
  background: var(--map-bg);
}

.player-continuous-map-navigation {
  position: absolute;
  z-index: 2;
  bottom: 1rem;
  left: 50%;
  display: flex;
  width: max-content;
  max-width: min(340px, calc(100% - 1rem));
  flex-wrap: wrap;
  align-items: center;
  gap: .25rem;
  overflow-x: auto;
  transform: translateX(-50%);
  border: 1px solid var(--line-soft);
  border-radius: .35rem;
  padding: .3rem;
  background: color-mix(in srgb, var(--panel-bg) 96%, transparent);
  box-shadow: 0 .35rem 1.2rem color-mix(in srgb, var(--map-bg) 45%, transparent);
  backdrop-filter: blur(12px);
}

.player-continuous-map-scene {
  display: block;
  width: 100%;
  min-height: 14rem;
  max-height: 56vh;
  overflow: hidden;
  border: 1px solid var(--line-soft);
  background: var(--map-bg);
  cursor: grab;
  touch-action: none;
  user-select: none;
}

.player-continuous-map--workspace,
.player-continuous-map--workspace .player-continuous-map-scene {
  height: 100%;
  min-height: 0;
  max-height: none;
}

.player-continuous-map--workspace .player-continuous-map-scene {
  flex: 1;
  height: auto;
}

.player-continuous-map-scene:focus-visible {
  outline: 2px solid var(--focus, var(--accent-hover));
  outline-offset: 2px;
}

.player-continuous-system-envelope {
  fill: color-mix(in srgb, var(--map-orbit) 5%, transparent);
  stroke: color-mix(in srgb, var(--map-orbit) 48%, transparent);
  stroke-width: 1.25;
  stroke-dasharray: 5 5;
  vector-effect: non-scaling-stroke;
  pointer-events: none;
}

.player-continuous-system-envelope.is-detailed {
  fill: color-mix(in srgb, var(--map-selected) 5%, transparent);
  stroke: color-mix(in srgb, var(--map-selected) 70%, transparent);
  stroke-dasharray: none;
}

.player-continuous-system-orbits ellipse {
  fill: none;
  stroke: var(--map-orbit);
  stroke-width: 2;
  stroke-dasharray: 3 6;
  vector-effect: non-scaling-stroke;
}

.player-continuous-system-orbits ellipse.player-continuous-orbit--selected {
  stroke: var(--map-selected, var(--accent));
  stroke-width: 2.4;
}

.player-continuous-orbit-hit-target {
  fill: none;
  stroke: transparent;
  stroke-width: 16;
  pointer-events: stroke;
  cursor: pointer;
}

.player-continuous-orbit-hit-target:focus-visible {
  stroke: var(--focus, var(--accent-hover));
  stroke-opacity: .45;
}

.player-continuous-object { cursor: pointer; }
.player-continuous-object-hit-target { pointer-events: all; }
.player-continuous-object-unknown {
  fill: var(--map-bg);
  stroke: var(--text-muted);
  stroke-width: 2;
  vector-effect: non-scaling-stroke;
}
.player-continuous-object-glyph {
  fill: var(--text-secondary);
  font: 16px Consolas, monospace;
  pointer-events: none;
}
.player-continuous-object-label {
  fill: var(--text-primary);
  font: 12px Georgia, serif;
  pointer-events: none;
}
.player-continuous-object--dimmed .player-continuous-object-glyph,
.player-continuous-object--dimmed .player-continuous-object-label,
.player-continuous-object--dimmed .player-continuous-object-unknown { opacity: .14; }
.player-continuous-object--selected .player-continuous-object-glyph,
.player-continuous-object--selected .player-continuous-object-label { fill: var(--map-selected); }

.player-continuous-object-marker-outline {
  fill: none;
  stroke: transparent;
  stroke-width: 2;
  vector-effect: non-scaling-stroke;
  pointer-events: none;
}
.player-continuous-object--selected .player-continuous-object-marker-outline,
.player-continuous-object:focus-visible .player-continuous-object-marker-outline { stroke: var(--map-selected); }

.player-continuous-unoccupied-center { fill: var(--text-muted); }

.player-continuous-system-anchor { cursor: pointer; }
.player-continuous-system-unknown {
  fill: var(--map-bg);
  stroke: var(--text-muted);
  stroke-width: 3;
  vector-effect: non-scaling-stroke;
}
.player-continuous-system-known,
.player-continuous-system-revealed {
  fill: var(--map-card);
  stroke: var(--map-installation);
  stroke-width: 2;
  vector-effect: non-scaling-stroke;
}
.player-continuous-system-known { stroke: var(--map-label-border); }
.player-continuous-system-core { fill: var(--map-installation); }
.player-continuous-system-anchor.is-selected .player-continuous-system-known,
.player-continuous-system-anchor.is-selected .player-continuous-system-revealed,
.player-continuous-system-anchor.is-selected .player-continuous-system-unknown {
  stroke: var(--map-selected);
  stroke-width: 3;
}

.player-continuous-name-target { cursor: pointer; }
.player-continuous-name-background {
  fill: var(--map-card);
  stroke: var(--map-label-border);
  stroke-width: 1.5;
  vector-effect: non-scaling-stroke;
}
.player-continuous-name { fill: var(--text-primary); font: 600 18px Georgia, serif; }
.player-continuous-name-leader { stroke: var(--map-label-border); stroke-width: 1; vector-effect: non-scaling-stroke; }
.player-continuous-name-target.is-selected .player-continuous-name-background,
.player-continuous-name-target:focus-visible .player-continuous-name-background { stroke: var(--map-selected); stroke-width: 2.5; }
.player-continuous-name-target:focus-visible { outline: none; }

.player-continuous-route-destinations { pointer-events: none; }
.player-continuous-destination-caption {
  fill: var(--text-secondary);
  font: 11px Georgia, serif;
  paint-order: stroke;
  stroke: var(--map-bg);
  stroke-width: 4px;
}
.player-continuous-destination-hit,
.player-continuous-route-destinations .cluster-exit-mark {
  pointer-events: all;
  cursor: pointer;
  vector-effect: non-scaling-stroke;
}
.player-continuous-route-destinations .is-selected .cluster-exit-mark {
  stroke: var(--map-selected);
  stroke-width: 3;
}
</style>
