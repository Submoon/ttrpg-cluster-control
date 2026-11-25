<template>
  <div class="google-drive-backup">
    <p :id="retentionNoticeId" class="m-0 basis-full text-xs text-muted">
      This app keeps the {{ GOOGLE_DRIVE_BACKUP_LIMIT }} newest Google Drive backups across all Jump Clusters in this account.
      After saving a new backup, it permanently deletes older backups.
      Download JSON to keep a copy.
    </p>
    <UButton
      class="workspace-control workspace-map-import-button w-full"
      color="neutral"
      variant="outline"
      size="sm"
      type="button"
      :aria-describedby="retentionNoticeId"
      :disabled="busy || props.restoreInProgress || !props.signIn.ready.value"
      :loading="busy || props.signIn.status.value === 'warming'"
      @click="props.controller.activate"
    >
      {{ buttonLabel }}
    </UButton>
    <UButton
      v-if="canCancel"
      color="neutral"
      variant="ghost"
      size="xs"
      @click="props.controller.cancelBeforeUpload"
    >
      Cancel before upload
    </UButton>
    <UButton
      v-if="isRetrying || isRetryingCleanup"
      color="neutral"
      variant="ghost"
      size="xs"
      :disabled="props.restoreInProgress"
      :aria-describedby="retentionNoticeId"
      @click="props.controller.startNewBackupInstead"
    >
      {{ isRetryingCleanup ? 'Save another backup' : 'Start a new backup instead' }}
    </UButton>
  </div>
</template>

<script setup lang="ts">
import { computed, useId } from 'vue'
import type { GoogleDriveBackupController } from '../composables/useGoogleDriveBackup'
import type { useGoogleDriveSignIn } from '../composables/useGoogleDriveSignIn'
import { GOOGLE_DRIVE_BACKUP_LIMIT } from '../utils/google-drive-backup-snapshot'

/** Presentational trigger for the page-owned Google Drive backup controller. */
const props = defineProps<{
  controller: GoogleDriveBackupController
  signIn: ReturnType<typeof useGoogleDriveSignIn>
  restoreInProgress: boolean
}>()
const busy = computed(() => props.controller.busy.value)
const canCancel = computed(() => props.controller.canCancel.value)
const buttonLabel = computed(() => props.controller.buttonLabel.value)
const isRetrying = computed(() => props.controller.state.value === 'retry')
const isRetryingCleanup = computed(() => props.controller.state.value === 'cleanup-retry')
const retentionNoticeId = useId()
</script>

<style scoped>
.google-drive-backup {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem;
}
</style>
