<template>
  <nav
    v-if="workspace"
    class="workspace-map-chrome"
    aria-label="Map context and commands"
    data-map-obstruction
    :inert="props.compactModalOpen ? true : undefined"
  >
    <div class="workspace-map-context">
      <span>{{ activeView === 'cluster' ? 'Jump Cluster' : 'Star System' }}</span>
      <div class="workspace-map-context-line">
        <h2>{{ contextName }}</h2>
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
    </div>

    <UButton
      v-if="activeView === 'system'"
      class="workspace-control workspace-map-back"
      color="neutral"
      variant="outline"
      size="sm"
      aria-label="Back to Jump Cluster"
      title="Back to Jump Cluster"
      @click="emit('show-cluster')"
    >
      <UIcon name="i-lucide-arrow-left" aria-hidden="true" />
      <span>Back</span>
    </UButton>

    <div class="workspace-map-actions">
      <div class="workspace-map-panel-actions" role="group" aria-label="Map panels">
        <UButton
          class="workspace-control"
          color="neutral"
          :variant="hierarchyOpen ? 'soft' : 'outline'"
          size="sm"
          aria-label="Hierarchy"
          aria-controls="workspace-hierarchy-panel"
          :aria-expanded="hierarchyOpen"
          @click="emit('toggle-hierarchy')"
        >
          Hierarchy
        </UButton>
        <UButton
          class="workspace-control"
          color="neutral"
          :variant="inspectorOpen ? 'soft' : 'outline'"
          size="sm"
          aria-label="Inspect"
          aria-controls="workspace-inspector-panel"
          :aria-expanded="inspectorOpen"
          @click="emit('toggle-inspector')"
        >
          Inspect
        </UButton>
      </div>

      <UPopover
        v-model:open="headerMapActionsOpen"
        :modal="false"
        :content="{ side: 'bottom', align: 'end', sideOffset: 8, collisionPadding: 12 }"
      >
        <UButton
          class="workspace-control workspace-map-files-toggle"
          color="neutral"
          :variant="headerMapActionsOpen ? 'soft' : 'outline'"
          size="sm"
          aria-label="Map files"
          aria-controls="workspace-header-map-files-panel"
          :aria-expanded="headerMapActionsOpen"
          :title="`Map file actions for ${mapFileScope}`"
        >
          <span>Map files</span>
          <UIcon
            :name="headerMapActionsOpen ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
            aria-hidden="true"
          />
        </UButton>

        <template #content>
          <div
            id="workspace-header-map-files-panel"
            class="workspace-map-files-content"
            role="group"
            :aria-label="`Map file actions for ${mapFileScope}`"
            :data-map-obstruction="headerMapActionsOpen ? '' : undefined"
          >
            <p class="workspace-map-files-heading">{{ mapFileScope }}</p>
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
              aria-label="Import JSON copy"
              title="Import JSON copy"
              @click="openJsonImportPicker"
            >
              Import JSON copy
            </UButton>
            <input
              ref="importFileInput"
              class="workspace-map-import-input"
              type="file"
              accept="application/json,.json"
              aria-label="Import map JSON"
              data-testid="map-json-import-input"
              @change="emit('import-file', $event)"
            >

            <p v-if="exportError" class="workspace-map-export-error" role="alert">{{ exportError }}</p>
            <p class="workspace-map-files-note">
              Import JSON creates a separate copy in the current Jump Cluster: {{ workspace.cluster.name }}.
            </p>
          </div>
        </template>
      </UPopover>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { LocalWorkspace, StarSystem } from '../domain/workspace'
import type { SystemCreationSession } from '../composables/editor-workflows/types'
import type { MapImageExporter, MapImageFormat, MapImagePalette } from '../utils/map-image-export'

const props = withDefaults(defineProps<{
  workspace: LocalWorkspace | null
  activeView: 'cluster' | 'system'
  selectedSystem: StarSystem | null | undefined
  clusterMap: MapImageExporter | null
  systemMap: MapImageExporter | null
  exportError: string
  hierarchyOpen?: boolean
  inspectorOpen?: boolean
  compactModalOpen?: boolean
  creationSession?: SystemCreationSession | null
  creationTypeLabel?: string
  clusterAddPresentation?: { label: string; status: string; error?: string } | null
  clusterMovePresentation?: { status: string; error?: string; previewing: boolean } | null
}>(), {
  hierarchyOpen: false,
  inspectorOpen: false,
  compactModalOpen: false,
  creationSession: null,
  creationTypeLabel: 'object',
  clusterAddPresentation: null,
})

const emit = defineEmits<{
  'export-cluster-json': []
  'export-system-json': []
  'export-map-image': [map: MapImageExporter | null, name: string | undefined, kind: 'jump-cluster' | 'star-system', format: MapImageFormat, palette: MapImagePalette]
  'import-file': [event: Event]
  'show-cluster': []
  'toggle-hierarchy': []
  'toggle-inspector': []
  'files-open-change': [open: boolean]
  'quit-add': []
  'confirm-system-move': []
  'cancel-system-move': []
}>()

const headerMapActionsOpen = ref(false)
const printLightForPrinting = ref(false)
const importFileInput = ref<HTMLInputElement | null>(null)
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

watch(headerMapActionsOpen, open => emit('files-open-change', open))
watch(() => props.compactModalOpen, open => {
  if (open) headerMapActionsOpen.value = false
})

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

function openJsonImportPicker(): void {
  importFileInput.value?.click()
  headerMapActionsOpen.value = false
}
</script>

<style scoped>
.workspace-map-chrome {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 0.65rem;
  border: 1px solid var(--line-soft);
  border-radius: 0.35rem;
  padding: 0.5rem 0.65rem;
  background: var(--panel);
  color: var(--text-primary);
}

.workspace-map-context {
  display: grid;
  min-width: 0;
  flex: 1 1 9rem;
  gap: 0.12rem;
}

.workspace-map-context > span,
.workspace-map-files-heading {
  margin: 0;
  color: var(--text-muted);
  font: 0.625rem Consolas, monospace;
  letter-spacing: 0.09em;
  text-transform: uppercase;
}

.workspace-map-context h2 {
  max-width: min(32vw, 28rem);
  margin: 0;
  overflow: hidden;
  font-family: Georgia, serif;
  font-size: 1rem;
  font-weight: 500;
  line-height: 1.1;
  text-overflow: ellipsis;
  white-space: nowrap;
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

.workspace-map-actions,
.workspace-map-panel-actions {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.3rem;
}

.workspace-map-actions {
  justify-content: flex-end;
}

.workspace-map-back {
  flex: 0 0 auto;
}

.workspace-map-files-content {
  position: relative;
  z-index: 60;
  display: grid;
  width: min(22rem, calc(100vw - 1.5rem));
  max-height: min(70vh, 32rem);
  gap: 0.65rem;
  overflow: auto;
  border: 1px solid var(--line);
  border-radius: 0.35rem;
  padding: 0.8rem;
  background: var(--panel-raised);
  color: var(--text-primary);
  box-shadow: 0 0.7rem 2rem rgb(0 0 0 / 35%);
}

.workspace-map-files-exports {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.4rem;
}

.workspace-map-file-button,
.workspace-map-import-button {
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
  .workspace-map-chrome {
    flex-wrap: wrap;
    gap: 0.35rem;
    padding: 0.4rem 0.5rem;
  }

  .workspace-map-context {
    flex: 1 1 8rem;
  }

  .workspace-map-context h2 {
    max-width: min(52vw, 20rem);
    font-size: 0.9rem;
  }

  .workspace-map-actions {
    width: 100%;
    justify-content: space-between;
  }

  .workspace-map-back {
    min-height: 2rem;
  }
}
</style>
