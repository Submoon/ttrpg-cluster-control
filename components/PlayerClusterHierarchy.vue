<template>
  <section class="player-public-hierarchy" aria-label="Visible cluster locations">
    <div class="player-public-panel-heading">
      <span class="section-kicker">PUBLIC NAVIGATION</span>
      <h2>Map locations</h2>
    </div>
    <ul v-if="props.document.systems.length" class="player-public-list">
      <li v-for="system in props.document.systems" :key="system.id">
        <button
          v-if="system.disclosure === 'revealed'"
          class="player-public-list-item player-public-list-item--revealed"
          type="button"
          :aria-pressed="props.selectedSystemId === system.id"
          @click="emit('open-system', system.id)"
        >
          <span>{{ system.label }}</span>
          <span class="player-public-list-note">{{ PLAYER_CLUSTER_HIERARCHY_DISCLOSURE_COPY[system.disclosure] }}</span>
        </button>
        <div
          v-else
          class="player-public-list-item player-public-list-item--static"
          :class="`player-public-list-item--${system.disclosure}`"
          aria-disabled="true"
        >
          <span>{{ system.label }}</span>
          <span class="player-public-list-note">{{ PLAYER_CLUSTER_HIERARCHY_DISCLOSURE_COPY[system.disclosure] }}</span>
        </div>
      </li>
    </ul>
    <p v-else class="empty-copy">No locations are visible to players.</p>
  </section>
</template>

<script setup lang="ts">
import type { PlayerClusterDocument } from '../domain/workspace'
import { PLAYER_CLUSTER_HIERARCHY_DISCLOSURE_COPY } from '../utils/cluster-system-presentation'

const props = defineProps<{ document: PlayerClusterDocument; selectedSystemId: string | null }>()
const emit = defineEmits<{ 'open-system': [publicSystemId: string] }>()
</script>

<style scoped>
.player-public-hierarchy { display: grid; min-width: 0; gap: .5rem; }
.player-public-panel-heading { display: grid; gap: .2rem; }
.player-public-panel-heading h2 { margin: 0; font: 500 1rem Georgia, serif; }
.player-public-list { display: grid; min-width: 0; gap: .25rem; padding: 0; list-style: none; }
.player-public-list-item {
  display: grid;
  width: 100%;
  min-width: 0;
  min-height: 2.55rem;
  gap: .1rem;
  border: 1px solid transparent;
  border-radius: 2px;
  padding: .45rem .55rem;
  background: transparent;
  color: var(--text-secondary);
  text-align: left;
  overflow-wrap: anywhere;
}
.player-public-list-item--revealed { cursor: pointer; }
.player-public-list-item--revealed:hover {
  border-color: var(--line);
  background: var(--panel-raised);
}
.player-public-list-item--revealed:focus-visible {
  outline: 2px solid var(--focus);
  outline-offset: 2px;
}
.player-public-list-item--revealed[aria-pressed="true"] {
  border-color: var(--accent);
  background: var(--accent-soft);
  color: var(--text-primary);
}
.player-public-list-item--unknown { color: var(--text-muted); }
.player-public-list-item--known-type { color: var(--text-secondary); }
.player-public-list-note { color: var(--text-muted); font-size: .72rem; }
</style>
