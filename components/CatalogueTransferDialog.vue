<template>
  <UModal
    :open="Boolean(props.detach || props.review)"
    :title="props.review ? 'Review transfer' : 'Detach from Jump Route'"
    :description="props.review ? 'Review the relationship changes for this landing.' : 'Choose where the object and its hosted branch will land.'"
    @update:open="open => { if (!open) emit('cancel') }"
  >
    <template #body>
      <div v-if="props.review" class="grid gap-3">
        <ul class="grid list-disc gap-2 pl-5" aria-label="Transfer consequences">
          <li v-for="effect in effects" :key="effect">{{ effect }}</li>
        </ul>
        <p v-if="staleReview" class="feedback error-text" role="alert">
          The workspace changed. Start the transfer again to review the current landing.
        </p>
      </div>
      <div v-else-if="props.detach" class="grid gap-3">
        <UFormField label="Destination Zone">
          <USelect v-model="zoneId" class="w-full" :items="destinationZones" placeholder="Choose a Zone" />
        </UFormField>
        <div class="grid grid-cols-2 gap-3">
          <UFormField label="Local X">
            <UInput v-model="x" type="number" step="any" />
          </UFormField>
          <UFormField label="Local Y">
            <UInput v-model="y" type="number" step="any" />
          </UFormField>
        </div>
        <p v-if="geometryError" class="feedback error-text" role="alert">{{ geometryError }}</p>
        <p v-else-if="proposal" class="m-0 text-sm text-muted">
          {{ proposal.branch.objectIds.length }} objects and {{ proposal.branch.orbitIds.length }} hosted Orbits will move together.
        </p>
      </div>
    </template>
    <template #footer>
      <div class="flex w-full flex-wrap justify-end gap-2">
        <UButton color="neutral" variant="ghost" @click="emit('cancel')">Cancel</UButton>
        <UButton v-if="props.review" :disabled="staleReview" @click="emit('confirm')">Apply transfer</UButton>
        <UButton v-else :disabled="!proposal" @click="applyDetach">Detach to Zone</UButton>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import { computed, ref, toRaw, watch } from 'vue'
import { catalogueBranches, type CatalogueObjectTransferReview, type LocalWorkspace } from '../domain/workspace'
import { prepareFittedCatalogueObjectTransfer } from '../utils/zone-object-branch'

const props = defineProps<{
  detach: { routeId: string; objectId: string; workspace: LocalWorkspace } | null
  workspace: LocalWorkspace
  review: CatalogueObjectTransferReview | null
}>()
const emit = defineEmits<{ cancel: []; confirm: []; detach: [proposal: CatalogueObjectTransferReview] }>()

const zoneId = ref<string>()
const x = ref('0.5')
const y = ref('0.5')
watch(() => props.detach, () => {
  zoneId.value = undefined
  x.value = '0.5'
  y.value = '0.5'
})

const destinationZones = computed(() => props.detach?.workspace.cluster.systems.map(zone => ({
  value: zone.id, label: zone.name,
})) ?? [])

const landing = computed(() => {
  const { detach } = props
  if (!detach) return null
  if (detach.workspace !== props.workspace) return { error: 'The workspace changed. Open Detach again to choose a current landing.' }
  if (!zoneId.value) return null
  if (x.value.trim() === '' || y.value.trim() === '') {
    return { error: 'Enter both local coordinates.' }
  }
  try {
    return { proposal: prepareFittedCatalogueObjectTransfer(detach.workspace, {
      source: { kind: 'route', routeId: detach.routeId },
      rootObjectId: detach.objectId,
      landing: { kind: 'system', systemId: zoneId.value, placement: { kind: 'system', x: Number(x.value), y: Number(y.value) } },
    }) }
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) }
  }
})
const proposal = computed(() => landing.value?.proposal)
const geometryError = computed(() => landing.value?.error)

const staleReview = computed(() => props.review !== null && toRaw(props.review.sourceWorkspace) !== toRaw(props.workspace))

const effects = computed(() => {
  const { review } = props
  if (!review) return []
  const { cluster } = review.sourceWorkspace
  const objects = new Map(catalogueBranches(cluster).flatMap(branch => branch.objects.map(object => [object.id, object.name] as const)))
  return [
    ...review.detachedRouteAttachments.map(({ routeId, pointId, end }) => {
      const route = cluster.routes.find(candidate => candidate.id === routeId)
      const name = route?.name || `Jump Route (Level ${route?.jumpLevel})`
      return `Clear ${objects.get(pointId)} from the ${end === 'from' ? 'departure' : 'arrival'} of ${name}.`
    }),
    ...review.clearedStationLinks.map(({ objectId, stationId }) =>
      `Clear the Station link from ${objects.get(objectId)} to ${objects.get(stationId)}.`),
  ]
})

function applyDetach(): void {
  if (proposal.value) emit('detach', proposal.value)
}
</script>
