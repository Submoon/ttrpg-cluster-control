<template>
  <div
    v-show="hasVisibleFeedback"
    class="workspace-feedback-content"
    :data-save-state="props.saveState"
    :data-feedback-visible="hasVisibleFeedback"
  >
    <div v-if="props.hasChartNameDraft" class="workspace-feedback-draft" role="status" aria-live="polite">
      <span class="feedback">{{ props.hasUncommittedNames ? 'Unapplied chart-name changes' : 'Chart names ready to resume' }}</span>
      <UButton
        class="workspace-control resume-chart-draft"
        color="neutral"
        variant="outline"
        size="xs"
        aria-label="Resume chart name draft"
        title="Resume chart name draft"
        @click="emit('resume-chart-draft')"
      >
        Resume
      </UButton>
    </div>

    <div class="workspace-feedback-actions">
      <span
        v-if="props.saveState === 'error' || (props.saveState === 'saving' && props.saveError)"
        class="save-feedback"
        :class="{ 'error-text': props.saveState === 'error' }"
        :role="props.saveState === 'error' ? 'alert' : 'status'"
        :aria-live="props.saveState === 'error' ? 'assertive' : 'polite'"
        :aria-label="props.saveMessage"
        :title="props.saveMessage"
        tabindex="-1"
      >
        <span class="workspace-save-indicator" :class="`is-${props.saveState}`" aria-hidden="true"></span>
        <span class="workspace-save-message">{{ visibleSaveMessage }}</span>
      </span>

      <div v-if="hasSaveRecovery" class="workspace-feedback-direct-actions">
        <UButton
          class="workspace-control workspace-feedback-icon-button"
          color="neutral"
          variant="outline"
          size="xs"
          icon="i-lucide-rotate-cw"
          aria-label="Retry save"
          title="Retry save"
          :disabled="props.saveState === 'saving'"
          @click="emit('retry-save')"
        />
        <UButton
          v-if="hasCurrentJsonRecovery"
          class="workspace-control workspace-feedback-icon-button"
          color="neutral"
          variant="outline"
          size="xs"
          icon="i-lucide-download"
          aria-label="Export current Jump Cluster JSON"
          title="Export current Jump Cluster JSON"
          @click="emit('export-current-json')"
        />
      </div>

      <UPopover
        v-if="hasRecoveryError"
        :open="recoveryOpen"
        :modal="false"
        :content="{ side: 'top', align: 'end', sideOffset: 8, collisionPadding: 12 }"
        @update:open="updateRecoveryOpen"
      >
        <UButton
          class="workspace-control workspace-feedback-icon-button"
          color="neutral"
          variant="outline"
          size="xs"
          icon="i-lucide-circle-alert"
          aria-label="Recovery details"
          title="Recovery details"
          :aria-expanded="recoveryOpen"
        />

        <template #content>
          <div ref="recoveryPopoverElement" class="workspace-recovery-popover-content" role="group" aria-label="Workspace recovery details">
            <p v-if="props.saveError" class="feedback m-0 error-text" role="alert" aria-live="assertive">
              Save failed: {{ props.saveError }}
            </p>
            <p v-else-if="props.saveState === 'error'" class="feedback m-0 error-text" role="alert" aria-live="assertive">
              {{ props.saveMessage }}
            </p>
            <p v-if="props.exportError" class="feedback m-0 error-text" role="alert" aria-live="assertive">
              Export failed: {{ props.exportError }}
            </p>
            <div v-if="hasSaveRecovery" class="workspace-recovery-actions">
              <UButton
                class="workspace-control"
                color="primary"
                variant="outline"
                size="sm"
                :disabled="props.saveState === 'saving'"
                @click="emit('retry-save')"
              >
                Retry save
              </UButton>
              <UButton
                v-if="hasCurrentJsonRecovery"
                class="workspace-control"
                color="neutral"
                variant="outline"
                size="sm"
                @click="emit('export-current-json')"
              >
                Export current Jump Cluster JSON
              </UButton>
            </div>
            <UButton
              v-else-if="props.exportError"
              class="workspace-control"
              color="neutral"
              variant="outline"
              size="sm"
              @click="emit('export-current-json')"
            >
              Export current Jump Cluster JSON
            </UButton>
          </div>
        </template>
      </UPopover>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import type { SaveState } from '../composables/editor-workflows/types'

const props = defineProps<{
  active: boolean
  hasChartNameDraft: boolean
  hasUncommittedNames: boolean
  saveState: SaveState
  saveMessage: string
  saveError: string | null
  exportError: string
}>()

const emit = defineEmits<{
  'resume-chart-draft': []
  'retry-save': []
  'export-current-json': []
  'recovery-details-open-change': [open: boolean]
}>()

const recoveryOpen = ref(false)
const recoveryPopoverElement = ref<HTMLElement | null>(null)
const hasSaveRecovery = computed(() => props.saveState === 'error' || (props.saveState === 'saving' && props.saveError !== null))
const hasCurrentJsonRecovery = computed(() => hasSaveRecovery.value || !!props.exportError)
const hasRecoveryError = computed(() => hasSaveRecovery.value || !!props.exportError)
const hasVisibleFeedback = computed(() => props.hasChartNameDraft || hasRecoveryError.value)
const visibleSaveMessage = computed(() => {
  if (props.saveState === 'error') return 'Not saved.'
  return 'Saving to this browser. A previous write failed:'
})

function updateRecoveryOpen(open: boolean): void {
  recoveryOpen.value = open
  emit('recovery-details-open-change', open)
}

watch(() => props.active, active => {
  if (!active && recoveryOpen.value) updateRecoveryOpen(false)
}, { flush: 'sync' })

watch(hasRecoveryError, hasError => {
  if (hasError || !recoveryOpen.value) return
  const activeElement = typeof document === 'undefined' ? null : document.activeElement
  const focusWasInRecovery = activeElement !== null && (
    recoveryPopoverElement.value?.contains(activeElement) === true
    || activeElement.closest('.workspace-feedback-icon-button[aria-label="Recovery details"]') !== null
  )
  const focusWasLost = typeof document !== 'undefined'
    && (activeElement === document.body || activeElement === document.documentElement)
  updateRecoveryOpen(false)
  if (!focusWasInRecovery && !focusWasLost) return
  void nextTick(() => {
    // Preserve a newer focus owner after closing recovery that lost its target.
    const currentFocus = document.activeElement
    const focusMovedToAnotherTarget = currentFocus
      && currentFocus !== document.body
      && currentFocus !== document.documentElement
      && currentFocus !== activeElement
      && currentFocus.isConnected
    if (focusMovedToAnotherTarget) return
    const compactPanel = document.querySelector<HTMLElement>('.workspace-resizable-panel-compact[role="dialog"]')
    const panelControl = compactPanel?.querySelector<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]',
    )
    ;(panelControl ?? document.getElementById('workspace-main'))?.focus()
  })
}, { flush: 'sync' })

onBeforeUnmount(() => {
  if (recoveryOpen.value) emit('recovery-details-open-change', false)
})
</script>
