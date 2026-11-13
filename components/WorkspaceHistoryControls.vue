<template>
  <div
    class="workspace-history-controls"
    :class="{ 'workspace-history-controls-has-notice': feedback || props.error }"
    role="group"
    aria-label="Edit history"
  >
    <div class="flex items-center gap-3">
      <UChip size="3xl" class="workspace-history-count" :ui="countChipUi">
        <UTooltip :text="undoTooltipText" :kbds="undoKeycaps" :ui="historyTooltipUi">
          <UButton
            class="workspace-control workspace-map-icon-control"
            color="neutral"
            variant="outline"
            size="sm"
            :aria-label="undoLabel"
            aria-keyshortcuts="Control+Z Meta+Z"
            :aria-description="undoDescription"
            :disabled="props.status.undoUnavailableReason !== null"
            aria-describedby="workspace-history-feedback workspace-history-error"
            @click="emit('undo')"
          >
            <UIcon class="workspace-history-action-icon" name="i-lucide-undo-2" aria-hidden="true" />
          </UButton>
        </UTooltip>
        <template #content><span aria-hidden="true">{{ props.status.undoDepth }}</span></template>
      </UChip>
      <UChip size="3xl" class="workspace-history-count" :ui="countChipUi">
        <UTooltip :text="redoTooltipText" :kbds="redoKeycaps" :ui="historyTooltipUi">
          <UButton
            class="workspace-control workspace-map-icon-control"
            color="neutral"
            variant="outline"
            size="sm"
            :aria-label="redoLabel"
            aria-keyshortcuts="Control+Shift+Z Control+Y Meta+Shift+Z"
            :aria-description="redoDescription"
            :disabled="props.status.redoUnavailableReason !== null"
            aria-describedby="workspace-history-feedback workspace-history-error"
            @click="emit('redo')"
          >
            <UIcon class="workspace-history-action-icon" name="i-lucide-redo-2" aria-hidden="true" />
          </UButton>
        </UTooltip>
        <template #content><span aria-hidden="true">{{ props.status.redoDepth }}</span></template>
      </UChip>
      <UTooltip text="History" :ui="historyTooltipUi">
        <UButton
          class="workspace-control workspace-map-icon-control"
          color="neutral"
          variant="outline"
          size="sm"
          aria-label="History"
          aria-haspopup="dialog"
          :aria-expanded="props.open"
          @click="emit('update:open', true)"
        >
          <UIcon class="workspace-history-action-icon" name="i-lucide-history" aria-hidden="true" />
        </UButton>
      </UTooltip>
    </div>
    <div v-if="feedback || props.error" class="workspace-history-notices" data-map-obstruction>
      <p id="workspace-history-feedback" class="m-0 text-xs text-muted" :class="{ 'sr-only': !feedback }" role="status" aria-live="polite">
        {{ feedback }}
      </p>
      <p v-if="props.error" id="workspace-history-error" class="m-0 text-xs error-text" role="alert">{{ props.error }}</p>
      <p v-else id="workspace-history-error" class="sr-only"></p>
    </div>
    <div v-else>
      <p id="workspace-history-feedback" class="sr-only" role="status" aria-live="polite"></p>
      <p id="workspace-history-error" class="sr-only"></p>
    </div>
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
        <p v-if="!props.entries.length" class="m-0" role="status">{{ props.status.notice ?? 'No actions yet.' }}</p>
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
import { useKbd } from '@nuxt/ui/composables/useKbd'
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
const { macOS } = useKbd()
const undoKeycaps = computed(() => [macOS.value ? 'meta' : 'ctrl', 'z'])
const redoKeycaps = computed(() => [macOS.value ? 'meta' : 'ctrl', 'shift', 'z'])
const undoTooltipText = computed(() => props.status.undoUnavailableReason ?? undoLabel.value)
const redoTooltipText = computed(() => props.status.redoUnavailableReason ?? redoLabel.value)
const undoDescription = computed(() => `${props.status.undoDepth} ${props.status.undoDepth === 1 ? 'action' : 'actions'} available to undo`)
const redoDescription = computed(() => `${props.status.redoDepth} ${props.status.redoDepth === 1 ? 'action' : 'actions'} available through Redo`)
const countChipUi = { base: 'pointer-events-none px-0.5 tabular-nums' }
const historyTooltipUi = {
  content: 'workspace-history-tooltip-content',
  text: 'workspace-history-tooltip-text',
  kbds: 'inline-flex',
}
const feedback = computed(() => {
  const commonReason = props.status.undoUnavailableReason
  if (commonReason && commonReason === props.status.redoUnavailableReason) return commonReason
  const reason = props.status.undoAction ? props.status.undoUnavailableReason
    : props.status.redoAction ? props.status.redoUnavailableReason : null
  if (reason) return reason
  if (props.status.retentionReduced) return props.status.notice ?? 'Older history was removed to stay within capacity.'
  return props.status.notice ?? ''
})
</script>

<style scoped>
.workspace-history-controls {
  display: grid;
  flex: none;
  width: max-content;
  min-width: 0;
  max-width: 100%;
  gap: 0.2rem;
}

.workspace-history-action-icon {
  width: 1.125rem;
  height: 1.125rem;
}

:global(.workspace-history-tooltip-content) {
  box-sizing: border-box;
  height: auto;
  max-width: min(22rem, calc(100vw - 2rem));
}

:global(.workspace-history-tooltip-text) {
  display: block;
  max-width: 100%;
  overflow-wrap: anywhere;
  text-overflow: clip;
  white-space: normal;
}

.workspace-history-notices {
  position: absolute;
  top: calc(100% + 0.25rem);
  right: 0;
  z-index: 1;
  display: grid;
  width: max-content;
  max-width: min(19rem, calc(100vw - 2rem));
  gap: 0.2rem;
  border: 1px solid var(--line-soft);
  border-radius: 0.25rem;
  padding: 0.35rem 0.45rem;
  background: var(--panel-raised);
  box-shadow: 0 0.35rem 1rem color-mix(in srgb, var(--map-bg) 65%, transparent);
  line-height: 1.35;
  overflow-wrap: anywhere;
  pointer-events: none;
}

</style>
