<template>
  <section class="player-system-map" aria-label="Player-visible system map">
    <div class="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_14rem]">
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

      <aside class="grid min-w-0 content-start gap-3">
        <section aria-label="Visible system hierarchy" class="grid content-start gap-2">
          <h3 class="m-0 text-sm font-semibold">Visible objects</h3>
          <ul v-if="props.document.objects.length" class="m-0 grid list-none gap-1 p-0">
            <li v-for="entry in hierarchyEntries" :key="entry.object.id">
              <button
                class="player-system-hierarchy-item"
                type="button"
                :aria-pressed="props.selectedObjectId === entry.object.id"
                @click="emit('inspect-object', entry.object.id)"
              >
                <span>{{ entry.object.label }}</span>
                <span v-if="entry.object.disclosure !== 'unknown'" class="player-system-hierarchy-type">
                  {{ catalogueSubtypeLabel(entry.object) }}
                </span>
                <span v-if="entry.path" class="player-system-hierarchy-path">
                  {{ entry.path }}
                </span>
              </button>
            </li>
          </ul>
          <p v-else class="empty-copy m-0">No map objects are visible to players.</p>
        </section>

        <section v-if="selectedObject" class="player-system-object-details" aria-label="Player object details">
          <span class="section-kicker">PLAYER-VISIBLE OBJECT</span>
          <h3 class="mb-1 mt-2 text-base">{{ selectedObject.label }}</h3>
          <p v-if="selectedObject.disclosure !== 'unknown'" class="inspector-intro m-0">
            {{ catalogueSubtypeLabel(selectedObject) }}
          </p>
          <p v-if="selectedObject.disclosure === 'revealed' && selectedObject.playerText" class="inspector-intro m-0 whitespace-pre-wrap">
            {{ selectedObject.playerText }}
          </p>
          <dl
            v-if="selectedObject.disclosure === 'revealed' && selectedObject.fields.length"
            class="m-0 grid gap-2"
            aria-label="Player-visible Fields"
          >
            <div v-for="(field, index) in selectedObject.fields" :key="`${field.name}:${field.type}:${index}`">
              <dt class="font-semibold">{{ field.name }}</dt>
              <dd class="m-0">{{ field.type }}: {{ field.value }}</dd>
            </div>
          </dl>
          <section
            v-if="selectedStation"
            class="player-system-station-association"
            aria-label="Physical Station association"
          >
            <strong>Physical Station</strong>
            <UButton
              class="player-system-station-link"
              color="neutral"
              variant="link"
              size="sm"
              :aria-label="`Inspect ${selectedStation.label}`"
              @click="emit('inspect-object', selectedStation.id)"
            >
              {{ selectedStation.label }}
            </UButton>
          </section>
        </section>

        <section v-if="props.document.orbits.length" aria-label="Visible Orbit layout" class="grid content-start gap-2">
          <h3 class="m-0 text-sm font-semibold">Orbit layout</h3>
          <ul class="m-0 grid list-none gap-1 p-0">
            <li v-for="orbit in props.document.orbits" :key="orbit.id" class="player-system-orbit-label">
              {{ orbit.hostId === null ? 'Orbit around unoccupied center' : `Orbit around ${hostLabel(orbit.hostId)}` }}
            </li>
          </ul>
        </section>
      </aside>
    </div>
  </section>
</template>

<script setup lang="ts">
/** Renders only the allowlisted public system document; it never receives source entities or editor state. */
import { computed, ref, watch } from 'vue'
import type { PlayerObjectMarker, PlayerSystemDocument } from '../domain/workspace'
import { catalogueSubtypeLabel } from '../utils/catalogue-labels'
import { usePlayerMapViewport } from '../composables/usePlayerMapViewport'
import { playerSystemGeometry } from '../utils/player-system-geometry'

const props = defineProps<{
  document: PlayerSystemDocument
  label: string
  selectedObjectId?: string | null
  active?: boolean
}>()

const emit = defineEmits<{ 'inspect-object': [publicObjectId: string] }>()

const selectedObject = computed(() => props.document.objects.find(object => object.id === props.selectedObjectId) ?? null)
const unoccupiedOrbits = computed(() => props.document.orbits.filter(orbit => orbit.hostId === null))
const objectsById = computed(() => new Map(props.document.objects.map(object => [object.id, object])))
const orbitsById = computed(() => new Map(props.document.orbits.map(orbit => [orbit.id, orbit])))
const hierarchyEntries = computed(() => props.document.objects.map(object => ({
  object,
  path: hierarchyPath(object),
})))
const selectedStation = computed(() => {
  const object = selectedObject.value
  if (object?.disclosure !== 'revealed' || object.family !== 'JumpPoint' || !object.stationId) return null
  const station = objectsById.value.get(object.stationId)
  return station?.disclosure === 'revealed' ? station : null
})
const mapElement = ref<SVGSVGElement | null>(null)
const fittedBounds = computed(() => playerSystemGeometry(props.document).bounds)
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

function isObjectMarkerTarget(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest('.player-system-object-marker') !== null
}

function hostLabel(publicHostId: string): string {
  return summarizeHostLabel(objectsById.value.get(publicHostId)?.label ?? 'Unknown presence')
}

const maximumHostLinks = 8
const maximumHostLabelLength = 80

/** Caps summaries without reading beyond the fixed prefix or splitting a surrogate pair. */
function summarizeHostLabel(label: string): string {
  if (label.length <= maximumHostLabelLength) return label

  const prefixLength = maximumHostLabelLength - 1
  let prefix = label.slice(0, prefixLength)
  const lastCodeUnit = prefix.charCodeAt(prefix.length - 1)
  const nextCodeUnit = label.charCodeAt(prefix.length)
  const endsWithHighSurrogate = lastCodeUnit >= 0xD800 && lastCodeUnit <= 0xDBFF
  const nextIsLowSurrogate = nextCodeUnit >= 0xDC00 && nextCodeUnit <= 0xDFFF
  if (endsWithHighSurrogate && nextIsLowSurrogate) prefix = prefix.slice(0, -1)
  return `${prefix}…`
}

/** Follows only remapped DTO placement and host references, so private source labels cannot enter the hierarchy. */
function hierarchyPath(object: PlayerObjectMarker): string {
  const path: string[] = []
  const visitedOrbitIds = new Set<string>()
  let placement = object.placement
  let hostLinks = 0

  while (placement.kind === 'orbit') {
    const orbit = orbitsById.value.get(placement.orbitId)
    if (!orbit || visitedOrbitIds.has(orbit.id)) break
    visitedOrbitIds.add(orbit.id)
    if (orbit.hostId === null) {
      path.push('Orbit around unoccupied center')
      break
    }

    if (hostLinks >= maximumHostLinks) {
      path.push('…')
      break
    }

    const host = objectsById.value.get(orbit.hostId)
    if (!host) {
      path.push('Orbit around Unknown presence')
      break
    }
    path.push(`Orbit around ${summarizeHostLabel(host.label)}`)
    hostLinks += 1
    placement = host.placement
  }

  return path.join(' → ')
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
