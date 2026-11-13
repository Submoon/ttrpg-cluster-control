<template>
  <div class="google-drive-restore">
    <UButton
      color="neutral"
      variant="outline"
      size="sm"
      :disabled="busy || (canCancel && !isContinuing)"
      :loading="busy"
      @click="props.controller.activate"
    >
      {{ buttonLabel }}
    </UButton>
    <UButton
      v-if="canCancel && !dialogOpen"
      color="neutral"
      variant="ghost"
      size="xs"
      @click="() => props.controller.cancel()"
    >
      Cancel restore
    </UButton>
    <p v-if="message" class="m-0 text-sm" role="status" aria-live="polite">{{ message }}</p>

    <UModal
      v-model:open="dialogOpen"
      title="Google Drive backups"
      description="Choose a complete Jump Cluster backup from this app's private Google Drive storage. These files do not appear in regular Drive folders."
      :dismissible="!busy"
      :content="{ onOpenAutoFocus: captureOpener, onCloseAutoFocus: restoreFocus }"
      :ui="{ content: 'max-h-[calc(100dvh-2rem)] overflow-hidden', body: 'min-h-0 overflow-y-auto' }"
    >
      <template #body>
        <div class="grid gap-3">
          <p class="m-0 text-sm text-muted">These backups are kept in this app's private Google Drive storage and are managed here.</p>
          <p v-if="state === 'listing'" class="m-0" role="status" aria-live="polite">Loading your Google Drive backups...</p>
          <p v-else-if="state === 'listing-more'" class="m-0" role="status" aria-live="polite">Loading more backups...</p>
          <p v-else-if="state === 'reading'" class="m-0" role="status" aria-live="polite">Opening the selected backup...</p>
          <p v-else-if="state === 'downloading'" class="m-0" role="status" aria-live="polite">Preparing the selected JSON download...</p>
          <p v-else-if="!backups.length" class="m-0" role="status">No Google Drive backups are available yet.</p>

          <UAlert
            v-if="selectionError"
            color="error"
            variant="subtle"
            :description="selectionError"
            role="alert"
          />

          <ol v-if="backups.length" class="m-0 grid list-none gap-2 p-0" aria-label="Google Drive Jump Cluster backups">
            <li
              v-for="backup in backups"
              :key="backup.id"
              class="grid gap-2 rounded-md border border-[var(--line-soft)] p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
            >
              <div class="grid min-w-0 gap-1">
                <span class="break-all font-medium">{{ backup.name }}</span>
                <time class="text-sm text-muted" :datetime="backup.createdTime">{{ formatCreatedTime(backup.createdTime) }}</time>
              </div>
              <div class="flex flex-wrap gap-2">
                <UButton
                  color="neutral"
                  variant="outline"
                  size="sm"
                  :disabled="busy"
                  @click="props.controller.downloadBackup(backup.id)"
                >
                  Download JSON
                </UButton>
                <UButton
                  color="primary"
                  variant="soft"
                  size="sm"
                  :disabled="busy"
                  @click="props.controller.openBackup(backup.id)"
                >
                  Restore
                </UButton>
              </div>
            </li>
          </ol>

          <UButton
            v-if="canLoadMore"
            class="justify-self-start"
            color="neutral"
            variant="outline"
            size="sm"
            :loading="state === 'listing-more'"
            :disabled="busy"
            @click="props.controller.loadMore"
          >
            Load more backups
          </UButton>
        </div>
      </template>
      <template #footer>
        <div class="flex w-full justify-end">
          <UButton color="neutral" variant="ghost" @click="() => props.controller.cancel()">Cancel</UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { GoogleDriveRestoreController } from '../composables/useGoogleDriveRestore'

/** Presents the appDataFolder backup list while the page controller owns provider and restore state. */
const props = defineProps<{ controller: GoogleDriveRestoreController }>()
const state = computed(() => props.controller.state.value)
const busy = computed(() => props.controller.busy.value)
const canCancel = computed(() => props.controller.canCancel.value)
const canLoadMore = computed(() => props.controller.canLoadMore.value)
const buttonLabel = computed(() => props.controller.buttonLabel.value)
const message = computed(() => props.controller.message.value)
const selectionError = computed(() => props.controller.selectionError.value)
const backups = computed(() => props.controller.backups.value)
const isContinuing = computed(() => state.value === 'continue')
const dialogOpen = computed({
  get: () => props.controller.dialogOpen.value,
  set: open => { if (!open) props.controller.cancel() },
})
let opener: HTMLElement | null = null

function captureOpener(event: Event): void {
  opener = event.target instanceof HTMLElement ? event.target : document.activeElement as HTMLElement | null
}

function restoreFocus(): void {
  const target = opener
  opener = null
  if (target?.isConnected && !target.closest('[inert]')) target.focus()
}

function formatCreatedTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Date unavailable'
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}
</script>

<style scoped>
.google-drive-restore {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem;
}
</style>
