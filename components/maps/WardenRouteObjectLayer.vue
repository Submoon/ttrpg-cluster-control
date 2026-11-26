<template>
  <g
    :transform="`translate(${viewport.x + (offset?.x ?? 0) * viewport.k} ${viewport.y + (offset?.y ?? 0) * viewport.k}) scale(${viewport.k})`"
    :class="preview ? `warden-route-object-${preview}-preview` : undefined"
    :aria-hidden="preview ? true : undefined"
  >
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
      :data-route-object-id="preview ? undefined : object.id"
      :data-owner-route-id="preview ? undefined : routeId"
      :transform="`translate(${point.x} ${point.y}) scale(${markerScale})`"
      :role="preview ? undefined : 'button'"
      :tabindex="preview ? undefined : 0"
      :aria-label="preview ? undefined : `Select ${catalogueObjectLabel(object)}`"
      :aria-pressed="preview ? undefined : object.id === selectedObjectId"
      @focus="focusedObjectId = object.id"
      @blur="focusedObjectId = undefined"
    >
      <title v-if="showDetail || preview">{{ catalogueObjectLabel(object) }}</title>
      <circle
        v-if="object.id === searchLocatorObjectId"
        class="warden-route-object-search-locator"
        data-map-search-locator
        r="20"
        aria-hidden="true"
      />
      <g :opacity="dimmedObjectIds?.has(object.id) ? 0.35 : 1">
        <circle :r="routeObjectMarkerRadiusPixels" class="warden-route-object-marker" aria-hidden="true" />
        <text
          class="warden-route-object-glyph"
          :fill="object.markerColor ?? 'var(--map-text)'"
          text-anchor="middle"
          y="5"
          aria-hidden="true"
        >{{ objectMark(object) }}</text>
        <template v-if="showDetail">
          <text v-if="!props.compactLabels || object.id === selectedObjectId" class="warden-route-object-key" text-anchor="middle" y="27" aria-hidden="true">
            {{ object.locationKey }}
          </text>
          <text v-if="!props.compactLabels || object.id === selectedObjectId" class="warden-route-object-name" text-anchor="middle" y="41" aria-hidden="true">
            {{ object.name }}
          </text>
          <WardenObjectPublicationBadge
            v-if="!preview"
            :identity="`route-object-${routeId}-${object.id}`"
            :mode="object.publication"
            transform="translate(24 -13) scale(1.5)"
          />
        </template>
      </g>
    </g>
  </g>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Point, RouteContents } from '../../domain/workspace'
import { catalogueObjectLabel } from '../../utils/catalogue-labels'
import { objectMark } from '../../utils/catalogue-marks'
import type { ContinuousMapRouteGeometry } from '../../utils/continuous-map-route-geometry'
import type { MapViewport } from '../../utils/map-zoom'
import {
  projectRouteObjects,
  wardenRouteBranchShowsDetail,
  routeObjectIsVisible,
  routeObjectMarkerRadiusPixels,
} from '../../utils/route-object-geometry'
import type { SystemMapGeometry } from '../../utils/system-map-geometry'
import type { SystemObjectBranch } from '../../domain/workspace-object-branch'
import WardenObjectPublicationBadge from './WardenObjectPublicationBadge.vue'

const props = defineProps<{
  routeId: string
  contents: RouteContents
  geometry: ContinuousMapRouteGeometry
  layout: SystemMapGeometry
  viewport: MapViewport
  svgPixelScale: number
  detailZoomPercent?: number
  compactLabels?: boolean
  selectedObjectId?: string
  dimmedObjectIds?: ReadonlySet<string>
  searchLocatorObjectId?: string
  preview?: 'landing' | 'pointer'
  hiddenBranch?: SystemObjectBranch
  visibleBranch?: SystemObjectBranch
  projected?: ReturnType<typeof projectRouteObjects>
  offset?: Point
}>()

const focusedObjectId = ref<string>()
const pixelsPerSceneUnit = computed(() => props.viewport.k * props.svgPixelScale)
const markerScale = computed(() => 1 / Math.max(pixelsPerSceneUnit.value, Number.EPSILON))
const showDetail = computed(() => wardenRouteBranchShowsDetail(props.viewport.k, props.svgPixelScale, props.detailZoomPercent))
const showOrbits = computed(() => props.preview === 'landing' || showDetail.value)
const rootContents = computed(() => ({
  objects: props.contents.objects.filter(object => object.placement.kind === 'route'),
  orbits: [],
}))
const needsOrbitalGeometry = computed(() => showOrbits.value
  || ((props.selectedObjectId !== undefined || focusedObjectId.value !== undefined)
    && props.contents.objects.some(object => object.placement.kind === 'orbit'
      && (object.id === props.selectedObjectId || object.id === focusedObjectId.value))))
const renderedContents = computed(() => needsOrbitalGeometry.value ? props.contents : rootContents.value)
const projection = computed(() => props.projected ?? projectRouteObjects(renderedContents.value, props.geometry, props.layout))
const hiddenObjects = computed(() => new Set(props.hiddenBranch?.objectIds))
const hiddenOrbits = computed(() => new Set(props.hiddenBranch?.orbitIds))
const visibleObjects = computed(() => props.visibleBranch && new Set(props.visibleBranch.objectIds))
const branchOrbits = computed(() => props.visibleBranch && new Set(props.visibleBranch.orbitIds))
const visibleOrbits = computed(() => showOrbits.value
  ? projection.value.orbits.filter(orbit => !hiddenOrbits.value.has(orbit.id)
    && (!branchOrbits.value || branchOrbits.value.has(orbit.id))) : [])
const marks = computed(() => renderedContents.value.objects.flatMap(object => {
  const point = projection.value.positions.get(object.id)
  const showObject = routeObjectIsVisible(object, showOrbits.value, props.selectedObjectId)
    || object.id === focusedObjectId.value
  return point && showObject && !hiddenObjects.value.has(object.id)
    && (!visibleObjects.value || visibleObjects.value.has(object.id))
    ? [{ object, point }]
    : []
}))
</script>

<style scoped>
.warden-route-object { cursor: pointer; }
.warden-route-object-landing-preview { opacity: 0.52; pointer-events: none; }
.warden-route-object-pointer-preview { pointer-events: none; }
.warden-route-object:focus-visible .warden-route-object-marker,
.warden-route-object[aria-pressed="true"] .warden-route-object-marker {
  stroke: var(--map-selection, var(--map-text));
  stroke-width: 3;
}
.warden-route-object-search-locator {
  fill: none;
  pointer-events: none;
  stroke: var(--map-selection, var(--map-text));
  stroke-width: 2;
  stroke-dasharray: 4 3;
}
</style>

<style>
/* Shared with detached Warden SVG export. */
.continuous-warden-map-svg .warden-route-object-orbit {
  fill: none;
  pointer-events: none;
  stroke: var(--map-route-line, var(--map-text));
  stroke-width: 1;
  stroke-dasharray: 4 4;
  vector-effect: non-scaling-stroke;
}
.continuous-warden-map-svg .warden-route-object-marker {
  fill: var(--map-bg, var(--surface));
  stroke: var(--map-text);
  stroke-width: 1.5;
}
.continuous-warden-map-svg .warden-route-object-glyph {
  pointer-events: none;
  font-size: 16px;
}
.continuous-warden-map-svg .warden-route-object-key {
  fill: var(--map-unresolved);
  font: 9px Consolas, monospace;
  pointer-events: none;
}
.continuous-warden-map-svg .warden-route-object-name {
  fill: var(--map-text);
  font: 12px Georgia, serif;
  pointer-events: none;
}
</style>
