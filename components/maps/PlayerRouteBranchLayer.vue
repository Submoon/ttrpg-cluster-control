<template>
  <g :transform="props.sceneTransform">
    <g v-for="{ branchId, geometry } in layers" :key="branchId" :data-player-branch-id="branchId">
      <ellipse
        v-for="orbit in geometry.orbits.filter(orbit => showDetail || isSelected(branchId, 'orbit', orbit.id))"
        :key="orbit.id"
        class="player-branch-orbit"
        :cx="orbit.center.x"
        :cy="orbit.center.y"
        :rx="orbit.radii.horizontal"
        :ry="orbit.radii.vertical"
        :transform="`rotate(${orbit.rotation} ${orbit.center.x} ${orbit.center.y})`"
        :aria-label="`Inspect ${orbitLabel(geometry, orbit.hostId)}`"
        :aria-pressed="isSelected(branchId, 'orbit', orbit.id)"
        role="button"
        tabindex="0"
        @click.stop="emit('inspect', branchId, { kind: 'orbit', id: orbit.id })"
        @keydown.enter.stop.prevent="emit('inspect', branchId, { kind: 'orbit', id: orbit.id })"
        @keydown.space.stop.prevent="emit('inspect', branchId, { kind: 'orbit', id: orbit.id })"
      />
      <g
        v-for="{ object, point } in geometry.objects.filter(({ object }) =>
          object.placement.kind === 'branch-root' || showDetail || isSelected(branchId, 'object', object.id))"
        :key="object.id"
        class="player-branch-marker"
        :class="{ 'player-branch-marker--dimmed': props.dimmedObjects.get(branchId)?.has(object.id) }"
        :transform="`translate(${point.x} ${point.y}) scale(${markerScale})`"
        :aria-label="`Inspect ${object.label}`"
        :aria-pressed="isSelected(branchId, 'object', object.id)"
        role="button"
        tabindex="0"
        @click.stop="emit('inspect', branchId, { kind: 'object', id: object.id })"
        @keydown.enter.stop.prevent="emit('inspect', branchId, { kind: 'object', id: object.id })"
        @keydown.space.stop.prevent="emit('inspect', branchId, { kind: 'object', id: object.id })"
      >
        <title>{{ object.label }}</title>
        <circle r="12" aria-hidden="true" />
        <text
          v-if="object.disclosure !== 'unknown'"
          :fill="object.markerColor ?? 'var(--map-text)'"
          text-anchor="middle"
          y="4"
          aria-hidden="true"
        >{{ playerObjectPresentation(object).glyph }}</text>
      </g>
    </g>
  </g>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { PlayerRouteBranch } from '../../domain/player-projection'
import type { ContinuousMapRouteGeometry } from '../../utils/continuous-map-route-geometry'
import type { PlayerInspectionTarget } from '../../utils/player-inspection'
import { playerObjectPresentation } from '../../utils/player-object-presentation'
import { playerRouteBranchShowsDetail, projectPlayerRouteBranch } from '../../utils/player-route-branch-geometry'

const props = defineProps<{
  branches: readonly PlayerRouteBranch[]
  curves: ReadonlyMap<string, ContinuousMapRouteGeometry>
  sceneTransform: string
  scenePixelScale: number
  selectedBranchId?: string | null
  selection?: PlayerInspectionTarget | null
  dimmedObjects: ReadonlyMap<string, ReadonlySet<string>>
}>()
const emit = defineEmits<{ inspect: [branchId: string, target: PlayerInspectionTarget] }>()
const showDetail = computed(() => playerRouteBranchShowsDetail(props.scenePixelScale))
const markerScale = computed(() => 1 / Math.max(props.scenePixelScale, Number.EPSILON))
const layers = computed(() => props.branches.flatMap(branch => {
  const geometry = projectPlayerRouteBranch(branch, props.curves)
  return geometry ? [{ branchId: branch.id, geometry }] : []
}))

function isSelected(branchId: string, kind: PlayerInspectionTarget['kind'], entityId: string): boolean {
  return props.selectedBranchId === branchId && props.selection?.kind === kind && props.selection.id === entityId
}

function orbitLabel(geometry: NonNullable<ReturnType<typeof projectPlayerRouteBranch>>, hostId: string | null): string {
  return `Orbit around ${geometry.objects.find(({ object }) => object.id === hostId)?.object.label ?? 'public object'}`
}
</script>

<style scoped>
.player-branch-marker { cursor: pointer; }
.player-branch-marker circle {
  fill: var(--map-bg, var(--surface));
  stroke: var(--map-text);
  stroke-width: 1.5;
}
.player-branch-marker text { font-size: 14px; pointer-events: none; }
.player-branch-marker--dimmed { opacity: .4; }
.player-branch-orbit {
  fill: none;
  stroke: var(--map-route-line, var(--map-text));
  stroke-dasharray: 4 4;
  stroke-width: 2;
  vector-effect: non-scaling-stroke;
  cursor: pointer;
}
.player-branch-marker:focus-visible circle,
.player-branch-marker[aria-pressed="true"] circle,
.player-branch-orbit:focus-visible,
.player-branch-orbit[aria-pressed="true"] {
  stroke: var(--map-selection, var(--map-text));
  stroke-width: 3;
}
</style>
