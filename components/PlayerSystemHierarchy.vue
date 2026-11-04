<template>
  <section class="player-public-hierarchy" aria-label="Visible system hierarchy">
    <div v-if="props.workspacePresentation" class="player-public-panel-heading">
      <span class="section-kicker">PUBLIC NAVIGATION</span><h2>Visible objects</h2>
    </div>
    <h3 v-else class="m-0 text-sm font-semibold">Visible objects</h3>
    <ul v-if="props.document.objects.length" class="player-public-list m-0 grid list-none gap-1 p-0">
      <li v-for="entry in entries" :key="entry.object.id">
        <button
          class="player-system-hierarchy-item"
          type="button"
          :aria-pressed="props.selectedObjectId === entry.object.id"
          @click="emit('inspect-object', entry.object.id)"
        >
          <span>{{ entry.object.label }}</span>
          <span v-if="entry.object.disclosure !== 'unknown'" class="player-system-hierarchy-type">
            {{ catalogueSubtypeLabel(entry.object) }}
          </span>
          <span v-if="entry.path" class="player-system-hierarchy-path">{{ entry.path }}</span>
        </button>
      </li>
    </ul>
    <p v-else class="empty-copy">No map objects are visible to players.</p>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { PlayerObjectMarker, PlayerSystemDocument } from '../domain/workspace'
import { catalogueSubtypeLabel } from '../utils/catalogue-labels'

const props = defineProps<{
  document: PlayerSystemDocument
  selectedObjectId: string | null
  workspacePresentation?: boolean
}>()
const emit = defineEmits<{ 'inspect-object': [publicObjectId: string] }>()
const objectsById = computed(() => new Map(props.document.objects.map(object => [object.id, object])))
const orbitsById = computed(() => new Map(props.document.orbits.map(orbit => [orbit.id, orbit])))
const entries = computed(() => props.document.objects.map(object => ({ object, path: hierarchyPath(object) })))

const maximumHostLinks = 8
const maximumHostLabelLength = 80

function summarizeHostLabel(label: string): string {
  if (label.length <= maximumHostLabelLength) return label
  const prefixLength = maximumHostLabelLength - 1
  let prefix = label.slice(0, prefixLength)
  const lastCodeUnit = prefix.charCodeAt(prefix.length - 1)
  const nextCodeUnit = label.charCodeAt(prefix.length)
  if (lastCodeUnit >= 0xD800 && lastCodeUnit <= 0xDBFF && nextCodeUnit >= 0xDC00 && nextCodeUnit <= 0xDFFF) {
    prefix = prefix.slice(0, -1)
  }
  return `${prefix}…`
}

/** Follows only remapped public placement and host references. */
function hierarchyPath(object: PlayerObjectMarker): string {
  const path: string[] = []
  const visitedOrbitIds = new Set<string>()
  let placement = object.placement
  let hostLinks = 0
  while (placement.kind === 'orbit') {
    const orbit = orbitsById.value.get(placement.orbitId)
    if (!orbit || visitedOrbitIds.has(orbit.id)) break
    visitedOrbitIds.add(orbit.id)
    if (orbit.hostId === null) {
      path.push('Orbit around unoccupied center')
      break
    }
    if (hostLinks >= maximumHostLinks) {
      path.push('…')
      break
    }
    const host = objectsById.value.get(orbit.hostId)
    if (!host) {
      path.push('Orbit around Unknown presence')
      break
    }
    path.push(`Orbit around ${summarizeHostLabel(host.label)}`)
    hostLinks += 1
    placement = host.placement
  }
  return path.join(' → ')
}
</script>

<style scoped>
.player-public-hierarchy { display: grid; min-width: 0; gap: .5rem; }
.player-public-panel-heading { display: grid; gap: .2rem; }
.player-public-panel-heading h2 { margin: 0; font: 500 1rem Georgia, serif; }
.player-system-hierarchy-item {
  display: grid;
  width: 100%;
  min-width: 0;
  gap: .1rem;
  border: 1px solid var(--line-soft);
  background: transparent;
  padding: .45rem .55rem;
  color: var(--text-primary);
  text-align: left;
  white-space: normal;
}
.player-system-hierarchy-item > span { min-width: 0; overflow-wrap: anywhere; }
.player-system-hierarchy-item[aria-pressed="true"] { border-color: var(--accent); background: var(--accent-soft); }
.player-system-hierarchy-type,
.player-system-hierarchy-path { color: var(--text-muted); font-size: .72rem; }
.player-system-hierarchy-path { font-size: .68rem; line-height: 1.35; }
</style>
