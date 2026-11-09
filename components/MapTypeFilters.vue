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
        :aria-label="active ? 'Filters (1 active criterion)' : 'Filters'"
      >
        {{ active ? 'Filters (1)' : 'Filters' }}
      </UButton>

      <template #content="{ close }">
        <div class="map-type-filter-panel grid gap-3 p-3" data-map-obstruction>
          <div class="flex items-center justify-between gap-2">
            <span class="font-semibold">Filters</span>
            <UButton color="neutral" variant="outline" size="sm" @click="close">
              Close filters
            </UButton>
          </div>
          <p v-if="noMatches" class="m-0 text-sm text-muted">No objects match</p>
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
          <div class="flex flex-wrap gap-2">
            <UButton color="neutral" variant="outline" size="sm" :disabled="!active" @click="selectedTypes = []">
              Remove Type
            </UButton>
            <UButton color="neutral" variant="outline" size="sm" :disabled="!active" @click="selectedTypes = []">
              Clear all
            </UButton>
          </div>
        </div>
      </template>
    </UPopover>
    <p v-if="noMatches" class="m-0 text-xs text-muted" role="status">No objects match</p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

withDefaults(defineProps<{
  options: readonly { value: string, label: string }[]
  compact: boolean
  noMatches: boolean
  portal?: boolean
}>(), { portal: true })

const open = defineModel<boolean>('open', { required: true })
const selectedTypes = defineModel<string[]>('selectedTypes', { required: true })
const active = computed(() => selectedTypes.value.length > 0)
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
</script>

<style scoped>
.map-type-filter-panel {
  width: min(22rem, calc(100vw - 1.5rem));
  max-height: min(70dvh, 32rem, var(--reka-popover-content-available-height, 70dvh));
  overflow: auto;
  overscroll-behavior: contain;
  overflow-wrap: anywhere;
}
</style>
