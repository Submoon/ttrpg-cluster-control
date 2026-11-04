<template>
  <section class="player-public-hierarchy" aria-label="Visible star systems">
    <div class="player-public-panel-heading">
      <span class="section-kicker">PUBLIC NAVIGATION</span>
      <h2>Star systems</h2>
    </div>
    <ul v-if="props.document.systems.length" class="player-public-list">
      <li v-for="system in props.document.systems" :key="system.id">
        <button
          v-if="system.disclosure === 'revealed'"
          class="player-public-list-item"
          type="button"
          :aria-pressed="props.selectedSystemId === system.id"
          @click="emit('open-system', system.id)"
        >
          <span>{{ system.label }}</span>
          <span class="player-public-list-note">Open shared system map</span>
        </button>
        <div v-else class="player-public-list-item player-public-list-item--static">
          <span>{{ system.label }}</span>
          <span class="player-public-list-note">{{ system.disclosure === 'known-type' ? 'Star system' : 'Unknown presence' }}</span>
        </div>
      </li>
    </ul>
    <p v-else class="empty-copy">No star systems are visible to players.</p>
  </section>
</template>

<script setup lang="ts">
import type { PlayerClusterDocument } from '../domain/workspace'

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
  gap: .1rem;
  border: 1px solid var(--line-soft);
  padding: .5rem .55rem;
  background: transparent;
  color: var(--text-primary);
  text-align: left;
  overflow-wrap: anywhere;
}
.player-public-list-item[aria-pressed="true"] { border-color: var(--accent); background: var(--accent-soft); }
.player-public-list-item--static { color: var(--text-secondary); }
.player-public-list-note { color: var(--text-muted); font-size: .72rem; }
</style>
