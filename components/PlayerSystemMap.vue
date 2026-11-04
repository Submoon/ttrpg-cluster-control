<template>
  <section class="player-system-map" :class="{ 'player-system-map--workspace': props.workspacePresentation }" aria-label="Player-visible system map">
    <div class="player-system-map-content grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_14rem]" :class="{ 'player-system-map-content--workspace': props.workspacePresentation }">
      <div class="grid min-w-0 content-start gap-2">
        <div class="player-system-map-navigation" role="group" aria-label="Player system map navigation">
          <UButton
            color="neutral"
            variant="outline"
            size="xs"
            icon="i-lucide-arrow-left"
            aria-label="Pan left"
            :disabled="!canPan"
            @click="panView(-1, 0)"
          />
          <UButton
            color="neutral"
            variant="outline"
            size="xs"
            icon="i-lucide-arrow-up"
            aria-label="Pan up"
            :disabled="!canPan"
            @click="panView(0, -1)"
          />
          <UButton
            color="neutral"
            variant="outline"
            size="xs"
            icon="i-lucide-arrow-down"
            aria-label="Pan down"
            :disabled="!canPan"
            @click="panView(0, 1)"
          />
          <UButton
            color="neutral"
            variant="outline"
            size="xs"
            icon="i-lucide-arrow-right"
            aria-label="Pan right"
            :disabled="!canPan"
            @click="panView(1, 0)"
          />
          <UButton
            color="neutral"
            variant="outline"
            size="xs"
            icon="i-lucide-minus"
            aria-label="Zoom out"
            :disabled="!canZoomOut"
            @click="zoomOut"
          />
          <UButton
            color="neutral"
            variant="outline"
            size="xs"
            icon="i-lucide-plus"
            aria-label="Zoom in"
            :disabled="!canZoomIn"
            @click="zoomIn"
          />
          <UButton
            color="neutral"
            variant="outline"
            size="xs"
            icon="i-lucide-maximize"
            aria-label="Fit player map"
            @click="fitPlayerMap"
          />
        </div>
        <svg
          ref="mapElement"
          class="player-system-map-scene"
          :class="{ 'player-system-map-scene--panning': panGesture !== null }"
          role="group"
          :aria-label="`${props.label} player system map`"
          aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight + - 0"
          :viewBox="viewBox"
          preserveAspectRatio="xMidYMid meet"
          tabindex="0"
          @keydown="handleMapKeydown"
          @pointerdown.stop="startPan"
          @pointermove.stop="movePan"
          @pointerup.stop="finishPan"
          @pointercancel.stop="cancelPan"
          @lostpointercapture.stop="cancelPan"
          @wheel.stop.prevent="handleWheel"
        >
          <g class="player-system-orbits" aria-hidden="true">
            <ellipse
              v-for="orbit in props.document.orbits"
              :key="orbit.id"
              :cx="orbit.center.x"
              :cy="orbit.center.y"
              :rx="orbit.radii.horizontal"
              :ry="orbit.radii.vertical"
              :transform="`rotate(${orbit.rotation} ${orbit.center.x} ${orbit.center.y})`"
            />
          </g>
          <g
            v-for="object in props.document.objects"
            :key="object.id"
            class="player-system-object-marker"
            :class="object.disclosure === 'unknown' ? undefined : `player-system-object-marker--${object.disclosure}`"
            :transform="`translate(${object.position.x} ${object.position.y})`"
            role="button"
            :aria-label="`Inspect ${object.label}`"
            :aria-pressed="props.selectedObjectId === object.id"
            tabindex="0"
            @click="emit('inspect-object', object.id)"
            @keydown="event => inspectFromKeyboard(event, object.id)"
          >
            <circle r="10" />
            <text v-if="object.disclosure !== 'unknown'" x="16" y="6">{{ object.label }}</text>
          </g>
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

      <aside v-if="!props.workspacePresentation" class="grid min-w-0 content-start gap-3">
        <PlayerSystemHierarchy
          :document="props.document"
          :selected-object-id="props.selectedObjectId ?? null"
          @inspect-object="emit('inspect-object', $event)"
        />
        <PlayerObjectInspector
          :document="props.document"
          :object="selectedObject"
          :workspace-presentation="false"
          @inspect-object="emit('inspect-object', $event)"
        />
      </aside>
    </div>
  </section>
</template>

<script setup lang="ts">
/** Renders only the allowlisted public system document; it never receives source entities or editor state. */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { PlayerSystemDocument } from '../domain/workspace'
import { usePlayerMapViewport } from '../composables/usePlayerMapViewport'
import { playerSystemGeometry } from '../utils/player-system-geometry'
import { fitPlayerMapToViewport } from '../utils/player-map-fit'
import PlayerSystemHierarchy from './PlayerSystemHierarchy.vue'
import PlayerObjectInspector from './PlayerObjectInspector.vue'

const props = defineProps<{
  document: PlayerSystemDocument
  label: string
  selectedObjectId?: string | null
  active?: boolean
  workspacePresentation?: boolean
}>()

const emit = defineEmits<{ 'inspect-object': [publicObjectId: string] }>()

const selectedObject = computed(() => props.document.objects.find(object => object.id === props.selectedObjectId) ?? null)
const unoccupiedOrbits = computed(() => props.document.orbits.filter(orbit => orbit.hostId === null))
const mapElement = ref<SVGSVGElement | null>(null)
const contentBounds = computed(() => playerSystemGeometry(props.document).bounds)
const viewportSize = ref({ width: 960, height: 560 })
const fittedBounds = computed(() => fitPlayerMapToViewport(contentBounds.value, viewportSize.value))
const viewport = usePlayerMapViewport({
  element: mapElement,
  fittedBounds,
  active: computed(() => props.active !== false),
  maximumZoom: computed(() => 4),
  isInteractiveTarget: isObjectMarkerTarget,
})
const {
  canPan,
  canZoomIn,
  canZoomOut,
  fitPlayerMap,
  handleMapKeydown,
  handleWheel,
  movePan,
  panGesture,
  panView,
  resetViewport,
  startPan,
  finishPan,
  cancelPan,
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

function isObjectMarkerTarget(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest('.player-system-object-marker') !== null
}

function inspectFromKeyboard(event: KeyboardEvent, publicObjectId: string): void {
  if (event.key !== 'Enter' && event.key !== ' ') return
  event.preventDefault()
  emit('inspect-object', publicObjectId)
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
  stroke: var(--line-soft);
  stroke-width: 2;
}

.player-system-object-marker {
  cursor: pointer;
}

.player-system-object-marker circle {
  fill: var(--map-bg);
  stroke: var(--text-muted);
  stroke-width: 3;
}

.player-system-object-marker--known-type circle {
  fill: var(--text-secondary);
  stroke: var(--text-primary);
}

.player-system-object-marker--revealed circle {
  fill: var(--accent, #a9d6b2);
  stroke: var(--text-primary);
}

.player-system-object-marker text {
  fill: var(--text-primary);
  font: 16px Georgia, serif;
}

.player-system-object-marker:focus-visible circle {
  stroke: var(--focus, var(--accent-hover));
  stroke-width: 5;
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
