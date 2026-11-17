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
    description="Choose a complete Jump Cluster backup from this app’s Dropbox App Folder."
    :content="{ onCloseAutoFocus: restoreFocus }"
    :ui="{ content: 'max-h-[calc(100dvh-2rem)] overflow-hidden', body: 'min-h-0 overflow-y-auto' }"
  >
    <template #body>
      <p v-if="displayMessage" class="m-0 mb-3 text-sm" role="status">
        {{ displayMessage }}
      </p>
      <ol v-if="props.controller.backups.value.length" class="m-0 grid list-none gap-2 p-0" aria-label="Dropbox Jump Cluster backups">
        <li v-for="backup in props.controller.backups.value" :key="backup.id">
          <UButton
            class="w-full text-start"
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
        </li>
      </ol>
      <p v-else-if="!displayMessage" class="m-0 text-sm" role="status">No Dropbox backups are available yet.</p>
    </template>
    <template #footer>
      <div class="flex w-full justify-end">
        <UButton color="neutral" variant="ghost" @click="cancelRestore">Cancel</UButton>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import { computed, nextTick } from 'vue'
import type { DropboxRestoreController } from '../composables/useDropboxRestore'
import { createDialogFocusTarget, restoreDialogFocus } from '../utils/dialog-focus'

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
const dialogOpen = computed({
  get: () => props.controller.dialogOpen.value,
  set: open => { if (!open) cancelRestore() },
})
const displayMessage = computed(() => props.controller.message.value
  || (props.controller.state.value === 'authorizing' ? 'Signing in to Dropbox…' : '')
  || (props.controller.state.value === 'listing' ? 'Loading Dropbox backups…' : '')
  || (props.controller.state.value === 'downloading' ? 'Opening the selected backup…' : ''))
let opener: HTMLElement | null = null

function activateFrom(target: HTMLElement | null): void {
  if (!props.available || props.blocked || dialogOpen.value || props.controller.busy.value) return
  opener = target
  props.controller.activate()
}

function activateFromTrigger(event: MouseEvent): void {
  activateFrom(event.currentTarget instanceof HTMLElement ? event.currentTarget : null)
}

function selectBackup(id: string): void {
  emit('restore-review-open', opener)
  props.controller.select(id)
}

function cancelRestore(): void {
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

function formatDate(value: string): string {
  return new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

defineExpose({ activateFrom })
</script>
