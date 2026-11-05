<template>
  <section class="grid min-w-0 gap-1.5" :aria-label="sectionLabel">
    <div class="flex min-w-0 flex-wrap items-center justify-between gap-2">
      <span class="section-kicker">{{ sectionLabel.toUpperCase() }}</span>
      <div
        :id="props.focusTargetId"
        role="group"
        :aria-label="sectionLabel"
        :aria-describedby="props.describedBy"
        :aria-invalid="props.invalid ? 'true' : undefined"
        :tabindex="props.focusTargetId ? -1 : undefined"
        class="inline-flex shrink-0 items-center gap-1 rounded-md border border-[var(--line-soft)] bg-[var(--panel-soft)] p-1"
      >
        <UTooltip v-for="mode in publicationModes" :key="mode" :text="controlTitle(mode)">
          <UButton
            :aria-label="`Set visibility to ${publicationPresentation(mode).label}`"
            :aria-pressed="props.modelValue === mode"
            :title="controlTitle(mode)"
            :disabled="props.disabled"
            :color="props.modelValue === mode ? 'primary' : 'neutral'"
            :variant="props.modelValue === mode ? 'soft' : 'ghost'"
            class="size-9 min-h-9 min-w-9 justify-center px-0"
            size="sm"
            type="button"
            @click="emit('select', mode)"
          >
            <UIcon :name="publicationPresentation(mode).icon" class="size-4" aria-hidden="true" />
          </UButton>
        </UTooltip>
      </div>
    </div>
    <p class="m-0 flex items-start gap-1.5 text-xs leading-relaxed text-[var(--text-muted)]" aria-live="polite">
      <UIcon v-if="status.parentBlocked" name="i-lucide-lock-keyhole" aria-hidden="true" class="mt-0.5 shrink-0" />
      <span>{{ status.description }}</span>
    </p>
  </section>
</template>

<script setup lang="ts">
import type { PublicationMode } from '../domain/workspace'
import { publicationModes, publicationPresentation, publicationStatus } from '../utils/publication-presentation'

const props = defineProps<{
  modelValue: PublicationMode
  parentPublication?: PublicationMode
  disabled?: boolean
  draft?: boolean
  focusTargetId?: string
  describedBy?: string
  invalid?: boolean
  presentationContext?: 'object' | 'system'
}>()

const emit = defineEmits<{
  select: [mode: PublicationMode]
}>()

const sectionLabel = computed(() => props.draft ? 'Draft visibility' : 'Configured visibility')
const status = computed(() => publicationStatus(
  props.modelValue,
  props.parentPublication,
  props.draft ? 'draft' : 'configured',
  props.presentationContext,
))

function controlTitle(mode: PublicationMode): string {
  const { description } = publicationStatus(
    mode,
    props.parentPublication,
    props.draft ? 'draft' : 'configured',
    props.presentationContext,
  )
  return `Set visibility to ${publicationPresentation(mode).label}. ${description}`
}
</script>
