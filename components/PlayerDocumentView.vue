<template>
  <section ref="rootElement" class="player-document-view grid gap-3" :aria-label="props.ariaLabel">
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
      >
        Back to Jump Cluster
      </UButton>
      <h3 class="m-0 break-words text-lg">{{ selectedSystem.label }}</h3>
    </div>

    <PlayerClusterMap
      v-show="!selectedSystem"
      :document="props.document"
      :active="isActive && !selectedSystem"
      @open-system="openSystem"
    />
    <PlayerSystemMap
      v-if="selectedSystem"
      :document="selectedSystem.map"
      :label="selectedSystem.label"
      :selected-object-id="selectedObjectId"
      :active="isActive && selectedSystem !== null"
      @inspect-object="inspectObject"
    />
  </section>
</template>

<script setup lang="ts">
/** Shared read-only player navigation over an allowlisted Cluster document. */
import { computed, nextTick, ref, watch } from 'vue'
import type { PlayerClusterDocument, PlayerSystemMarker } from '../domain/workspace'
import PlayerClusterMap from './PlayerClusterMap.vue'
import PlayerSystemMap from './PlayerSystemMap.vue'

const props = withDefaults(defineProps<{
  document: PlayerClusterDocument
  active?: boolean
  ariaLabel?: string
  eyebrow?: string
  description?: string
  headingLevel?: 'h1' | 'h2'
}>(), {
  active: true,
  ariaLabel: 'Player document view',
  headingLevel: 'h1',
})

type RevealedSystem = Extract<PlayerSystemMarker, { disclosure: 'revealed' }>
type FocusTarget = HTMLElement | SVGElement

const rootElement = ref<HTMLElement | null>(null)
const selectedSystemId = ref<string | null>(null)
const selectedObjectId = ref<string | null>(null)
const clusterMarkerOpener = ref<FocusTarget | null>(null)
const headingTag = computed(() => props.headingLevel)
const isActive = computed(() => props.active)
const selectedSystem = computed<RevealedSystem | null>(() =>
  props.document.systems.find(isSelectedRevealedSystem) ?? null,
)

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
}

async function openSystem(publicSystemId: string): Promise<void> {
  const system = props.document.systems.find(candidate => candidate.id === publicSystemId)
  if (!system || system.disclosure !== 'revealed') return
  clusterMarkerOpener.value = focusableElement(document.activeElement)
  selectedSystemId.value = system.id
  selectedObjectId.value = null
  await nextTick()
  focusBackButton()
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
