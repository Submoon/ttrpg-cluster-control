<template>
  <section class="player-cluster-map" aria-label="Player-visible Jump Cluster map">
    <p v-if="props.document.systems.length === 0" class="player-cluster-map-empty" role="status">
      No star systems are visible to players.
    </p>
    <div v-if="props.document.systems.length" class="player-cluster-map-navigation" role="group" aria-label="Player cluster map navigation" data-player-map-obstruction>
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
      :class="{ 'player-cluster-map-scene--panning': panGesture?.dragging }"
      role="group"
      :aria-label="`${props.document.title} player map`"
      aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight + - 0"
      :viewBox="viewBox"
      preserveAspectRatio="xMidYMid meet"
      tabindex="0"
      @keydown="handleMapKeydown"
      @click.capture="suppressDraggedClick"
      @contextmenu.prevent.stop
      @pointerdown.stop="startPan"
      @lostpointercapture.self.stop="cancelPan"
      @wheel.stop.prevent="handleWheel"
    >
      <g>
        <PlayerClusterRouteMark
          v-for="route in backgroundRouteGeometries"
          :key="route.id"
          :route="route"
        />
      </g>
      <g
        v-for="system in props.document.systems"
        :key="system.id"
        class="player-cluster-map-marker"
        :class="`player-cluster-map-marker--${system.disclosure}`"
        :transform="`translate(${system.position.x} ${system.position.y})`"
        :data-player-system-id="system.id"
        :role="system.disclosure === 'revealed' ? 'button' : 'group'"
        :aria-label="system.disclosure === 'revealed' ? `Open ${system.label} system preview` : system.label"
        :tabindex="system.disclosure === 'revealed' ? 0 : undefined"
        @click="openSystem($event, system)"
        @keydown="event => openSystemFromKeyboard(event, system)"
      >
        <g
          class="player-cluster-map-marker-geometry"
          aria-hidden="true"
        >
          <circle
            v-if="system.disclosure === 'unknown'"
            class="player-cluster-map-marker-unknown"
            r="18"
          />
          <template v-else>
            <rect
              :class="CLUSTER_SYSTEM_PRESENTATION_CLASSES.card"
              :x="CLUSTER_SYSTEM_CARD.x"
              :y="CLUSTER_SYSTEM_CARD.y"
              :width="CLUSTER_SYSTEM_CARD.width"
              :height="CLUSTER_SYSTEM_CARD.height"
              :rx="CLUSTER_SYSTEM_CARD.cornerRadius"
            />
            <circle
              :class="CLUSTER_SYSTEM_PRESENTATION_CLASSES.seal"
              :cx="CLUSTER_SYSTEM_SEAL.x"
              :cy="CLUSTER_SYSTEM_SEAL.y"
              :r="CLUSTER_SYSTEM_SEAL.radius"
            />
            <text
              :class="CLUSTER_SYSTEM_PRESENTATION_CLASSES.name"
              :x="CLUSTER_SYSTEM_CARD_NAME_POSITION.x"
              :y="CLUSTER_SYSTEM_CARD_NAME_POSITION.y"
            >{{ system.label }}</text>
          </template>
        </g>
        <rect
          v-if="system.disclosure === 'revealed'"
          class="player-cluster-map-marker-hit-target"
          :x="CLUSTER_SYSTEM_CARD.x"
          :y="CLUSTER_SYSTEM_CARD.y"
          :width="CLUSTER_SYSTEM_CARD.width"
          :height="CLUSTER_SYSTEM_CARD.height"
          fill="transparent"
          stroke="none"
          pointer-events="all"
          aria-hidden="true"
        />
      </g>
      <g v-if="foregroundRouteGeometries.length" class="player-cluster-routes-foreground" pointer-events="none">
        <PlayerClusterRouteMark
          v-for="route in foregroundRouteGeometries"
          :key="route.id"
          :route="route"
        />
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
import type { PlayerUsableRectReader } from '../utils/player-inspection'
import { usePlayerMapViewport } from '../composables/usePlayerMapViewport'
import { playerClusterGeometry } from '../utils/player-cluster-geometry'
import { fitPlayerMapToViewport } from '../utils/player-map-fit'
import PlayerClusterRouteMark from './maps/PlayerClusterRouteMark.vue'
import { CLUSTER_ROUTE_PRESENTATION } from '../utils/cluster-route-presentation'
import {
  CLUSTER_SYSTEM_CARD,
  CLUSTER_SYSTEM_CARD_NAME_POSITION,
  CLUSTER_SYSTEM_PRESENTATION_CLASSES,
  CLUSTER_SYSTEM_SEAL,
} from '../utils/cluster-system-presentation'

const props = withDefaults(defineProps<{
  document: PlayerClusterDocument
  active?: boolean
  getUsableClientRect?: PlayerUsableRectReader
}>(), { active: true })
const emit = defineEmits<{ 'open-system': [publicSystemId: string] }>()

const geometry = computed(() => playerClusterGeometry(props.document))
const backgroundRouteGeometries = computed(() => geometry.value.routes.filter(route => !route.foreground))
const foregroundRouteGeometries = computed(() => geometry.value.routes.filter(route => route.foreground))
const contentBounds = computed(() => ({
  left: geometry.value.bounds.minX,
  top: geometry.value.bounds.minY,
  width: geometry.value.bounds.width,
  height: geometry.value.bounds.height,
}))
const mapElement = ref<SVGSVGElement | null>(null)
const viewportSize = ref({ width: 960, height: 560 })
const usableRectReader = computed(() => props.getUsableClientRect)
const fittedBounds = computed(() => fitPlayerMapToViewport(contentBounds.value, viewportSize.value))
const maximumZoom = computed(() => {
  const scale = Math.min(
    viewportSize.value.width / fittedBounds.value.width,
    viewportSize.value.height / fittedBounds.value.height,
  )
  return Number.isFinite(scale) && scale > 0
    ? Math.max(4, 13 / (CLUSTER_ROUTE_PRESENTATION.labelFontSize * scale))
    : 4
})
const viewport = usePlayerMapViewport({
  element: mapElement,
  fittedBounds,
  viewportSize,
  active: computed(() => props.active),
  maximumZoom,
  getUsableClientRect: usableRectReader,
  isInteractiveTarget: isClusterMarkerTarget,
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
  startPan,
  cancelPan,
  suppressDraggedClick,
  viewBox,
  zoomIn,
  zoomOut,
} = viewport

let resizeObserver: ResizeObserver | null = null

watch(() => props.document, () => {
  resetViewport()
}, { flush: 'post' })
onMounted(() => {
  measureViewport()
  if (typeof ResizeObserver !== 'undefined' && mapElement.value) {
    resizeObserver = new ResizeObserver(measureViewport)
    resizeObserver.observe(mapElement.value)
  }
})
onBeforeUnmount(() => resizeObserver?.disconnect())

function isClusterMarkerTarget(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest('.player-cluster-map-marker') !== null
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

function openSystem(event: MouseEvent, system: PlayerSystemMarker): void {
  if (event.button === 0 && system.disclosure === 'revealed') emit('open-system', system.id)
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

.player-cluster-map-marker .cluster-system-card {
  stroke-width: 1.5;
  transition: stroke 100ms ease, stroke-width 100ms ease;
}
.player-cluster-map-marker--unknown .player-cluster-map-marker-unknown {
  fill: var(--map-bg);
  stroke: var(--text-muted);
  stroke-width: 3;
}
.player-cluster-map-marker[role="button"] { cursor: pointer; }
.player-cluster-map-marker--known-type .cluster-system-card {
  stroke: var(--map-label-border);
}
.player-cluster-map-marker--revealed .cluster-system-card {
  stroke: var(--map-installation);
}
.player-cluster-map-marker--known-type .cluster-system-seal { fill: var(--text-secondary); }
.player-cluster-map-marker--revealed .cluster-system-seal { fill: var(--map-installation); }
.player-cluster-map-marker--known-type .cluster-system-name {
  fill: var(--text-secondary);
}
.player-cluster-map-marker--revealed .cluster-system-name {
  fill: var(--text-primary);
}
.player-cluster-map-marker[role="button"]:hover .cluster-system-card,
.player-cluster-map-marker[role="button"]:focus-visible .cluster-system-card {
  stroke: var(--map-selected);
  stroke-width: 2.5;
}
.player-cluster-map-marker[role="button"]:focus-visible {
  outline: none;
}
.player-cluster-map-marker[role="button"]:focus-visible .cluster-system-card {
  filter: drop-shadow(0 0 2px var(--focus));
}
.player-cluster-map-marker .cluster-system-seal {
  stroke: none;
}
.player-cluster-map-marker .cluster-system-name {
  text-anchor: middle;
  pointer-events: none;
}
.player-cluster-map-marker--known-type .cluster-system-card,
.player-cluster-map-marker--revealed .cluster-system-card { fill: var(--map-card); }
.player-cluster-map-marker--known-type .cluster-system-name,
.player-cluster-map-marker--revealed .cluster-system-name {
  font: 14px Georgia, serif;
}
</style>
