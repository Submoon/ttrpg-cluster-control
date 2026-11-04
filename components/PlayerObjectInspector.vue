<template>
  <div class="player-object-inspector">
    <section v-if="props.object" class="player-system-object-details" aria-label="Player object details">
      <span class="section-kicker">PLAYER-VISIBLE OBJECT</span>
      <h2 v-if="props.workspacePresentation">{{ presentation.label }}</h2>
      <h3 v-else class="mb-1 mt-2 text-base">{{ presentation.label }}</h3>
      <p v-if="presentation.typeLabel" class="inspector-intro m-0">
        {{ presentation.typeLabel }}
      </p>
      <p v-if="props.object.disclosure === 'revealed' && props.object.playerText" class="inspector-intro m-0 whitespace-pre-wrap">
        {{ props.object.playerText }}
      </p>
      <dl v-if="props.object.disclosure === 'revealed' && props.object.fields.length" class="player-object-fields m-0 grid gap-2" aria-label="Player-visible Fields">
        <div v-for="(field, index) in props.object.fields" :key="`${field.name}:${field.type}:${index}`">
          <dt class="font-semibold">{{ field.name }}</dt>
          <dd class="m-0">{{ field.value }}</dd>
        </div>
      </dl>
      <p v-if="hasNoPublishedDetails" class="player-inspector-empty-detail empty-copy">
        {{ props.object.disclosure === 'unknown' ? 'No further details are shared.' : 'No additional text or Fields were shared.' }}
      </p>

      <section v-if="placementOrbit" class="player-object-relationship" aria-label="Public placement relationship">
        <strong>Placed in</strong>
        <UButton
          class="player-object-relationship-link"
          color="neutral"
          variant="link"
          size="sm"
          :aria-label="`Inspect ${orbitLabel(placementOrbit)}`"
          @click="emit('inspect-orbit', placementOrbit.id)"
        >{{ orbitLabel(placementOrbit) }}</UButton>
      </section>

      <section v-if="hostedOrbits.length" class="player-object-relationship" aria-label="Hosted public Orbits">
        <strong>Hosted Orbits</strong>
        <UButton
          v-for="orbit in hostedOrbits"
          :key="orbit.id"
          class="player-object-relationship-link"
          color="neutral"
          variant="link"
          size="sm"
          :aria-label="`Inspect ${orbitLabel(orbit)}`"
          @click="emit('inspect-orbit', orbit.id)"
        >{{ orbitLabel(orbit) }}</UButton>
      </section>

      <section v-if="selectedStation" class="player-system-station-association" aria-label="Physical Station association">
        <strong>Physical Station</strong>
        <UButton
          class="player-system-station-link"
          color="neutral"
          variant="link"
          size="sm"
          :aria-label="`Inspect ${playerObjectPresentation(selectedStation).label}`"
          @click="emit('inspect-object', selectedStation.id)"
        >{{ playerObjectPresentation(selectedStation).label }}</UButton>
      </section>
    </section>
    <p v-else-if="props.showEmptyPrompt" class="empty-copy">Select a visible object to inspect its shared details.</p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { PlayerObjectMarker, PlayerOrbit, PlayerSystemDocument } from '../domain/player-projection'
import { playerObjectPresentation } from '../utils/player-object-presentation'
import { summarizePlayerContextLabel } from '../utils/player-system-hierarchy'

const props = withDefaults(defineProps<{
  document: PlayerSystemDocument
  object: PlayerObjectMarker | null
  workspacePresentation?: boolean
  showEmptyPrompt?: boolean
}>(), {
  workspacePresentation: false,
  showEmptyPrompt: false,
})
const emit = defineEmits<{
  'inspect-object': [publicObjectId: string]
  'inspect-orbit': [publicOrbitId: string]
}>()
const objectsById = computed(() => new Map(props.document.objects.map(object => [object.id, object])))
const presentation = computed(() => props.object
  ? playerObjectPresentation(props.object)
  : { glyph: null, label: '', typeLabel: null })
const hasNoPublishedDetails = computed(() => {
  const object = props.object
  return Boolean(object && (object.disclosure !== 'revealed'
    || (!object.playerText.trim() && object.fields.length === 0)))
})
const placementOrbit = computed<PlayerOrbit | null>(() => {
  const placement = props.object?.placement
  if (placement?.kind !== 'orbit') return null
  return props.document.orbits.find(orbit => orbit.id === placement.orbitId) ?? null
})
const hostedOrbits = computed(() => {
  const object = props.object
  return object ? props.document.orbits.filter(orbit => orbit.hostId === object.id) : []
})
const selectedStation = computed(() => {
  const object = props.object
  if (object?.disclosure !== 'revealed' || object.family !== 'JumpPoint' || !object.stationId) return null
  const station = objectsById.value.get(object.stationId)
  return station?.disclosure === 'revealed' ? station : null
})

function orbitLabel(orbit: PlayerOrbit): string {
  if (orbit.hostId === null) return 'Orbit around unoccupied center'
  const host = objectsById.value.get(orbit.hostId)
  return `Orbit around ${summarizePlayerContextLabel(host
    ? playerObjectPresentation(host).label
    : 'Unknown presence')}`
}
</script>

<style scoped>
.player-object-inspector { display: grid; min-width: 0; gap: .75rem; }
.player-system-object-details { display: grid; min-width: 0; gap: .4rem; overflow-wrap: anywhere; }
.player-system-object-details h2 { margin: 0; font: 500 1rem Georgia, serif; }
.player-inspector-empty-detail { margin: 0; }
.player-object-relationship,
.player-system-station-association { display: grid; justify-items: start; gap: .125rem; }
.player-object-relationship-link,
.player-system-station-link { max-width: 100%; white-space: normal; text-align: left; }
</style>
