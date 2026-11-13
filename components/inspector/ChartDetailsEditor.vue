<template>
  <section class="chart-details-editor flex min-h-0 flex-1 flex-col" aria-label="Jump Cluster details editor">
    <header class="shrink-0 border-b border-[var(--line-soft)] px-4 py-3 sm:px-5">
      <h2 class="mt-2 mb-1 text-2xl">Edit Jump Cluster details</h2>
      <p class="inspector-intro m-0">Editing details for {{ props.targetSystemName || 'the selected star system' }}.</p>
    </header>

    <form
      id="chart-details-form"
      class="chart-details-editor-form flex min-h-0 flex-1 flex-col"
      aria-label="Edit Jump Cluster details"
      novalidate
      @submit.prevent="emit('apply')"
    >
      <div class="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
        <div class="grid gap-4">
          <UFormField label="Jump Cluster" :error="clusterError || undefined" class="grid gap-1.5">
            <UInput
              id="chart-dialog-cluster-name"
              v-model="clusterName"
              maxlength="80"
              autocomplete="off"
            />
            <template #error="{ error }">
              <span v-if="typeof error === 'string' && error" role="alert">{{ error }}</span>
            </template>
          </UFormField>
          <UFormField label="Star system" :error="systemError || undefined" class="grid gap-1.5">
            <UInput
              id="chart-dialog-system-name"
              v-model="systemName"
              maxlength="80"
              autocomplete="off"
            />
            <template #error="{ error }">
              <span v-if="typeof error === 'string' && error" role="alert">{{ error }}</span>
            </template>
          </UFormField>
          <UFormField label="Player-facing title" :error="playerTitleError || undefined" class="grid gap-1.5">
            <UInput
              id="chart-dialog-player-title"
              v-model="playerTitle"
              maxlength="80"
              autocomplete="off"
            />
            <template #error="{ error }">
              <span v-if="typeof error === 'string' && error" role="alert">{{ error }}</span>
            </template>
          </UFormField>
          <section class="grid min-w-0 gap-2" aria-labelledby="chart-dialog-publication-heading">
            <h3 id="chart-dialog-publication-heading" class="m-0 text-sm font-medium">
              How players see this system
            </h3>
            <PublicationModeControl
              :model-value="publication"
              :draft="true"
              presentation-context="system"
              focus-target-id="chart-dialog-publication"
              :described-by="publicationDescribedBy"
              :invalid="Boolean(publicationError)"
              @select="publication = $event"
            />
            <p id="chart-dialog-publication-guidance" class="m-0 text-sm text-[var(--text-muted)]">
              Only Revealed systems can be opened by players. Publishing an object does not reveal its parent system.
            </p>
            <p
              v-if="publicationError"
              id="chart-dialog-publication-error"
              class="feedback m-0 error-text"
              role="alert"
            >
              {{ publicationError }}
            </p>
          </section>
          <UAlert
            v-if="props.formError && !clusterError && !systemError && !playerTitleError && !publicationError"
            color="error"
            variant="subtle"
            :description="props.formError"
            role="alert"
          />
        </div>
      </div>

      <footer class="shrink-0 border-t border-[var(--line-soft)] px-4 py-3 sm:px-5">
        <div class="flex w-full flex-wrap justify-end gap-2">
          <UButton color="neutral" variant="ghost" type="button" @click="emit('discard')">Discard draft</UButton>
          <UButton color="primary" type="submit">Apply details</UButton>
        </div>
      </footer>
    </form>
  </section>
</template>

<script setup lang="ts">
/** Presents the parent-owned chart session inline in the Inspector. */
import { computed, nextTick, onMounted, watch } from 'vue'
import type { PublicationMode } from '../../domain/workspace'

const clusterName = defineModel<string>('clusterName', { required: true })
const systemName = defineModel<string>('systemName', { required: true })
const playerTitle = defineModel<string>('playerTitle', { required: true })
const publication = defineModel<PublicationMode>('publication', { required: true })

const props = defineProps<{
  active: boolean
  formError: string
  targetSystemName?: string
}>()

const emit = defineEmits<{
  apply: []
  discard: []
}>()

const clusterError = computed(() => props.formError.startsWith('Jump Cluster name') ? props.formError : '')
const systemError = computed(() => props.formError.startsWith('Star system name') ? props.formError : '')
const playerTitleError = computed(() => props.formError.startsWith('Player-facing title') ? props.formError : '')
const publicationError = computed(() => props.formError.startsWith('Choose a supported publication mode') ? props.formError : '')
const publicationDescribedBy = computed(() => publicationError.value
  ? 'chart-dialog-publication-guidance chart-dialog-publication-error'
  : 'chart-dialog-publication-guidance')

function fieldToFocus(): string {
  return props.formError.startsWith('Star system name')
    ? 'chart-dialog-system-name'
    : props.formError.startsWith('Player-facing title')
      ? 'chart-dialog-player-title'
      : props.formError.startsWith('Choose a supported publication mode')
        ? 'chart-dialog-publication'
        : 'chart-dialog-cluster-name'
}

async function focusField(): Promise<void> {
  if (!props.active) return
  await nextTick()
  document.getElementById(fieldToFocus())?.focus()
}

onMounted(() => {
  void focusField()
})

watch(() => [props.active, props.formError] as const, ([active, error], [wasActive, previousError]) => {
  if (active && (!wasActive || error !== previousError)) void focusField()
}, { flush: 'post' })

defineExpose({ focusField })
</script>
