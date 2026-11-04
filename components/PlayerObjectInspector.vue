<template>
  <div class="player-object-inspector">
    <section v-if="props.object" class="player-system-object-details" aria-label="Player object details">
      <span class="section-kicker">PLAYER-VISIBLE OBJECT</span>
      <h2 v-if="props.workspacePresentation">{{ props.object.label }}</h2>
      <h3 v-else class="mb-1 mt-2 text-base">{{ props.object.label }}</h3>
      <p v-if="props.object.disclosure !== 'unknown'" class="inspector-intro m-0">
        {{ catalogueSubtypeLabel(props.object) }}
      </p>
      <p v-if="props.object.disclosure === 'revealed' && props.object.playerText" class="inspector-intro m-0 whitespace-pre-wrap">
        {{ props.object.playerText }}
      </p>
      <dl v-if="props.object.disclosure === 'revealed' && props.object.fields.length" class="player-object-fields m-0 grid gap-2" aria-label="Player-visible Fields">
        <div v-for="(field, index) in props.object.fields" :key="`${field.name}:${field.type}:${index}`">
          <dt class="font-semibold">{{ field.name }}</dt>
          <dd class="m-0">{{ field.type }}: {{ field.value }}</dd>
        </div>
      </dl>
      <section v-if="selectedStation" class="player-system-station-association" aria-label="Physical Station association">
        <strong>Physical Station</strong>
        <UButton
          class="player-system-station-link"
          color="neutral"
          variant="link"
          size="sm"
          :aria-label="`Inspect ${selectedStation.label}`"
          @click="emit('inspect-object', selectedStation.id)"
        >{{ selectedStation.label }}</UButton>
      </section>
    </section>
    <p v-else-if="props.showEmptyPrompt" class="empty-copy">Select a visible object to inspect its shared details.</p>

    <section v-if="props.document.orbits.length" class="player-public-orbit-layout grid content-start gap-2" aria-label="Visible Orbit layout">
      <h3 class="m-0 text-sm font-semibold">Orbit layout</h3>
      <ul class="player-public-list m-0 grid list-none gap-1 p-0">
        <li v-for="orbit in props.document.orbits" :key="orbit.id">
          {{ orbit.hostId === null ? 'Orbit around unoccupied center' : `Orbit around ${hostLabel(orbit.hostId)}` }}
        </li>
      </ul>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { PlayerObjectMarker, PlayerSystemDocument } from '../domain/workspace'
import { catalogueSubtypeLabel } from '../utils/catalogue-labels'

const props = defineProps<{
  document: PlayerSystemDocument
  object: PlayerObjectMarker | null
  workspacePresentation?: boolean
  showEmptyPrompt?: boolean
}>()
const emit = defineEmits<{ 'inspect-object': [publicObjectId: string] }>()
const objectsById = computed(() => new Map(props.document.objects.map(object => [object.id, object])))
const selectedStation = computed(() => {
  const object = props.object
  if (object?.disclosure !== 'revealed' || object.family !== 'JumpPoint' || !object.stationId) return null
  const station = objectsById.value.get(object.stationId)
  return station?.disclosure === 'revealed' ? station : null
})

function hostLabel(publicHostId: string): string {
  return summarizeHostLabel(objectsById.value.get(publicHostId)?.label ?? 'Unknown presence')
}

function summarizeHostLabel(label: string): string {
  if (label.length <= 80) return label
  let prefix = label.slice(0, 79)
  if (prefix.charCodeAt(78) >= 0xD800 && prefix.charCodeAt(78) <= 0xDBFF
    && label.charCodeAt(79) >= 0xDC00 && label.charCodeAt(79) <= 0xDFFF) prefix = prefix.slice(0, -1)
  return `${prefix}…`
}
</script>

<style scoped>
.player-object-inspector { display: grid; min-width: 0; gap: .75rem; }
.player-system-object-details { display: grid; min-width: 0; gap: .4rem; overflow-wrap: anywhere; }
.player-system-object-details h2 { margin: 0; font: 500 1rem Georgia, serif; }
.player-system-station-association { display: grid; justify-items: start; gap: .125rem; }
.player-system-station-link { max-width: 100%; white-space: normal; text-align: left; }
.player-public-orbit-layout { min-width: 0; }
.player-public-orbit-layout li { color: var(--text-muted); font-size: .75rem; }
</style>
