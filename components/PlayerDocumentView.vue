<template>
  <section
    ref="rootElement"
    class="player-document-view"
    :class="props.workspacePresentation ? 'player-document-view--workspace' : 'player-document-view--embedded grid gap-3'"
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
      :overlay-open="searchOpen || filesOpen"
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
            :get-usable-client-rect="usableRectReader"
            @open-system="openSystem"
          />
          <PlayerSystemMap
            v-if="cachedSystem"
            ref="systemMapHandle"
            v-show="selectedSystem !== null"
            :document="cachedSystem.map"
            :label="cachedSystem.label"
            :selected-object-id="selectedObjectId"
            :selected-orbit-id="selectedOrbitId"
            :get-usable-client-rect="usableRectReader"
            :active="isActive && selectedSystem !== null"
            workspace-presentation
            @inspect-object="inspectObject"
            @inspect-orbit="inspectOrbit"
          />
        </section>
      </template>
      <template #map-chrome>
        <UDashboardToolbar class="player-workspace-toolbar" role="toolbar" aria-label="Player map navigation" data-player-map-obstruction>
          <div class="player-workspace-map-context">
            <UButton
              v-if="selectedSystem"
              class="player-workspace-back"
              color="neutral"
              variant="outline"
              size="sm"
              aria-label="Back to Jump Cluster"
              title="Back to Jump Cluster"
              data-player-back-to-cluster
              @click="backToCluster"
            >
              <UIcon name="i-lucide-arrow-left" aria-hidden="true" />
              <span>Back</span>
            </UButton>
            <div class="player-workspace-map-caption">
              <span class="section-kicker">{{ selectedSystem ? 'STAR SYSTEM' : 'PLAYER MAP' }}</span>
              <h2>{{ selectedSystem?.label ?? 'Jump Cluster' }}</h2>
            </div>
          </div>
          <div class="player-workspace-actions">
            <PlayerMapTools
              ref="mapTools"
              v-model:search-open="searchOpen"
              v-model:search-query="searchQuery"
              v-model:files-open="filesOpen"
              :search-results="searchResults"
              :reveal-search-target="revealSearchTarget"
              :can-open-search-shortcut="canOpenSearchShortcut"
              :get-shortcut-owning-dialog="getShortcutOwningDialog"
              :file-scope="mapFileScope"
              :export-error="playerExportError"
              @export-image="downloadPlayerImage"
            >
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
            </PlayerMapTools>
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
          v-if="selectedSystem"
          :document="selectedSystem.map"
          :selected-object-id="selectedObjectId"
          :selected-orbit-id="selectedOrbitId"
          workspace-presentation
          @inspect-object="inspectObject"
          @inspect-orbit="inspectOrbit"
        />
        <PlayerClusterHierarchy
          v-else
          :document="props.document"
          :selected-system-id="null"
          @open-system="openSystem"
        />
      </template>
      <template #inspector>
        <div class="player-workspace-inspector">
          <template v-if="selectedSystem">
            <header class="player-workspace-inspector-heading">
              <span class="section-kicker">PLAYER-VISIBLE SYSTEM</span>
              <h2>{{ selectedSystem.label }}</h2>
            </header>
            <PlayerObjectInspector
              v-if="selectedTarget?.kind === 'object' || !selectedTarget"
              :document="selectedSystem.map"
              :object="selectedObject"
              workspace-presentation
              show-empty-prompt
              @inspect-object="inspectObject"
              @inspect-orbit="inspectOrbit"
            />
            <PlayerOrbitInspector
              v-else
              :document="selectedSystem.map"
              :orbit="selectedOrbit"
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
      <header class="player-embedded-heading">
        <span v-if="props.eyebrow" class="section-kicker">{{ props.eyebrow }}</span>
        <component :is="headingTag" class="mb-1 mt-2 break-words text-2xl">
          {{ props.document.title }}
        </component>
        <p v-if="props.description" class="inspector-intro m-0">{{ props.description }}</p>
      </header>

      <UDashboardToolbar as="nav" class="player-embedded-toolbar" role="toolbar" aria-label="Player map navigation" data-player-map-obstruction>
        <div class="player-workspace-map-context">
          <UButton
            v-if="selectedSystem"
            class="player-workspace-back"
            color="neutral"
            variant="outline"
            size="sm"
            aria-label="Back to Jump Cluster"
            title="Back to Jump Cluster"
            data-player-back-to-cluster
            @click="backToCluster"
          >
            <UIcon name="i-lucide-arrow-left" aria-hidden="true" />
            <span>Back</span>
          </UButton>
          <div class="player-workspace-map-caption">
            <span class="section-kicker">{{ selectedSystem ? 'STAR SYSTEM' : 'PLAYER MAP' }}</span>
            <h2>{{ selectedSystem?.label ?? 'Jump Cluster' }}</h2>
          </div>
        </div>
        <div class="player-workspace-actions">
          <PlayerMapTools
            ref="mapTools"
            v-model:search-open="searchOpen"
            v-model:search-query="searchQuery"
            v-model:files-open="filesOpen"
            :search-results="searchResults"
            :reveal-search-target="revealSearchTarget"
            :can-open-search-shortcut="canOpenSearchShortcut"
            :get-shortcut-owning-dialog="getShortcutOwningDialog"
            :file-scope="mapFileScope"
            :export-error="playerExportError"
            embedded
            @export-image="downloadPlayerImage"
          >
            <UButton
              color="neutral"
              variant="outline"
              size="sm"
              :aria-expanded="isPanelOpen('hierarchy')"
              @click="togglePanel('hierarchy')"
            >Hierarchy</UButton>
            <UButton
              color="neutral"
              variant="outline"
              size="sm"
              :aria-expanded="isPanelOpen('inspector')"
              @click="togglePanel('inspector')"
            >Inspect</UButton>
          </PlayerMapTools>
        </div>
      </UDashboardToolbar>

      <div class="player-inline-map-layout">
        <div class="player-inline-map-board">
          <PlayerClusterMap
            v-show="!selectedSystem"
            :document="props.document"
            :active="isActive && !selectedSystem"
            :get-usable-client-rect="usableRectReader"
            @open-system="openSystem"
          />
          <PlayerSystemMap
            v-if="cachedSystem"
            ref="systemMapHandle"
            v-show="selectedSystem !== null"
            :document="cachedSystem.map"
            :label="cachedSystem.label"
            :selected-object-id="selectedObjectId"
            :selected-orbit-id="selectedOrbitId"
            :get-usable-client-rect="usableRectReader"
            :active="isActive && selectedSystem !== null"
            @inspect-object="inspectObject"
            @inspect-orbit="inspectOrbit"
          />
        </div>
        <aside class="player-inline-panels" aria-label="Player consultation panels">
          <section v-show="hierarchyVisible" class="player-inline-panel" aria-label="Player hierarchy">
            <PlayerSystemHierarchy
              v-if="selectedSystem"
              :document="selectedSystem.map"
              :selected-object-id="selectedObjectId"
              :selected-orbit-id="selectedOrbitId"
              @inspect-object="inspectObject"
              @inspect-orbit="inspectOrbit"
            />
            <PlayerClusterHierarchy
              v-else
              :document="props.document"
              :selected-system-id="null"
              @open-system="openSystem"
            />
          </section>
          <section v-show="inspectorVisible" class="player-inline-panel" aria-label="Player details">
            <template v-if="selectedSystem">
              <header class="player-workspace-inspector-heading">
                <span class="section-kicker">PLAYER-VISIBLE SYSTEM</span>
                <h2>{{ selectedSystem.label }}</h2>
              </header>
              <PlayerObjectInspector
                v-if="selectedTarget?.kind === 'object' || !selectedTarget"
                :document="selectedSystem.map"
                :object="selectedObject"
                workspace-presentation
                show-empty-prompt
                @inspect-object="inspectObject"
                @inspect-orbit="inspectOrbit"
              />
              <PlayerOrbitInspector
                v-else
                :document="selectedSystem.map"
                :orbit="selectedOrbit"
                workspace-presentation
                show-empty-prompt
                @inspect-object="inspectObject"
              />
            </template>
            <template v-else>
              <span class="section-kicker">PLAYER INFORMATION</span>
              <h2>Jump Cluster</h2>
              <p>Select a Revealed star system to inspect its shared map.</p>
            </template>
          </section>
        </aside>
      </div>
    </template>
  </section>
</template>

<script setup lang="ts">
/** Shared read-only player navigation over an allowlisted Cluster document. */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { usePlayerFileExports } from '../composables/usePlayerFileExports'
import type { CurrentPlayerMapScene } from '../domain/player-scene'
import type { PlayerClusterDocument, PlayerObjectMarker, PlayerOrbit, PlayerSystemDocument, PlayerSystemMarker } from '../domain/workspace'
import type { ClientRectBounds } from '../utils/map-usable-area'
import { largestUnobstructedClientRect } from '../utils/map-usable-area'
import type { PlayerInspectionTarget, PlayerUsableRectReader } from '../utils/player-inspection'
import { searchPlayerDocument, type PlayerSearchTarget } from '../utils/player-search'
import PlayerClusterMap from './PlayerClusterMap.vue'
import PlayerSystemMap from './PlayerSystemMap.vue'
import PlayerClusterHierarchy from './PlayerClusterHierarchy.vue'
import PlayerSystemHierarchy from './PlayerSystemHierarchy.vue'
import PlayerObjectInspector from './PlayerObjectInspector.vue'
import PlayerOrbitInspector from './PlayerOrbitInspector.vue'
import MapEditorLayout from './MapEditorLayout.vue'
import PlayerMapTools from './PlayerMapTools.vue'
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
interface PlayerSystemMapHandle {
  revealTarget(target: PlayerInspectionTarget, expectedDocument: PlayerSystemDocument): boolean
}
interface PendingReveal {
  clusterDocument: PlayerClusterDocument
  system: RevealedSystem
  systemDocument: PlayerSystemDocument
  map: PlayerSystemMapHandle | null
  target: PlayerInspectionTarget
  request: number
}

const rootElement = ref<HTMLElement | null>(null)
const mapTools = ref<InstanceType<typeof PlayerMapTools> | null>(null)
const searchOpen = ref(false)
const searchQuery = ref('')
const filesOpen = ref(false)
const selectedSystemId = ref<string | null>(null)
const selectedTarget = shallowRef<PlayerInspectionTarget | null>(null)
const clusterMarkerOpener = ref<FocusTarget | null>(null)
const clusterMarkerSystemId = ref<string | null>(null)
const cachedSystem = shallowRef<RevealedSystem | null>(null)
const systemMapHandle = ref<PlayerSystemMapHandle | null>(null)
const isCompactViewport = ref(false)
const compactPanel = ref<'hierarchy' | 'inspector' | null>(null)
const desktopHierarchyVisible = ref(true)
const desktopInspectorVisible = ref(true)
const mapReaderEpoch = ref(0)
const pendingReveal = shallowRef<PendingReveal | null>(null)
const headingTag = computed(() => props.headingLevel)
const isActive = computed(() => props.active)
const selectedSystem = computed<RevealedSystem | null>(() =>
  props.document.systems.find(isSelectedRevealedSystem) ?? null,
)
const searchResults = computed(() => searchPlayerDocument(props.document, searchQuery.value))
const mapFileScope = computed(() => selectedSystem.value
  ? `star system ${selectedSystem.value.label}`
  : `Jump Cluster ${props.document.title}`)
const { playerExportError, downloadPlayerImage } = usePlayerFileExports({ prepare: preparePlayerImage })
const selectedObjectId = computed(() => selectedTarget.value?.kind === 'object' ? selectedTarget.value.id : null)
const selectedOrbitId = computed(() => selectedTarget.value?.kind === 'orbit' ? selectedTarget.value.id : null)
const selectedObject = computed<PlayerObjectMarker | null>(() => selectedObjectId.value
  ? selectedSystem.value?.map.objects.find(object => object.id === selectedObjectId.value) ?? null
  : null)
const selectedOrbit = computed<PlayerOrbit | null>(() => selectedOrbitId.value
  ? selectedSystem.value?.map.orbits.find(orbit => orbit.id === selectedOrbitId.value) ?? null
  : null)
const compactModalOpen = computed(() => props.workspacePresentation
  && isCompactViewport.value && compactPanel.value !== null)
const hierarchyVisible = computed(() => isPanelOpen('hierarchy'))
const inspectorVisible = computed(() => isPanelOpen('inspector'))
const usableRectReader = computed<PlayerUsableRectReader>(() => {
  const epoch = mapReaderEpoch.value
  const document = props.document
  const active = isActive.value
  const compactMapBlocked = props.workspacePresentation && isCompactViewport.value && compactPanel.value !== null
  return (mapClientRect) => {
    if (epoch !== mapReaderEpoch.value || document !== props.document || !active || compactMapBlocked) return null
    const root = rootElement.value
    if (!root || !root.isConnected || root.getClientRects().length === 0) return null
    const obstructions = Array.from(root.querySelectorAll<HTMLElement>(
      '[data-map-obstruction], [data-player-map-obstruction]',
    ))
      .filter(isVisibleObstruction)
      .map(toClientRectBounds)
    return largestUnobstructedClientRect(mapClientRect, obstructions) ?? null
  }
})

let compactMedia: MediaQueryList | null = null
let layoutResizeObserver: ResizeObserver | null = null
let layoutMutationObserver: MutationObserver | null = null
let requestNonce = 0
let searchOpening = 0
let mapVisit = 0
let lastRevealAttempt = ''
let isDisposed = false

onMounted(() => {
  compactMedia = window.matchMedia('(max-width: 760px), (max-height: 600px)')
  updateCompactViewport()
  compactMedia.addEventListener('change', updateCompactViewport)
  observePublicLayout()
})

onBeforeUnmount(() => {
  isDisposed = true
  invalidatePendingReveal()
  compactMedia?.removeEventListener('change', updateCompactViewport)
  layoutResizeObserver?.disconnect()
  layoutMutationObserver?.disconnect()
})

watch(() => props.active, (active) => {
  mapReaderEpoch.value += 1
  if (!active) resetDocumentView()
}, { flush: 'sync' })
watch(() => props.document, () => {
  mapReaderEpoch.value += 1
  resetDocumentView()
}, { flush: 'sync' })
watch([() => props.document, () => props.active, selectedSystemId], () => {
  mapVisit += 1
  filesOpen.value = false
  playerExportError.value = ''
}, { flush: 'sync' })
watch(searchOpen, open => {
  if (!open) return
  searchOpening += 1
  filesOpen.value = false
}, { flush: 'sync' })
watch(() => compactModalOpen.value, () => {
  mapReaderEpoch.value += 1
  if (compactModalOpen.value) filesOpen.value = false
  else void retryPendingReveal()
}, { flush: 'post' })
watch(() => [hierarchyVisible.value, inspectorVisible.value] as const, () => {
  mapReaderEpoch.value += 1
  void retryPendingReveal()
}, { flush: 'post' })
watch(selectedSystem, system => {
  if (!system) return
  if (selectedObjectId.value && !system.map.objects.some(object => object.id === selectedObjectId.value)) {
    selectedTarget.value = null
  } else if (selectedOrbitId.value && !system.map.orbits.some(orbit => orbit.id === selectedOrbitId.value)) {
    selectedTarget.value = null
  }
})

function updateCompactViewport(): void {
  isCompactViewport.value = compactMedia?.matches ?? false
  if (!isCompactViewport.value) compactPanel.value = null
  mapReaderEpoch.value += 1
  if (!compactModalOpen.value) void retryPendingReveal()
}

function observePublicLayout(): void {
  const root = rootElement.value
  if (!root || typeof ResizeObserver === 'undefined' || typeof MutationObserver === 'undefined') return
  layoutResizeObserver = new ResizeObserver(publicLayoutChanged)
  layoutResizeObserver.observe(root)
  layoutMutationObserver = new MutationObserver(publicLayoutChanged)
  layoutMutationObserver.observe(root, {
    attributes: true,
    attributeFilter: ['class', 'style', 'hidden', 'inert', 'data-map-obstruction', 'data-player-map-obstruction'],
    childList: true,
    subtree: true,
  })
}

function publicLayoutChanged(): void {
  mapReaderEpoch.value += 1
  void retryPendingReveal()
}

function isSelectedRevealedSystem(system: PlayerSystemMarker): system is RevealedSystem {
  return system.disclosure === 'revealed' && system.id === selectedSystemId.value
}

function isVisible(element: FocusTarget): boolean {
  return element.isConnected
    && !element.matches(':disabled')
    && element.getClientRects().length > 0
    && getComputedStyle(element).visibility !== 'hidden'
    && !element.closest('[inert], [aria-hidden="true"]')
}

function isVisibleObstruction(element: HTMLElement): boolean {
  return element.isConnected
    && element.getClientRects().length > 0
    && getComputedStyle(element).visibility !== 'hidden'
    && !element.closest('[inert], [aria-hidden="true"]')
}

function toClientRectBounds(element: HTMLElement): ClientRectBounds {
  const bounds = element.getBoundingClientRect()
  return { left: bounds.left, top: bounds.top, right: bounds.right, bottom: bounds.bottom }
}

function focusBackButton(request: number, sourceDocument: PlayerClusterDocument, system: RevealedSystem): void {
  if (!isCurrentNavigation(request, sourceDocument, system)) return
  const button = rootElement.value?.querySelector<HTMLButtonElement>('[data-player-back-to-cluster]')
  if (button && isVisible(button)) button.focus()
}

function resetDocumentView(): void {
  searchOpen.value = false
  searchQuery.value = ''
  invalidatePendingReveal()
  selectedSystemId.value = null
  selectedTarget.value = null
  clusterMarkerOpener.value = null
  clusterMarkerSystemId.value = null
  cachedSystem.value = null
}

function getShortcutOwningDialog(): HTMLElement | null {
  return rootElement.value?.closest<HTMLElement>('.player-view-preview-content[role="dialog"]') ?? null
}

function canOpenSearchShortcut(): boolean {
  const root = rootElement.value
  return isActive.value && !compactModalOpen.value
    && (searchOpen.value || (root !== null && isVisible(root)))
}

async function revealSearchTarget(target: PlayerSearchTarget): Promise<
  { status: 'revealed' } | { status: 'rejected'; reason: 'stale' | 'unavailable' }
> {
  const source = props.document
  const opening = searchOpening
  const tools = mapTools.value
  let navigationRequest = requestNonce
  const ownsSearch = () => !isDisposed && isActive.value && props.document === source
    && searchOpening === opening && mapTools.value === tools && navigationRequest === requestNonce
  const stale = { status: 'rejected', reason: 'stale' } as const
  const unavailable = { status: 'rejected', reason: 'unavailable' } as const
  if (!tools || !searchOpen.value || target.document !== source || !ownsSearch()) return stale

  const destination = target.kind === 'cluster' ? null : source.systems.find(system => system.id === target.systemId)
  if (target.kind !== 'cluster' && destination?.disclosure !== 'revealed') return unavailable
  if (target.kind === 'object' && destination?.disclosure === 'revealed'
    && !destination.map.objects.some(object => object.id === target.objectId)) return unavailable

  searchOpen.value = false
  await nextTick()
  await tools.whenSearchClosingFocusSettled()
  if (!ownsSearch() || searchOpen.value) return stale

  if (target.kind === 'cluster') {
    const navigation = backToCluster()
    navigationRequest = requestNonce
    await navigation
    if (!ownsSearch() || searchOpen.value || selectedSystem.value) return stale
    focusCurrentMap('.player-cluster-map-scene')
  } else {
    if (selectedSystem.value !== destination) {
      const navigation = openSystem(target.systemId, 'search')
      navigationRequest = requestNonce
      await navigation
      if (!ownsSearch() || searchOpen.value || selectedSystem.value !== destination) return stale
    }
    if (target.kind === 'object') {
      focusCurrentMap('.player-system-map-scene')
      inspectObject(target.objectId)
    } else if (selectedSystem.value) {
      focusBackButton(navigationRequest, source, selectedSystem.value)
    }
  }
  return { status: 'revealed' }
}

function focusCurrentMap(selector: string): void {
  const root = rootElement.value
  const map = root?.querySelector<SVGElement>(selector)
  const target = map && isVisible(map) ? map : root?.querySelector<HTMLElement>('.workspace-map-search')
  if (target && isVisible(target)) target.focus({ preventScroll: true })
}

async function preparePlayerImage() {
  if (isDisposed || !isActive.value) return null
  const source = props.document
  const visit = mapVisit
  const system = selectedSystem.value
  const scene: CurrentPlayerMapScene = system
    ? { kind: 'star-system', document: system.map, label: system.label }
    : { kind: 'jump-cluster', document: source }
  return {
    document: source,
    scene,
    isCurrent: () => !isDisposed && isActive.value && props.document === source && mapVisit === visit,
  }
}

async function openSystem(publicSystemId: string, origin: 'map' | 'search' = 'map'): Promise<void> {
  const sourceDocument = props.document
  const system = sourceDocument.systems.find(candidate => candidate.id === publicSystemId)
  if (!system || system.disclosure !== 'revealed') return
  const request = ++requestNonce
  pendingReveal.value = null
  clusterMarkerOpener.value = origin === 'map' ? focusableElement(document.activeElement) : null
  clusterMarkerSystemId.value = system.id
  cachedSystem.value = system
  selectedSystemId.value = system.id
  selectedTarget.value = null
  if (props.workspacePresentation && isCompactViewport.value) compactPanel.value = null
  await nextTick()
  await nextTick()
  if (!isCurrentNavigation(request, sourceDocument, system)) return
  focusBackButton(request, sourceDocument, system)
}

async function backToCluster(): Promise<void> {
  const sourceDocument = props.document
  const system = selectedSystem.value
  if (!system) return
  const request = ++requestNonce
  pendingReveal.value = null
  selectedSystemId.value = null
  selectedTarget.value = null
  if (props.workspacePresentation && isCompactViewport.value) compactPanel.value = null
  await nextTick()
  await nextTick()
  if (isDisposed || request !== requestNonce || props.document !== sourceDocument || selectedSystem.value !== null) return
  const target = clusterMarkerOpener.value
  clusterMarkerOpener.value = null
  const publicSystemId = clusterMarkerSystemId.value
  clusterMarkerSystemId.value = null
  if (target && isVisible(target)) target.focus()
  else if (publicSystemId) focusPublicClusterMarker(publicSystemId)
}

function focusPublicClusterMarker(publicSystemId: string): void {
  const marker = rootElement.value?.querySelector<SVGElement>(
    `[data-player-system-id="${CSS.escape(publicSystemId)}"]`,
  )
  if (marker instanceof SVGElement && isVisible(marker)) marker.focus()
}

function focusableElement(active: Element | null): FocusTarget | null {
  if (active instanceof HTMLElement) return active
  if (active instanceof SVGElement) {
    if (active.matches('[tabindex], [role="button"]')) return active
    return active.closest<SVGElement>('g[role="button"][tabindex]')
  }
  return null
}

function inspectObject(publicObjectId: string): void {
  inspectTarget({ kind: 'object', id: publicObjectId })
}

function inspectOrbit(publicOrbitId: string): void {
  inspectTarget({ kind: 'orbit', id: publicOrbitId })
}

function inspectTarget(target: PlayerInspectionTarget): void {
  const clusterDocument = props.document
  const system = selectedSystem.value
  if (!system || !targetExists(target, system.map)) return
  const map = systemMapHandle.value
  const copiedTarget: PlayerInspectionTarget = target.kind === 'object'
    ? { kind: 'object', id: target.id }
    : { kind: 'orbit', id: target.id }
  const request = ++requestNonce
  const nextPending: PendingReveal = {
    clusterDocument,
    system,
    systemDocument: system.map,
    map,
    target: copiedTarget,
    request,
  }
  pendingReveal.value = nextPending
  lastRevealAttempt = ''
  selectedTarget.value = copiedTarget
  if (props.workspacePresentation && isCompactViewport.value) {
    compactPanel.value = 'inspector'
  } else {
    desktopInspectorVisible.value = true
  }
  void attemptPendingReveal(nextPending)
}

function targetExists(target: PlayerInspectionTarget, systemDocument: PlayerSystemDocument): boolean {
  return target.kind === 'object'
    ? systemDocument.objects.some(object => object.id === target.id)
    : systemDocument.orbits.some(orbit => orbit.id === target.id)
}

function isCurrentNavigation(
  request: number,
  clusterDocument: PlayerClusterDocument,
  system: RevealedSystem,
): boolean {
  return !isDisposed
    && request === requestNonce
    && props.document === clusterDocument
    && selectedSystem.value === system
    && selectedSystem.value.map === system.map
}

function ownsPendingReveal(pending: PendingReveal): boolean {
  return isCurrentNavigation(pending.request, pending.clusterDocument, pending.system)
    && pendingReveal.value?.request === pending.request
    && systemMapHandle.value === pending.map
    && selectedTarget.value?.kind === pending.target.kind
    && selectedTarget.value.id === pending.target.id
    && targetExists(pending.target, pending.systemDocument)
}

async function attemptPendingReveal(pending: PendingReveal): Promise<void> {
  await nextTick()
  if (!ownsPendingReveal(pending)) return
  const attemptKey = `${pending.request}:${mapReaderEpoch.value}`
  if (lastRevealAttempt === attemptKey) return
  lastRevealAttempt = attemptKey
  const map = pending.map
  if (!map) return
  if (map.revealTarget(pending.target, pending.systemDocument) && ownsPendingReveal(pending)) {
    pendingReveal.value = null
    lastRevealAttempt = ''
  }
}

function retryPendingReveal(): Promise<void> {
  const pending = pendingReveal.value
  return pending ? attemptPendingReveal(pending) : Promise.resolve()
}

function invalidatePendingReveal(): void {
  requestNonce += 1
  pendingReveal.value = null
  lastRevealAttempt = ''
}

function isPanelOpen(panel: 'hierarchy' | 'inspector'): boolean {
  return props.workspacePresentation && isCompactViewport.value
    ? compactPanel.value === panel
    : panel === 'hierarchy' ? desktopHierarchyVisible.value : desktopInspectorVisible.value
}

function togglePanel(panel: 'hierarchy' | 'inspector'): void {
  if (props.workspacePresentation && isCompactViewport.value) {
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
  if (props.workspacePresentation && isCompactViewport.value) {
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
  border: 0;
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

.player-workspace-map-region :deep(.player-cluster-map-scene),
.player-workspace-map-region :deep(.player-system-map-scene) {
  position: absolute;
  inset: 0;
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  max-height: none;
  min-height: 0;
  border: 0;
}

.player-workspace-map-region :deep(.player-cluster-map-navigation),
.player-workspace-map-region :deep(.player-system-map-navigation) {
  position: absolute;
  z-index: 2;
  bottom: 1rem;
  left: 50%;
  display: flex;
  width: max-content;
  max-width: min(242px, calc(100% - 2rem));
  flex-wrap: nowrap;
  align-items: center;
  gap: .25rem;
  overflow-x: auto;
  transform: translateX(-50%);
  border: 1px solid var(--line-soft);
  border-radius: .35rem;
  padding: .3rem;
  background: color-mix(in srgb, var(--panel-bg) 96%, transparent);
  box-shadow: 0 .35rem 1.2rem color-mix(in srgb, var(--map-bg) 45%, transparent);
  backdrop-filter: blur(12px);
}

.player-workspace-toolbar,
.player-embedded-toolbar {
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

.player-workspace-map-context,
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
.player-orbit-inspector h2 {
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
.player-workspace-inspector-empty p,
.player-inline-panel > p { margin: 0; color: var(--text-secondary); font-size: .78rem; line-height: 1.5; }
.player-workspace-compact-recovery { justify-content: space-between; }

.player-document-view--embedded { min-width: 0; }
.player-embedded-heading { display: grid; min-width: 0; gap: .1rem; }
.player-inline-map-layout { display: grid; min-width: 0; align-items: start; gap: .75rem; grid-template-columns: minmax(0, 1fr) 17rem; }
.player-inline-map-board { min-width: 0; }
.player-inline-panels { display: grid; min-width: 0; gap: .75rem; }
.player-inline-panel { display: grid; min-width: 0; align-content: start; gap: .6rem; border: 1px solid var(--line-soft); border-radius: .35rem; padding: .75rem; background: var(--panel-bg); }

@media (max-width: 760px), (max-height: 600px) {
  .player-workspace-toolbar,
  .player-embedded-toolbar { gap: .35rem; padding: .35rem; }
  .player-workspace-actions { flex: 1 1 100%; justify-content: flex-start; }
  .player-inline-map-layout { grid-template-columns: minmax(0, 1fr); }
}
</style>
