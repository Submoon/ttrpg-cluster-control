<template>
  <div class="google-drive-restore">
    <UButton
      ref="restoreTrigger"
      :class="triggerClass"
      color="neutral"
      variant="outline"
      :size="triggerSize"
      type="button"
      :disabled="canCancel || !props.signIn.ready.value"
      :loading="busy || props.signIn.status.value === 'warming'"
      @click="activateFromTrigger"
    >
      {{ buttonLabel }}
    </UButton>
    <UButton
      v-if="canCancel && !dialogOpen"
      color="neutral"
      variant="ghost"
      size="xs"
      @click="cancelRestore"
    >
      Cancel restore
    </UButton>
    <UButton
      v-if="props.signIn.status.value === 'error'"
      color="neutral"
      variant="ghost"
      size="xs"
      type="button"
      @click="props.signIn.retryLoading"
    >
      Retry loading Google Drive
    </UButton>
    <UButton
      v-if="props.signIn.hasAccessToken.value"
      ref="forgetTrigger"
      color="neutral"
      variant="ghost"
      size="xs"
      type="button"
      :disabled="canCancel || props.backupInProgress"
      @click="props.signIn.forgetAccessToken"
    >
      Forget Google Drive account
    </UButton>
    <p v-if="message" class="m-0 basis-full text-sm" role="status" aria-live="polite">{{ message }}</p>

    <UModal
      v-model:open="dialogOpen"
      title="Google Drive backups"
      description="Choose a complete Jump Cluster backup from this app's private Google Drive storage. These files do not appear in regular Drive folders."
      :dismissible="!busy"
      :content="{ onCloseAutoFocus: restoreFocus }"
      :ui="{ content: 'max-h-[calc(100dvh-2rem)] overflow-hidden', body: 'min-h-0 overflow-y-auto' }"
    >
      <template #body>
        <div class="grid gap-3">
          <p class="m-0 text-sm text-muted">These backups are kept in this app's private Google Drive storage and are managed here.</p>
          <p v-if="state === 'choosing' && !backups.length" class="m-0" role="status">No Google Drive backups are available yet.</p>
          <p class="sr-only" role="status" aria-live="polite" aria-atomic="true">{{ restoreToastTitle }}</p>

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
                  @click="openBackup(backup.id)"
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
        <div class="grid w-full gap-3">
          <ToastProvider label="Google Drive restore updates" :duration="5000" :disable-swipe="true">
            <ToastViewport
              :hotkey="[]"
              :class="restoreToastTitle ? 'grid w-full list-none gap-2 p-0' : 'w-full list-none p-0'"
              label="Google Drive restore notifications"
            >
              <UToast
                v-if="restoreToastTitle"
                :key="restoreToastKey"
                :open="true"
                :title="restoreToastTitle"
                :duration="restoreProgressTitle ? 0 : undefined"
                :close="!restoreProgressTitle"
                :progress="!restoreProgressTitle"
                :color="restoreProgressTitle ? 'neutral' : 'success'"
                :icon="restoreProgressTitle ? 'i-lucide-loader-circle' : 'i-lucide-check'"
                :ui="restoreToastUi"
                class="w-full"
                @update:open="onRestoreToastOpenChange"
              />
            </ToastViewport>
          </ToastProvider>
          <div class="flex w-full justify-end">
            <UButton color="neutral" variant="ghost" @click="cancelRestore">Cancel</UButton>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue'
import { ToastProvider, ToastViewport } from 'reka-ui'
import type { GoogleDriveRestoreController, GoogleDriveRestoreState } from '../composables/useGoogleDriveRestore'
import type { useGoogleDriveSignIn } from '../composables/useGoogleDriveSignIn'
import { createDialogFocusTarget, restoreDialogFocus } from '../utils/dialog-focus'

/** Presents the appDataFolder backup list while the page controller owns provider and restore state. */
const props = defineProps<{
  controller: GoogleDriveRestoreController
  signIn: ReturnType<typeof useGoogleDriveSignIn>
  surface?: 'welcome'
  backupInProgress?: boolean
  reviewOpen: boolean
  fallbackFocusTarget: HTMLElement | null
}>()
const emit = defineEmits<{
  'restore-review-open': [target: HTMLElement | null]
  'restore-canceled': []
}>()
const state = computed(() => props.controller.state.value)
const busy = computed(() => props.controller.busy.value)
const canCancel = computed(() => props.controller.canCancel.value)
const canLoadMore = computed(() => props.controller.canLoadMore.value)
const buttonLabel = computed(() => props.controller.buttonLabel.value)
const message = computed(() => props.signIn.message.value || props.controller.message.value)
const selectionError = computed(() => props.controller.selectionError.value)
const backups = computed(() => props.controller.backups.value)
const restoreProgressTitles: Record<GoogleDriveRestoreState, string> = {
  idle: '',
  authorizing: '',
  listing: 'Loading Google Drive backups…',
  choosing: '',
  'listing-more': 'Loading more backups…',
  reading: 'Opening the selected backup…',
  downloading: 'Preparing the backup download…',
}
const restoreProgressTitle = computed(() => restoreProgressTitles[state.value])
const downloadToastOpen = ref(false)
const downloadToastVersion = ref(0)
const restoreToastTitle = computed(() => restoreProgressTitle.value
  || (downloadToastOpen.value ? 'Backup downloaded from Google Drive' : ''))
const restoreToastKey = computed(() => restoreProgressTitle.value
  ? `progress:${restoreProgressTitle.value}`
  : `download:${downloadToastVersion.value}`)
const restoreToastUi = computed(() => ({ icon: restoreProgressTitle.value ? 'motion-safe:animate-spin' : undefined }))
const triggerClass = computed(() => props.surface === 'welcome'
  ? 'secondary-button launch-action'
  : 'workspace-control workspace-map-import-button w-full')
const triggerSize = computed(() => props.surface === 'welcome' ? 'md' : 'sm')
const dialogOpen = computed({
  get: () => props.controller.dialogOpen.value,
  set: open => { if (!open) cancelRestore() },
})
const restoreTrigger = useTemplateRef('restoreTrigger')
const forgetTrigger = useTemplateRef('forgetTrigger')
let opener: HTMLElement | null = null

watch(props.controller.completedDownloads, (count, previousCount) => {
  if (count <= previousCount) return
  downloadToastOpen.value = true
  downloadToastVersion.value = count
}, { flush: 'sync' })

watch(restoreProgressTitle, title => {
  if (title) downloadToastOpen.value = false
})

watch(props.signIn.hasAccessToken, available => {
  const previous = forgetTrigger.value?.$el
  if (available || !previous || document.activeElement !== previous) return
  void nextTick(() => {
    const trigger = restoreTrigger.value?.$el
    restoreDialogFocus(
      createDialogFocusTarget(trigger instanceof HTMLElement ? trigger : null),
      createDialogFocusTarget(props.fallbackFocusTarget),
    )
  })
})

function activateFromTrigger(event: MouseEvent): void {
  opener = event.currentTarget instanceof HTMLElement ? event.currentTarget : null
  props.controller.activate()
}

function openBackup(fileId: string): void {
  emit('restore-review-open', opener)
  props.controller.openBackup(fileId)
}

function cancelRestore(): void {
  emit('restore-canceled')
  props.controller.cancel()
}

function onRestoreToastOpenChange(open: boolean): void {
  if (!open && !restoreProgressTitle.value) downloadToastOpen.value = false
}

function restoreFocus(event: Event): void {
  event.preventDefault()
  const originalOpener = opener
  void nextTick(() => {
    // Let the replacement review take focus when this dialog closes into it.
    if (props.reviewOpen) return
    restoreDialogFocus(
      createDialogFocusTarget(originalOpener),
      createDialogFocusTarget(props.fallbackFocusTarget),
    )
    opener = null
  })
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
