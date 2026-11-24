<template>
  <!-- Keep all wide hit strokes underneath every visible Orbit stroke. -->
  <template v-for="mark in props.marks" :key="`hit-${mark.id}`">
    <ellipse
      v-if="mark.clip.kind === 'ellipse'"
      class="continuous-warden-orbit-hit-target"
      :data-system-id="props.systemId"
      :data-orbit-id="mark.id"
      :cx="mark.geometry.center.x"
      :cy="mark.geometry.center.y"
      :rx="mark.geometry.rx"
      :ry="mark.geometry.ry"
      :transform="mark.geometry.transform"
      aria-hidden="true"
      focusable="false"
    />
    <template v-else-if="mark.clip.kind === 'arcs'">
      <path
        v-for="(arc, arcIndex) in mark.clip.arcs"
        :key="`${mark.id}-hit-${arcIndex}`"
        class="continuous-warden-orbit-hit-target"
        :data-system-id="props.systemId"
        :data-orbit-id="mark.id"
        :d="arc.path"
        aria-hidden="true"
        focusable="false"
      />
    </template>
  </template>
  <template v-for="mark in props.marks" :key="mark.id">
    <ellipse
      class="orbit-ring continuous-warden-orbit-target"
      :class="{
        'is-selected': props.selectedOrbitId === mark.id,
        'is-clipped': mark.clip.kind !== 'ellipse',
      }"
      :data-system-id="props.systemId"
      :data-orbit-id="mark.id"
      role="button"
      tabindex="0"
      :aria-label="mark.label"
      :cx="mark.geometry.center.x"
      :cy="mark.geometry.center.y"
      :rx="mark.geometry.rx"
      :ry="mark.geometry.ry"
      :transform="mark.geometry.transform"
      @focus="onOrbitTargetFocus(mark.id)"
      @blur="onOrbitTargetBlur(mark.id)"
    />
    <template v-if="mark.clip.kind === 'arcs'">
      <path
        v-for="(arc, arcIndex) in mark.clip.arcs"
        :key="`${mark.id}-visible-${arcIndex}`"
        class="continuous-warden-orbit-visible-arc"
        :class="{
          'is-selected': props.selectedOrbitId === mark.id,
          'is-focused': focusedOrbitId === mark.id,
        }"
        :data-system-id="props.systemId"
        :data-orbit-id="mark.id"
        :d="arc.path"
        :stroke-dashoffset="arc.dashOffset"
        aria-hidden="true"
      />
    </template>
  </template>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { clipWardenOrbitStroke } from '../../utils/continuous-warden-orbit-clip'

interface OrbitPaintGeometry {
  readonly center: { readonly x: number; readonly y: number }
  readonly rx: number
  readonly ry: number
  readonly transform: string
}

type OrbitClip = ReturnType<typeof clipWardenOrbitStroke>

interface OrbitPaintMark {
  readonly id: string
  readonly label: string
  readonly geometry: OrbitPaintGeometry
  readonly clip: OrbitClip
}

const props = defineProps<{
  systemId: string
  marks: readonly OrbitPaintMark[]
  selectedOrbitId: string | null
}>()

const focusedOrbitId = ref<string | null>(null)

function onOrbitTargetFocus(orbitId: string): void {
  focusedOrbitId.value = orbitId
}

function onOrbitTargetBlur(orbitId: string): void {
  if (focusedOrbitId.value === orbitId) focusedOrbitId.value = null
}
</script>

<style scoped>
.continuous-warden-orbit-hit-target {
  fill: none;
  stroke: transparent;
  stroke-width: calc(20 * var(--warden-orbit-screen-pixel, 1px));
  pointer-events: stroke;
  cursor: pointer;
}

.orbit-ring.continuous-warden-orbit-target {
  fill: none;
  stroke: var(--map-orbit);
  stroke-width: calc(2 * var(--warden-orbit-screen-pixel, 1px));
  stroke-dasharray: calc(3 * var(--warden-orbit-screen-pixel, 1px)) calc(6 * var(--warden-orbit-screen-pixel, 1px));
  vector-effect: none;
  pointer-events: stroke;
  cursor: pointer;
}

.continuous-warden-orbit-target:is(.is-selected, :focus) {
  stroke: var(--map-selected);
  stroke-width: calc(3 * var(--warden-orbit-screen-pixel, 1px));
}

.continuous-warden-orbit-target.is-clipped {
  stroke: none;
  pointer-events: none;
}

.continuous-warden-orbit-visible-arc {
  fill: none;
  stroke: var(--map-orbit);
  stroke-width: calc(2 * var(--warden-orbit-screen-pixel, 1px));
  stroke-dasharray: calc(3 * var(--warden-orbit-screen-pixel, 1px)) calc(6 * var(--warden-orbit-screen-pixel, 1px));
  vector-effect: none;
  pointer-events: stroke;
  cursor: pointer;
}

.continuous-warden-orbit-visible-arc:is(.is-selected, .is-focused) {
  stroke: var(--map-selected);
  stroke-width: calc(3 * var(--warden-orbit-screen-pixel, 1px));
}
</style>
