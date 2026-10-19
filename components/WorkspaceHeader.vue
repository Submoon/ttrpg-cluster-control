<template>
  <header class="workspace-header" :inert="props.compactModalOpen ? true : undefined">
    <div class="workspace-header-brand" aria-label="TTRPG Cluster Control">
      <span class="workspace-header-mark" aria-hidden="true">✦</span>
      <span class="workspace-header-wordmark">TTRPG Cluster Control</span>
      <span class="workspace-header-local">LOCAL ONLY</span>
    </div>

    <div class="workspace-header-context">
      <section
        v-if="workspace"
        class="workspace-header-summary cluster-stamp"
        aria-label="Active Jump Cluster summary"
      >
        <span class="workspace-header-eyebrow">ACTIVE JUMP CLUSTER</span>
        <h1 class="workspace-summary-name">{{ workspace.cluster.name }}</h1>
        <div class="header-summary-stats" aria-label="Jump Cluster contents">
          <span><strong>{{ workspace.cluster.systems.length }}</strong> SYSTEMS</span>
          <span><strong>{{ workspace.cluster.routes.length }}</strong> ROUTES</span>
          <span><strong>{{ jumpPointCount }}</strong> JUMP POINTS</span>
        </div>
      </section>

      <section
        v-if="selectedSystem"
        class="workspace-header-summary system-stamp"
        :aria-label="activeView === 'system' ? 'Active Star System summary' : 'Selected Star System summary'"
      >
        <span class="workspace-header-eyebrow">{{ activeView === 'system' ? 'ACTIVE STAR SYSTEM' : 'SELECTED STAR SYSTEM' }}</span>
        <h2 class="workspace-summary-name">{{ selectedSystem.name }}</h2>
        <div class="header-summary-stats" aria-label="Star System contents">
          <span><strong>{{ starCount }}</strong> STARS</span>
          <span><strong>{{ selectedSystem.objects.length }}</strong> OBJECTS</span>
          <span><strong>{{ selectedSystem.orbits.length }}</strong> ORBITS</span>
        </div>
      </section>

      <p v-else-if="!workspace" class="workspace-header-empty">A local map workspace</p>
    </div>

    <div class="workspace-header-actions">
      <nav v-if="workspace" class="workspace-header-map-actions" aria-label="Workspace controls">
        <UButton
          v-if="activeView === 'system'"
          class="workspace-control workspace-header-control"
          color="neutral"
          variant="outline"
          size="sm"
          aria-label="Back to Jump Cluster"
          title="Back to Jump Cluster"
          @click="emit('show-cluster')"
        >
          <span aria-hidden="true">←</span>
          <span>Back</span>
        </UButton>

        <UButton
          class="workspace-control workspace-header-control"
          color="neutral"
          :variant="hierarchyOpen ? 'soft' : 'outline'"
          size="sm"
          :aria-expanded="hierarchyOpen"
          aria-controls="workspace-hierarchy-panel"
          @click="emit('toggle-hierarchy')"
        >
          Hierarchy
        </UButton>

        <UButton
          class="workspace-control workspace-header-control"
          color="neutral"
          :variant="inspectorOpen ? 'soft' : 'outline'"
          size="sm"
          :aria-expanded="inspectorOpen"
          aria-controls="workspace-inspector-panel"
          @click="emit('toggle-inspector')"
        >
          Inspect
        </UButton>

        <UPopover
          v-model:open="headerMapActionsOpen"
          :modal="false"
          :content="{ side: 'bottom', align: 'end', sideOffset: 8, collisionPadding: 12 }"
        >
          <UButton
            class="workspace-control workspace-header-control header-map-actions-toggle"
            color="neutral"
            :variant="headerMapActionsOpen ? 'soft' : 'outline'"
            size="sm"
            :aria-label="`${headerMapActionsOpen ? 'Close' : 'Open'} map file actions for ${mapFileScope}`"
            aria-controls="workspace-header-map-files-panel"
            :aria-expanded="headerMapActionsOpen"
            :title="`Map file actions for ${mapFileScope}`"
          >
            <span>Map files</span>
            <span class="header-map-actions-indicator" aria-hidden="true">{{ headerMapActionsOpen ? '−' : '+' }}</span>
          </UButton>

          <template #content>
            <div
              id="workspace-header-map-files-panel"
              class="workspace-header-map-files-content"
              role="group"
              :aria-label="`Map file actions for ${mapFileScope}`"
            >
              <p class="workspace-header-map-files-heading">{{ mapFileScope }}</p>
              <div class="workspace-header-map-files-exports">
                <UButton
                  v-if="activeView === 'cluster'"
                  class="workspace-control workspace-header-file-button"
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
                  class="workspace-control workspace-header-file-button"
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
                  class="workspace-control workspace-header-file-button"
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
                  class="workspace-control workspace-header-file-button"
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

              <UButton
                class="workspace-control workspace-header-import-button"
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
                class="workspace-header-import-input"
                type="file"
                accept="application/json,.json"
                aria-label="Import map JSON"
                data-testid="map-json-import-input"
                @change="emit('import-file', $event)"
              >

              <p v-if="exportError" class="workspace-header-export-error" role="alert">{{ exportError }}</p>
              <p class="workspace-header-map-files-note">Import JSON creates a separate copy in the current Jump Cluster: {{ workspace?.cluster.name ?? 'local workspace' }}.</p>
            </div>
          </template>
        </UPopover>
      </nav>

      <div class="workspace-header-utilities">
        <div class="workspace-header-theme" role="group" aria-label="Theme">
          <span class="workspace-header-theme-label">THEME</span>
          <ColorScheme>
            <span class="workspace-header-theme-status">{{ colorMode.value === 'dark' ? 'Dark' : 'Light' }}</span>
          </ColorScheme>
          <UColorModeButton class="theme-control-toggle" />
        </div>
        <slot name="field-definitions" />
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { LocalWorkspace, StarSystem } from '../domain/workspace'
import type { MapImageExporter, MapImageFormat } from '../utils/map-image-export'

const props = withDefaults(defineProps<{
  workspace: LocalWorkspace | null
  activeView: 'cluster' | 'system'
  selectedSystem: StarSystem | null | undefined
  jumpPointCount: number
  clusterMap: MapImageExporter | null
  systemMap: MapImageExporter | null
  exportError: string
  hierarchyOpen?: boolean
  inspectorOpen?: boolean
  compactModalOpen?: boolean
}>(), {
  hierarchyOpen: false,
  inspectorOpen: false,
  compactModalOpen: false,
})

const emit = defineEmits<{
  'export-cluster-json': []
  'export-system-json': []
  'export-map-image': [map: MapImageExporter | null, name: string | undefined, kind: 'jump-cluster' | 'star-system', format: MapImageFormat]
  'import-file': [event: Event]
  'show-cluster': []
  'toggle-hierarchy': []
  'toggle-inspector': []
  'files-open-change': [open: boolean]
}>()

const colorMode = useColorMode()
const headerMapActionsOpen = ref(false)
const importFileInput = ref<HTMLInputElement | null>(null)
const hierarchyOpen = computed(() => props.hierarchyOpen)
const inspectorOpen = computed(() => props.inspectorOpen)
const workspace = computed(() => props.workspace)
const selectedSystem = computed(() => props.selectedSystem)
const activeView = computed(() => props.activeView)
const mapFileScope = computed(() => activeView.value === 'cluster'
  ? `Jump Cluster ${workspace.value?.cluster.name ?? ''}`
  : `star system ${selectedSystem.value?.name ?? ''}`)
const activeMap = computed(() => activeView.value === 'cluster' ? props.clusterMap : props.systemMap)
const starCount = computed(() => selectedSystem.value?.objects.filter(object => object.subtype === 'star').length ?? 0)
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
  headerMapActionsOpen.value = false
  emit('export-map-image', map, name, isCluster ? 'jump-cluster' : 'star-system', format)
}

function openJsonImportPicker(): void {
  importFileInput.value?.click()
  headerMapActionsOpen.value = false
}
</script>

<style scoped>
.workspace-header {
  position: relative;
  z-index: 20;
  display: flex;
  min-width: 0;
  align-items: center;
  gap: clamp(0.75rem, 2vw, 1.75rem);
  border: 1px solid var(--line-soft);
  border-radius: 0.35rem;
  padding: 0.8rem clamp(0.75rem, 1.8vw, 1.5rem);
  background: var(--panel);
  color: var(--text-primary);
}

.workspace-header-brand {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 0.55rem;
  color: var(--text-primary);
  white-space: nowrap;
}

.workspace-header-mark {
  color: var(--accent);
  font-size: 1.25rem;
}

.workspace-header-wordmark {
  font-family: Georgia, serif;
  font-size: clamp(0.95rem, 1.25vw, 1.2rem);
  letter-spacing: 0.015em;
}

.workspace-header-local,
.workspace-header-eyebrow,
.workspace-header-theme-label {
  color: var(--text-muted);
  font: 0.625rem Consolas, monospace;
  letter-spacing: 0.12em;
}

.workspace-header-local {
  border: 1px solid var(--line);
  border-radius: 2px;
  padding: 0.18rem 0.28rem;
}

.workspace-header-context {
  display: flex;
  min-width: 0;
  flex: 1 1 auto;
  align-items: center;
  justify-content: center;
  gap: clamp(0.7rem, 2vw, 1.75rem);
}

.workspace-header-summary {
  display: grid;
  min-width: 0;
  justify-items: center;
  gap: 0.22rem;
  text-align: center;
}

.workspace-summary-name {
  display: block;
  max-width: min(26vw, 22rem);
  margin: 0;
  overflow: hidden;
  color: var(--text-primary);
  font-family: Georgia, serif;
  font-size: 1rem;
  font-weight: 500;
  line-height: 1.1;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.header-summary-stats {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.2rem 0.65rem;
  color: var(--text-muted);
  font: 0.5625rem Consolas, monospace;
  letter-spacing: 0.045em;
}

.header-summary-stats strong {
  color: var(--text-secondary);
  font-size: 0.75rem;
}

.workspace-header-empty {
  margin: 0;
  color: var(--text-secondary);
  font: 0.8rem Consolas, monospace;
}

.workspace-header-actions,
.workspace-header-map-actions,
.workspace-header-utilities,
.workspace-header-theme {
  display: flex;
  min-width: 0;
  align-items: center;
}

.workspace-header-actions {
  flex: 0 0 auto;
  gap: 0.75rem;
}

.workspace-header-map-actions,
.workspace-header-utilities {
  gap: 0.4rem;
}

.workspace-header-control {
  min-height: 2.35rem;
  white-space: nowrap;
}

.header-map-actions-indicator {
  color: var(--accent);
  font-size: 1rem;
  line-height: 1;
}

.workspace-header-theme {
  gap: 0.35rem;
  border-left: 1px solid var(--line-soft);
  padding-left: 0.65rem;
}

.workspace-header-theme-status {
  color: var(--text-secondary);
  font-size: 0.75rem;
}

.workspace-header-save-state {
  max-width: 7rem;
  overflow: hidden;
  color: var(--text-muted);
  font-size: 0.625rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.workspace-header-save-state.is-error {
  color: var(--color-error, #e88f87);
}

.workspace-header-save-state.is-saving {
  color: var(--accent);
}

.workspace-header-map-files-content {
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

.workspace-header-map-files-heading {
  margin: 0;
  color: var(--text-muted);
  font: 0.75rem Consolas, monospace;
  letter-spacing: 0.05em;
  overflow-wrap: anywhere;
  text-transform: uppercase;
}

.workspace-header-map-files-exports {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.4rem;
}

.workspace-header-file-button {
  min-width: 0;
  justify-content: center;
  overflow-wrap: anywhere;
}

.workspace-header-import-button {
  justify-content: center;
}

.workspace-header-import-input {
  position: fixed;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  clip-path: inset(50%);
  white-space: nowrap;
}

.workspace-header-export-error {
  margin: 0;
  color: var(--color-error, #e88f87);
  font-size: 0.8rem;
  overflow-wrap: anywhere;
}

.workspace-header-map-files-note {
  margin: 0;
  color: var(--text-muted);
  font-size: 0.75rem;
}

@media (max-width: 760px), (max-height: 600px) {
  .workspace-header {
    flex-wrap: wrap;
    gap: 0.55rem 0.8rem;
    padding: 0.55rem 0.65rem;
  }

  .workspace-header-brand {
    flex: 1 1 auto;
  }

  .workspace-header-context {
    flex: 1 1 100%;
    order: 3;
    justify-content: flex-start;
  }

  .workspace-header-summary {
    justify-items: start;
    text-align: left;
  }

  .workspace-summary-name {
    max-width: min(46vw, 20rem);
  }

  .header-summary-stats {
    display: none;
  }

  .workspace-header-actions {
    flex: 0 1 auto;
    gap: 0.35rem;
  }

  .workspace-header-map-actions {
    flex-wrap: wrap;
  }

  .workspace-header-map-actions,
  .workspace-header-utilities {
    gap: 0.25rem;
  }

  .workspace-header-control {
    min-height: 2.15rem;
    padding-inline: 0.45rem;
  }

  .workspace-header-save-state,
  .workspace-header-theme-label,
  .workspace-header-theme-status {
    display: none;
  }

  .workspace-header-theme {
    border-left: 0;
    padding-left: 0;
  }
}
</style>
