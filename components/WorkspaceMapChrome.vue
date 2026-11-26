<template>
  <UDashboardToolbar
    v-if="workspace"
    as="nav"
    class="workspace-map-chrome"
    :ui="{
      left: hasContextStatus ? 'workspace-map-context' : 'workspace-map-context-empty',
      right: 'workspace-map-actions',
    }"
    aria-label="Map context and commands"
    data-map-obstruction
    :inert="props.compactModalOpen ? true : undefined"
  >
    <template #left>
      <div v-if="hasContextStatus" class="workspace-map-context-line">
        <template v-if="props.creationSession || props.clusterAddPresentation">
          <span class="workspace-add-status" role="status" aria-live="polite">
            {{ props.clusterAddPresentation?.status ?? `ADD ${props.creationTypeLabel} · ${creationProgress}` }}
          </span>
          <UButton
            class="workspace-control workspace-add-quit"
            color="neutral"
            variant="ghost"
            size="xs"
            aria-label="Quit Add and return to Select"
            @click="emit('quit-add')"
          >
            Quit Add
          </UButton>
        </template>
        <template v-else-if="props.clusterMovePresentation">
          <span class="workspace-add-status" role="status" aria-live="polite">
            {{ props.clusterMovePresentation.status }}
          </span>
          <UButton
            v-if="props.clusterMovePresentation.previewing"
            class="workspace-control"
            color="primary"
            variant="solid"
            size="xs"
            aria-label="Confirm Zone move"
            @click="emit('confirm-system-move')"
          >
            Confirm move
          </UButton>
          <UButton
            v-if="props.clusterMovePresentation.previewing"
            class="workspace-control"
            color="neutral"
            variant="outline"
            size="xs"
            aria-label="Cancel Zone move"
            @click="emit('cancel-system-move')"
          >
            Cancel
          </UButton>
        </template>
      </div>
      <p v-if="props.clusterAddPresentation?.error" class="workspace-add-error" role="alert">
        {{ props.clusterAddPresentation.error }}
      </p>
      <p v-else-if="props.clusterMovePresentation?.error" class="workspace-add-error" role="alert">
        {{ props.clusterMovePresentation.error }}
      </p>
    </template>

    <template #right>
      <span class="sr-only" data-testid="workspace-map-context-kind">
        {{ activeView === 'cluster' ? 'Jump Cluster' : 'Zone' }}
      </span>
      <slot name="history" />
      <MapTypeFilters
        v-if="(activeView === 'system' && selectedSystem) || props.continuousMap"
        :icon-only="true"
        v-model:open="typeFiltersOpen"
        :selected-types="mapCriteriaValues.types"
        :publication-modes="mapCriteriaValues.publicationModes"
        :field-conditions="mapCriteriaValues.fieldConditions"
        :options="props.filterCriteria.map.typeOptions.value"
        :compact="props.isCompactViewport"
        :active-filter-criterion-count="props.filterCriteria.map.activeCriterionCount.value"
        :publication-filter-options="props.filterCriteria.publicationFilterOptions.value"
        :field-filter-options="props.filterCriteria.fieldOptions.value"
        @update:selected-types="props.filterCriteria.map.setTypes"
        @update:publication-modes="props.filterCriteria.map.setPublicationModes"
        @update:field-conditions="props.filterCriteria.map.setFieldConditions"
        @clear-all-filters="props.filterCriteria.map.clearAll"
      />
      <WorkspaceSearch
        ref="workspaceSearch"
        :icon-only="true"
        v-model:open="searchOpen"
        v-model:query="searchQuery"
        :results="props.searchResults"
        :criteria-active="props.filterCriteria.search.activeCriterionCount.value > 0"
        :reveal="props.revealSearchTarget"
        :can-open-search-shortcut="props.canOpenSearchShortcut"
      >
        <template #filters>
          <MapTypeFilters
            v-model:open="searchTypeFiltersOpen"
            :selected-types="searchCriteriaValues.types"
            :publication-modes="searchCriteriaValues.publicationModes"
            :field-conditions="searchCriteriaValues.fieldConditions"
            label="Search filters"
            :options="props.filterCriteria.search.typeOptions.value"
            :compact="false"
            :active-filter-criterion-count="props.filterCriteria.search.activeCriterionCount.value"
            :publication-filter-options="props.filterCriteria.publicationFilterOptions.value"
            :field-filter-options="props.filterCriteria.fieldOptions.value"
            :portal="false"
            @update:selected-types="props.filterCriteria.search.setTypes"
            @update:publication-modes="props.filterCriteria.search.setPublicationModes"
            @update:field-conditions="props.filterCriteria.search.setFieldConditions"
            @clear-all-filters="props.filterCriteria.search.clearAll"
          />
        </template>
      </WorkspaceSearch>
      <div class="workspace-map-panel-actions" role="group" aria-label="Map panels">
        <UTooltip text="Hierarchy">
          <UButton
            class="workspace-control workspace-map-icon-control"
            color="neutral"
            :variant="hierarchyOpen ? 'soft' : 'outline'"
            size="sm"
            aria-label="Hierarchy"
            aria-controls="workspace-hierarchy-panel"
            :aria-expanded="hierarchyOpen"
            @click="emit('toggle-hierarchy')"
          >
            <UIcon name="i-lucide-network" aria-hidden="true" />
          </UButton>
        </UTooltip>
        <UTooltip text="Inspect">
          <UButton
            class="workspace-control workspace-map-icon-control"
            color="neutral"
            :variant="inspectorOpen ? 'soft' : 'outline'"
            size="sm"
            aria-label="Inspect"
            aria-controls="workspace-inspector-panel"
            :aria-expanded="inspectorOpen"
            @click="emit('toggle-inspector')"
          >
            <UIcon name="i-lucide-panel-right" aria-hidden="true" />
          </UButton>
        </UTooltip>
      </div>

      <WorkspaceMapFilesMenu
        ref="mapFiles"
        v-model:open="headerMapActionsOpen"
        :workspace-id="workspace.id"
        :scope="mapFileScope"
        :active-view="activeView"
        :continuous-map="props.continuousMap"
        :image-cluster-id="workspace.cluster.id"
        :selected-image-system-id="props.selectedImageSystemId"
        :image-systems="imageSystems"
        :image-available="Boolean(activeMap)"
        :restore-loading="props.restoreLoading"
        :export-error="props.exportError"
        :generated-player-url="props.generatedPlayerUrl"
        :player-link-busy="props.playerLinkBusy"
        :player-link-status="props.playerLinkStatus"
        :player-export-error="props.playerExportError"
        :cloud-backup-items="props.cloudBackupItems"
        :cloud-restore-items="props.cloudRestoreItems"
        :generate-player-link="props.generatePlayerLink"
        @export-cluster-json="emit('export-cluster-json')"
        @export-system-json="emit('export-system-json')"
        @export-warden-image="exportMapImage"
        @export-player-json="emit('export-player-json')"
        @export-player-image="exportPlayerImage"
        @preview-player-view="emit('preview-player-view', $event)"
        @import-system="openSystemImportPicker"
        @restore-cluster="openClusterRestorePicker"
        @copy-player-link="emit('copy-player-link')"
        @files-open-change="emit('files-open-change', $event)"
      />
      <input
        ref="systemImportFileInput"
        class="workspace-map-import-input"
        type="file"
        accept="application/json,.json"
        aria-label="Choose Zone JSON"
        tabindex="-1"
        data-testid="map-system-import-input"
        @change="emit('import-file', $event)"
      >
      <input
        ref="clusterRestoreFileInput"
        class="workspace-map-import-input"
        type="file"
        accept="application/json,.json"
        aria-label="Choose Jump Cluster backup JSON"
        tabindex="-1"
        data-testid="map-cluster-restore-input"
        @change="emit('restore-file', $event, mapFiles?.triggerElement() ?? null)"
      >
    </template>
  </UDashboardToolbar>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { DropdownMenuItem } from '@nuxt/ui'
import type { LocalWorkspace, StarSystem } from '../domain/workspace'
import type { SystemCreationSession } from '../composables/editor-workflows/types'
import type { PlayerLinkGenerationResult } from '../composables/usePlayerFileExports'
import type { WardenFilterControl, WardenFilterCriteriaOwner } from '../composables/useWardenFilterCriteria'
import type { MapImageExporter, MapImageFormat, MapImagePalette } from '../utils/map-image-export'
import type { MapImageScope } from '../utils/map-image-scope'
import type { SearchResult, SearchTarget } from '../utils/workspace-search'
import WorkspaceMapFilesMenu from './workspace-map-files/WorkspaceMapFilesMenu.vue'
import WorkspaceSearch from './WorkspaceSearch.vue'
import MapTypeFilters from './MapTypeFilters.vue'

const props = withDefaults(defineProps<{
  workspace: LocalWorkspace | null
  activeView: 'cluster' | 'system'
  continuousMap?: boolean
  selectedImageSystemId?: string | null
  selectedSystem: StarSystem | null | undefined
  clusterMap: MapImageExporter | null
  systemMap: MapImageExporter | null
  exportError: string
  restoreLoading?: boolean
  playerExportError: string
  generatedPlayerUrl: string
  playerLinkBusy: boolean
  playerLinkStatus: string
  cloudBackupItems?: readonly DropdownMenuItem[]
  cloudRestoreItems?: readonly DropdownMenuItem[]
  generatePlayerLink: () => Promise<PlayerLinkGenerationResult>
  filterCriteria: WardenFilterCriteriaOwner
  isCompactViewport: boolean
  hierarchyOpen?: boolean
  inspectorOpen?: boolean
  compactModalOpen?: boolean
  creationSession?: SystemCreationSession | null
  creationTypeLabel?: string
  clusterAddPresentation?: { label: string; status: string; error?: string } | null
  clusterMovePresentation?: { status: string; error?: string; previewing: boolean } | null
  canOpenSearchShortcut: () => boolean
  searchResults: readonly SearchResult[]
  revealSearchTarget: (target: SearchTarget) => Promise<
    { status: 'revealed' } | { status: 'rejected'; reason: 'guard' | 'stale' | 'unavailable' }
  >
}>(), {
  hierarchyOpen: false,
  inspectorOpen: false,
  compactModalOpen: false,
  creationSession: null,
  creationTypeLabel: 'object',
  clusterAddPresentation: null,
  cloudBackupItems: () => [],
  cloudRestoreItems: () => [],
})

const emit = defineEmits<{
  'export-cluster-json': []
  'export-system-json': []
  'export-map-image': [
    map: MapImageExporter | null,
    kind: 'jump-cluster' | 'star-system',
    format: MapImageFormat,
    palette: MapImagePalette,
    scope: MapImageScope | null,
    selectedSystemId: string | null,
    systemImageTarget: 'inspected' | 'explicit',
  ]
  'export-player-json': []
  'export-player-image': [format: MapImageFormat, palette: MapImagePalette]
  'preview-player-view': [focusMapFiles: () => void]
  'copy-player-link': []
  'import-file': [event: Event]
  'restore-file': [event: Event, returnFocusTarget: HTMLElement | null]
  'toggle-hierarchy': []
  'toggle-inspector': []
  'files-open-change': [open: boolean]
  'quit-add': []
  'confirm-system-move': []
  'cancel-system-move': []
}>()

const headerMapActionsOpen = ref(false)
const mapFiles = ref<InstanceType<typeof WorkspaceMapFilesMenu> | null>(null)
const searchOpen = defineModel<boolean>('searchOpen', { required: true })
const searchQuery = defineModel<string>('searchQuery', { required: true })
const typeFiltersOpen = defineModel<boolean>('typeFiltersOpen', { required: true })
const workspaceSearch = ref<{ whenClosingFocusSettled: () => Promise<void> } | null>(null)
const searchTypeFiltersOpen = ref(false)
function mutableCriteriaValues(control: WardenFilterControl) {
  const criteria = control.criteria.value
  return {
    types: [...criteria.types],
    publicationModes: [...criteria.publicationModes],
    fieldConditions: [...criteria.fieldConditions],
  }
}
const mapCriteriaValues = computed(() => mutableCriteriaValues(props.filterCriteria.map))
const searchCriteriaValues = computed(() => mutableCriteriaValues(props.filterCriteria.search))
const systemImportFileInput = ref<HTMLInputElement | null>(null)
const clusterRestoreFileInput = ref<HTMLInputElement | null>(null)
const workspace = computed(() => props.workspace)
const imageSystems = computed(() => workspace.value?.cluster.systems.map(({ id, name }) => ({ id, name })) ?? [])
const selectedSystem = computed(() => props.selectedSystem)
const activeView = computed(() => props.activeView)
const hierarchyOpen = computed(() => props.hierarchyOpen)
const inspectorOpen = computed(() => props.inspectorOpen)
const hasContextStatus = computed(() => Boolean(
  props.creationSession || props.clusterAddPresentation || props.clusterMovePresentation,
))
const creationProgress = computed(() => {
  const session = props.creationSession
  if (!session) return ''
  if (session.notice) return session.notice
  if (session.preview) return 'Add ready'
  if (session.candidates.length > 1) return 'Choose a named target'
  return 'Choose a target'
})
const mapFileScope = computed(() => activeView.value === 'cluster'
  ? `Jump Cluster ${workspace.value?.cluster.name ?? ''}`
  : `Zone ${selectedSystem.value?.name ?? ''}`)
const activeMap = computed(() => activeView.value === 'cluster' ? props.clusterMap : props.systemMap)

function whenSearchClosingFocusSettled(): Promise<void> {
  return workspaceSearch.value?.whenClosingFocusSettled() ?? Promise.resolve()
}

watch(searchOpen, open => {
  if (!open) searchTypeFiltersOpen.value = false
})
watch(() => props.compactModalOpen, open => {
  if (open) headerMapActionsOpen.value = false
})

function exportMapImage(
  format: MapImageFormat,
  lightForPrinting: boolean,
  imageScope: MapImageScope,
  explicitSystemId: string | null = null,
  systemImageTargetOverride: 'inspected' | 'explicit' = 'inspected',
): void {
  const continuousMap = props.continuousMap ?? false
  const selectedSystemId = continuousMap && imageScope === 'system'
    ? explicitSystemId ?? props.selectedImageSystemId ?? null
    : null
  const systemImageTarget = systemImageTargetOverride
  const selectedImageSystem = selectedSystemId
    ? workspace.value?.cluster.systems.find(system => system.id === selectedSystemId)
    : undefined
  const selectedSystemScope = continuousMap && imageScope === 'system' && selectedImageSystem
  const map = continuousMap ? props.clusterMap : activeMap.value
  const kind = selectedSystemScope || (!continuousMap && activeView.value === 'system')
    ? 'star-system'
    : 'jump-cluster'
  const palette: MapImagePalette = lightForPrinting ? 'print-light' : 'active'
  emit('export-map-image', map, kind, format, palette, continuousMap ? imageScope : null, selectedSystemId, systemImageTarget)
}

function exportPlayerImage(format: MapImageFormat, lightForPrinting: boolean): void {
  const palette: MapImagePalette = lightForPrinting ? 'print-light' : 'active'
  emit('export-player-image', format, palette)
}

function openSystemImportPicker(): void {
  systemImportFileInput.value?.click()
  headerMapActionsOpen.value = false
}

function openClusterRestorePicker(): void {
  clusterRestoreFileInput.value?.click()
  headerMapActionsOpen.value = false
}

function mapFilesTriggerElement(): HTMLElement | null {
  return mapFiles.value?.triggerElement() ?? null
}

function closeMapFilesForDialog(): Promise<boolean> {
  return mapFiles.value?.closeForDialog() ?? Promise.resolve(false)
}

defineExpose({ whenSearchClosingFocusSettled, mapFilesTriggerElement, closeMapFilesForDialog })
</script>

<style scoped>
:global(.workspace-map-chrome) {
  position: relative;
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 0.65rem;
  overflow: visible;
  border: 1px solid var(--line-soft);
  border-radius: 0.35rem;
  padding: 0.5rem 0.65rem;
  background: var(--panel);
  color: var(--text-primary);
}

:global(.workspace-map-chrome .workspace-map-context) {
  display: grid;
  min-width: 0;
  flex: 0 1 auto;
  gap: 0.12rem;
}

:global(.workspace-map-chrome .workspace-map-context-empty) {
  display: none;
}

.workspace-map-files-heading {
  margin: 0;
  color: var(--text-muted);
  font: 0.625rem Consolas, monospace;
  letter-spacing: 0.09em;
  text-transform: uppercase;
}

.workspace-map-context-line {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.25rem 0.6rem;
}

.workspace-add-status {
  min-width: 0;
  color: var(--text-secondary);
  font: 0.625rem Consolas, monospace;
  overflow-wrap: anywhere;
}

.workspace-add-quit { flex: 0 0 auto; }

.workspace-add-error {
  margin: 0;
  color: var(--color-error, #e88f87);
  font-size: 0.7rem;
  overflow-wrap: anywhere;
}

:global(.workspace-map-chrome .workspace-map-actions),
.workspace-map-panel-actions {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.3rem;
}

:global(.workspace-map-chrome .workspace-map-actions) {
  justify-content: flex-end;
}

.workspace-map-back {
  flex: 0 0 auto;
}

:global(.workspace-map-icon-control) {
  min-width: 2.75rem;
  min-height: 2.75rem;
  justify-content: center;
  padding-inline: 0.55rem;
}

:global(.workspace-map-icon-control.workspace-control) {
  font-size: 1.125rem;
}

:global(.workspace-map-import-button) {
  min-width: 0;
  justify-content: center;
  overflow-wrap: anywhere;
}

.workspace-map-import-input {
  position: fixed;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  clip-path: inset(50%);
  white-space: nowrap;
}

@media (max-width: 760px), (max-height: 600px) {
  :global(.workspace-map-chrome) {
    flex-wrap: wrap;
    gap: 0.35rem;
    padding: 0.4rem 0.5rem;
  }

  :global(.workspace-map-chrome .workspace-map-context) {
    flex: 0 1 auto;
  }

  :global(.workspace-map-chrome .workspace-map-actions) {
    width: auto;
    justify-content: flex-end;
  }

  .workspace-map-back {
    min-height: 2.75rem;
  }
}

@media (max-height: 600px) and (min-width: 761px) {
  :global(.workspace-map-chrome) {
    flex-wrap: nowrap;
  }

  :global(.workspace-map-chrome .workspace-map-actions) {
    width: auto;
    flex: 0 1 auto;
  }
}
</style>
