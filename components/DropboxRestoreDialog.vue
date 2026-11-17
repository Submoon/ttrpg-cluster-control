<template>
  <div v-if="props.surface === 'welcome'" class="flex flex-wrap items-center gap-2">
    <UButton
      class="secondary-button launch-action"
      color="neutral"
      variant="outline"
      size="md"
      :disabled="!props.available || props.blocked || props.controller.busy.value || dialogOpen"
      :loading="props.controller.busy.value && !dialogOpen"
      @click="activateFromTrigger"
    >
      Restore Jump Cluster from Dropbox
    </UButton>
  </div>

  <UModal
    v-model:open="dialogOpen"
    title="Restore Jump Cluster from Dropbox"
    description="Choose a complete Jump Cluster backup from this app’s Dropbox App Folder. Dated app backups can also be deleted from Dropbox."
    :dismissible="props.controller.canCancel.value"
    :close="props.controller.canCancel.value"
    :content="{ onCloseAutoFocus: restoreFocus }"
    :ui="{ content: 'max-h-[calc(100dvh-2rem)] overflow-hidden', body: 'min-h-0 overflow-y-auto' }"
  >
    <template #body>
      <p v-if="displayMessage" class="m-0 mb-3 text-sm" role="status" aria-live="polite">
        {{ displayMessage }}
      </p>
      <p v-if="restoreToastTitle" class="sr-only" role="status" aria-live="polite" aria-atomic="true">{{ restoreToastTitle }}</p>
      <div ref="backupListFocusTarget" tabindex="-1">
        <ol v-if="props.controller.backups.value.length" class="m-0 grid list-none gap-2 p-0" aria-label="Dropbox Jump Cluster backups">
          <li v-for="backup in props.controller.backups.value" :key="backup.id">
            <div class="grid gap-2">
              <div class="flex flex-wrap items-stretch gap-2">
                <UButton
                  class="min-w-0 flex-1 justify-start text-start"
                  color="neutral"
                  variant="outline"
                  :aria-label="`Restore ${backup.name}`"
                  :disabled="props.controller.busy.value"
                  @click="selectBackup(backup.id)"
                >
                  <span class="grid min-w-0 gap-1">
                    <span class="break-all font-medium">{{ backup.name }}</span>
                    <time class="text-xs text-muted" :datetime="backup.modifiedAt">{{ formatDate(backup.modifiedAt) }}</time>
                  </span>
                </UButton>
                <UButton
                  v-if="isDropboxDatedBackupName(backup.name)"
                  color="neutral"
                  variant="ghost"
                  :aria-label="`Delete ${backup.name} from Dropbox`"
                  :disabled="props.controller.busy.value || props.controller.refreshRequired.value"
                  @click="openDeleteConfirmation(backup, $event)"
                >
                  Delete
                </UButton>
              </div>
              <div
                v-if="isPendingDelete(backup)"
                class="grid gap-2 rounded-md border border-default p-3"
                role="group"
                :aria-label="`Confirm delete ${backup.name}`"
              >
                <p class="m-0 text-sm">Delete <span class="break-all font-medium">{{ backup.name }}</span> from your Dropbox App Folder?</p>
                <div class="flex flex-wrap items-center gap-2">
                  <UButton
                    color="error"
                    variant="soft"
                    :aria-label="`Confirm delete ${backup.name} from Dropbox`"
                    :loading="props.controller.state.value === 'deleting' && isPendingDelete(backup)"
                    :disabled="props.controller.busy.value"
                    @click="confirmDelete"
                  >
                    Delete backup
                  </UButton>
                  <UButton :ref="setKeepBackupButton" color="neutral" variant="ghost" :disabled="props.controller.busy.value" @click="cancelDeleteConfirmation">
                    Keep backup
                  </UButton>
                </div>
              </div>
            </div>
          </li>
        </ol>
        <p v-else-if="!displayMessage" class="m-0 text-sm" role="status">No Dropbox backups are available yet.</p>
      </div>
    </template>
    <template #footer>
      <div class="grid w-full gap-3">
        <ToastProvider label="Dropbox restore updates" :duration="5000" :disable-swipe="true">
          <ToastViewport
            :hotkey="[]"
            :class="restoreToastTitle ? 'grid w-full list-none gap-2 p-0' : 'w-full list-none p-0'"
            label="Dropbox restore notifications"
          >
            <UToast
              v-if="restoreToastTitle"
              :key="completedToastVersion"
              :open="true"
              :title="restoreToastTitle"
              close
              progress
              color="success"
              icon="i-lucide-check"
              class="w-full"
              @update:open="onRestoreToastOpenChange"
            />
          </ToastViewport>
        </ToastProvider>
        <div class="flex w-full flex-wrap justify-end gap-2">
          <UButton
            color="neutral"
            variant="outline"
            :disabled="props.controller.busy.value"
            @click="refreshBackups"
          >
            Refresh backups
          </UButton>
          <UButton color="neutral" variant="ghost" :disabled="!props.controller.canCancel.value" @click="cancelRestore">
            Cancel
          </UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { ToastProvider, ToastViewport } from 'reka-ui'
import type { DropboxRestoreBackup, DropboxRestoreController } from '../composables/useDropboxRestore'
import { createDialogFocusTarget, restoreDialogFocus } from '../utils/dialog-focus'
import { isDropboxDatedBackupName } from '../utils/dropbox-backup-snapshot'

const props = defineProps<{
  controller: DropboxRestoreController
  available: boolean
  blocked: boolean
  surface: 'welcome' | 'menu'
  reviewOpen: boolean
  fallbackFocusTarget: HTMLElement | null
}>()
const emit = defineEmits<{
  'restore-review-open': [target: HTMLElement | null]
  'restore-canceled': []
}>()
const state = computed(() => props.controller.state.value)
const dialogOpen = computed({
  get: () => props.controller.dialogOpen.value,
  set: (open: boolean) => {
    if (open) return
    if (props.controller.canCancel.value) cancelRestore()
  },
})
const displayMessage = computed(() => props.controller.message.value
  || (props.controller.state.value === 'authorizing' ? 'Signing in to Dropbox…' : '')
  || (props.controller.state.value === 'listing' ? 'Loading Dropbox backups…' : '')
  || (props.controller.state.value === 'downloading' ? 'Opening the selected backup…' : '')
  || (props.controller.state.value === 'deleting' ? 'Deleting the selected backup from Dropbox…' : '')
  || (props.controller.state.value === 'refreshing' ? 'Refreshing Dropbox backups…' : ''))
const completedToastOpen = ref(false)
const completedToastVersion = ref(0)
const restoreToastTitle = computed(() => completedToastOpen.value ? 'Backup deleted from Dropbox' : '')
const pendingDelete = ref<Pick<DropboxRestoreBackup, 'id' | 'name' | 'rev'> | null>(null)
const deleteTrigger = ref<HTMLElement | null>(null)
const backupListFocusTarget = ref<HTMLElement | null>(null)
let keepBackupButton: HTMLElement | null = null
let opener: HTMLElement | null = null
let focusAfterDeletion = false

watch(props.controller.completedDeletions, (count, previousCount) => {
  if (count <= previousCount) return
  completedToastOpen.value = true
  completedToastVersion.value += 1
  pendingDelete.value = null
  if (focusAfterDeletion) {
    focusAfterDeletion = false
    void nextTick(() => backupListFocusTarget.value?.focus())
  }
}, { flush: 'sync' })

function activateFrom(target: HTMLElement | null): void {
  if (!props.available || props.blocked || dialogOpen.value || props.controller.busy.value) return
  opener = target
  props.controller.activate()
}

function activateFromTrigger(event: MouseEvent): void {
  activateFrom(event.currentTarget instanceof HTMLElement ? event.currentTarget : null)
}

function selectBackup(id: string): void {
  pendingDelete.value = null
  emit('restore-review-open', opener)
  props.controller.select(id)
}

function openDeleteConfirmation(backup: DropboxRestoreBackup, event: MouseEvent): void {
  pendingDelete.value = { id: backup.id, name: backup.name, rev: backup.rev }
  deleteTrigger.value = event.currentTarget instanceof HTMLElement ? event.currentTarget : null
  void nextTick(() => keepBackupButton?.focus())
}

function setKeepBackupButton(target: unknown): void {
  const element = target && typeof target === 'object' && '$el' in target ? target.$el : target
  keepBackupButton = element instanceof HTMLElement ? element : null
}

function isPendingDelete(backup: DropboxRestoreBackup): boolean {
  return pendingDelete.value?.id === backup.id && pendingDelete.value.rev === backup.rev
}

function confirmDelete(): void {
  const selected = pendingDelete.value
  if (!selected || !props.controller.canCancel.value) return
  props.controller.deleteBackup(selected.id, selected.rev)
  focusAfterDeletion = state.value === 'deleting'
  if (focusAfterDeletion) {
    void nextTick(() => backupListFocusTarget.value?.focus())
  } else {
    void nextTick(() => deleteTrigger.value?.focus())
  }
}

function cancelDeleteConfirmation(): void {
  pendingDelete.value = null
  void nextTick(() => deleteTrigger.value?.focus())
}

function refreshBackups(): void {
  pendingDelete.value = null
  props.controller.refresh()
}

function cancelRestore(): void {
  if (!props.controller.canCancel.value) return
  pendingDelete.value = null
  props.controller.cancel()
  emit('restore-canceled')
}

function restoreFocus(event: Event): void {
  event.preventDefault()
  void nextTick(() => {
    if (props.reviewOpen) return
    restoreDialogFocus(createDialogFocusTarget(opener), createDialogFocusTarget(props.fallbackFocusTarget))
  })
}

watch(state, (currentState, previousState) => {
  if (currentState !== 'choosing') completedToastOpen.value = false
  if (previousState === 'deleting' && currentState !== 'deleting') {
    pendingDelete.value = null
    focusAfterDeletion = false
    return
  }
  if (currentState !== 'deleting') pendingDelete.value = null
})

function onRestoreToastOpenChange(open: boolean): void {
  if (!open) completedToastOpen.value = false
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

defineExpose({ activateFrom })
</script>
