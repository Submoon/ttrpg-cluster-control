<template>
  <div class="flex min-w-0 flex-wrap items-center gap-1.5">
    <UPopover
      v-model:open="open"
      :modal="compact"
      :portal="portal"
      :content="popoverContent"
    >
      <UTooltip :text="props.iconOnly ? props.label : undefined">
        <UButton
          class="workspace-control"
          :class="{ 'workspace-map-icon-control': props.iconOnly }"
          color="neutral"
          :variant="open || active ? 'soft' : 'outline'"
          size="sm"
          :aria-label="accessibleLabel"
        >
          <UIcon v-if="props.iconOnly" name="i-lucide-list-filter" aria-hidden="true" />
          <span v-if="!props.iconOnly">{{ active ? `${props.label} (${activeCriterionCount})` : props.label }}</span>
          <span v-else-if="active" class="workspace-map-filter-count" aria-hidden="true">
            {{ activeCriterionCount }}
          </span>
        </UButton>
      </UTooltip>

      <template #content="{ close }">
        <div v-if="props.fieldFilterOptions.length > 0" :id="fieldSelectPortalId" class="relative z-10" />
        <div class="map-type-filter-panel flex flex-col" data-map-obstruction>
          <div class="flex shrink-0 items-center justify-between gap-2 border-b border-default p-3">
            <span class="font-semibold">{{ accessibleLabel }}</span>
            <UButton color="neutral" variant="outline" size="sm" @click="close">
              Close filters
            </UButton>
          </div>
          <div ref="criteriaViewport" class="min-h-0 overflow-y-auto overscroll-contain p-3">
            <div class="grid gap-3">
              <p v-if="props.invalidationNotice" class="m-0 text-sm text-muted" role="status">
                {{ props.invalidationNotice }}
              </p>
              <fieldset v-if="typeGroups.length > 0" class="m-0 grid min-w-0 gap-3 border-0 p-0">
                <legend class="mb-2 font-medium">Type</legend>
                <fieldset
                  v-for="group in typeGroups"
                  :key="group.family ?? 'undisclosed'"
                  class="m-0 grid min-w-0 gap-2 border-0 p-0"
                >
                  <legend class="mb-1 text-xs font-medium text-muted">
                    {{ group.family ? catalogueFamilyLabel(group.family) : 'Undisclosed type' }}
                  </legend>
                  <UCheckbox
                    v-for="option in group.options"
                    :key="option.value"
                    :label="option.label"
                    :aria-label="option.label"
                    :model-value="selectedTypes.includes(option.value)"
                    @update:model-value="toggleType(option.value, $event === true)"
                  />
                </fieldset>
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
                :collision-boundary="criteriaViewport"
              />
            </div>
          </div>
          <div class="flex shrink-0 justify-end border-t border-default p-3">
            <UButton color="neutral" variant="outline" size="sm" :disabled="cannotClearAll" @click="clearAll">
              Clear all
            </UButton>
          </div>
        </div>
      </template>
    </UPopover>
    <p v-if="props.invalidationNotice" class="map-filter-notice m-0 text-xs text-muted" role="status">
      {{ props.invalidationNotice }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import type { PublicationMode } from '../domain/workspace'
import type { FieldCondition, FieldFilterOption } from '../utils/field-filter-matching'
import { catalogueFamilyLabel } from '../utils/catalogue-labels'
import type { MapObjectTypeOption } from '../utils/map-type-filters'
import FieldFilterConditions from './FieldFilterConditions.vue'

const props = withDefaults(defineProps<{
  options: readonly MapObjectTypeOption[]
  compact: boolean
  label?: string
  /** Show only the filter icon and an active count badge in map chrome. */
  iconOnly?: boolean
  allowNoValue?: boolean
  activeFilterCriterionCount?: number
  publicationFilterOptions?: readonly { value: PublicationMode; label: string }[]
  fieldFilterOptions?: readonly FieldFilterOption[]
  invalidationNotice?: string | null
  portal?: boolean
}>(), {
  activeFilterCriterionCount: undefined,
  iconOnly: false,
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
// Keep nested menus above the scrolling criteria and inside the popover's focus scope.
const fieldSelectPortalId = `field-filter-options-${useId()}`
const criteriaViewport = ref<HTMLElement | null>(null)
const typeGroups = computed(() => {
  const groups = new Map<MapObjectTypeOption['family'], MapObjectTypeOption[]>()
  for (const option of props.options) {
    const group = groups.get(option.family)
    if (group) group.push(option)
    else groups.set(option.family, [option])
  }
  return Array.from(groups, ([family, options]) => ({ family, options }))
})
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
  overflow-wrap: anywhere;
}

.map-filter-notice {
  display: -webkit-box;
  max-width: 11rem;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 1;
  overflow-wrap: anywhere;
}

.workspace-map-filter-count {
  display: inline-grid;
  min-width: 1.2rem;
  min-height: 1.2rem;
  place-items: center;
  border: 1px solid var(--focus);
  border-radius: 999px;
  padding: 0 0.2rem;
  background: var(--panel);
  color: var(--focus);
  font-size: 0.7rem;
  font-weight: 700;
  line-height: 1;
}
</style>
