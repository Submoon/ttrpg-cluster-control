<template>
  <UModal
    v-model:open="dialogOpen"
    title="Review deletion"
    description="Review the current effects before removing this map entity."
    :dismissible="!props.review?.confirming"
    :content="{ onOpenAutoFocus: captureOpener, onCloseAutoFocus: restoreFocus }"
    :ui="{
      content: 'workspace-deletion-review-content max-h-[calc(100dvh-2rem)] overflow-hidden max-[760px]:h-[calc(100dvh-1rem)] max-[760px]:max-h-none max-[760px]:w-[calc(100vw-1rem)]',
      body: 'min-h-0 overflow-y-auto',
      footer: 'shrink-0 border-t border-[var(--line-soft)]',
    }"
  >
    <template #body>
      <div v-if="props.review" class="grid gap-4">
        <section class="grid gap-2" aria-label="Deletion effects">
          <div>
            <span class="section-kicker">CURRENT TARGET</span>
            <h2 class="mb-1 mt-2 break-words text-xl">{{ props.review.entityLabel }}</h2>
          </div>
          <div v-if="props.review.affectedEntities.length" class="grid gap-2">
            <p class="inspector-intro m-0">This deletion will also remove or update:</p>
            <ul class="m-0 grid gap-1 pl-5">
              <li v-for="effect in props.review.affectedEntities" :key="effect" class="break-words">
                {{ effect }}
              </li>
            </ul>
          </div>
          <p v-else class="inspector-intro m-0">No dependent objects or references will be changed.</p>
        </section>
        <UAlert
          v-if="props.review.notice"
          color="warning"
          variant="subtle"
          :description="props.review.notice"
          role="status"
        />
        <UAlert
          v-if="props.review.error"
          color="error"
          variant="subtle"
          :description="props.review.error"
          role="alert"
        />
      </div>
    </template>

    <template #footer>
      <div class="flex w-full flex-wrap justify-end gap-2">
        <UButton color="neutral" variant="ghost" :disabled="props.review?.confirming" @click="emit('cancel')">
          Cancel deletion
        </UButton>
        <UButton
          color="error"
          :loading="props.review?.confirming"
          :disabled="props.review?.confirming || Boolean(props.review?.error)"
          @click="emit('confirm')"
        >
          Confirm deletion
        </UButton>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
/** Presents the current read-only cascade while the workflow retains target ownership. */
import { computed } from 'vue'
import type { WorkspaceDeletionReview as DeletionReview } from '../composables/editor-workflows/types'

const props = defineProps<{ review: DeletionReview | null }>()
const emit = defineEmits<{ cancel: []; confirm: [] }>()
const dialogOpen = computed({
  get: () => props.review?.open ?? false,
  set: (open: boolean) => {
    if (!open && props.review?.open && !props.review.suspended && !props.review.confirming) emit('cancel')
  },
})

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
  if (props.review?.suspended) {
    event.preventDefault()
    return
  }
  event.preventDefault()
  const target = opener && isVisible(opener)
    ? opener
    : document.querySelector<HTMLElement>('#workspace-hierarchy-panel [aria-current="true"]')
      ?? document.querySelector<HTMLElement>('#workspace-main [role="group"][aria-label$="star system map"]')
      ?? document.getElementById('workspace-main')
  target?.focus()
  opener = null
}
</script>
