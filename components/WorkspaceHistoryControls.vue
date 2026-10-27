<template>
  <div class="workspace-history-controls" role="group" aria-label="Edit history">
    <div class="flex items-center gap-1">
      <UButton
        class="workspace-control"
        color="neutral"
        variant="outline"
        size="sm"
        icon="i-lucide-undo-2"
        :aria-label="undoLabel"
        :title="props.status.undoUnavailableReason ?? undoLabel"
        :disabled="props.status.undoUnavailableReason !== null"
        aria-describedby="workspace-history-feedback"
        @click="emit('undo')"
      >Undo</UButton>
      <UButton
        class="workspace-control"
        color="neutral"
        variant="outline"
        size="sm"
        icon="i-lucide-redo-2"
        :aria-label="redoLabel"
        :title="props.status.redoUnavailableReason ?? redoLabel"
        :disabled="props.status.redoUnavailableReason !== null"
        aria-describedby="workspace-history-feedback"
        @click="emit('redo')"
      >Redo</UButton>
    </div>
    <p id="workspace-history-feedback" class="workspace-history-feedback m-0 text-xs text-muted" role="status" aria-live="polite">
      {{ feedback }}
    </p>
    <p v-if="props.error" class="m-0 text-xs error-text" role="alert">{{ props.error }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { WorkspaceHistoryStatus } from '../composables/useWorkspaceHistory'

const props = defineProps<{ status: WorkspaceHistoryStatus; error?: string }>()
const emit = defineEmits<{ undo: []; redo: [] }>()
const undoLabel = computed(() => props.status.undoAction ? `Undo: ${props.status.undoAction.label}` : 'Undo')
const redoLabel = computed(() => props.status.redoAction ? `Redo: ${props.status.redoAction.label}` : 'Redo')
const feedback = computed(() => {
  const commonReason = props.status.undoUnavailableReason
  if (commonReason && commonReason === props.status.redoUnavailableReason) return commonReason
  const reason = props.status.undoAction ? props.status.undoUnavailableReason
    : props.status.redoAction ? props.status.redoUnavailableReason : null
  if (reason) return reason
  if (props.status.retentionReduced) return props.status.notice ?? 'Older history was removed to stay within capacity.'
  if (!props.status.totalActions) return props.status.notice ?? 'History starts with your first change.'
  return `${props.status.undoDepth} to undo · ${props.status.redoDepth} to redo`
})
</script>

<style scoped>
.workspace-history-controls {
  display: grid;
  flex: none;
  width: 19rem;
  min-width: 0;
  max-width: 100%;
  gap: 0.2rem;
}

/* Keep neighbouring commands still when a popover closes between pointer down and up. */
.workspace-history-feedback {
  min-height: 2lh;
}
</style>
