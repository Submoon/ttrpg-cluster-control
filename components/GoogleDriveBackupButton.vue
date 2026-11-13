<template>
  <div class="google-drive-backup">
    <UButton
      class="workspace-control workspace-map-import-button w-full"
      color="neutral"
      variant="outline"
      size="sm"
      type="button"
      :disabled="busy || !props.signIn.ready.value"
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
      v-if="isRetrying"
      color="neutral"
      variant="ghost"
      size="xs"
      @click="props.controller.startNewBackupInstead"
    >
      Start a new backup instead
    </UButton>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { GoogleDriveBackupController } from '../composables/useGoogleDriveBackup'
import type { useGoogleDriveSignIn } from '../composables/useGoogleDriveSignIn'

/** Presentational trigger for the page-owned Google Drive backup controller. */
const props = defineProps<{
  controller: GoogleDriveBackupController
  signIn: ReturnType<typeof useGoogleDriveSignIn>
}>()
const busy = computed(() => props.controller.busy.value)
const canCancel = computed(() => props.controller.canCancel.value)
const buttonLabel = computed(() => props.controller.buttonLabel.value)
const isRetrying = computed(() => props.controller.state.value === 'retry')
</script>

<style scoped>
.google-drive-backup {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem;
}
</style>
