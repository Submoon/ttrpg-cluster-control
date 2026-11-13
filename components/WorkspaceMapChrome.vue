<template>
  <UDashboardToolbar
    v-if="workspace"
    as="nav"
    class="workspace-map-chrome"
    :ui="{ left: 'workspace-map-context', right: 'workspace-map-actions' }"
    aria-label="Map context and commands"
    data-map-obstruction
    :inert="props.compactModalOpen ? true : undefined"
  >
    <template #left>
      <div class="workspace-map-context-line">
        <div class="workspace-map-title">
          <UTooltip v-if="activeView === 'system'" text="Back to Jump Cluster">
            <UButton
              class="workspace-control workspace-map-back workspace-map-icon-control"
              color="neutral"
              variant="outline"
              size="sm"
              aria-label="Back to Jump Cluster"
              @click="emit('show-cluster')"
            >
              <UIcon name="i-lucide-arrow-left" aria-hidden="true" />
            </UButton>
          </UTooltip>
          <div class="workspace-map-heading">
            <span data-testid="workspace-map-context-kind">{{ activeView === 'cluster' ? 'Jump Cluster' : 'Star System' }}</span>
            <h2 :aria-labelledby="mapNameLabelId">
              <UPopover
                v-model:open="mapNameDisclosureOpen"
                :modal="false"
                :content="{
                  side: 'bottom', align: 'start', sideOffset: 4, collisionPadding: 12,
                  onOpenAutoFocus: event => event.preventDefault(),
                }"
              >
                <UButton
                  class="workspace-control workspace-map-name-trigger"
                  color="neutral"
                  variant="ghost"
                  size="sm"
                  :aria-label="`${contextName}, show full map name`"
                  :aria-expanded="mapNameDisclosureOpen"
                >
                  <span :id="mapNameLabelId" class="workspace-map-name-text">{{ contextName }}</span>
                  <UIcon name="i-lucide-chevron-down" class="workspace-map-name-disclosure-icon" aria-hidden="true" />
                </UButton>
                <template #content>
                  <div class="workspace-map-name-popover" data-map-obstruction>
                    <p class="workspace-map-full-name">{{ contextName }}</p>
                  </div>
                </template>
              </UPopover>
            </h2>
          </div>
        </div>
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
            aria-label="Confirm system move"
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
            aria-label="Cancel system move"
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
      <slot name="history" />
      <MapTypeFilters
        v-if="activeView === 'system' && selectedSystem"
        :icon-only="true"
        v-model:open="typeFiltersOpen"
        v-model:selected-types="selectedTypes"
        v-model:publication-modes="selectedPublicationModes"
        v-model:field-conditions="fieldConditions"
        :options="props.typeFilterOptions"
        :compact="props.isCompactViewport"
        :active-filter-criterion-count="props.activeFilterCriterionCount"
        :publication-filter-options="props.publicationFilterOptions"
        :field-filter-options="props.fieldFilterOptions"
        :invalidation-notice="props.filterInvalidationNotice"
        @clear-all-filters="emit('clear-all-filters')"
      />
      <p
        v-if="props.filterInvalidationNotice"
        class="workspace-filter-invalidation"
        role="status"
        aria-live="polite"
        :aria-label="props.filterInvalidationNotice"
        :title="props.filterInvalidationNotice"
      >
        Filters updated
      </p>
      <WorkspaceSearch
        ref="workspaceSearch"
        :icon-only="true"
        v-model:open="searchOpen"
        v-model:query="searchQuery"
        :results="props.searchResults"
        :criteria-active="searchActiveCriterionCount > 0"
        :reveal="props.revealSearchTarget"
        :can-open-search-shortcut="props.canOpenSearchShortcut"
      >
        <template #filters>
          <MapTypeFilters
            v-model:open="searchTypeFiltersOpen"
            v-model:selected-types="searchSelectedTypes"
            v-model:publication-modes="searchPublicationModes"
            v-model:field-conditions="searchFieldConditions"
            label="Search filters"
            :options="props.searchTypeFilterOptions ?? props.typeFilterOptions"
            :compact="false"
            :active-filter-criterion-count="searchActiveCriterionCount"
            :publication-filter-options="props.publicationFilterOptions"
            :field-filter-options="props.fieldFilterOptions"
            :invalidation-notice="props.searchFilterInvalidationNotice"
            :portal="false"
            @clear-all-filters="clearSearchCriteria"
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

      <MapFilesPopover
        ref="mapFiles"
        v-model:open="headerMapActionsOpen"
        :scope="mapFileScope"
        :icon-only="true"
        panel-id="workspace-header-map-files-panel"
      >
        <div class="workspace-map-files-exports">
          <UButton
            v-if="activeView === 'cluster'"
            class="workspace-control workspace-map-file-button"
            color="neutral"
            variant="outline"
            size="sm"
            aria-label="Export Jump Cluster JSON"
            title="Export Jump Cluster JSON"
            :disabled="!workspace"
            @click="exportClusterJson"
          >
            Export JSON
          </UButton>
          <UButton
            v-else
            class="workspace-control workspace-map-file-button"
            color="neutral"
            variant="outline"
            size="sm"
            aria-label="Export star system JSON"
            title="Export star system JSON"
            :disabled="!selectedSystem"
            @click="exportSystemJson"
          >
            Export JSON
          </UButton>
          <UButton
            class="workspace-control workspace-map-file-button"
            color="neutral"
            variant="outline"
            size="sm"
            :aria-label="activeView === 'cluster' ? 'Export Jump Cluster PNG' : 'Export star system PNG'"
            :title="activeView === 'cluster' ? 'Export Jump Cluster PNG' : 'Export star system PNG'"
            :disabled="!activeMap"
            @click="exportMapImage('png')"
          >
            PNG
          </UButton>
          <UButton
            class="workspace-control workspace-map-file-button"
            color="neutral"
            variant="outline"
            size="sm"
            :aria-label="activeView === 'cluster' ? 'Export Jump Cluster SVG' : 'Export star system SVG'"
            :title="activeView === 'cluster' ? 'Export Jump Cluster SVG' : 'Export star system SVG'"
            :disabled="!activeMap"
            @click="exportMapImage('svg')"
          >
            SVG
          </UButton>
        </div>

        <slot name="cloud-backup" />

        <section class="workspace-player-exports" aria-label="Player exports">
          <p class="workspace-map-files-heading">Player exports</p>
          <div class="workspace-player-export-actions">
            <UButton
              class="workspace-control workspace-map-file-button"
              color="primary"
              variant="soft"
              size="sm"
              aria-label="Export player JSON"
              title="Export the complete public Jump Cluster JSON"
              :disabled="!workspace"
              @click="emit('export-player-json')"
            >
              Export player JSON
            </UButton>
            <UButton
              class="workspace-control workspace-map-file-button"
              color="primary"
              variant="soft"
              size="sm"
              aria-label="Export player SVG"
              title="Export the current public map as SVG"
              :disabled="!activeMap"
              @click="exportPlayerImage('svg')"
            >
              Export player SVG
            </UButton>
            <UButton
              class="workspace-control workspace-map-file-button"
              color="primary"
              variant="soft"
              size="sm"
              aria-label="Export player PNG"
              title="Export the current public map as PNG"
              :disabled="!activeMap"
              @click="exportPlayerImage('png')"
            >
              Export player PNG
            </UButton>
          </div>
          <PlayerShareControls
            :url="props.generatedPlayerUrl"
            :busy="props.playerLinkBusy"
            :status="props.playerLinkStatus"
            @preview="openPlayerPreview"
            @generate="emit('generate-player-link')"
            @copy="emit('copy-player-link')"
          />
          <a class="workspace-player-reader-link" href="/player" target="_blank" rel="noopener">Open player JSON</a>
          <p v-if="props.playerExportError" class="workspace-map-export-error" role="alert">
            {{ props.playerExportError }}
          </p>
        </section>

        <UCheckbox
          v-model="printLightForPrinting"
          class="workspace-map-print-light"
          label="Light for printing"
        />

        <UButton
          class="workspace-control workspace-map-import-button"
          color="neutral"
          variant="outline"
          size="sm"
          aria-label="Restore a Star System"
          title="Restore a Star System from a standalone JSON file"
          @click="openSystemImportPicker"
        >
          Restore a Star System
        </UButton>
        <UButton
          class="workspace-control workspace-map-import-button"
          color="neutral"
          variant="outline"
          size="sm"
          aria-label="Restore Jump Cluster"
          title="Replace the active Jump Cluster from a complete JSON backup"
          :disabled="props.restoreLoading"
          @click="openClusterRestorePicker"
        >
          Restore Jump Cluster
        </UButton>
        <p v-if="exportError" class="workspace-map-export-error" role="alert">{{ exportError }}</p>
        <p class="workspace-map-files-note">
          Restore a Star System adds an independent copy to {{ workspace.cluster.name }}. Restore Jump Cluster replaces this map after review.
        </p>
      </MapFilesPopover>
      <input
        ref="systemImportFileInput"
        class="workspace-map-import-input"
        type="file"
        accept="application/json,.json"
        aria-label="Choose star system JSON"
        data-testid="map-system-import-input"
        @change="emit('import-file', $event)"
      >
      <input
        ref="clusterRestoreFileInput"
        class="workspace-map-import-input"
        type="file"
        accept="application/json,.json"
        aria-label="Choose Jump Cluster backup JSON"
        data-testid="map-cluster-restore-input"
        @change="emit('restore-file', $event, mapFiles?.triggerElement() ?? null)"
      >
    </template>
  </UDashboardToolbar>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, useId, watch } from 'vue'
import type { LocalWorkspace, StarSystem } from '../domain/workspace'
import type { FieldCondition, FieldFilterOption } from '../utils/field-filter-matching'
import type { MapObjectTypeOption } from '../utils/map-type-filters'
import type { PublicationMode } from '../domain/workspace'
import type { SystemCreationSession } from '../composables/editor-workflows/types'
import type { MapImageExporter, MapImageFormat, MapImagePalette } from '../utils/map-image-export'
import type { SearchResult, SearchTarget } from '../utils/workspace-search'
import MapFilesPopover from './MapFilesPopover.vue'
import WorkspaceSearch from './WorkspaceSearch.vue'
import PlayerShareControls from './PlayerShareControls.vue'
import MapTypeFilters from './MapTypeFilters.vue'

const props = withDefaults(defineProps<{
  workspace: LocalWorkspace | null
  activeView: 'cluster' | 'system'
  selectedSystem: StarSystem | null | undefined
  clusterMap: MapImageExporter | null
  systemMap: MapImageExporter | null
  exportError: string
  restoreLoading?: boolean
  playerExportError: string
  generatedPlayerUrl: string
  playerLinkBusy: boolean
  playerLinkStatus: string
  typeFilterOptions: readonly MapObjectTypeOption[]
  searchTypeFilterOptions?: readonly MapObjectTypeOption[]
  activeFilterCriterionCount?: number
  publicationFilterOptions?: readonly { value: PublicationMode; label: string }[]
  fieldFilterOptions?: readonly FieldFilterOption[]
  filterInvalidationNotice?: string | null
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
  searchActiveCriterionCount?: number
  searchFilterInvalidationNotice?: string | null
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
  publicationFilterOptions: () => [],
  fieldFilterOptions: () => [],
  searchFilterInvalidationNotice: null,
  filterInvalidationNotice: null,
})

const emit = defineEmits<{
  'export-cluster-json': []
  'export-system-json': []
  'export-map-image': [map: MapImageExporter | null, name: string | undefined, kind: 'jump-cluster' | 'star-system', format: MapImageFormat, palette: MapImagePalette]
  'export-player-json': []
  'export-player-image': [format: MapImageFormat, palette: MapImagePalette]
  'preview-player-view': [focusMapFiles: () => void]
  'generate-player-link': []
  'copy-player-link': []
  'import-file': [event: Event]
  'restore-file': [event: Event, returnFocusTarget: HTMLElement | null]
  'show-cluster': []
  'toggle-hierarchy': []
  'toggle-inspector': []
  'files-open-change': [open: boolean]
  'quit-add': []
  'confirm-system-move': []
  'cancel-system-move': []
  'clear-all-filters': []
}>()

const headerMapActionsOpen = ref(false)
const mapFiles = ref<InstanceType<typeof MapFilesPopover> | null>(null)
const mapNameDisclosureOpen = ref(false)
const mapNameLabelId = `workspace-map-name-${useId()}`
const searchOpen = defineModel<boolean>('searchOpen', { required: true })
const searchQuery = defineModel<string>('searchQuery', { required: true })
const searchSelectedTypes = defineModel<string[]>('searchSelectedTypes', { default: () => [] })
const searchPublicationModes = defineModel<PublicationMode[]>('searchPublicationModes', { default: () => [] })
const searchFieldConditions = defineModel<FieldCondition[]>('searchFieldConditions', { default: () => [] })
const typeFiltersOpen = defineModel<boolean>('typeFiltersOpen', { required: true })
const selectedTypes = defineModel<string[]>('selectedTypes', { required: true })
const selectedPublicationModes = defineModel<PublicationMode[]>('publicationModes', { default: () => [] })
const fieldConditions = defineModel<FieldCondition[]>('fieldConditions', { default: () => [] })
const workspaceSearch = ref<{ whenClosingFocusSettled: () => Promise<void> } | null>(null)
const searchTypeFiltersOpen = ref(false)
const searchActiveCriterionCount = computed(() => props.searchActiveCriterionCount
  ?? Number(searchSelectedTypes.value.length > 0)
    + Number(searchPublicationModes.value.length > 0)
    + searchFieldConditions.value.length)
const printLightForPrinting = ref(false)
const systemImportFileInput = ref<HTMLInputElement | null>(null)
const clusterRestoreFileInput = ref<HTMLInputElement | null>(null)
const workspace = computed(() => props.workspace)
const selectedSystem = computed(() => props.selectedSystem)
const activeView = computed(() => props.activeView)
const hierarchyOpen = computed(() => props.hierarchyOpen)
const inspectorOpen = computed(() => props.inspectorOpen)
const contextName = computed(() => activeView.value === 'cluster'
  ? workspace.value?.cluster.name ?? 'Jump Cluster'
  : selectedSystem.value?.name ?? 'Star system')
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
  : `star system ${selectedSystem.value?.name ?? ''}`)
const activeMap = computed(() => activeView.value === 'cluster' ? props.clusterMap : props.systemMap)

watch(contextName, () => { mapNameDisclosureOpen.value = false })

function whenSearchClosingFocusSettled(): Promise<void> {
  return workspaceSearch.value?.whenClosingFocusSettled() ?? Promise.resolve()
}

watch(headerMapActionsOpen, open => emit('files-open-change', open))
watch(searchOpen, open => {
  if (!open) searchTypeFiltersOpen.value = false
})
watch(() => props.compactModalOpen, open => {
  if (open) headerMapActionsOpen.value = false
})

function clearSearchCriteria(): void {
  searchSelectedTypes.value = []
  searchPublicationModes.value = []
  searchFieldConditions.value = []
}

function exportClusterJson(): void {
  headerMapActionsOpen.value = false
  emit('export-cluster-json')
}

function exportSystemJson(): void {
  headerMapActionsOpen.value = false
  emit('export-system-json')
}

function exportMapImage(format: MapImageFormat): void {
  const map = activeMap.value
  const isCluster = activeView.value === 'cluster'
  const name = isCluster ? workspace.value?.cluster.name : selectedSystem.value?.name
  const palette: MapImagePalette = printLightForPrinting.value ? 'print-light' : 'active'
  printLightForPrinting.value = false
  headerMapActionsOpen.value = false
  emit('export-map-image', map, name, isCluster ? 'jump-cluster' : 'star-system', format, palette)
}

function exportPlayerImage(format: MapImageFormat): void {
  const palette: MapImagePalette = printLightForPrinting.value ? 'print-light' : 'active'
  printLightForPrinting.value = false
  emit('export-player-image', format, palette)
}

async function openPlayerPreview(): Promise<void> {
  const files = mapFiles.value
  const workspaceId = props.workspace?.id
  if (!files || !workspaceId || !headerMapActionsOpen.value) return
  headerMapActionsOpen.value = false
  await nextTick()
  await files.whenClosingFocusSettled()
  if (mapFiles.value !== files || props.workspace?.id !== workspaceId || headerMapActionsOpen.value) return
  emit('preview-player-view', files.focusTrigger)
}

function openSystemImportPicker(): void {
  systemImportFileInput.value?.click()
  headerMapActionsOpen.value = false
}

function openClusterRestorePicker(): void {
  clusterRestoreFileInput.value?.click()
  headerMapActionsOpen.value = false
}

defineExpose({ whenSearchClosingFocusSettled })
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
  flex: 1 1 9rem;
  gap: 0.12rem;
}

.workspace-map-heading > span,
.workspace-map-files-heading {
  margin: 0;
  color: var(--text-muted);
  font: 0.625rem Consolas, monospace;
  letter-spacing: 0.09em;
  text-transform: uppercase;
}

.workspace-filter-invalidation {
  display: -webkit-box;
  max-width: 8.5rem;
  margin: 0;
  overflow: hidden;
  color: var(--text-muted);
  font-size: 0.62rem;
  overflow-wrap: anywhere;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

:global(.workspace-map-chrome .workspace-map-context h2) {
  width: 100%;
  min-width: 0;
  max-width: min(52vw, 36rem);
  flex: 1 1 auto;
  margin: 0;
  font-family: Georgia, serif;
  font-size: 1.2rem;
  font-weight: 600;
  line-height: 1.1;
}

.workspace-map-context-line {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.25rem 0.6rem;
}

.workspace-map-title {
  display: flex;
  min-width: 0;
  flex: 0 1 auto;
  flex-wrap: nowrap;
  align-items: flex-end;
  gap: 0.25rem 0.6rem;
}

.workspace-map-heading {
  display: grid;
  min-width: 0;
  flex: 1 1 auto;
  gap: 0.12rem;
}

.workspace-map-name-trigger {
  display: flex;
  width: 100%;
  min-width: 0;
  min-height: 1.5rem;
  max-width: 100%;
  justify-content: flex-start;
  gap: 0.3rem;
  overflow: hidden;
  padding: 0 0.15rem;
  color: inherit;
  font: inherit;
  text-align: left;
}

.workspace-map-name-text {
  display: block;
  min-width: 0;
  flex: 1 1 auto;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.workspace-map-name-disclosure-icon {
  flex: 0 0 auto;
  width: 0.85rem;
  height: 0.85rem;
  color: var(--text-muted);
}

.workspace-map-name-popover {
  max-width: min(30rem, calc(100vw - 2rem));
  border: 1px solid var(--line-soft);
  border-radius: 0.35rem;
  padding: 0.65rem 0.8rem;
  background: var(--panel-raised);
  color: var(--text-primary);
  box-shadow: 0 0.5rem 1.5rem rgb(0 0 0 / 24%);
}

.workspace-map-full-name {
  margin: 0;
  overflow-wrap: anywhere;
  color: var(--text-primary);
  font-size: 0.95rem;
  font-weight: 500;
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

.workspace-map-files-exports {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.4rem;
}

.workspace-player-exports {
  display: grid;
  gap: 0.55rem;
  border-top: 1px solid var(--line-soft);
  padding-top: 0.65rem;
}

.workspace-player-export-actions {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.4rem;
}

.workspace-player-reader-link {
  width: fit-content;
  color: var(--text-secondary);
  font-size: 0.75rem;
  text-decoration: underline;
  text-underline-offset: 0.15em;
}

.workspace-map-file-button,
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

.workspace-map-export-error,
.workspace-map-files-note {
  margin: 0;
  font-size: 0.75rem;
  overflow-wrap: anywhere;
}

.workspace-map-export-error {
  color: var(--color-error, #e88f87);
}

.workspace-map-files-note {
  color: var(--text-muted);
}

@media (max-width: 760px), (max-height: 600px) {
  :global(.workspace-map-chrome) {
    flex-wrap: wrap;
    gap: 0.35rem;
    padding: 0.4rem 0.5rem;
  }

  :global(.workspace-map-chrome .workspace-map-context) {
    flex: 1 1 8rem;
  }

  :global(.workspace-map-chrome .workspace-map-context h2) {
    max-width: 100%;
    font-size: 1.05rem;
  }

  :global(.workspace-map-chrome .workspace-map-actions) {
    width: 100%;
    justify-content: space-between;
  }

  .workspace-map-back {
    min-height: 2.75rem;
  }
}

@media (max-height: 600px) and (min-width: 761px) {
  :global(.workspace-map-chrome) {
    flex-wrap: nowrap;
  }

  :global(.workspace-map-chrome .workspace-map-context h2) {
    max-width: min(30vw, 22rem);
    font-size: 1.05rem;
  }

  :global(.workspace-map-chrome .workspace-map-actions) {
    width: auto;
    flex: 0 1 auto;
  }
}
</style>
