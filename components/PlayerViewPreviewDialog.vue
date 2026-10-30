<template>
  <UModal
    :open="props.open"
    title="Player view preview"
    description="A Warden-side preview of committed player-visible locations and Revealed system maps."
    :content="{ onOpenAutoFocus: captureOpener, onCloseAutoFocus: restoreFocus }"
    :ui="{
      content: 'player-view-preview-content w-[min(96vw,72rem)] max-w-none max-h-[calc(100dvh-2rem)] overflow-hidden max-[760px]:h-[calc(100dvh-1rem)] max-[760px]:max-h-none max-[760px]:w-[calc(100vw-1rem)]',
      body: 'min-h-0 overflow-y-auto',
      footer: 'shrink-0 border-t border-[var(--line-soft)]',
    }"
    @update:open="emit('update:open', $event)"
  >
    <template #body>
      <section class="grid gap-3" aria-label="Warden-side player preview">
        <div>
          <span class="section-kicker">WARDEN-SIDE PREVIEW</span>
          <h2 class="mb-1 mt-2 break-words text-2xl">{{ props.document.title }}</h2>
          <p class="inspector-intro m-0">This preview shows committed publication settings. It is not a secure player session.</p>
        </div>

        <div v-if="selectedSystem" class="grid gap-2">
          <UButton
            id="player-preview-back-to-cluster"
            class="w-fit"
            color="neutral"
            variant="outline"
            size="sm"
            @click="backToCluster"
          >
            Back to Jump Cluster
          </UButton>
          <h3 class="m-0 break-words text-lg">{{ selectedSystem.label }}</h3>
        </div>

        <PlayerClusterMap
          v-show="!selectedSystem"
          :document="props.document"
          :active="props.open && !selectedSystem"
          @open-system="openSystem"
        />
        <PlayerSystemMap
          v-if="selectedSystem"
          :document="selectedSystem.map"
          :label="selectedSystem.label"
          :selected-object-id="selectedObjectId"
          :active="props.open && selectedSystem !== null"
          @inspect-object="inspectObject"
        />
      </section>
    </template>

    <template #footer>
      <div class="flex w-full justify-end">
        <UButton color="primary" aria-label="Close player preview" @click="emit('update:open', false)">Close</UButton>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
/** Read-only Warden consultation; receives only committed allowlisted player documents. */
import { computed, nextTick, ref, watch } from 'vue'
import type { PlayerClusterDocument, PlayerSystemMarker } from '../domain/workspace'
import PlayerClusterMap from './PlayerClusterMap.vue'
import PlayerSystemMap from './PlayerSystemMap.vue'

const props = defineProps<{ open: boolean; document: PlayerClusterDocument }>()
const emit = defineEmits<{ 'update:open': [open: boolean] }>()

type RevealedSystem = Extract<PlayerSystemMarker, { disclosure: 'revealed' }>
type FocusTarget = HTMLElement | SVGElement

const selectedSystemId = ref<string | null>(null)
const selectedObjectId = ref<string | null>(null)
const clusterMarkerOpener = ref<FocusTarget | null>(null)
const selectedSystem = computed<RevealedSystem | null>(() =>
  props.document.systems.find(isSelectedRevealedSystem) ?? null,
)

let opener: FocusTarget | null = null

watch(() => props.open, resetNavigation, { flush: 'sync' })
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

function captureOpener(): void {
  if (!opener) opener = focusableElement(document.activeElement)
}

function restoreFocus(event: Event): void {
  event.preventDefault()
  const target = opener && isVisible(opener) ? opener : document.getElementById('workspace-main')
  target?.focus()
  opener = null
}

function resetNavigation(): void {
  selectedSystemId.value = null
  selectedObjectId.value = null
  clusterMarkerOpener.value = null
}

async function openSystem(publicSystemId: string): Promise<void> {
  const system = props.document.systems.find(candidate => candidate.id === publicSystemId)
  if (!system || system.disclosure !== 'revealed') return
  clusterMarkerOpener.value = focusableElement(document.activeElement)
  selectedSystemId.value = system.id
  selectedObjectId.value = null
  await nextTick()
  document.getElementById('player-preview-back-to-cluster')?.focus()
}

async function backToCluster(): Promise<void> {
  selectedSystemId.value = null
  selectedObjectId.value = null
  await nextTick()
  const target = clusterMarkerOpener.value
  clusterMarkerOpener.value = null
  if (target && isVisible(target)) target.focus()
}

function inspectObject(publicObjectId: string): void {
  if (!selectedSystem.value?.map.objects.some(object => object.id === publicObjectId)) return
  selectedObjectId.value = publicObjectId
}
</script>
