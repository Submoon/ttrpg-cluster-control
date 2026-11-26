<template>
  <WorkspaceSearch
    ref="search"
    v-model:open="searchOpen"
    v-model:query="searchQuery"
    title="Search player map"
    description="Find the shared Jump Cluster, a Revealed Zone, or a published map object."
    id-prefix="player-search"
    :results="props.searchResults"
    :reveal="props.revealSearchTarget"
    :can-open-search-shortcut="props.canOpenSearchShortcut"
    :get-shortcut-owning-dialog="props.getShortcutOwningDialog"
  />
  <slot />
  <MapTypeFilters
    v-if="props.showTypeFilters"
    v-model:open="typeFilterOpen"
    v-model:selected-types="selectedTypes"
    v-model:field-conditions="fieldConditions"
    :options="props.typeFilterOptions"
    :field-filter-options="props.fieldFilterOptions"
    :allow-no-value="false"
    :compact="props.compact"
    :portal="!props.embedded"
  />
  <MapFilesPopover v-model:open="filesOpen" :scope="props.fileScope" :portal="!props.embedded">
    <URadioGroup
      v-if="props.scopedImages"
      v-model="imageScope"
      legend="Image area"
      :items="imageScopeItems"
      color="neutral"
      size="sm"
    />
    <div class="grid grid-cols-2 gap-2">
      <UButton
        class="workspace-control justify-center"
        color="neutral"
        variant="outline"
        size="sm"
        :aria-label="`Export ${imageScopeLabel} PNG`"
        @click="exportImage('png')"
      >PNG</UButton>
      <UButton
        class="workspace-control justify-center"
        color="neutral"
        variant="outline"
        size="sm"
        :aria-label="`Export ${imageScopeLabel} SVG`"
        @click="exportImage('svg')"
      >SVG</UButton>
    </div>
    <UCheckbox v-model="printLight" label="Light for printing" />
    <p v-if="props.exportError" class="m-0 break-words text-xs text-error" role="alert">{{ props.exportError }}</p>
  </MapFilesPopover>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { MapImageFormat, MapImagePalette } from '../utils/map-image-export'
import type { MapImageScope } from '../utils/map-image-scope'
import type { FieldCondition, FieldFilterOption } from '../utils/field-filter-matching'
import type { MapObjectTypeOption } from '../utils/map-type-filters'
import type { PlayerSearchTarget } from '../utils/player-search'
import type { SearchResult } from '../utils/workspace-search'
import MapFilesPopover from './MapFilesPopover.vue'
import MapTypeFilters from './MapTypeFilters.vue'
import WorkspaceSearch from './WorkspaceSearch.vue'

const props = defineProps<{
  searchResults: readonly SearchResult<PlayerSearchTarget>[]
  revealSearchTarget: (target: PlayerSearchTarget) => Promise<
    { status: 'revealed' } | { status: 'rejected'; reason: 'stale' | 'unavailable' }
  >
  canOpenSearchShortcut: () => boolean
  getShortcutOwningDialog: () => HTMLElement | null
  fileScope: string
  scopedImages?: boolean
  canExportSystemImage?: boolean
  exportError: string
  embedded?: boolean
  showTypeFilters: boolean
  typeFilterOptions: readonly MapObjectTypeOption[]
  fieldFilterOptions: readonly FieldFilterOption[]
  compact: boolean
}>()
const emit = defineEmits<{ 'export-image': [format: MapImageFormat, palette: MapImagePalette, scope?: MapImageScope] }>()

const searchOpen = defineModel<boolean>('searchOpen', { required: true })
const searchQuery = defineModel<string>('searchQuery', { required: true })
const filesOpen = defineModel<boolean>('filesOpen', { required: true })
const typeFilterOpen = defineModel<boolean>('typeFilterOpen', { required: true })
const selectedTypes = defineModel<string[]>('selectedTypes', { required: true })
const fieldConditions = defineModel<FieldCondition[]>('fieldConditions', { required: true })
const search = ref<{ whenClosingFocusSettled: () => Promise<void> } | null>(null)
const printLight = ref(false)
const requestedScope = ref<MapImageScope>('cluster')
const imageScopeItems = computed<Array<{ label: string; value: MapImageScope; disabled?: boolean }>>(() => [
  { label: 'Entire Cluster', value: 'cluster' },
  { label: 'Selected Zone', value: 'system', disabled: !props.canExportSystemImage },
  { label: 'Current viewport', value: 'viewport' },
])
const imageScope = computed({
  get: () => requestedScope.value === 'system' && !props.canExportSystemImage ? 'cluster' : requestedScope.value,
  set: (scope: MapImageScope) => { requestedScope.value = scope },
})
const imageScopeLabel = computed(() => props.scopedImages
  ? imageScopeItems.value.find(item => item.value === imageScope.value)?.label ?? props.fileScope
  : props.fileScope)

watch(filesOpen, open => {
  if (!open) {
    printLight.value = false
    return
  }
  typeFilterOpen.value = false
})
watch(searchOpen, open => {
  if (open) typeFilterOpen.value = false
})
watch(typeFilterOpen, open => {
  if (!open) return
  searchOpen.value = false
  filesOpen.value = false
})

function exportImage(format: MapImageFormat): void {
  const palette = printLight.value ? 'print-light' : 'active'
  printLight.value = false
  emit('export-image', format, palette, props.scopedImages ? imageScope.value : undefined)
}

function whenSearchClosingFocusSettled(): Promise<void> {
  return search.value?.whenClosingFocusSettled() ?? Promise.resolve()
}

defineExpose({ whenSearchClosingFocusSettled })
</script>
