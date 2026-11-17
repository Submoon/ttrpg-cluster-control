<template>
  <UModal
    v-model:open="open"
    title="Back up Jump Cluster to Dropbox"
    description="Save the complete Jump Cluster JSON in this app’s Dropbox App Folder. The backup can include GM notes. You manage sharing in Dropbox."
    :content="{ onCloseAutoFocus: props.restoreFocus }"
  >
    <template #body>
      <p v-if="props.message" class="m-0 mb-3 break-words text-sm" role="status">
        {{ props.message }}
      </p>
      <div class="flex flex-wrap items-center gap-2">
        <UButton :disabled="props.busy || props.restoreInProgress" :loading="props.busy" @click="emit('activate')">
          {{ props.buttonLabel }}
        </UButton>
        <UButton v-if="props.canCancel" color="neutral" variant="ghost" @click="emit('cancel')">
          Cancel before upload
        </UButton>
        <UButton
          v-if="props.canStartNew"
          color="neutral"
          variant="ghost"
          :disabled="props.busy || props.restoreInProgress"
          @click="emit('start-new')"
        >
          Start a new backup instead
        </UButton>
      </div>
    </template>
    <template #footer>
      <div class="flex w-full justify-end">
        <UButton color="neutral" variant="ghost" @click="open = false">Close</UButton>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
const open = defineModel<boolean>('open', { required: true })
const props = defineProps<{
  message: string
  buttonLabel: string
  busy: boolean
  canCancel: boolean
  canStartNew: boolean
  restoreInProgress: boolean
  restoreFocus: (event: Event) => void
}>()
const emit = defineEmits<{
  activate: []
  cancel: []
  'start-new': []
}>()
</script>
