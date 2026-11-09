<template>
  <section class="player-system-map" :class="{ 'player-system-map--workspace': props.workspacePresentation }" aria-label="Player-visible system map">
    <div class="player-system-map-content grid min-w-0 gap-3" :class="{ 'player-system-map-content--workspace': props.workspacePresentation }">
      <div class="grid min-w-0 content-start gap-2">
        <div class="player-system-map-navigation" role="group" aria-label="Player system map navigation" data-player-map-obstruction>
          <UButton
            color="neutral"
            variant="outline"
            size="xs"
            icon="i-lucide-arrow-left"
            aria-label="Pan left"
            :disabled="!canPan"
            @click="runMapControl(() => panView(-1, 0))"
          />
          <UButton
            color="neutral"
            variant="outline"
            size="xs"
            icon="i-lucide-arrow-up"
            aria-label="Pan up"
            :disabled="!canPan"
            @click="runMapControl(() => panView(0, -1))"
          />
          <UButton
            color="neutral"
            variant="outline"
            size="xs"
            icon="i-lucide-arrow-down"
            aria-label="Pan down"
            :disabled="!canPan"
            @click="runMapControl(() => panView(0, 1))"
          />
          <UButton
            color="neutral"
            variant="outline"
            size="xs"
            icon="i-lucide-arrow-right"
            aria-label="Pan right"
            :disabled="!canPan"
            @click="runMapControl(() => panView(1, 0))"
          />
          <UButton
            color="neutral"
            variant="outline"
            size="xs"
            icon="i-lucide-minus"
            aria-label="Zoom out"
            :disabled="!canZoomOut"
            @click="runMapControl(zoomOut)"
          />
          <UButton
            color="neutral"
            variant="outline"
            size="xs"
            icon="i-lucide-plus"
            aria-label="Zoom in"
            :disabled="!canZoomIn"
            @click="runMapControl(zoomIn)"
          />
          <UButton
            color="neutral"
            variant="outline"
            size="xs"
            icon="i-lucide-maximize"
            aria-label="Fit player map"
            @click="runMapControl(fitPlayerMap)"
          />
        </div>
        <svg
          ref="mapElement"
          class="player-system-map-scene"
          :class="{ 'player-system-map-scene--panning': panGesture?.dragging }"
          role="group"
          :aria-label="`${props.label} player system map`"
          aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight + - 0"
          :viewBox="viewBox"
          preserveAspectRatio="xMidYMid meet"
          tabindex="0"
          @keydown.capture="handleSceneKeyIntent"
          @keydown="handleMapKeydown"
          @click.capture="suppressDraggedClick"
          @contextmenu.prevent.stop
          @pointerdown.capture="handleScenePointerIntent"
          @pointerdown.stop="startPan"
          @lostpointercapture.self.stop="cancelPan"
          @wheel.stop.prevent="handleSceneWheel"
        >
          <g class="player-system-orbits" aria-hidden="true">
            <ellipse
              v-for="orbit in props.document.orbits"
              :key="orbit.id"
              :class="{ 'player-system-orbit--selected': props.selectedOrbitId === orbit.id }"
              :cx="orbit.center.x"
              :cy="orbit.center.y"
              :rx="orbit.radii.horizontal"
              :ry="orbit.radii.vertical"
              :transform="`rotate(${orbit.rotation} ${orbit.center.x} ${orbit.center.y})`"
              stroke-dasharray="3 6"
            />
          </g>
          <g class="player-system-orbit-interactions">
            <ellipse
              v-for="orbit in props.document.orbits"
              :key="`hit-${orbit.id}`"
              class="player-system-orbit-hit-target"
              :aria-label="`Inspect ${playerOrbitLabel(orbit)}`"
              :aria-pressed="props.selectedOrbitId === orbit.id"
              :cx="orbit.center.x"
              :cy="orbit.center.y"
              :rx="orbit.radii.horizontal"
              :ry="orbit.radii.vertical"
              :transform="`rotate(${orbit.rotation} ${orbit.center.x} ${orbit.center.y})`"
              role="button"
              tabindex="0"
              @click.stop="inspectOrbitFromClick($event, orbit.id)"
              @keydown="event => inspectOrbitFromKeyboard(event, orbit.id)"
            />
          </g>
          <g
            v-for="object in props.document.objects"
            :key="object.id"
            class="player-system-object-marker"
            :class="[
              object.disclosure === 'unknown' ? undefined : `player-system-object-marker--${object.disclosure}`,
              { 'player-system-object-marker--selected': props.selectedObjectId === object.id },
              { 'player-system-object-marker--dimmed': isDimmed(object) },
            ]"
            :transform="`translate(${object.position.x} ${object.position.y})`"
            role="button"
            :aria-label="`Inspect ${objectPresentations.get(object.id)?.label ?? object.label}`"
            :aria-pressed="props.selectedObjectId === object.id"
            tabindex="0"
            @click="inspectObjectFromClick($event, object.id)"
            @keydown="event => inspectFromKeyboard(event, object.id)"
          >
            <circle
              class="player-system-object-hit-target"
              r="10"
              fill="transparent"
              stroke="none"
              pointer-events="all"
              aria-hidden="true"
            />
            <circle v-if="object.disclosure === 'unknown'" class="player-system-object-marker-art" r="10" />
            <rect
              class="player-system-object-focus-outline"
              x="-14"
              y="-14"
              width="28"
              height="28"
              rx="14"
              aria-hidden="true"
            />
            <text
              v-if="objectPresentations.get(object.id)?.glyph"
              class="player-system-object-glyph"
              x="0"
              y="8"
              text-anchor="middle"
              aria-hidden="true"
            >{{ objectPresentations.get(object.id)?.glyph }}</text>
            <text class="player-system-object-label" x="16" y="6">
              {{ objectPresentations.get(object.id)?.label }}
            </text>
          </g>
          <circle
            v-if="searchLocatorObject"
            class="map-search-locator"
            data-map-search-locator
            :cx="searchLocatorObject.position.x"
            :cy="searchLocatorObject.position.y"
            r="14"
            aria-hidden="true"
          />
          <circle
            v-for="orbit in unoccupiedOrbits"
            :key="`center-${orbit.id}`"
            class="player-system-unoccupied-center"
            :cx="orbit.center.x"
            :cy="orbit.center.y"
            r="3"
            aria-hidden="true"
          />
        </svg>
      </div>

    </div>
  </section>
</template>

<script setup lang="ts">
/** Renders only the allowlisted public system document; it never receives source entities or editor state. */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { PlayerSystemDocument, PlayerOrbit } from '../domain/workspace'
import type { PlayerInspectionTarget, PlayerUsableRectReader } from '../utils/player-inspection'
import { usePlayerMapViewport } from '../composables/usePlayerMapViewport'
import { playerSystemGeometry } from '../utils/player-system-geometry'
import { playerObjectPresentation } from '../utils/player-object-presentation'
import { fitPlayerMapToViewport } from '../utils/player-map-fit'
import { playerObjectMatchesTypeFilters } from '../utils/player-type-filters'

const props = defineProps<{
  document: PlayerSystemDocument
  label: string
  selectedObjectId?: string | null
  selectedOrbitId?: string | null
  selectedTypeFilters?: readonly string[]
  searchLocatorObjectId?: string | null
  active?: boolean
  workspacePresentation?: boolean
  getUsableClientRect?: PlayerUsableRectReader
}>()

const emit = defineEmits<{
  'inspect-object': [publicObjectId: string]
  'inspect-orbit': [publicOrbitId: string]
  'map-interaction': []
}>()

const unoccupiedOrbits = computed(() => props.document.orbits.filter(orbit => orbit.hostId === null))
const searchLocatorObject = computed(() => props.searchLocatorObjectId
  ? props.document.objects.find(object => object.id === props.searchLocatorObjectId) ?? null
  : null)
const objectPresentations = computed(() => new Map(props.document.objects.map(object => [
  object.id,
  playerObjectPresentation(object),
])))
const mapElement = ref<SVGSVGElement | null>(null)
const contentBounds = computed(() => playerSystemGeometry(props.document).bounds)
const viewportSize = ref({ width: 960, height: 560 })
const usableRectReader = computed(() => props.getUsableClientRect)
const fittedBounds = computed(() => fitPlayerMapToViewport(contentBounds.value, viewportSize.value))
const viewport = usePlayerMapViewport({
  element: mapElement,
  fittedBounds,
  viewportSize,
  active: computed(() => props.active !== false),
  maximumZoom: computed(() => 4),
  getUsableClientRect: usableRectReader,
  isInteractiveTarget: isSystemMapInteractiveTarget,
})
const {
  canPan,
  canZoomIn,
  canZoomOut,
  fitPlayerMap,
  handleMapKeydown,
  handleWheel,
  panGesture,
  panView,
  resetViewport,
  revealPoint,
  startPan,
  cancelPan,
  suppressDraggedClick,
  viewBox,
  zoomIn,
  zoomOut,
} = viewport

watch(() => props.document, () => {
  resetViewport()
}, { flush: 'post' })

let resizeObserver: ResizeObserver | null = null

onMounted(() => {
  measureViewport()
  if (typeof ResizeObserver !== 'undefined' && mapElement.value) {
    resizeObserver = new ResizeObserver(measureViewport)
    resizeObserver.observe(mapElement.value)
  }
})

onBeforeUnmount(() => resizeObserver?.disconnect())

function isSystemMapInteractiveTarget(target: EventTarget | null): boolean {
  return target instanceof Element
    && target.closest('.player-system-object-marker, .player-system-orbit-hit-target') !== null
}

function isDimmed(object: PlayerSystemDocument['objects'][number]): boolean {
  return !playerObjectMatchesTypeFilters(object, props.selectedTypeFilters ?? [])
}

function handleScenePointerIntent(): void {
  if (props.active !== false) emit('map-interaction')
}

function handleSceneKeyIntent(event: KeyboardEvent): void {
  if (props.active === false || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '=', '-', '0'].includes(event.key)) return
  emit('map-interaction')
}

function handleSceneWheel(event: WheelEvent): void {
  if (props.active !== false) emit('map-interaction')
  handleWheel(event)
}

function runMapControl(action: () => void): void {
  if (props.active !== false) emit('map-interaction')
  action()
}

function measureViewport(): void {
  const svg = mapElement.value
  if (!svg) return
  const bounds = svg.getBoundingClientRect()
  if (bounds.width <= 0 || bounds.height <= 0) return
  viewportSize.value = {
    width: svg.clientWidth || bounds.width,
    height: svg.clientHeight || bounds.height,
  }
}

function playerOrbitLabel(orbit: PlayerOrbit): string {
  if (orbit.hostId === null) return 'Orbit around unoccupied center'
  const host = props.document.objects.find(object => object.id === orbit.hostId)
  return host ? `Orbit around ${playerObjectPresentation(host).label}` : 'Orbit'
}

function inspectOrbitFromKeyboard(event: KeyboardEvent, publicOrbitId: string): void {
  if (event.key !== 'Enter' && event.key !== ' ') return
  event.preventDefault()
  emit('inspect-orbit', publicOrbitId)
}

function inspectOrbitFromClick(event: MouseEvent, publicOrbitId: string): void {
  if (event.button === 0) emit('inspect-orbit', publicOrbitId)
}

/** Reveals a current public target without changing selection or focus. */
function revealTarget(target: PlayerInspectionTarget, expectedDocument: PlayerSystemDocument): boolean {
  if (props.document !== expectedDocument) return false
  if (target.kind === 'object') {
    const object = props.document.objects.find(candidate => candidate.id === target.id)
    return object ? revealPoint(object.position) : false
  }
  const orbit = props.document.orbits.find(candidate => candidate.id === target.id)
  return orbit ? revealPoint(orbit.center) : false
}

defineExpose({ revealTarget })

function inspectFromKeyboard(event: KeyboardEvent, publicObjectId: string): void {
  if (event.key !== 'Enter' && event.key !== ' ') return
  event.preventDefault()
  emit('inspect-object', publicObjectId)
}

function inspectObjectFromClick(event: MouseEvent, publicObjectId: string): void {
  if (event.button === 0) emit('inspect-object', publicObjectId)
}
</script>

<style scoped>
.player-system-map {
  min-width: 0;
}

.player-system-map-content--workspace {
  height: 100%;
  grid-template-columns: minmax(0, 1fr);
  grid-template-rows: auto minmax(0, 1fr);
}

.player-system-map--workspace,
.player-system-map--workspace .player-system-map-content--workspace {
  height: 100%;
  min-height: 0;
}

.player-system-object-details {
  min-width: 0;
  overflow-wrap: anywhere;
}

.player-system-map-navigation {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: .25rem;
}

.player-system-map-scene {
  display: block;
  width: 100%;
  min-width: 0;
  min-height: 16rem;
  max-height: 40vh;
  overflow: hidden;
  border: 1px solid var(--line-soft);
  background: var(--map-bg);
  cursor: grab;
  touch-action: none;
  user-select: none;
}

.player-system-map-content--workspace .player-system-map-scene {
  height: 100%;
  max-height: none;
  min-height: 0;
}

.player-system-map-scene:focus-visible {
  outline: 2px solid var(--focus, var(--accent-hover));
  outline-offset: 2px;
}

.player-system-map-scene--panning {
  cursor: grabbing;
}

.player-system-orbits ellipse {
  fill: none;
  stroke: var(--map-orbit);
  stroke-width: 2;
}

.player-system-orbits ellipse.player-system-orbit--selected {
  stroke: var(--map-selected, var(--accent));
  stroke-width: 2.4;
}

.player-system-orbit-hit-target {
  fill: none;
  stroke: transparent;
  stroke-width: 16;
  pointer-events: stroke;
  cursor: pointer;
}

.player-system-orbit-hit-target:focus-visible {
  stroke: var(--focus, var(--accent-hover));
  stroke-opacity: .45;
}

.player-system-object-marker {
  cursor: pointer;
}

.player-system-object-marker--dimmed .player-system-object-marker-art,
.player-system-object-marker--dimmed .player-system-object-glyph,
.player-system-object-marker--dimmed .player-system-object-label {
  opacity: .14;
}

.player-system-object-marker:focus {
  outline: none;
}

.player-system-object-hit-target {
  pointer-events: all;
}

.player-system-object-marker-art {
  fill: var(--map-bg);
  stroke: var(--text-muted);
  stroke-width: 3;
}

.player-system-object-focus-outline {
  fill: none;
  stroke: var(--focus);
  stroke-width: 2;
  stroke-dasharray: 2 3;
  opacity: 0;
  pointer-events: none;
}

.player-system-object-marker--selected .player-system-object-glyph,
.player-system-object-marker:focus-visible .player-system-object-glyph {
  fill: var(--map-selected);
}

.player-system-object-marker--selected .player-system-object-marker-art {
  stroke: var(--map-selected);
  stroke-width: 3.5;
}

.player-system-object-marker:focus-visible .player-system-object-focus-outline {
  opacity: 1;
}

.player-system-object-label {
  fill: var(--text-primary);
  font: 16px Georgia, serif;
  pointer-events: none;
}

.player-system-object-glyph {
  fill: var(--text-secondary);
  font: 20px Consolas, monospace;
  pointer-events: visiblePainted;
}

.player-system-object-marker--revealed .player-system-object-glyph {
  fill: var(--accent);
}

.player-system-object-marker--revealed.player-system-object-marker--selected .player-system-object-glyph,
.player-system-object-marker--revealed:focus-visible .player-system-object-glyph {
  fill: var(--map-selected);
}

.player-system-unoccupied-center {
  fill: var(--text-muted);
}

.player-system-station-association {
  display: grid;
  justify-items: start;
  gap: .125rem;
}

.player-system-station-link {
  max-width: 100%;
  white-space: normal;
  text-align: left;
}

.player-system-hierarchy-item {
  display: grid;
  width: 100%;
  min-width: 0;
  gap: .1rem;
  border: 1px solid var(--line-soft);
  background: transparent;
  padding: .45rem .55rem;
  color: var(--text-primary);
  text-align: left;
  white-space: normal;
}

.player-system-hierarchy-item > span {
  min-width: 0;
  overflow-wrap: anywhere;
}

.player-system-hierarchy-item[aria-pressed="true"] {
  border-color: var(--accent);
  background: var(--accent-soft);
}

.player-system-hierarchy-type,
.player-system-orbit-label {
  color: var(--text-muted);
  font-size: .75rem;
}

.player-system-hierarchy-path {
  color: var(--text-muted);
  font-size: .68rem;
  line-height: 1.35;
}
</style>
