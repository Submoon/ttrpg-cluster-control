<template>
  <section class="player-orbit-inspector" aria-label="Player Orbit details">
    <template v-if="props.orbit">
      <span class="section-kicker">PLAYER-VISIBLE ORBIT</span>
      <h2 v-if="props.workspacePresentation">Orbit</h2>
      <h3 v-else class="mb-1 mt-2 text-base">Orbit</h3>
      <dl class="player-orbit-relationships m-0 grid gap-2">
        <div>
          <dt class="font-semibold">Center</dt>
          <dd class="m-0">{{ centerLabel }}</dd>
        </div>
      </dl>
      <section class="player-orbit-objects" aria-label="Public objects in this Orbit">
        <h3 class="m-0 text-sm font-semibold">Public objects in this Orbit</h3>
        <ul v-if="objects.length" class="player-public-list m-0 grid list-none gap-1 p-0">
          <li v-for="object in objects" :key="object.id">
            <UButton
              class="player-orbit-object-link"
              color="neutral"
              variant="link"
              size="sm"
              :aria-label="`Inspect ${playerObjectPresentation(object).label}`"
              @click="emit('inspect-object', object.id)"
            >
              <span v-if="playerObjectPresentation(object).glyph" aria-hidden="true">
                {{ playerObjectPresentation(object).glyph }}
              </span>
              {{ playerObjectPresentation(object).label }}
              <span v-if="playerObjectPresentation(object).typeLabel" class="player-orbit-object-type">
                {{ playerObjectPresentation(object).typeLabel }}
              </span>
            </UButton>
          </li>
        </ul>
        <p v-else class="empty-copy">No public objects are in this Orbit.</p>
      </section>
    </template>
    <p v-else-if="props.showEmptyPrompt" class="empty-copy">Select a visible Orbit to inspect its public relationships.</p>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { PlayerObjectMarker, PlayerOrbit, PlayerSystemDocument } from '../domain/player-projection'
import { playerObjectPresentation } from '../utils/player-object-presentation'

const props = withDefaults(defineProps<{
  document: PlayerSystemDocument
  orbit: PlayerOrbit | null
  workspacePresentation?: boolean
  showEmptyPrompt?: boolean
}>(), {
  workspacePresentation: false,
  showEmptyPrompt: false,
})
const emit = defineEmits<{ 'inspect-object': [publicObjectId: string] }>()
const objectsById = computed(() => new Map(props.document.objects.map(object => [object.id, object])))
const objects = computed(() => {
  const orbit = props.orbit
  return orbit
    ? props.document.objects.filter(object => object.placement.kind === 'orbit'
      && object.placement.orbitId === orbit.id)
    : []
})
const host = computed<PlayerObjectMarker | null>(() => props.orbit?.hostId
  ? objectsById.value.get(props.orbit.hostId) ?? null
  : null)
const centerLabel = computed(() => props.orbit?.hostId === null
  ? 'Unoccupied center'
  : host.value ? playerObjectPresentation(host.value).label : 'Unknown presence')
</script>

<style scoped>
.player-orbit-inspector { display: grid; min-width: 0; align-content: start; gap: .65rem; }
.player-orbit-inspector h2 { margin: 0; font: 500 1rem Georgia, serif; }
.player-orbit-relationships { overflow-wrap: anywhere; }
.player-orbit-objects { display: grid; min-width: 0; gap: .4rem; }
.player-orbit-object-link { max-width: 100%; white-space: normal; text-align: left; }
.player-orbit-object-type { color: var(--text-muted); font-size: .72rem; }
</style>
