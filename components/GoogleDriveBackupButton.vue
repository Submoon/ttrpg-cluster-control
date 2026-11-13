<template>
  <div class="google-drive-backup">
    <UButton
      color="neutral"
      variant="outline"
      size="sm"
      :disabled="busy"
      :loading="busy"
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
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { GoogleDriveBackupController } from '../composables/useGoogleDriveBackup'

/** Presentational trigger for the page-owned Google Drive backup controller. */
const props = defineProps<{ controller: GoogleDriveBackupController }>()
const busy = computed(() => props.controller.busy.value)
const canCancel = computed(() => props.controller.canCancel.value)
const buttonLabel = computed(() => props.controller.buttonLabel.value)
</script>

<style scoped>
.google-drive-backup {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem;
}
</style>
