<template>
  <section class="player-cluster-map" aria-label="Player-visible Jump Cluster map">
    <p v-if="props.document.systems.length === 0" class="player-cluster-map-empty" role="status">
      No star systems are visible to players.
    </p>
    <svg
      v-else
      class="player-cluster-map-scene"
      role="img"
      :aria-label="`${props.document.title} player map`"
      :viewBox="viewBox"
      preserveAspectRatio="xMidYMid meet"
    >
      <g
        v-for="system in props.document.systems"
        :key="system.id"
        class="player-cluster-map-marker"
        :class="`player-cluster-map-marker--${system.disclosure}`"
        role="group"
        :aria-label="system.label"
      >
        <circle :cx="system.position.x" :cy="system.position.y" r="18" />
        <text
          v-if="system.disclosure !== 'unknown'"
          :x="system.position.x + labelOffset.x"
          :y="system.position.y + labelOffset.y"
        >{{ system.label }}</text>
      </g>
    </svg>
    <ul v-if="props.document.systems.length" class="sr-only" aria-label="Visible star system labels">
      <li v-for="system in props.document.systems" :key="system.id">{{ system.label }}</li>
    </ul>
  </section>
</template>

<script setup lang="ts">
/** Draws only an allowlisted player projection; this component never accepts a Warden workspace. */
import { computed } from 'vue'
import type { PlayerClusterDocument } from '../domain/workspace'

const props = defineProps<{ document: PlayerClusterDocument }>()

const bounds = computed(() => {
  const systems = props.document.systems
  if (!systems.length) return { minX: 0, minY: 0, width: 1, height: 1 }

  const labelEnvelopePerCharacter = 24
  const left = Math.min(...systems.map(system => system.position.x))
  const top = Math.min(...systems.map(system => system.position.y))
  const right = Math.max(...systems.map(system => system.disclosure === 'unknown'
    ? system.position.x + 18
    : system.position.x + 28 + system.label.length * labelEnvelopePerCharacter))
  const bottom = Math.max(...systems.map(system => system.position.y + 18))
  const padding = Math.max((right - left) * 0.12, (bottom - top) * 0.18, 56)
  return {
    minX: left - padding,
    minY: top - padding,
    width: right - left + padding * 2,
    height: bottom - top + padding * 2,
  }
})

const viewBox = computed(() => `${bounds.value.minX} ${bounds.value.minY} ${bounds.value.width} ${bounds.value.height}`)
const labelOffset = { x: 28, y: 7 }
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
}

.player-cluster-map-marker circle { stroke-width: 3; }
.player-cluster-map-marker text {
  fill: var(--text-primary);
  font: 20px Georgia, serif;
}
.player-cluster-map-marker--unknown circle {
  fill: var(--map-bg);
  stroke: var(--text-muted);
}
.player-cluster-map-marker--known-type circle {
  fill: var(--text-secondary);
  stroke: var(--text-primary);
}
.player-cluster-map-marker--revealed circle {
  fill: var(--accent, #a9d6b2);
  stroke: var(--text-primary);
}
</style>
