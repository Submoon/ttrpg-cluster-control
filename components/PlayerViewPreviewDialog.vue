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
      <PlayerDocumentView
        :document="props.document"
        :active="props.open"
        aria-label="Warden-side player preview"
        eyebrow="WARDEN-SIDE PREVIEW"
        description="This preview shows committed publication settings. It is not a secure player session."
        :heading-level="'h2'"
      />
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
import type { PlayerClusterDocument } from '../domain/workspace'
import PlayerDocumentView from './PlayerDocumentView.vue'

const props = defineProps<{ open: boolean; document: PlayerClusterDocument }>()
const emit = defineEmits<{ 'update:open': [open: boolean] }>()

type FocusTarget = HTMLElement | SVGElement

let opener: FocusTarget | null = null

function focusableElement(active: Element | null): FocusTarget | null {
  if (active instanceof HTMLElement) return active
  if (active instanceof SVGElement) {
    if (active.matches('[tabindex], [role="button"]')) return active
    return active.closest<SVGElement>('g[role="button"][tabindex]')
  }
  return null
}

function isVisible(element: FocusTarget): boolean {
  return element.isConnected && !element.matches(':disabled')
    && element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden'
}

function captureOpener(): void {
  if (!opener) opener = focusableElement(document.activeElement)
}

function restoreFocus(event: Event): void {
  const target = opener
  opener = null
  if (target && isVisible(target)) {
    event.preventDefault()
    target.focus()
  }
}
</script>
