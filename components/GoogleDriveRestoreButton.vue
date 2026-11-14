<template>
  <div class="google-drive-restore">
    <UButton
      ref="restoreTrigger"
      :class="triggerClass"
      color="neutral"
      variant="outline"
      :size="triggerSize"
      type="button"
      :disabled="dialogOpen || props.backupInProgress || !props.signIn.ready.value"
      :loading="busy || props.backupInProgress || props.signIn.status.value === 'warming'"
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
      :disabled="dialogOpen || props.backupInProgress"
      @click="props.signIn.forgetAccessToken"
    >
      Forget Google Drive account
    </UButton>
    <p v-if="message" class="m-0 basis-full text-sm" role="status" aria-live="polite">{{ message }}</p>

    <UModal
      v-model:open="dialogOpen"
      title="Google Drive backups"
      description="Choose a complete Jump Cluster backup from this app's private Google Drive storage. These files do not appear in regular Drive folders."
      :close="state !== 'deleting'"
      :dismissible="state !== 'deleting' && !busy"
      :content="{ onCloseAutoFocus: restoreFocus }"
      :ui="{ content: 'max-h-[calc(100dvh-2rem)] overflow-hidden', body: 'min-h-0 overflow-y-auto' }"
    >
      <template #body>
        <div class="grid gap-3">
          <p class="m-0 text-sm text-muted">{{ retentionMessage }}</p>
          <p class="sr-only" role="status" aria-live="polite" aria-atomic="true">{{ restoreToastTitle }}</p>
          <UAlert
            v-if="selectionError"
            color="error"
            variant="subtle"
            :description="selectionError"
            role="alert"
          />

          <div ref="backupListFocusTarget" tabindex="-1">
            <p v-if="state === 'choosing' && !backups.length && !refreshRequired && !canLoadMore" class="m-0" role="status">No Google Drive backups are available yet.</p>
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
                  <UButton
                    v-if="canDeleteBackup(backup)"
                    :ref="element => setDeleteButtonRef(backup.id, element)"
                    color="error"
                    variant="outline"
                    size="sm"
                    :disabled="busy"
                    :aria-label="`Delete ${backup.name} from Google Drive`"
                    @click="requestDelete(backup)"
                  >
                    Delete
                  </UButton>
                </div>
                <div
                  v-if="deleteConfirmationId === backup.id"
                  class="grid gap-2 rounded-md border border-[var(--line-soft)] bg-[var(--panel-raised)] p-3 sm:col-span-2"
                  role="group"
                  :aria-label="`Confirm permanent deletion of ${backup.name}`"
                >
                  <p class="m-0 text-sm">Permanently delete <strong class="break-all">{{ backup.name }}</strong>? This cannot be undone.</p>
                  <div class="flex flex-wrap gap-2">
                    <UButton color="error" variant="solid" size="sm" :disabled="busy" @click="confirmDelete(backup)">
                      Delete permanently
                    </UButton>
                    <UButton color="neutral" variant="outline" size="sm" :disabled="busy" @click="cancelDeleteConfirmation(backup.id)">
                      Keep backup
                    </UButton>
                  </div>
                </div>
              </li>
            </ol>
          </div>

          <p v-if="refreshRequired" class="m-0 text-sm text-muted" role="status">Refresh the list to check the latest backups.</p>
          <UButton
            v-if="canRefresh"
            class="justify-self-start"
            color="neutral"
            variant="outline"
            size="sm"
            :loading="state === 'refreshing'"
            :disabled="busy"
            @click="props.controller.refreshBackups"
          >
            Refresh backup list
          </UButton>

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
            <UButton color="neutral" variant="ghost" :disabled="state === 'deleting'" @click="cancelRestore">Cancel</UButton>
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
import { isGoogleDriveBackupName } from '../utils/google-drive-api'
import { GOOGLE_DRIVE_BACKUP_LIMIT } from '../utils/google-drive-backup-snapshot'

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
const canRefresh = computed(() => props.controller.canRefresh.value)
const refreshRequired = computed(() => props.controller.refreshRequired.value)
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
  deleting: 'Deleting the selected backup…',
  refreshing: 'Refreshing Google Drive backups…',
}
const restoreProgressTitle = computed(() => restoreProgressTitles[state.value])
const completedToastOpen = ref(false)
const completedToastTitle = ref('')
const completedToastVersion = ref(0)
const restoreToastTitle = computed(() => restoreProgressTitle.value || (completedToastOpen.value ? completedToastTitle.value : ''))
const restoreToastKey = computed(() => restoreProgressTitle.value
  ? `progress:${restoreProgressTitle.value}`
  : `completed:${completedToastVersion.value}`)
const restoreToastUi = computed(() => ({ icon: restoreProgressTitle.value ? 'motion-safe:animate-spin' : undefined }))
const retentionMessage = `This app keeps the ${GOOGLE_DRIVE_BACKUP_LIMIT} newest Google Drive backups for this account across all Jump Clusters. Older backups are permanently deleted after a new backup is saved. Download JSON to keep a copy.`
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
const backupListFocusTarget = useTemplateRef<HTMLElement>('backupListFocusTarget')
const deleteConfirmationId = ref<string | null>(null)
const deleteButtonElements = new Map<string, HTMLElement>()
let focusAfterDeletion = false
let opener: HTMLElement | null = null

watch(props.controller.completedDownloads, (count, previousCount) => {
  if (count <= previousCount) return
  completedToastOpen.value = true
  completedToastTitle.value = 'Backup downloaded from Google Drive'
  completedToastVersion.value += 1
}, { flush: 'sync' })

watch(props.controller.completedDeletions, (count, previousCount) => {
  if (count <= previousCount) return
  completedToastOpen.value = true
  completedToastTitle.value = 'Backup deleted from Google Drive'
  completedToastVersion.value += 1
  deleteConfirmationId.value = null
  if (focusAfterDeletion) {
    focusAfterDeletion = false
    void nextTick(() => backupListFocusTarget.value?.focus())
  }
}, { flush: 'sync' })

watch(restoreProgressTitle, title => {
  if (title) completedToastOpen.value = false
})

watch(state, currentState => {
  if (currentState !== 'choosing') deleteConfirmationId.value = null
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

function canDeleteBackup(backup: { name: string; canDelete?: boolean }): boolean {
  return backup.canDelete !== false && isGoogleDriveBackupName(backup.name)
}

function requestDelete(backup: { id: string }): void {
  if (busy.value) return
  deleteConfirmationId.value = backup.id
}

function setDeleteButtonRef(id: string, target: unknown): void {
  if (target instanceof HTMLElement) {
    deleteButtonElements.set(id, target)
  } else if (target && typeof target === 'object' && '$el' in target && target.$el instanceof HTMLElement) {
    deleteButtonElements.set(id, target.$el)
  } else {
    deleteButtonElements.delete(id)
  }
}

function cancelDeleteConfirmation(id: string): void {
  deleteConfirmationId.value = null
  void nextTick(() => deleteButtonElements.get(id)?.focus())
}

function confirmDelete(backup: { id: string; name: string; createdTime: string; canDelete?: boolean }): void {
  if (busy.value || deleteConfirmationId.value !== backup.id) return
  deleteConfirmationId.value = null
  props.controller.deleteBackup(backup)
  focusAfterDeletion = props.controller.state.value === 'deleting'
  if (focusAfterDeletion) {
    void nextTick(() => backupListFocusTarget.value?.focus())
  } else {
    void nextTick(() => deleteButtonElements.get(backup.id)?.focus())
  }
}

function cancelRestore(): void {
  if (state.value === 'deleting') return
  emit('restore-canceled')
  props.controller.cancel()
}

function onRestoreToastOpenChange(open: boolean): void {
  if (!open && !restoreProgressTitle.value) completedToastOpen.value = false
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
