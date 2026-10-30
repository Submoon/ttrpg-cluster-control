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
            @click="zoomView(1 / zoomStep)"
          />
          <UButton
            color="neutral"
            variant="outline"
            size="xs"
            icon="i-lucide-plus"
            aria-label="Zoom in"
            :disabled="!canZoomIn"
            @click="zoomView(zoomStep)"
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
            <li v-for="object in props.document.objects" :key="object.id">
              <button
                class="player-system-hierarchy-item"
                type="button"
                :aria-pressed="props.selectedObjectId === object.id"
                @click="emit('inspect-object', object.id)"
              >
                <span>{{ object.label }}</span>
                <span v-if="object.disclosure !== 'unknown'" class="player-system-hierarchy-type">
                  {{ catalogueSubtypeLabel(object) }}
                </span>
                <span v-if="hierarchyPath(object)" class="player-system-hierarchy-path">
                  {{ hierarchyPath(object) }}
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
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { PlayerObjectMarker, PlayerSystemDocument } from '../domain/workspace'
import { catalogueSubtypeLabel } from '../utils/catalogue-labels'

interface SceneBounds {
  left: number
  top: number
  width: number
  height: number
}

interface PanGesture {
  pointerId: number
  startX: number
  startY: number
  startBounds: SceneBounds
  startedAtFit: boolean
  screenToScene: DOMMatrix
}

const props = defineProps<{
  document: PlayerSystemDocument
  label: string
  selectedObjectId?: string | null
}>()

const emit = defineEmits<{ 'inspect-object': [publicObjectId: string] }>()

const selectedObject = computed(() => props.document.objects.find(object => object.id === props.selectedObjectId) ?? null)
const unoccupiedOrbits = computed(() => props.document.orbits.filter(orbit => orbit.hostId === null))
const objectsById = computed(() => new Map(props.document.objects.map(object => [object.id, object])))
const orbitsById = computed(() => new Map(props.document.orbits.map(orbit => [orbit.id, orbit])))
const mapElement = ref<SVGSVGElement | null>(null)
const measuredBounds = ref<SceneBounds | null>(null)
const viewportBounds = ref<SceneBounds | null>(null)
const panGesture = ref<PanGesture | null>(null)
const zoomStep = 1.25
const maximumZoom = 4

const estimatedBounds = computed(() => {
  const bounds = rawSceneBounds(true)
  return paddedBounds(bounds.left, bounds.top, bounds.left + bounds.width, bounds.top + bounds.height)
})
const fittedBounds = computed(() => measuredBounds.value ?? estimatedBounds.value)
const currentBounds = computed(() => viewportBounds.value ?? fittedBounds.value)
const zoomLevel = computed(() => fittedBounds.value.width / currentBounds.value.width)
const canZoomIn = computed(() => zoomLevel.value < maximumZoom - 0.001)
const canZoomOut = computed(() => zoomLevel.value > 1.001)
const canPan = computed(() => canZoomOut.value)
const viewBox = computed(() => `${currentBounds.value.left} ${currentBounds.value.top} ${currentBounds.value.width} ${currentBounds.value.height}`)

watch(() => props.document, () => {
  cancelOwnedPan(false)
  viewportBounds.value = null
  measuredBounds.value = null
  void fitMapToDocument()
}, { flush: 'post' })

onMounted(() => { void fitMapToDocument() })
onBeforeUnmount(() => { cancelOwnedPan(false) })

function rawSceneBounds(estimateLabels: boolean): SceneBounds {
  const xValues: number[] = []
  const yValues: number[] = []
  for (const object of props.document.objects) {
    xValues.push(object.position.x - 10, object.position.x + 10)
    yValues.push(object.position.y - 10, object.position.y + 10)
    if (estimateLabels && object.disclosure !== 'unknown') {
      xValues.push(object.position.x + 16 + object.label.length * 18)
      yValues.push(object.position.y - 10, object.position.y + 12)
    }
  }
  for (const orbit of props.document.orbits) {
    const radians = orbit.rotation * Math.PI / 180
    const horizontalExtent = Math.sqrt(
      orbit.radii.horizontal ** 2 * Math.cos(radians) ** 2
        + orbit.radii.vertical ** 2 * Math.sin(radians) ** 2,
    )
    const verticalExtent = Math.sqrt(
      orbit.radii.horizontal ** 2 * Math.sin(radians) ** 2
        + orbit.radii.vertical ** 2 * Math.cos(radians) ** 2,
    )
    xValues.push(orbit.center.x - horizontalExtent, orbit.center.x + horizontalExtent)
    yValues.push(orbit.center.y - verticalExtent, orbit.center.y + verticalExtent)
  }
  if (!xValues.length || !yValues.length) return { left: 0, top: 0, width: 960, height: 560 }

  const left = Math.min(...xValues)
  const right = Math.max(...xValues)
  const top = Math.min(...yValues)
  const bottom = Math.max(...yValues)
  return { left, top, width: Math.max(right - left, 1), height: Math.max(bottom - top, 1) }
}

function paddedBounds(left: number, top: number, right: number, bottom: number): SceneBounds {
  const width = Math.max(right - left, 1)
  const height = Math.max(bottom - top, 1)
  const padding = Math.max(width * 0.08, height * 0.12, 48)
  return {
    left: left - padding,
    top: top - padding,
    width: width + padding * 2,
    height: height + padding * 2,
  }
}

async function fitMapToDocument(): Promise<void> {
  await nextTick()
  const svg = mapElement.value
  if (!svg) return

  const geometryBounds = rawSceneBounds(false)
  let left = geometryBounds.left
  let top = geometryBounds.top
  let right = geometryBounds.left + geometryBounds.width
  let bottom = geometryBounds.top + geometryBounds.height

  const rootMatrix = svg.getCTM()
  if (rootMatrix) {
    for (const label of svg.querySelectorAll<SVGGraphicsElement>('.player-system-object-marker text')) {
      const labelMatrix = label.getCTM()
      if (!labelMatrix) continue
      const labelToRoot = rootMatrix.inverse().multiply(labelMatrix)
      const box = label.getBBox()
      const corners = [
        new DOMPoint(box.x, box.y),
        new DOMPoint(box.x + box.width, box.y),
        new DOMPoint(box.x, box.y + box.height),
        new DOMPoint(box.x + box.width, box.y + box.height),
      ].map(point => point.matrixTransform(labelToRoot))
      left = Math.min(left, ...corners.map(point => point.x))
      top = Math.min(top, ...corners.map(point => point.y))
      right = Math.max(right, ...corners.map(point => point.x))
      bottom = Math.max(bottom, ...corners.map(point => point.y))
    }
  }

  measuredBounds.value = paddedBounds(left, top, right, bottom)
}

function fitPlayerMap(): void {
  viewportBounds.value = null
}

function zoomView(factor: number, anchor?: DOMPoint): void {
  const fitted = fittedBounds.value
  const current = currentBounds.value
  const nextZoom = Math.max(1, Math.min(maximumZoom, zoomLevel.value * factor))
  if (nextZoom <= 1.001) {
    viewportBounds.value = null
    return
  }

  const width = fitted.width / nextZoom
  const height = fitted.height / nextZoom
  const centerX = anchor?.x ?? current.left + current.width / 2
  const centerY = anchor?.y ?? current.top + current.height / 2
  const ratio = width / current.width
  const left = centerX - (centerX - current.left) * ratio
  const top = centerY - (centerY - current.top) * ratio
  viewportBounds.value = clampViewport({ left, top, width, height }, fitted)
}

function panView(horizontal: -1 | 0 | 1, vertical: -1 | 0 | 1): void {
  if (!canPan.value) return
  const current = currentBounds.value
  viewportBounds.value = clampViewport({
    left: current.left + horizontal * current.width * 0.16,
    top: current.top + vertical * current.height * 0.16,
    width: current.width,
    height: current.height,
  }, fittedBounds.value)
}

function clampViewport(candidate: SceneBounds, fitted: SceneBounds): SceneBounds {
  const width = Math.min(candidate.width, fitted.width)
  const height = Math.min(candidate.height, fitted.height)
  return {
    left: Math.max(fitted.left, Math.min(fitted.left + fitted.width - width, candidate.left)),
    top: Math.max(fitted.top, Math.min(fitted.top + fitted.height - height, candidate.top)),
    width,
    height,
  }
}

function handleMapKeydown(event: KeyboardEvent): void {
  switch (event.key) {
    case 'ArrowLeft': panView(-1, 0); break
    case 'ArrowRight': panView(1, 0); break
    case 'ArrowUp': panView(0, -1); break
    case 'ArrowDown': panView(0, 1); break
    case '+':
    case '=': zoomView(zoomStep); break
    case '-': zoomView(1 / zoomStep); break
    case '0': fitPlayerMap(); break
    default: return
  }
  event.preventDefault()
}

function handleWheel(event: WheelEvent): void {
  const svg = mapElement.value
  const transform = svg?.getScreenCTM()
  const anchor = transform
    ? new DOMPoint(event.clientX, event.clientY).matrixTransform(transform.inverse())
    : undefined
  zoomView(event.deltaY < 0 ? zoomStep : 1 / zoomStep, anchor)
}

function startPan(event: PointerEvent): void {
  if (event.button !== 0 || !event.isPrimary || isObjectMarkerTarget(event.target)) return
  const svg = mapElement.value
  const screenMatrix = svg?.getScreenCTM()
  if (!svg || !screenMatrix) return

  const screenToScene = screenMatrix.inverse()
  const start = new DOMPoint(event.clientX, event.clientY).matrixTransform(screenToScene)
  panGesture.value = {
    pointerId: event.pointerId,
    startX: start.x,
    startY: start.y,
    startBounds: { ...currentBounds.value },
    startedAtFit: viewportBounds.value === null,
    screenToScene,
  }
  svg.setPointerCapture(event.pointerId)
  event.preventDefault()
}

function movePan(event: PointerEvent): void {
  const gesture = panGesture.value
  if (!gesture || gesture.pointerId !== event.pointerId) return
  const current = new DOMPoint(event.clientX, event.clientY).matrixTransform(gesture.screenToScene)
  viewportBounds.value = clampViewport({
    left: gesture.startBounds.left - (current.x - gesture.startX),
    top: gesture.startBounds.top - (current.y - gesture.startY),
    width: gesture.startBounds.width,
    height: gesture.startBounds.height,
  }, fittedBounds.value)
}

function finishPan(event: PointerEvent): void {
  if (panGesture.value?.pointerId !== event.pointerId) return
  panGesture.value = null
  releasePanCapture(event.pointerId)
}

function cancelPan(event: PointerEvent): void {
  if (panGesture.value?.pointerId !== event.pointerId) return
  cancelOwnedPan(true)
}

function cancelOwnedPan(restoreStart: boolean): void {
  const gesture = panGesture.value
  if (!gesture) return
  if (restoreStart) viewportBounds.value = gesture.startedAtFit ? null : gesture.startBounds
  panGesture.value = null
  releasePanCapture(gesture.pointerId)
}

function releasePanCapture(pointerId: number): void {
  const svg = mapElement.value
  if (svg?.hasPointerCapture(pointerId)) svg.releasePointerCapture(pointerId)
}

function isObjectMarkerTarget(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest('.player-system-object-marker') !== null
}

function hostLabel(publicHostId: string): string {
  return objectsById.value.get(publicHostId)?.label ?? 'Unknown presence'
}

/** Follows only remapped DTO placement and host references, so private source labels cannot enter the hierarchy. */
function hierarchyPath(object: PlayerObjectMarker): string {
  const path: string[] = []
  const visitedOrbitIds = new Set<string>()
  let placement = object.placement

  while (placement.kind === 'orbit') {
    const orbit = orbitsById.value.get(placement.orbitId)
    if (!orbit || visitedOrbitIds.has(orbit.id)) break
    visitedOrbitIds.add(orbit.id)
    if (orbit.hostId === null) {
      path.push('Orbit around unoccupied center')
      break
    }

    const host = objectsById.value.get(orbit.hostId)
    if (!host) {
      path.push('Orbit around Unknown presence')
      break
    }
    path.push(`Orbit around ${host.label}`)
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
