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
    <ul v-if="branchGroups.length" class="player-public-list">
      <li v-for="{ route, branches } in branchGroups" :key="route?.id ?? 'detached'">
        <button v-if="route" type="button" class="player-public-list-item player-public-list-item--revealed" @click="emit('inspect-route', route.id)">
          {{ routeLabel(route) }}
        </button>
        <PlayerSystemHierarchy
          v-for="branch in branches"
          :key="branch.id"
          :document="branch.map"
          :selected-object-id="props.selectedBranchId === branch.id && props.branchSelection?.kind === 'object' ? props.branchSelection.id : null"
          :selected-orbit-id="props.selectedBranchId === branch.id && props.branchSelection?.kind === 'orbit' ? props.branchSelection.id : null"
          :dimmed-object-ids="props.dimmedBranchObjects.get(branch.id) ?? emptyIds"
          branch
          @inspect-object="id => emit('inspect-branch', branch.id, { kind: 'object', id })"
          @inspect-orbit="id => emit('inspect-branch', branch.id, { kind: 'orbit', id })"
        />
      </li>
    </ul>
    <p v-if="!props.document.systems.length && !branchGroups.length" class="empty-copy">No locations are visible to players.</p>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { PlayerClusterDocument, PlayerRoute, PlayerRouteBranch } from '../domain/player-projection'
import type { PlayerInspectionTarget } from '../utils/player-inspection'
import PlayerSystemHierarchy from './PlayerSystemHierarchy.vue'
import { PLAYER_CLUSTER_HIERARCHY_DISCLOSURE_COPY } from '../utils/cluster-system-presentation'

const props = defineProps<{
  document: PlayerClusterDocument
  selectedSystemId: string | null
  selectedBranchId: string | null
  branchSelection: PlayerInspectionTarget | null
  dimmedBranchObjects: ReadonlyMap<string, ReadonlySet<string>>
}>()
const emit = defineEmits<{
  'open-system': [publicSystemId: string]
  'inspect-route': [routeId: string]
  'inspect-branch': [branchId: string, target: PlayerInspectionTarget]
}>()
const emptyIds = new Set<string>()
const branchGroups = computed(() => {
  const byAnchor = new Map<string | null, PlayerRouteBranch[]>()
  for (const branch of props.document.routeBranches) {
    const key = branch.anchor.kind === 'route' ? branch.anchor.routeId : null
    const branches = byAnchor.get(key) ?? []
    branches.push(branch)
    byAnchor.set(key, branches)
  }
  const groups = props.document.routes.flatMap(route => {
    const branches = byAnchor.get(route.id)
    return branches ? [{ route, branches }] : []
  })
  const detached = byAnchor.get(null)
  return [...groups, ...(detached ? [{ route: null, branches: detached }] : [])]
})
const systemLabels = computed(() => new Map(props.document.systems.map(zone => [zone.id, zone.label])))

function routeLabel(route: PlayerRoute): string {
  const origin = systemLabels.value.get(route.fromSystemId)
  const destination = route.destination.kind === 'system'
    ? systemLabels.value.get(route.destination.systemId)
    : route.destination.label
  return `Jump Level ${route.jumpLevel} from ${origin} to ${destination}`
}
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
