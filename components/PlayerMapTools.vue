<template>
  <WorkspaceSearch
    ref="search"
    v-model:open="searchOpen"
    v-model:query="searchQuery"
    title="Search player map"
    description="Find the shared Jump Cluster, a Revealed star system, or a published map object."
    id-prefix="player-search"
    :results="props.searchResults"
    :reveal="props.revealSearchTarget"
    :can-open-search-shortcut="props.canOpenSearchShortcut"
    :get-shortcut-owning-dialog="props.getShortcutOwningDialog"
  />
  <slot />
  <MapFilesPopover v-model:open="filesOpen" :scope="props.fileScope" :portal="!props.embedded">
    <div class="grid grid-cols-2 gap-2">
      <UButton
        class="workspace-control justify-center"
        color="neutral"
        variant="outline"
        size="sm"
        :aria-label="`Export ${props.fileScope} PNG`"
        @click="exportImage('png')"
      >PNG</UButton>
      <UButton
        class="workspace-control justify-center"
        color="neutral"
        variant="outline"
        size="sm"
        :aria-label="`Export ${props.fileScope} SVG`"
        @click="exportImage('svg')"
      >SVG</UButton>
    </div>
    <UCheckbox v-model="printLight" label="Light for printing" />
    <p v-if="props.exportError" class="m-0 break-words text-xs text-error" role="alert">{{ props.exportError }}</p>
  </MapFilesPopover>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import type { MapImageFormat, MapImagePalette } from '../utils/map-image-export'
import type { PlayerSearchTarget } from '../utils/player-search'
import type { SearchResult } from '../utils/workspace-search'
import MapFilesPopover from './MapFilesPopover.vue'
import WorkspaceSearch from './WorkspaceSearch.vue'

const props = defineProps<{
  searchResults: readonly SearchResult<PlayerSearchTarget>[]
  revealSearchTarget: (target: PlayerSearchTarget) => Promise<
    { status: 'revealed' } | { status: 'rejected'; reason: 'stale' | 'unavailable' }
  >
  canOpenSearchShortcut: () => boolean
  getShortcutOwningDialog: () => HTMLElement | null
  fileScope: string
  exportError: string
  embedded?: boolean
}>()
const emit = defineEmits<{ 'export-image': [format: MapImageFormat, palette: MapImagePalette] }>()

const searchOpen = defineModel<boolean>('searchOpen', { required: true })
const searchQuery = defineModel<string>('searchQuery', { required: true })
const filesOpen = defineModel<boolean>('filesOpen', { required: true })
const search = ref<{ whenClosingFocusSettled: () => Promise<void> } | null>(null)
const printLight = ref(false)

watch(filesOpen, open => {
  if (!open) printLight.value = false
})

function exportImage(format: MapImageFormat): void {
  const palette = printLight.value ? 'print-light' : 'active'
  printLight.value = false
  emit('export-image', format, palette)
}

function whenSearchClosingFocusSettled(): Promise<void> {
  return search.value?.whenClosingFocusSettled() ?? Promise.resolve()
}

defineExpose({ whenSearchClosingFocusSettled })
</script>
