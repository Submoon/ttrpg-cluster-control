<template>
  <section class="player-cluster-map" aria-label="Player-visible Jump Cluster map">
    <p v-if="props.document.systems.length === 0" class="player-cluster-map-empty" role="status">
      No star systems are visible to players.
    </p>
    <div v-if="props.document.systems.length" class="player-cluster-map-navigation" role="group" aria-label="Player cluster map navigation">
      <UButton color="neutral" variant="outline" size="xs" icon="i-lucide-arrow-left" aria-label="Pan left" :disabled="!canPan" @click="panView(-1, 0)" />
      <UButton color="neutral" variant="outline" size="xs" icon="i-lucide-arrow-up" aria-label="Pan up" :disabled="!canPan" @click="panView(0, -1)" />
      <UButton color="neutral" variant="outline" size="xs" icon="i-lucide-arrow-down" aria-label="Pan down" :disabled="!canPan" @click="panView(0, 1)" />
      <UButton color="neutral" variant="outline" size="xs" icon="i-lucide-arrow-right" aria-label="Pan right" :disabled="!canPan" @click="panView(1, 0)" />
      <UButton color="neutral" variant="outline" size="xs" icon="i-lucide-minus" aria-label="Zoom out" :disabled="!canZoomOut" @click="zoomOut" />
      <UButton color="neutral" variant="outline" size="xs" icon="i-lucide-plus" aria-label="Zoom in" :disabled="!canZoomIn" @click="zoomIn" />
      <UButton color="neutral" variant="outline" size="xs" icon="i-lucide-maximize" aria-label="Fit player map" :disabled="!props.active" @click="fitPlayerMap" />
    </div>
    <svg
      v-if="props.document.systems.length"
      ref="mapElement"
      class="player-cluster-map-scene"
      :class="{ 'player-cluster-map-scene--panning': panGesture !== null }"
      role="group"
      :aria-label="`${props.document.title} player map`"
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
      <g
        v-for="route in routeGeometries"
        :key="route.id"
        class="player-cluster-route"
        role="group"
        :aria-label="route.accessibleLabel"
      >
        <path class="player-cluster-route-path" :d="route.path" />
        <g class="player-cluster-route-level">
          <rect
            :x="route.labelX - route.labelWidth / 2"
            :y="route.labelY - 15"
            :width="route.labelWidth"
            height="20"
            rx="2"
          />
          <text :x="route.labelX" :y="route.labelY" text-anchor="middle">{{ route.label }}</text>
        </g>
        <template v-if="route.destination">
          <circle
            class="player-cluster-route-unknown-destination"
            :cx="route.destination.position.x"
            :cy="route.destination.position.y"
            r="8"
          />
          <text
            class="player-cluster-route-unknown-label"
            :x="route.destination.position.x + 16"
            :y="route.destination.position.y + 5"
          >{{ route.destination.label }}</text>
        </template>
      </g>
      <g
        v-for="system in props.document.systems"
        :key="system.id"
        class="player-cluster-map-marker"
        :class="`player-cluster-map-marker--${system.disclosure}`"
        :data-player-system-id="system.id"
        :role="system.disclosure === 'revealed' ? 'button' : 'group'"
        :aria-label="system.disclosure === 'revealed' ? `Open ${system.label} system preview` : system.label"
        :tabindex="system.disclosure === 'revealed' ? 0 : undefined"
        @click="openSystem(system)"
        @keydown="event => openSystemFromKeyboard(event, system)"
      >
        <circle :cx="system.position.x" :cy="system.position.y" r="18" />
        <text
          v-if="system.disclosure !== 'unknown'"
          :x="system.position.x + labelOffset.x"
          :y="system.position.y + labelOffset.y"
        >{{ system.label }}</text>
      </g>
    </svg>
    <ul v-if="props.document.systems.length" class="sr-only" aria-label="Visible marker labels">
      <li v-for="system in props.document.systems" :key="system.id">{{ system.label }}</li>
    </ul>
  </section>
</template>

<script setup lang="ts">
/** Draws only an allowlisted player projection; this component never accepts a Warden workspace. */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { PlayerClusterDocument, PlayerSystemMarker } from '../domain/workspace'
import { usePlayerMapViewport } from '../composables/usePlayerMapViewport'
import { playerClusterGeometry } from '../utils/player-cluster-geometry'
import { fitPlayerMapToViewport } from '../utils/player-map-fit'

const props = withDefaults(defineProps<{ document: PlayerClusterDocument; active?: boolean }>(), { active: true })
const emit = defineEmits<{ 'open-system': [publicSystemId: string] }>()

const geometry = computed(() => playerClusterGeometry(props.document))
const routeGeometries = computed(() => geometry.value.routes)
const contentBounds = computed(() => ({
  left: geometry.value.bounds.minX,
  top: geometry.value.bounds.minY,
  width: geometry.value.bounds.width,
  height: geometry.value.bounds.height,
}))
const mapElement = ref<SVGSVGElement | null>(null)
const viewportSize = ref({ width: 960, height: 560 })
const fittedBounds = computed(() => fitPlayerMapToViewport(contentBounds.value, viewportSize.value))
const maximumZoom = computed(() => {
  const scale = Math.min(
    viewportSize.value.width / fittedBounds.value.width,
    viewportSize.value.height / fittedBounds.value.height,
  )
  return Number.isFinite(scale) && scale > 0 ? Math.max(4, 13 / (14 * scale)) : 4
})
const viewport = usePlayerMapViewport({
  element: mapElement,
  fittedBounds,
  active: computed(() => props.active),
  maximumZoom,
  isInteractiveTarget: isSystemMarkerTarget,
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

let resizeObserver: ResizeObserver | null = null

watch(() => props.document, resetViewport, { flush: 'post' })
onMounted(() => {
  measureViewport()
  if (typeof ResizeObserver !== 'undefined' && mapElement.value) {
    resizeObserver = new ResizeObserver(measureViewport)
    resizeObserver.observe(mapElement.value)
  }
})
onBeforeUnmount(() => resizeObserver?.disconnect())

const labelOffset = { x: 28, y: 7 }

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

function isSystemMarkerTarget(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest('.player-cluster-map-marker') !== null
}

function openSystem(system: PlayerSystemMarker): void {
  if (system.disclosure === 'revealed') emit('open-system', system.id)
}

function openSystemFromKeyboard(event: KeyboardEvent, system: PlayerSystemMarker): void {
  if (system.disclosure !== 'revealed' || (event.key !== 'Enter' && event.key !== ' ')) return
  event.preventDefault()
  emit('open-system', system.id)
}
</script>

<style scoped>
.player-cluster-map {
  display: grid;
  min-height: 14rem;
  place-items: center;
  overflow: hidden;
  border: 1px solid var(--line-soft);
  background: var(--map-bg);
}

.player-cluster-map-empty {
  margin: 0;
  padding: 2rem 1rem;
  color: var(--text-muted);
  text-align: center;
}

.player-cluster-map-scene {
  display: block;
  width: 100%;
  max-height: 56vh;
  min-height: 14rem;
  overflow: hidden;
  border: 1px solid var(--line-soft);
  background: var(--map-bg);
  cursor: grab;
  touch-action: none;
  user-select: none;
}
.player-cluster-map-scene:focus-visible {
  outline: 2px solid var(--focus, var(--accent-hover));
  outline-offset: 2px;
}
.player-cluster-map-scene--panning {
  cursor: grabbing;
}
.player-cluster-map-navigation {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: .25rem;
}

.player-cluster-map-marker circle { stroke-width: 3; }
.player-cluster-map-marker[role="button"] { cursor: pointer; }
.player-cluster-map-marker[role="button"]:focus-visible circle {
  stroke: var(--focus, var(--accent-hover));
  stroke-width: 5;
}
.player-cluster-map-marker text {
  fill: var(--text-primary);
  font: 20px Georgia, serif;
}
.player-cluster-route-path {
  fill: none;
  stroke: var(--text-secondary);
  stroke-width: 3;
}
.player-cluster-route-level rect {
  fill: var(--panel-bg);
  stroke: var(--line);
  stroke-width: 1;
}
.player-cluster-route-level text {
  fill: var(--text-primary);
  font: 12px system-ui, sans-serif;
}
.player-cluster-route-unknown-destination {
  fill: var(--map-bg);
  stroke: var(--text-muted);
  stroke-width: 3;
}
.player-cluster-route-unknown-label {
  fill: var(--text-secondary);
  font: 14px system-ui, sans-serif;
}
.player-cluster-map-marker--unknown circle {
  fill: var(--map-bg);
  stroke: var(--text-muted);
}
.player-cluster-map-marker--known-type circle {
  fill: var(--text-secondary);
  stroke: var(--text-primary);
}
.player-cluster-map-marker--revealed circle {
  fill: var(--accent, #a9d6b2);
  stroke: var(--text-primary);
}
</style>
