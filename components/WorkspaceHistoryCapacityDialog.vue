<template>
  <UModal
    :open="props.request !== null"
    title="This change cannot be undone"
    description="This operation exceeds the capacity of this session's history."
    :ui="{ overlay: 'z-[80]', content: 'z-[81] max-h-[calc(100dvh-2rem)] overflow-hidden', body: 'min-h-0 overflow-y-auto', footer: 'shrink-0' }"
    @update:open="open => { if (!open) emit('resolve', false) }"
  >
    <template #body>
      <div class="grid gap-3">
        <p class="m-0 break-words">{{ props.request?.action.label }}</p>
        <p class="m-0">Continuing applies this change and clears all Undo and Redo history. You will not be able to undo this change.</p>
        <p class="m-0 text-sm text-muted">Cancel keeps your current data and history.</p>
      </div>
    </template>
    <template #footer>
      <div class="flex w-full flex-wrap justify-end gap-2">
        <UButton color="neutral" variant="ghost" autofocus @click="emit('resolve', false)">Cancel change</UButton>
        <UButton color="warning" @click="emit('resolve', true)">Continue and clear history</UButton>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import type { HistoryCapacityRequest } from '../composables/useWorkspaceHistory'

const props = defineProps<{ request: HistoryCapacityRequest | null }>()
const emit = defineEmits<{ resolve: [accepted: boolean] }>()
</script>
