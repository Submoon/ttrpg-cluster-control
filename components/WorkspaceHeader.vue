<template>
  <header class="topbar flex min-h-20 items-center justify-between gap-4 border-b border-[var(--line-soft)] max-[760px]:min-h-[4.5rem]">
    <a class="wordmark inline-flex items-center gap-3 text-inherit no-underline" href="/" aria-label="Mothership Campaign Cartography home">
      <span class="wordmark-symbol grid size-[2.15rem] place-items-center rounded-full border border-[var(--accent)]" aria-hidden="true">M</span>
      <span>
        <strong class="block">MOTHERSHIP</strong>
        <small class="mt-[0.22rem] block">CAMPAIGN CARTOGRAPHY</small>
      </span>
    </a>
    <div v-if="props.workspace" class="workspace-header-summary">
      <div class="cluster-stamp" role="group" aria-label="Active Jump Cluster summary">
        <small>ACTIVE JUMP CLUSTER</small>
        <h1
          v-if="props.activeView === 'cluster' || !props.selectedSystem"
          class="workspace-summary-name"
        >
          {{ props.workspace.cluster.name }}
        </h1>
        <strong v-else class="workspace-summary-name">{{ props.workspace.cluster.name }}</strong>
        <div class="chart-stats header-summary-stats" role="group" aria-label="Current Jump Cluster contents">
          <span><strong>{{ props.workspace.cluster.systems.length }}</strong> SYSTEMS</span>
          <span><strong>{{ props.workspace.cluster.routes.length }}</strong> ROUTES</span>
          <span><strong>{{ props.jumpPointCount }}</strong> JUMP POINTS</span>
        </div>
      </div>
      <div
        v-if="props.selectedSystem"
        class="system-stamp"
        role="group"
        aria-label="Active Star System summary"
      >
        <small>ACTIVE STAR SYSTEM</small>
        <h1 v-if="props.activeView === 'system'" class="workspace-summary-name">
          {{ props.selectedSystem.name }}
        </h1>
        <strong v-else class="workspace-summary-name">{{ props.selectedSystem.name }}</strong>
        <div class="chart-stats header-summary-stats" role="group" aria-label="Current system contents">
          <span><strong>{{ props.selectedSystem.objects.filter(object => object.subtype === 'star').length }}</strong> STARS</span>
          <span><strong>{{ props.selectedSystem.objects.length }}</strong> OBJECTS</span>
          <span><strong>{{ props.selectedSystem.orbits.length }}</strong> ORBITS</span>
        </div>
      </div>
    </div>
    <div v-if="props.workspace" class="topbar-actions flex shrink-0 items-center gap-2">
      <slot name="field-definitions" />
      <div class="header-map-actions" @keydown.esc.stop.prevent="closeHeaderMapActions">
        <button
          ref="headerMapActionsToggle"
          class="header-map-actions-toggle"
          type="button"
          aria-controls="header-map-actions-panel"
          :aria-expanded="headerMapActionsOpen"
          :aria-label="`${headerMapActionsOpen ? 'Close' : 'Open'} map file actions for ${mapFileScope}`"
          :title="`Map file actions for ${mapFileScope}`"
          @click="headerMapActionsOpen = !headerMapActionsOpen"
        >
          <span>MAP FILES</span>
          <small>{{ props.activeView === 'cluster' ? 'CLUSTER' : 'SYSTEM' }}</small>
          <span class="header-map-actions-indicator" aria-hidden="true">
            {{ headerMapActionsOpen ? '-' : '+' }}
          </span>
        </button>
        <div
          v-show="headerMapActionsOpen"
          id="header-map-actions-panel"
          class="header-map-actions-panel"
          role="group"
          :aria-label="`Map file actions for ${mapFileScope}`"
        >
          <p class="header-map-actions-heading">EXPORT / {{ mapFileScope }}</p>
          <div class="header-map-actions-exports">
            <template v-if="props.activeView === 'cluster'">
              <button
                class="tool-button"
                type="button"
                aria-label="Export Jump Cluster JSON"
                title="Export Jump Cluster JSON"
                @click="emit('export-cluster-json')"
              >
                JSON
              </button>
              <button
                class="tool-button"
                type="button"
                aria-label="Export Jump Cluster PNG"
                title="Export Jump Cluster PNG"
                :disabled="!props.clusterMap"
                @click="emit('export-map-image', props.clusterMap, props.workspace.cluster.name, 'jump-cluster', 'png')"
              >
                PNG
              </button>
              <button
                class="tool-button"
                type="button"
                aria-label="Export Jump Cluster SVG"
                title="Export Jump Cluster SVG"
                :disabled="!props.clusterMap"
                @click="emit('export-map-image', props.clusterMap, props.workspace.cluster.name, 'jump-cluster', 'svg')"
              >
                SVG
              </button>
            </template>
            <template v-else-if="props.selectedSystem">
              <button
                class="tool-button"
                type="button"
                aria-label="Export star system JSON"
                title="Export star system JSON"
                @click="emit('export-system-json')"
              >
                JSON
              </button>
              <button
                class="tool-button"
                type="button"
                aria-label="Export star system PNG"
                title="Export star system PNG"
                :disabled="!props.systemMap"
                @click="emit('export-map-image', props.systemMap, props.selectedSystem.name, 'star-system', 'png')"
              >
                PNG
              </button>
              <button
                class="tool-button"
                type="button"
                aria-label="Export star system SVG"
                title="Export star system SVG"
                :disabled="!props.systemMap"
                @click="emit('export-map-image', props.systemMap, props.selectedSystem.name, 'star-system', 'svg')"
              >
                SVG
              </button>
            </template>
          </div>
          <p class="header-map-actions-note">
            Import JSON creates a separate copy in the current Jump Cluster: {{ props.workspace.cluster.name }}.
          </p>
          <button
            class="tool-button header-map-actions-import"
            type="button"
            aria-label="Import JSON copy"
            title="Import JSON copy"
            :disabled="props.saveState === 'saving'"
            @click="openJsonImportPicker"
          >
            Import JSON
          </button>
          <p v-if="props.exportError" class="feedback m-0 error-text" role="alert">{{ props.exportError }}</p>
        </div>
      </div>
      <div class="local-badge inline-flex items-center gap-[0.45rem] whitespace-nowrap text-[var(--status-good)]">
        <span class="inline-block size-[0.45rem] shrink-0 rounded-full bg-[var(--status-good)]" aria-hidden="true"></span>
        LOCAL ONLY
      </div>
    </div>
    <div v-else class="local-badge inline-flex items-center gap-[0.45rem] whitespace-nowrap text-[var(--status-good)]">
      <span class="inline-block size-[0.45rem] shrink-0 rounded-full bg-[var(--status-good)]" aria-hidden="true"></span>
      LOCAL ONLY
    </div>
    <input
      v-if="props.workspace"
      ref="jsonImportInput"
      class="sr-only"
      type="file"
      accept=".json,application/json"
      aria-label="JSON map file"
      @change="emit('import-file', $event)"
    >
  </header>
</template>

<script setup lang="ts">
/**
 * Shows shared chart summaries and dispatches file actions supplied by the page.
 */
import { computed, ref } from 'vue'
import type { LocalWorkspace, StarSystem } from '../domain/workspace'
import type { MapImageExporter, MapImageFormat } from '../utils/map-image-export'

type ActiveView = 'cluster' | 'system'
type SaveState = 'idle' | 'saving' | 'saved' | 'error'
type MapKind = 'jump-cluster' | 'star-system'

const props = defineProps<{
  workspace: LocalWorkspace | null
  activeView: ActiveView
  selectedSystem: StarSystem | undefined
  jumpPointCount: number
  saveState: SaveState
  clusterMap: MapImageExporter | null
  systemMap: MapImageExporter | null
  exportError: string
}>()

const emit = defineEmits<{
  'export-cluster-json': []
  'export-system-json': []
  'export-map-image': [map: MapImageExporter | null, name: string | undefined, kind: MapKind, format: MapImageFormat]
  'import-file': [event: Event]
}>()

const mapFileScope = computed(() => props.activeView === 'cluster'
  ? `Jump Cluster ${props.workspace?.cluster.name ?? ''}`
  : `star system ${props.selectedSystem?.name ?? ''}`,
)
const headerMapActionsOpen = ref(false)
const headerMapActionsToggle = ref<HTMLButtonElement | null>(null)
const jsonImportInput = ref<HTMLInputElement | null>(null)

/** Opens the hidden file input so import still flows through the page-owned preparation/commit handler. */
function openJsonImportPicker(): void {
  jsonImportInput.value?.click()
}

/** Closes the file-action menu and returns keyboard focus to its toggle. */
function closeHeaderMapActions(): void {
  headerMapActionsOpen.value = false
  headerMapActionsToggle.value?.focus()
}
</script>
