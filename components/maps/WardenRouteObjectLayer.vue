<template>
  <g :transform="`translate(${viewport.x} ${viewport.y}) scale(${viewport.k})`">
    <ellipse
      v-for="orbit in visibleOrbits"
      :key="orbit.id"
      class="warden-route-object-orbit"
      :cx="orbit.center.x"
      :cy="orbit.center.y"
      :rx="orbit.horizontal"
      :ry="orbit.vertical"
      :transform="`rotate(${orbit.rotation} ${orbit.center.x} ${orbit.center.y})`"
      aria-hidden="true"
    />
    <g
      v-for="{ object, point } in marks"
      :key="object.id"
      class="warden-route-object"
      :class="{ 'is-dimmed': dimmedObjectIds?.has(object.id) }"
      :data-route-object-id="object.id"
      :data-owner-route-id="routeId"
      :transform="`translate(${point.x} ${point.y}) scale(${markerScale})`"
      role="button"
      tabindex="0"
      :aria-label="`Select ${catalogueObjectLabel(object)}`"
      :aria-pressed="object.id === selectedObjectId"
      @focus="focusedObjectId = object.id"
      @blur="focusedObjectId = undefined"
    >
      <title>{{ catalogueObjectLabel(object) }}</title>
      <circle
        v-if="object.id === searchLocatorObjectId"
        class="warden-route-object-search-locator"
        data-map-search-locator
        r="20"
        aria-hidden="true"
      />
      <g :opacity="dimmedObjectIds?.has(object.id) ? 0.35 : 1">
        <circle r="14" class="warden-route-object-marker" aria-hidden="true" />
        <text
          class="warden-route-object-glyph"
          :fill="object.markerColor ?? 'var(--map-text)'"
          text-anchor="middle"
          y="5"
          aria-hidden="true"
        >{{ objectMark(object) }}</text>
      </g>
    </g>
  </g>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { RouteContents } from '../../domain/workspace'
import { catalogueObjectLabel } from '../../utils/catalogue-labels'
import { objectMark } from '../../utils/catalogue-marks'
import type { ContinuousMapRouteGeometry } from '../../utils/continuous-map-route-geometry'
import type { MapViewport } from '../../utils/map-zoom'
import { projectRouteObjects } from '../../utils/route-object-geometry'
import type { SystemMapGeometry } from '../../utils/system-map-geometry'
import { CONTINUOUS_MAP_SYSTEM_SCALE } from '../../utils/continuous-map-projection'

const props = defineProps<{
  routeId: string
  contents: RouteContents
  geometry: ContinuousMapRouteGeometry
  layout: SystemMapGeometry
  viewport: MapViewport
  svgPixelScale: number
  selectedObjectId?: string
  dimmedObjectIds?: ReadonlySet<string>
  searchLocatorObjectId?: string
}>()

const focusedObjectId = ref<string>()
const projection = computed(() => projectRouteObjects(props.contents, props.geometry, props.layout))
const pixelsPerSceneUnit = computed(() => props.viewport.k * props.svgPixelScale)
const markerScale = computed(() => 1 / Math.max(pixelsPerSceneUnit.value, Number.EPSILON))
const showDetail = computed(() => pixelsPerSceneUnit.value * CONTINUOUS_MAP_SYSTEM_SCALE >= 0.65)
const visibleOrbits = computed(() => showDetail.value ? projection.value.orbits : [])
const marks = computed(() => props.contents.objects.flatMap(object => {
  const point = projection.value.positions.get(object.id)
  return point && (object.placement.kind === 'route' || showDetail.value
    || object.id === props.selectedObjectId || object.id === focusedObjectId.value)
    ? [{ object, point }]
    : []
}))
</script>

<style scoped>
.warden-route-object { cursor: pointer; }
.warden-route-object-orbit {
  fill: none;
  pointer-events: none;
  stroke: var(--map-route-line, var(--map-text));
  stroke-width: 1;
  stroke-dasharray: 4 4;
  vector-effect: non-scaling-stroke;
}
.warden-route-object-marker {
  fill: var(--map-bg, var(--surface));
  stroke: var(--map-text);
  stroke-width: 1.5;
}
.warden-route-object:focus-visible .warden-route-object-marker,
.warden-route-object[aria-pressed="true"] .warden-route-object-marker {
  stroke: var(--map-selection, var(--map-text));
  stroke-width: 3;
}
.warden-route-object-glyph {
  pointer-events: none;
  font-size: 16px;
}
.warden-route-object-search-locator {
  fill: none;
  pointer-events: none;
  stroke: var(--map-selection, var(--map-text));
  stroke-width: 2;
  stroke-dasharray: 4 3;
}
</style>
