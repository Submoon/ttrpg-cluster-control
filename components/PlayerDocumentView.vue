<template>
  <section
    ref="rootElement"
    class="player-document-view"
    :class="props.workspacePresentation ? 'player-document-view--workspace' : 'grid gap-3'"
    :aria-label="props.ariaLabel"
  >
    <MapEditorLayout
      v-if="props.workspacePresentation"
      :mode="selectedSystem ? 'system' : 'cluster'"
      hierarchy-label="Player hierarchy"
      inspector-label="Player details"
      :hierarchy-visible="hierarchyVisible"
      :inspector-visible="inspectorVisible"
      :entity-inspector-active="false"
      :compact-modal-open="compactModalOpen"
      :compact-panel="compactPanel"
      :overlay-open="false"
      :is-compact-viewport="isCompactViewport"
      @close-panel="closePanel"
    >
      <template #header>
        <WorkspaceHeader :workspace="null" :public-title="props.document.title" public-eyebrow="PLAYER MAP">
          <template #player-actions><slot name="workspace-actions" /></template>
        </WorkspaceHeader>
      </template>
      <template #map>
        <section class="player-workspace-map-region" aria-label="Player map">
          <PlayerClusterMap
            v-show="!selectedSystem"
            :document="props.document"
            :active="isActive && !selectedSystem"
            @open-system="openSystem"
          />
          <PlayerSystemMap
            v-if="cachedSystem"
            v-show="selectedSystem !== null"
            :document="cachedSystem.map"
            :label="cachedSystem.label"
            :selected-object-id="selectedObjectId"
            :active="isActive && selectedSystem !== null"
            workspace-presentation
            @inspect-object="inspectObject"
          />
        </section>
      </template>
      <template #map-chrome>
        <UDashboardToolbar class="player-workspace-toolbar" role="toolbar" aria-label="Player map navigation">
          <div class="player-workspace-map-caption">
            <span class="section-kicker">{{ selectedSystem ? 'STAR SYSTEM' : 'PLAYER MAP' }}</span>
            <h2>{{ selectedSystem?.label ?? 'Jump Cluster' }}</h2>
          </div>
          <div class="player-workspace-actions">
            <UButton
              v-if="selectedSystem"
              color="neutral"
              variant="outline"
              size="sm"
              data-player-back-to-cluster
              @click="backToCluster"
            >Back to Jump Cluster</UButton>
            <UButton
              color="neutral"
              variant="outline"
              size="sm"
              aria-controls="workspace-hierarchy-panel"
              :aria-expanded="isPanelOpen('hierarchy')"
              @click="togglePanel('hierarchy')"
            >Hierarchy</UButton>
            <UButton
              color="neutral"
              variant="outline"
              size="sm"
              aria-controls="workspace-inspector-panel"
              :aria-expanded="isPanelOpen('inspector')"
              @click="togglePanel('inspector')"
            >Inspect</UButton>
          </div>
        </UDashboardToolbar>
      </template>
      <template #compact-recovery>
        <div class="player-workspace-compact-recovery" aria-label="Player panel navigation">
          <UButton color="neutral" variant="outline" size="sm" :aria-expanded="isPanelOpen('hierarchy')" @click="showCompactPanel('hierarchy')">Hierarchy</UButton>
          <UButton color="neutral" variant="outline" size="sm" :aria-expanded="isPanelOpen('inspector')" @click="showCompactPanel('inspector')">Inspect</UButton>
          <UButton color="neutral" variant="outline" size="sm" @click="closeActivePanel">Return to map</UButton>
        </div>
      </template>
      <template #hierarchy>
        <PlayerSystemHierarchy
          v-if="selectedSystem && cachedSystem"
          :document="cachedSystem.map"
          :selected-object-id="selectedObjectId"
          workspace-presentation
          @inspect-object="inspectObject"
        />
        <PlayerClusterHierarchy
          v-else
          :document="props.document"
          :selected-system-id="selectedSystem?.id ?? null"
          @open-system="openSystem"
        />
      </template>
      <template #inspector>
        <div class="player-workspace-inspector">
          <template v-if="selectedSystem && cachedSystem">
            <header class="player-workspace-inspector-heading">
              <span class="section-kicker">PLAYER-VISIBLE SYSTEM</span>
              <h2>{{ selectedSystem.label }}</h2>
            </header>
            <PlayerObjectInspector
              :document="cachedSystem.map"
              :object="selectedObject"
              workspace-presentation
              show-empty-prompt
              @inspect-object="inspectObject"
            />
          </template>
          <section v-else class="player-workspace-inspector-empty" aria-label="Jump Cluster details">
            <span class="section-kicker">PLAYER INFORMATION</span>
            <h2>Jump Cluster</h2>
            <p>Select a Revealed star system to inspect its shared map.</p>
          </section>
        </div>
      </template>
    </MapEditorLayout>

    <template v-else>
      <div>
        <span v-if="props.eyebrow" class="section-kicker">{{ props.eyebrow }}</span>
        <component :is="headingTag" class="mb-1 mt-2 break-words text-2xl">
          {{ props.document.title }}
        </component>
        <p v-if="props.description" class="inspector-intro m-0">{{ props.description }}</p>
      </div>

      <div v-if="selectedSystem" class="grid gap-2">
        <UButton
          class="w-fit"
          color="neutral"
          variant="outline"
          size="sm"
          data-player-back-to-cluster
          @click="backToCluster"
        >Back to Jump Cluster</UButton>
        <h3 class="m-0 break-words text-lg">{{ selectedSystem.label }}</h3>
      </div>

      <PlayerClusterMap
        v-show="!selectedSystem"
        :document="props.document"
        :active="isActive && !selectedSystem"
        @open-system="openSystem"
      />
      <PlayerSystemMap
        v-if="cachedSystem"
        v-show="selectedSystem !== null"
        :document="cachedSystem.map"
        :label="cachedSystem.label"
        :selected-object-id="selectedObjectId"
        :active="isActive && selectedSystem !== null"
        @inspect-object="inspectObject"
      />
    </template>
  </section>
</template>

<script setup lang="ts">
/** Shared read-only player navigation over an allowlisted Cluster document. */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { PlayerClusterDocument, PlayerSystemMarker } from '../domain/workspace'
import PlayerClusterMap from './PlayerClusterMap.vue'
import PlayerSystemMap from './PlayerSystemMap.vue'
import PlayerClusterHierarchy from './PlayerClusterHierarchy.vue'
import PlayerSystemHierarchy from './PlayerSystemHierarchy.vue'
import PlayerObjectInspector from './PlayerObjectInspector.vue'
import MapEditorLayout from './MapEditorLayout.vue'
import WorkspaceHeader from './WorkspaceHeader.vue'

const props = withDefaults(defineProps<{
  document: PlayerClusterDocument
  active?: boolean
  ariaLabel?: string
  eyebrow?: string
  description?: string
  headingLevel?: 'h1' | 'h2'
  workspacePresentation?: boolean
}>(), {
  active: true,
  ariaLabel: 'Player document view',
  headingLevel: 'h1',
  workspacePresentation: false,
})

type RevealedSystem = Extract<PlayerSystemMarker, { disclosure: 'revealed' }>
type FocusTarget = HTMLElement | SVGElement

const rootElement = ref<HTMLElement | null>(null)
const selectedSystemId = ref<string | null>(null)
const selectedObjectId = ref<string | null>(null)
const clusterMarkerOpener = ref<FocusTarget | null>(null)
const clusterMarkerSystemId = ref<string | null>(null)
const cachedSystem = ref<RevealedSystem | null>(null)
const isCompactViewport = ref(false)
const compactPanel = ref<'hierarchy' | 'inspector' | null>(null)
const desktopHierarchyVisible = ref(true)
const desktopInspectorVisible = ref(true)
const headingTag = computed(() => props.headingLevel)
const isActive = computed(() => props.active)
const selectedSystem = computed<RevealedSystem | null>(() =>
  props.document.systems.find(isSelectedRevealedSystem) ?? null,
)
const selectedObject = computed(() => selectedSystem.value?.map.objects.find(object => object.id === selectedObjectId.value) ?? null)
const compactModalOpen = computed(() => props.workspacePresentation && isCompactViewport.value && compactPanel.value !== null)
const hierarchyVisible = computed(() => isCompactViewport.value
  ? compactPanel.value === 'hierarchy'
  : desktopHierarchyVisible.value)
const inspectorVisible = computed(() => isCompactViewport.value
  ? compactPanel.value === 'inspector'
  : desktopInspectorVisible.value)

let compactMedia: MediaQueryList | null = null

onMounted(() => {
  if (!props.workspacePresentation) return
  compactMedia = window.matchMedia('(max-width: 760px), (max-height: 600px)')
  updateCompactViewport()
  compactMedia.addEventListener('change', updateCompactViewport)
})

onBeforeUnmount(() => compactMedia?.removeEventListener('change', updateCompactViewport))

function updateCompactViewport(): void {
  isCompactViewport.value = compactMedia?.matches ?? false
  if (!isCompactViewport.value) compactPanel.value = null
}

watch(() => props.active, active => {
  if (!active) resetNavigation()
}, { flush: 'sync' })
watch(() => props.document, resetNavigation, { flush: 'sync' })
watch(selectedSystem, system => {
  if (system && selectedObjectId.value
    && !system.map.objects.some(object => object.id === selectedObjectId.value)) {
    selectedObjectId.value = null
  }
})

function focusableElement(active: Element | null): FocusTarget | null {
  if (active instanceof HTMLElement) return active
  if (active instanceof SVGElement) {
    if (active.matches('[tabindex], [role="button"]')) return active
    return active.closest<SVGElement>('g[role="button"][tabindex]')
  }
  return null
}

function isSelectedRevealedSystem(system: PlayerSystemMarker): system is RevealedSystem {
  return system.disclosure === 'revealed' && system.id === selectedSystemId.value
}

function isVisible(element: FocusTarget): boolean {
  return element.isConnected && !element.matches(':disabled')
    && element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden'
}

function focusBackButton(): void {
  rootElement.value?.querySelector<HTMLButtonElement>('[data-player-back-to-cluster]')?.focus()
}

function resetNavigation(): void {
  selectedSystemId.value = null
  selectedObjectId.value = null
  clusterMarkerOpener.value = null
  clusterMarkerSystemId.value = null
  cachedSystem.value = null
}

async function openSystem(publicSystemId: string): Promise<void> {
  const sourceDocument = props.document
  const system = sourceDocument.systems.find(candidate => candidate.id === publicSystemId)
  if (!system || system.disclosure !== 'revealed') return
  clusterMarkerOpener.value = focusableElement(document.activeElement)
  clusterMarkerSystemId.value = system.id
  cachedSystem.value = system
  selectedSystemId.value = system.id
  selectedObjectId.value = null
  if (isCompactViewport.value) compactPanel.value = null
  await nextTick()
  await nextTick()
  if (props.document !== sourceDocument || selectedSystem.value?.id !== system.id) return
  focusBackButton()
}

async function backToCluster(): Promise<void> {
  const sourceDocument = props.document
  const systemId = selectedSystem.value?.id
  selectedSystemId.value = null
  selectedObjectId.value = null
  await nextTick()
  await nextTick()
  if (props.document !== sourceDocument || selectedSystem.value !== null) return
  const target = clusterMarkerOpener.value
  clusterMarkerOpener.value = null
  const publicSystemId = clusterMarkerSystemId.value
  clusterMarkerSystemId.value = null
  if (target && isVisible(target)) target.focus()
  else if (systemId && publicSystemId) focusPublicClusterMarker(publicSystemId)
}

function focusPublicClusterMarker(publicSystemId: string): void {
  const marker = rootElement.value?.querySelector<SVGElement>(
    `[data-player-system-id="${CSS.escape(publicSystemId)}"]`,
  )
  if (marker instanceof SVGElement && isVisible(marker)) marker.focus()
}

function inspectObject(publicObjectId: string): void {
  if (!selectedSystem.value?.map.objects.some(object => object.id === publicObjectId)) return
  selectedObjectId.value = publicObjectId
}

function isPanelOpen(panel: 'hierarchy' | 'inspector'): boolean {
  return isCompactViewport.value
    ? compactPanel.value === panel
    : panel === 'hierarchy' ? desktopHierarchyVisible.value : desktopInspectorVisible.value
}

function togglePanel(panel: 'hierarchy' | 'inspector'): void {
  if (isCompactViewport.value) {
    compactPanel.value = compactPanel.value === panel ? null : panel
  } else if (panel === 'hierarchy') {
    desktopHierarchyVisible.value = !desktopHierarchyVisible.value
  } else {
    desktopInspectorVisible.value = !desktopInspectorVisible.value
  }
}

function showCompactPanel(panel: 'hierarchy' | 'inspector'): void {
  compactPanel.value = panel
}

function closePanel(panel: 'hierarchy' | 'inspector'): void {
  if (isCompactViewport.value) {
    if (compactPanel.value === panel) compactPanel.value = null
  } else if (panel === 'hierarchy') {
    desktopHierarchyVisible.value = false
  } else {
    desktopInspectorVisible.value = false
  }
}

function closeActivePanel(): void {
  compactPanel.value = null
}
</script>

<style scoped>
.player-document-view--workspace {
  display: flex;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  flex: 1 1 auto;
}

.player-document-view--workspace > :deep(.map-editor-layout) {
  width: 100%;
  height: 100%;
}

.player-workspace-map-region,
.player-workspace-map-region > :deep(*) {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
}

.player-workspace-map-region > :deep(.player-cluster-map) {
  position: absolute;
  inset: 0;
  display: block;
  min-width: 0;
  min-height: 0;
}

.player-workspace-map-region > :deep(.player-cluster-map .player-cluster-map-scene) {
  width: 100%;
  height: 100%;
  max-height: none;
  min-height: 0;
  border: 0;
}

.player-workspace-map-region > :deep(.player-system-map--workspace) {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
}

.player-workspace-map-region > :deep(.player-system-map--workspace .player-system-map-content--workspace) {
  display: grid;
  height: 100%;
  grid-template-rows: minmax(0, 1fr);
}

.player-workspace-map-region > :deep(.player-system-map--workspace .player-system-map-content--workspace > div) {
  display: grid;
  height: 100%;
  min-height: 0;
  grid-template-rows: auto minmax(0, 1fr);
}

.player-workspace-toolbar {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: .55rem;
  border: 1px solid var(--line-soft);
  border-radius: .35rem;
  padding: .45rem .6rem;
  background: color-mix(in srgb, var(--panel-bg) 96%, transparent);
  box-shadow: 0 .35rem 1.2rem color-mix(in srgb, var(--map-bg) 45%, transparent);
  backdrop-filter: blur(12px);
}

.player-workspace-map-caption,
.player-workspace-actions,
.player-workspace-compact-recovery {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  align-items: center;
  gap: .4rem;
}

.player-workspace-map-caption { gap: .15rem .5rem; }
.player-workspace-map-caption h2,
.player-workspace-inspector-heading h2,
.player-workspace-inspector-empty h2,
.player-public-panel-heading h2,
.player-object-inspector h2,
.player-public-orbit-layout h3 {
  margin: 0;
  color: var(--text-primary);
  font-family: Georgia, serif;
  font-size: 1rem;
  font-weight: 500;
}
.player-workspace-map-caption .section-kicker { flex: 1 0 100%; font-size: .55rem; }
.player-workspace-actions { justify-content: flex-end; }
.player-workspace-inspector { display: grid; min-width: 0; gap: .8rem; padding: .85rem; overflow: auto; }
.player-workspace-inspector-heading { display: grid; gap: .2rem; }
.player-workspace-inspector-empty { display: grid; align-content: start; gap: .5rem; padding: .85rem; }
.player-workspace-inspector-empty p { margin: 0; color: var(--text-secondary); font-size: .78rem; line-height: 1.5; }
.player-workspace-compact-recovery { justify-content: space-between; }

@media (max-width: 760px), (max-height: 600px) {
  .player-workspace-toolbar { gap: .35rem; padding: .35rem; }
  .player-workspace-actions { flex: 1 1 100%; justify-content: flex-start; }
}
</style>
