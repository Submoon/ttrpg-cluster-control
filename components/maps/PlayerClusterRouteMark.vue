<template>
  <g
    class="cluster-route player-cluster-route"
    :class="{
      'is-unresolved': Boolean(props.route.destination),
      'player-cluster-route--foreground': props.route.foreground,
    }"
    :font-size="CLUSTER_ROUTE_PRESENTATION.labelFontSize"
    :pointer-events="props.route.foreground ? 'none' : undefined"
    role="group"
    :aria-label="props.route.accessibleLabel"
  >
    <path class="cluster-route-line player-cluster-route-path" :d="props.route.path" />
    <g class="cluster-route-level player-cluster-route-level">
      <rect
        class="cluster-route-label-bg"
        :x="props.route.labelX - props.route.labelWidth / 2"
        :y="props.route.labelY + CLUSTER_ROUTE_PRESENTATION.badge.topOffset"
        :width="props.route.labelWidth"
        :height="CLUSTER_ROUTE_PRESENTATION.badge.height"
        :rx="CLUSTER_ROUTE_PRESENTATION.badge.cornerRadius"
      />
      <text
        class="cluster-route-label"
        :x="props.route.labelX"
        :y="props.route.labelY + CLUSTER_ROUTE_PRESENTATION.badge.textBaselineOffset"
      >{{ props.route.label }}</text>
    </g>
    <template v-if="props.route.destination">
      <circle
        class="cluster-exit-mark player-cluster-route-unknown-destination"
        :cx="props.route.destination.position.x"
        :cy="props.route.destination.position.y"
        :r="CLUSTER_ROUTE_PRESENTATION.endpoint.radius"
      />
      <text
        class="cluster-exit-label player-cluster-route-unknown-label"
        :x="props.route.destination.labelX"
        :y="props.route.destination.labelY"
        text-anchor="end"
      >{{ props.route.destination.label }}</text>
    </template>
  </g>
</template>

<script setup lang="ts">
import type { PlayerRouteGeometry } from '../../utils/player-cluster-geometry'
import { CLUSTER_ROUTE_PRESENTATION } from '../../utils/cluster-route-presentation'

const props = defineProps<{ route: PlayerRouteGeometry }>()
</script>

<style scoped>
.player-cluster-route { cursor: inherit; pointer-events: auto; }
.player-cluster-route .cluster-exit-mark { cursor: inherit; }
.player-cluster-route--foreground,
.player-cluster-route--foreground * { pointer-events: none; }
</style>
