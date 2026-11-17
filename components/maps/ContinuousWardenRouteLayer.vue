<template>
  <g class="continuous-warden-route-layer" :class="{ 'is-move-enabled': moveEnabled }">
    <g
      v-for="mark in paintedMarks"
      :key="mark.id"
      class="cluster-route"
      :class="{ 'is-unresolved': mark.unresolved, 'is-selected': mark.id === selectedRouteId }"
      :data-route-id="mark.id"
      :aria-label="mark.accessibleLabel"
      :aria-pressed="mark.id === selectedRouteId"
      role="button"
      tabindex="0"
    >
      <path class="cluster-route-line" :d="mark.geometry.path" aria-hidden="true" />
      <path class="cluster-route-hit-target" :d="mark.geometry.path" aria-hidden="true" />
      <g
        v-if="mark.label"
        :transform="`translate(${mark.geometry.midpoint.x} ${mark.geometry.midpoint.y}) scale(${1 / scenePixelScale})`"
        aria-hidden="true"
      >
        <rect
          class="cluster-route-label-bg"
          :x="-mark.label.widthPixels / 2"
          :y="-CONTINUOUS_ROUTE_LABEL_HEIGHT_PIXELS / 2"
          :width="mark.label.widthPixels"
          :height="CONTINUOUS_ROUTE_LABEL_HEIGHT_PIXELS"
          rx="6"
        />
        <text class="cluster-route-label" dy="0.34em">{{ mark.label.text }}</text>
      </g>
      <template v-if="mark.unresolved">
        <circle
          class="cluster-exit-hit-target"
          :cx="mark.geometry.end.x"
          :cy="mark.geometry.end.y"
          :r="12 / scenePixelScale"
          aria-hidden="true"
        />
        <circle
          class="cluster-exit-mark"
          :cx="mark.geometry.end.x"
          :cy="mark.geometry.end.y"
          :r="7 / scenePixelScale"
          aria-hidden="true"
        />
      </template>
    </g>
  </g>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, shallowRef, watch } from 'vue'
import type { Point } from '../../domain/workspace'
import { continuousMapRouteCurve, type ContinuousMapRouteGeometry } from '../../utils/continuous-map-route-geometry'
import { CONTINUOUS_ROUTE_LABEL_HEIGHT_PIXELS, placeContinuousMapRouteLabels } from '../../utils/continuous-map-route-labels'
import { nearestContinuousMapRouteHit } from '../../utils/continuous-map-route-hit'
import type { MapViewport, SvgViewportRect } from '../../utils/map-zoom'

interface RouteMark {
  id: string
  jumpLevel: number
  accessibleLabel: string
  unresolved: boolean
}

const props = defineProps<{
  routes: readonly RouteMark[]
  geometries: ReadonlyMap<string, ContinuousMapRouteGeometry>
  detailSystemIds?: ReadonlySet<string>
  selectedRouteId: string | null
  viewport: MapViewport
  viewportRect: SvgViewportRect
  svgPixelScale: number
  labelObstacles?: readonly SvgViewportRect[]
  moveEnabled?: boolean
}>()

const TRANSITION_DURATION_MS = 140
const animated = shallowRef<ReadonlyMap<string, ContinuousMapRouteGeometry>>(new Map())
let frame: number | undefined

const marks = computed(() => props.routes.flatMap(route => {
  const geometry = animated.value.get(route.id) ?? props.geometries.get(route.id)
  return geometry ? [{ ...route, geometry }] : []
}))
const paintedMarks = computed(() => {
  const labels = placeContinuousMapRouteLabels({
    routes: marks.value,
    selectedRouteId: props.selectedRouteId,
    viewport: props.viewport,
    viewportRect: props.viewportRect,
    svgPixelScale: props.svgPixelScale,
    obstacles: props.labelObstacles,
  })
  return marks.value.map(mark => ({ ...mark, label: labels.get(mark.id) }))
})
const scenePixelScale = computed(() => props.viewport.k * props.svgPixelScale)

function interpolatePoint(from: Point, to: Point, progress: number): Point {
  return { x: from.x + (to.x - from.x) * progress, y: from.y + (to.y - from.y) * progress }
}

function stopAnimation(): void {
  if (frame !== undefined) window.cancelAnimationFrame(frame)
  frame = undefined
  if (animated.value.size) animated.value = new Map()
}

function routeIdAtStroke(event: MouseEvent): string | undefined {
  const stroke = event.target
  if (!(stroke instanceof SVGPathElement) || !stroke.matches('.cluster-route-hit-target')) return
  const layer = stroke.closest('.continuous-warden-route-layer')
  const hits = stroke.ownerDocument.elementsFromPoint(event.clientX, event.clientY)
    .filter(element => element.matches('.cluster-route-hit-target') && element.closest('.continuous-warden-route-layer') === layer)
  if (hits.length < 2) return
  const matrix = stroke.getScreenCTM()
  if (!matrix) return
  const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse())
  const candidates = hits.flatMap((path) => {
    const id = path.closest('.cluster-route')?.getAttribute('data-route-id')
    if (!id) return []
    const geometry = animated.value.get(id) ?? props.geometries.get(id)
    return geometry ? [{ id, geometry }] : []
  })
  return nearestContinuousMapRouteHit(point, candidates, Math.hypot(matrix.a, matrix.b))
}

watch(
  [() => props.geometries, () => props.detailSystemIds],
  ([next, nextDetail], [previous, previousDetail]) => {
    if (nextDetail === previousDetail) return
    const displayed = animated.value
    stopAnimation()
    if (!previousDetail || !nextDetail || typeof window === 'undefined') return
    const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (motionPreference.matches) return

    const motions = [...next].flatMap(([id, to]) => {
      const from = displayed.get(id) ?? previous.get(id)
      return from && from.path !== to.path ? [{ id, from }] : []
    })
    if (!motions.length) return
    animated.value = new Map(motions.map(({ id, from }) => [id, from]))
    const started = window.performance.now()
    function step(now: number): void {
      if (now >= started + TRANSITION_DURATION_MS || motionPreference.matches) {
        stopAnimation()
        return
      }
      const progress = 1 - (1 - Math.max(0, now - started) / TRANSITION_DURATION_MS) ** 3
      // Camera zoom can expand route lanes during a tween. Use each current target
      // with the existing start and deadline so continued zoom never snaps the endpoint.
      const currentTargets = props.geometries
      const frameGeometries = new Map<string, ContinuousMapRouteGeometry>()
      for (const { id, from } of motions) {
        const to = currentTargets.get(id)
        if (!to) continue
        frameGeometries.set(id, continuousMapRouteCurve(
          interpolatePoint(from.start, to.start, progress),
          interpolatePoint(from.control1, to.control1, progress),
          interpolatePoint(from.control2, to.control2, progress),
          interpolatePoint(from.end, to.end, progress),
        ))
      }
      animated.value = frameGeometries
      frame = window.requestAnimationFrame(step)
    }
    frame = window.requestAnimationFrame(step)
  },
)

onBeforeUnmount(stopAnimation)
defineExpose({ routeIdAtStroke })
</script>

<style scoped>
.cluster-route-line,
.cluster-route-hit-target,
.cluster-exit-mark {
  vector-effect: non-scaling-stroke;
}

.cluster-route-line {
  pointer-events: none;
}

.cluster-route-hit-target {
  fill: none;
  stroke: transparent;
  stroke-width: 14;
  pointer-events: stroke;
  cursor: pointer;
}

.cluster-route-label-bg,
.cluster-route-label {
  cursor: pointer;
}

.cluster-route-label {
  font-size: 11px;
}

.cluster-route:focus {
  outline: none;
}

.cluster-route.is-selected .cluster-route-line,
.cluster-route:focus .cluster-route-line,
.cluster-route.is-selected .cluster-exit-mark,
.cluster-route:focus .cluster-exit-mark {
  stroke: var(--map-selected);
  stroke-width: 3;
}

.cluster-route.is-selected .cluster-route-label-bg,
.cluster-route:focus .cluster-route-label-bg {
  stroke: var(--map-selected);
  stroke-width: 1.5;
}

.cluster-exit-hit-target,
.cluster-exit-mark {
  cursor: pointer;
  pointer-events: all;
}

.cluster-exit-hit-target {
  fill: transparent;
}

.is-move-enabled .cluster-exit-hit-target,
.is-move-enabled .cluster-exit-mark {
  cursor: grab;
}
</style>
