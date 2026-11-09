<template>
  <div class="flex min-w-0 flex-wrap items-center gap-1.5">
    <UPopover
      v-model:open="open"
      :modal="compact"
      :portal="portal"
      :content="popoverContent"
    >
      <UButton
        class="workspace-control"
        color="neutral"
        :variant="open || active ? 'soft' : 'outline'"
        size="sm"
        :aria-label="accessibleLabel"
      >
        {{ active ? `${props.label} (${activeCriterionCount})` : props.label }}
      </UButton>

      <template #content="{ close }">
        <div v-if="props.fieldFilterOptions.length > 0" :id="fieldSelectPortalId" />
        <div class="map-type-filter-panel grid gap-3 p-3" data-map-obstruction>
          <div class="map-type-filter-heading flex items-center justify-between gap-2">
            <span class="font-semibold">{{ accessibleLabel }}</span>
            <UButton color="neutral" variant="outline" size="sm" @click="close">
              Close filters
            </UButton>
          </div>
          <p v-if="noMatches" class="m-0 text-sm text-muted">No objects match</p>
          <p v-if="props.invalidationNotice" class="m-0 text-sm text-muted" role="status">
            {{ props.invalidationNotice }}
          </p>
          <fieldset class="m-0 grid min-w-0 gap-2 border-0 p-0">
            <legend class="mb-2 font-medium">Type</legend>
            <UCheckbox
              v-for="option in options"
              :key="option.value"
              :label="option.label"
              :aria-label="option.label"
              :model-value="selectedTypes.includes(option.value)"
              @update:model-value="toggleType(option.value, $event === true)"
            />
          </fieldset>
          <fieldset v-if="props.publicationFilterOptions.length > 0" class="m-0 grid min-w-0 gap-2 border-0 p-0">
            <legend class="mb-2 font-medium">Publication</legend>
            <UCheckbox
              v-for="option in props.publicationFilterOptions"
              :key="option.value"
              :label="option.label"
              :aria-label="option.label"
              :model-value="selectedPublicationModes.includes(option.value)"
              @update:model-value="togglePublication(option.value, $event === true)"
            />
          </fieldset>
          <FieldFilterConditions
            v-if="props.fieldFilterOptions.length > 0"
            ref="fieldFilters"
            v-model:conditions="fieldConditions"
            :options="props.fieldFilterOptions"
            :allow-no-value="props.allowNoValue"
            :portal="`#${fieldSelectPortalId}`"
          />
          <div class="flex flex-wrap gap-2">
            <UButton color="neutral" variant="outline" size="sm" :disabled="!selectedTypes.length" @click="selectedTypes = []">
              Remove Type
            </UButton>
            <UButton v-if="props.publicationFilterOptions.length > 0" color="neutral" variant="outline" size="sm" :disabled="!selectedPublicationModes.length" @click="selectedPublicationModes = []">
              Remove Publication
            </UButton>
            <UButton color="neutral" variant="outline" size="sm" :disabled="cannotClearAll" @click="clearAll">
              Clear all
            </UButton>
          </div>
        </div>
      </template>
    </UPopover>
    <p v-if="noMatches" class="m-0 text-xs text-muted" role="status">No objects match</p>
    <p v-if="props.invalidationNotice" class="map-filter-notice m-0 text-xs text-muted" role="status">
      {{ props.invalidationNotice }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import type { PublicationMode } from '../domain/workspace'
import type { FieldCondition, FieldFilterOption } from '../utils/field-filter-matching'
import FieldFilterConditions from './FieldFilterConditions.vue'

const props = withDefaults(defineProps<{
  options: readonly { value: string, label: string }[]
  compact: boolean
  noMatches: boolean
  label?: string
  allowNoValue?: boolean
  activeFilterCriterionCount?: number
  publicationFilterOptions?: readonly { value: PublicationMode; label: string }[]
  fieldFilterOptions?: readonly FieldFilterOption[]
  invalidationNotice?: string | null
  portal?: boolean
}>(), {
  activeFilterCriterionCount: undefined,
  label: 'Filters',
  allowNoValue: true,
  publicationFilterOptions: () => [],
  fieldFilterOptions: () => [],
  invalidationNotice: null,
  portal: true,
})

const emit = defineEmits<{
  'clear-all-filters': []
}>()

const open = defineModel<boolean>('open', { required: true })
const selectedTypes = defineModel<string[]>('selectedTypes', { required: true })
const selectedPublicationModes = defineModel<PublicationMode[]>('publicationModes', { default: () => [] })
const fieldConditions = defineModel<FieldCondition[]>('fieldConditions', { default: () => [] })
const fieldFilters = ref<{ clearDrafts: () => void; hasDrafts: boolean } | null>(null)
// Keep nested choices in this popover's focus scope, outside the scrolling criteria.
const fieldSelectPortalId = `field-filter-options-${useId()}`
const activeCriterionCount = computed(() => props.activeFilterCriterionCount
  ?? Number(selectedTypes.value.length > 0)
    + Number(selectedPublicationModes.value.length > 0)
    + fieldConditions.value.length)
const active = computed(() => activeCriterionCount.value > 0)
const accessibleLabel = computed(() => active.value
  ? `${props.label} (${activeCriterionCount.value} active ${activeCriterionCount.value === 1 ? 'criterion' : 'criteria'})`
  : props.label)
const cannotClearAll = computed(() => !active.value && !fieldFilters.value?.hasDrafts)
const popoverContent = {
  side: 'bottom',
  align: 'end',
  sideOffset: 8,
  collisionPadding: 12,
} as const

function toggleType(type: string, checked: boolean): void {
  selectedTypes.value = checked
    ? [...selectedTypes.value, type]
    : selectedTypes.value.filter(value => value !== type)
}

function togglePublication(mode: PublicationMode, checked: boolean): void {
  selectedPublicationModes.value = checked
    ? [...selectedPublicationModes.value, mode]
    : selectedPublicationModes.value.filter(value => value !== mode)
}

function clearAll(): void {
  fieldFilters.value?.clearDrafts()
  if (props.publicationFilterOptions.length > 0) emit('clear-all-filters')
  else {
    selectedTypes.value = []
    fieldConditions.value = []
  }
}
</script>

<style scoped>
.map-type-filter-panel {
  width: min(22rem, calc(100vw - 1.5rem));
  max-height: min(70dvh, 32rem, var(--reka-popover-content-available-height, 70dvh));
  overflow: auto;
  overscroll-behavior: contain;
  overflow-wrap: anywhere;
}

.map-type-filter-heading {
  position: sticky;
  z-index: 1;
  top: 0;
  margin-top: -0.25rem;
  padding-top: 0.25rem;
  padding-bottom: 0.25rem;
  background: var(--panel-bg);
}

.map-filter-notice {
  display: -webkit-box;
  max-width: 11rem;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 1;
  overflow-wrap: anywhere;
}
</style>
