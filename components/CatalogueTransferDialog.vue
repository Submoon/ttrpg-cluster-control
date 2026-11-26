<template>
  <UModal
    :open="dialogOpen"
    :transition="false"
    :dismissible="Boolean(props.review) || !props.applying"
    :content="{ onCloseAutoFocus: restoreFocus }"
    :title="title"
    :description="props.review ? 'Review the relationship changes for this landing.' : 'Choose where the object and its hosted branch will land.'"
    @update:open="updateOpen"
  >
    <template #body>
      <div v-if="props.review" ref="reviewBody" class="grid gap-3" tabindex="-1">
        <ul class="grid list-disc gap-2 pl-5" aria-label="Transfer consequences">
          <li v-for="effect in effects" :key="effect">{{ effect }}</li>
        </ul>
        <p v-if="staleReview" class="feedback error-text" role="alert">
          The workspace changed. Start the transfer again to review the current landing.
        </p>
      </div>
      <div v-else-if="props.form" ref="formBody" class="grid gap-3">
        <UFormField :label="landsInZone ? 'Destination Zone' : 'Destination Jump Route'">
          <USelect v-model="destinationId" class="w-full" :items="destinations" :placeholder="landsInZone ? 'Choose a Zone' : 'Choose a Jump Route'" />
        </UFormField>
        <div v-if="landsInZone" class="grid grid-cols-2 gap-3">
          <UFormField label="Local X">
            <UInput v-model="x" type="number" step="any" />
          </UFormField>
          <UFormField label="Local Y">
            <UInput v-model="y" type="number" step="any" />
          </UFormField>
        </div>
        <UFormField v-else label="Position on Jump Route (%)">
          <UInput v-model="percent" type="number" min="0" max="100" step="any" />
        </UFormField>
        <p v-if="props.error" class="feedback error-text" role="alert">{{ props.error }}</p>
        <p v-if="geometryError" class="feedback error-text" role="alert">{{ geometryError }}</p>
        <p v-else-if="proposal" class="m-0 text-sm text-muted">
          {{ proposal.branch.objectIds.length }} objects and {{ proposal.branch.orbitIds.length }} hosted Orbits will move together.
        </p>
      </div>
    </template>
    <template #footer>
      <div class="flex w-full flex-wrap justify-end gap-2">
        <UButton color="neutral" variant="ghost" :disabled="props.applying && !props.review" @click="emit('cancel')">Cancel</UButton>
        <UButton v-if="props.review" :disabled="staleReview" @click="emit('confirm')">Apply transfer</UButton>
        <UButton v-else :disabled="!proposal || props.applying" :loading="props.applying" @click="submit">
          {{ landsInZone ? 'Detach to Zone' : 'Place on Jump Route' }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, toRaw, watch } from 'vue'
import {
  catalogueBranches, routeContentsFor, type CatalogueObjectTransferReview,
  type CatalogueTransferSource, type JumpRoute, type LocalWorkspace,
} from '../domain/workspace'
import { prepareFittedCatalogueObjectTransfer } from '../utils/zone-object-branch'
import { createDialogFocusTarget, restoreDialogFocus } from '../utils/dialog-focus'

const props = defineProps<{
  form: { source: CatalogueTransferSource; rootObjectId: string; destination: 'system' | 'route' } | null
  workspace: LocalWorkspace
  review: CatalogueObjectTransferReview | null
  suspended: boolean
  applying: boolean
  error: string
  opener: HTMLElement | null
  fallbackFocusTarget: HTMLElement | null
  routeSummary: (route: JumpRoute) => string
}>()
const emit = defineEmits<{
  cancel: []
  confirm: []
  submit: [proposal: CatalogueObjectTransferReview]
  'focus-returned': []
}>()

const dialogOpen = computed(() => !props.suspended && Boolean(props.form || props.review))
const landsInZone = computed(() => props.form?.destination === 'system')
const title = computed(() => props.review ? 'Review transfer' : landsInZone.value ? 'Detach from Jump Route' : 'Place on Jump Route')
const reviewBody = ref<HTMLElement | null>(null)
const formBody = ref<HTMLElement | null>(null)
watch(() => props.review, (review, previous) => {
  if (review) reviewBody.value?.focus({ preventScroll: true })
  else if (previous) formBody.value?.querySelector<HTMLElement>('[role="combobox"]')?.focus({ preventScroll: true })
}, { flush: 'post' })

function updateOpen(open: boolean): void {
  if (!open && dialogOpen.value && (!props.applying || props.review)) emit('cancel')
}

function restoreFocus(event: Event): void {
  event.preventDefault()
  if (props.form || props.review || props.suspended) return
  const opener = props.opener
  if (!opener) return
  void nextTick(() => {
    if (dialogOpen.value) return
    restoreDialogFocus(createDialogFocusTarget(opener), createDialogFocusTarget(props.fallbackFocusTarget))
    emit('focus-returned')
  })
}

const destinationId = ref<string>()
type NumericInput = number | string | undefined
const x = ref<NumericInput>(0.5)
const y = ref<NumericInput>(0.5)
const percent = ref<NumericInput>(50)
watch(() => props.form, () => {
  destinationId.value = undefined
  x.value = 0.5
  y.value = 0.5
  percent.value = 50
})

const destinations = computed(() => {
  const { form, workspace } = props
  if (!form) return []
  if (form.destination === 'system') {
    return workspace.cluster.systems.map(zone => ({ value: zone.id, label: zone.name }))
  }

  const sourceRouteId = form.source.kind === 'route' ? form.source.routeId : null
  const sourcePlacement = sourceRouteId === null ? undefined
    : routeContentsFor(workspace.cluster, sourceRouteId)?.objects.find(object => object.id === form.rootObjectId)?.placement
  const routes = workspace.cluster.routes
    .filter(route => route.id !== sourceRouteId || sourcePlacement?.kind === 'orbit')
    .map(route => ({
      value: route.id,
      label: [route.name, props.routeSummary(route)].filter(Boolean).join(' · '),
    }))
  const names = new Map<string, number>()
  for (const route of routes) names.set(route.label, (names.get(route.label) ?? 0) + 1)
  return routes.map((route, index) => names.get(route.label) === 1 ? route
    : { ...route, label: `${route.label} (route ${index + 1})` })
})

function enteredNumber(value: NumericInput): number | null {
  if (value == null || (typeof value === 'string' && value.trim() === '')) return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

const landing = computed(() => {
  const { form, workspace } = props
  const id = destinationId.value
  if (!form || !id) return null
  try {
    if (form.destination === 'system') {
      const localX = enteredNumber(x.value)
      const localY = enteredNumber(y.value)
      if (localX === null || localY === null) return { error: 'Enter both local coordinates.' }
      return { proposal: prepareFittedCatalogueObjectTransfer(workspace, {
        source: form.source,
        rootObjectId: form.rootObjectId,
        landing: { kind: 'system', systemId: id, placement: { kind: 'system', x: localX, y: localY } },
      }) }
    }
    const progress = enteredNumber(percent.value)
    if (progress === null) return { error: 'Enter a position between 0% and 100%.' }
    return { proposal: prepareFittedCatalogueObjectTransfer(workspace, {
      source: form.source,
      rootObjectId: form.rootObjectId,
      landing: { kind: 'route', routeId: id, progression: progress / 100 },
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

function submit(): void {
  if (proposal.value && !props.applying) emit('submit', proposal.value)
}
</script>
