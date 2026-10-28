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
        aria-keyshortcuts="Control+Z Meta+Z"
        :title="undoTitle"
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
        aria-keyshortcuts="Control+Shift+Z Control+Y Meta+Shift+Z"
        :title="redoTitle"
        :disabled="props.status.redoUnavailableReason !== null"
        aria-describedby="workspace-history-feedback"
        @click="emit('redo')"
      >Redo</UButton>
      <UButton
        class="workspace-control"
        color="neutral"
        variant="outline"
        size="sm"
        icon="i-lucide-history"
        aria-label="History"
        aria-haspopup="dialog"
        :aria-expanded="props.open"
        @click="emit('update:open', true)"
      >History</UButton>
    </div>
    <p id="workspace-history-feedback" class="workspace-history-feedback m-0 text-xs text-muted" role="status" aria-live="polite">
      {{ feedback }}
    </p>
    <p v-if="props.error" class="m-0 text-xs error-text" role="alert">{{ props.error }}</p>
  </div>
  <UModal
    :open="props.open"
    title="History"
    description="Read the bounded history retained for this editing session."
    :ui="{ content: 'max-h-[calc(100dvh-2rem)] overflow-hidden', body: 'min-h-0 overflow-y-auto' }"
    @update:open="emit('update:open', $event)"
  >
    <template #body>
      <div class="grid gap-3">
        <p class="m-0 text-sm text-muted">This is the bounded history retained for the current editing session, not a complete audit log. Reading it does not move through history or change the workspace.</p>
        <p v-if="props.status.notice" class="m-0 text-sm" role="status">{{ props.status.notice }}</p>
        <p v-if="props.status.retentionReduced && !props.status.notice" class="m-0 text-sm" role="status">Older actions were removed to stay within the history limit.</p>
        <p v-if="!props.entries.length" class="m-0" role="status">{{ props.status.notice ?? 'History starts with the first applied change in this session.' }}</p>
        <ol v-else class="workspace-history-list m-0 grid list-none gap-2 p-0" aria-label="Retained actions in chronological order">
          <template v-for="(entry, index) in props.entries" :key="`${index}:${entry.action.workspaceId}:${entry.action.target.id}`">
            <li v-if="index === props.status.undoDepth" class="workspace-history-position" role="status" aria-label="Current history position">Current position</li>
            <li class="workspace-history-entry grid gap-1" :data-applied="entry.applied">
              <span class="font-medium">{{ entry.action.label }}</span>
              <span class="text-sm text-muted">{{ entry.action.contextLabel }}</span>
              <span class="text-xs text-muted">{{ entry.applied ? 'Applied' : 'Available through Redo' }}</span>
            </li>
          </template>
          <li v-if="props.status.undoDepth === props.entries.length" class="workspace-history-position" role="status" aria-label="Current history position">Current position</li>
        </ol>
        <p v-if="props.entries.length" class="m-0 text-sm text-muted">{{ props.status.undoDepth }} available to undo · {{ props.status.redoDepth }} available through Redo</p>
        <p v-else class="m-0 text-sm text-muted">Current position: initial baseline</p>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { WorkspaceHistoryStatus } from '../composables/useWorkspaceHistory'
import type { WorkspaceHistoryEntry } from '../composables/editor-workflows/workspace-mutations'

const props = defineProps<{ open: boolean; status: WorkspaceHistoryStatus; entries: readonly WorkspaceHistoryEntry[]; error?: string }>()
const emit = defineEmits<{ undo: []; redo: []; 'update:open': [open: boolean] }>()

const undoLabel = computed(() => props.status.undoAction
  ? `Undo: ${props.status.undoAction.label} · ${props.status.undoAction.contextLabel}`
  : 'Undo')
const redoLabel = computed(() => props.status.redoAction
  ? `Redo: ${props.status.redoAction.label} · ${props.status.redoAction.contextLabel}`
  : 'Redo')
const undoTitle = computed(() => `${props.status.undoUnavailableReason ?? undoLabel.value}. Shortcut: Ctrl+Z or Cmd+Z.`)
const redoTitle = computed(() => `${props.status.redoUnavailableReason ?? redoLabel.value}. Shortcut: Ctrl+Shift+Z, Ctrl+Y or Cmd+Shift+Z.`)
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
