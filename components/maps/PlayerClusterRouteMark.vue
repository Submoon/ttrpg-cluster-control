<template>
  <g
    class="player-cluster-route"
    :class="{ 'player-cluster-route--foreground': props.route.foreground }"
    :pointer-events="props.route.foreground ? 'none' : undefined"
    role="group"
    :aria-label="props.route.accessibleLabel"
  >
    <path class="player-cluster-route-path" :d="props.route.path" />
    <g class="player-cluster-route-level">
      <rect
        :x="props.route.labelX - props.route.labelWidth / 2"
        :y="props.route.labelY - 15"
        :width="props.route.labelWidth"
        height="20"
        rx="2"
      />
      <text :x="props.route.labelX" :y="props.route.labelY" text-anchor="middle">{{ props.route.label }}</text>
    </g>
    <template v-if="props.route.destination">
      <circle
        class="player-cluster-route-unknown-destination"
        :cx="props.route.destination.position.x"
        :cy="props.route.destination.position.y"
        r="8"
      />
      <text
        class="player-cluster-route-unknown-label"
        :x="props.route.destination.position.x + 16"
        :y="props.route.destination.position.y + 5"
      >{{ props.route.destination.label }}</text>
    </template>
  </g>
</template>

<script setup lang="ts">
import type { PlayerRouteGeometry } from '../../utils/player-cluster-geometry'

const props = defineProps<{ route: PlayerRouteGeometry }>()
</script>

<style scoped>
.player-cluster-route { pointer-events: auto; }
.player-cluster-route--foreground,
.player-cluster-route--foreground * { pointer-events: none; }
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
</style>
