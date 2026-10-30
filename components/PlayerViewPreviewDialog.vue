<template>
  <UModal
    :open="props.open"
    title="Player view preview"
    description="A Warden-side preview of the committed, player-visible Jump Cluster markers."
    :content="{ onOpenAutoFocus: captureOpener, onCloseAutoFocus: restoreFocus }"
    :ui="{
      content: 'player-view-preview-content max-h-[calc(100dvh-2rem)] overflow-hidden max-[760px]:h-[calc(100dvh-1rem)] max-[760px]:max-h-none max-[760px]:w-[calc(100vw-1rem)]',
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
        <PlayerClusterMap :document="props.document" />
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
/** Read-only Warden consultation; receives only the committed public projection. */
import type { PlayerClusterDocument } from '../domain/workspace'
import PlayerClusterMap from './PlayerClusterMap.vue'

const props = defineProps<{ open: boolean; document: PlayerClusterDocument }>()
const emit = defineEmits<{ 'update:open': [open: boolean] }>()

let opener: HTMLElement | null = null

function focusableElement(active: Element | null): HTMLElement | null {
  if (active instanceof HTMLElement) return active
  if (active instanceof SVGElement) return active.closest<HTMLElement>('button, a[href], [tabindex]')
  return null
}

function isVisible(element: HTMLElement): boolean {
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
</script>
