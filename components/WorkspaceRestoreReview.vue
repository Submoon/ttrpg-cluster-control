<template>
  <UModal
    v-model:open="dialogOpen"
    title="Replace Jump Cluster"
    description="Review the complete backup and confirm before replacing the active Jump Cluster."
    :dismissible="!props.review?.confirming"
    :content="{ onOpenAutoFocus: captureOpener, onCloseAutoFocus: restoreFocus }"
    :ui="{
      content: 'workspace-restore-review-content max-h-[calc(100dvh-2rem)] overflow-hidden max-[760px]:h-[calc(100dvh-1rem)] max-[760px]:max-h-none max-[760px]:w-[calc(100vw-1rem)]',
      body: 'min-h-0 overflow-y-auto',
      footer: 'shrink-0 border-t border-[var(--line-soft)]',
    }"
  >
    <template #body>
      <div v-if="props.review" class="grid gap-4">
        <section class="grid gap-3" aria-label="Replacement details">
          <div>
            <span class="section-kicker">COMPLETE BACKUP</span>
            <h2 class="mb-1 mt-2 break-words text-xl">Replace the active Jump Cluster?</h2>
            <p class="m-0 break-words">{{ props.review.activeName }} will be replaced by {{ props.review.incomingName }}.</p>
            <p class="m-0 break-words text-sm text-muted">Source file: {{ props.review.sourceName }}</p>
          </div>
          <p class="m-0 text-sm text-muted">
            Your current Jump Cluster will become this browser's last valid recovery copy.
          </p>
          <div v-if="props.review.canDownloadCurrent" class="flex flex-wrap gap-2">
            <UButton color="neutral" variant="outline" @click="emit('download-current')">
              Download current Jump Cluster JSON
            </UButton>
          </div>
          <UAlert
            v-if="props.review.stale"
            color="warning"
            variant="subtle"
            description="The active workspace or draft state changed after review. Review the updated names and confirm again."
            role="status"
          />
          <div v-if="props.review.hasDrafts" class="grid gap-2 rounded-md border border-[var(--line-soft)] p-3">
            <p class="m-0 font-medium">Unapplied editor drafts are open.</p>
            <p class="m-0 text-sm text-muted">Return to editing to keep them, or confirm that they may be discarded after the replacement is saved.</p>
            <UCheckbox
              :model-value="props.review.discardDraftsConfirmed"
              label="Discard current drafts if the replacement succeeds"
              :disabled="props.review.confirming"
              @update:model-value="emit('update:discard-drafts-confirmed', Boolean($event))"
            />
          </div>
          <UAlert
            v-if="props.review.error"
            color="error"
            variant="subtle"
            :description="props.review.error"
            role="alert"
          />
        </section>
      </div>
    </template>

    <template #footer>
      <div class="flex w-full flex-wrap justify-end gap-2">
        <UButton color="neutral" variant="ghost" :disabled="props.review?.confirming" @click="emit('cancel')">
          Return to editing
        </UButton>
        <UButton
          color="primary"
          :loading="props.review?.confirming"
          :disabled="!props.review || props.review.confirming || (props.review.hasDrafts && !props.review.discardDraftsConfirmed)"
          @click="emit('confirm')"
        >
          Replace Jump Cluster
        </UButton>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
/** Presents the reviewed backup and draft-discard consent without owning restore state or persistence. */
import { computed } from 'vue'
import type { WorkspaceRestoreReview } from '../composables/useWorkspaceRestore'

const props = defineProps<{ review: Readonly<WorkspaceRestoreReview> | null }>()
const emit = defineEmits<{
  cancel: []
  confirm: []
  'download-current': []
  'update:discard-drafts-confirmed': [confirmed: boolean]
}>()

let opener: HTMLElement | null = null
const dialogOpen = computed({
  get: () => props.review !== null,
  set: open => { if (!open && !props.review?.confirming) emit('cancel') },
})

function captureOpener(event: Event): void {
  opener = event.target instanceof HTMLElement ? event.target : document.activeElement as HTMLElement | null
}

function restoreFocus(): void {
  const target = opener
  opener = null
  if (target?.isConnected && !target.closest('[inert]')) target.focus()
}
</script>
