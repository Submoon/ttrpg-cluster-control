<template>
  <UModal
    v-model:open="open"
    title="Edit Jump Cluster details"
    description="Resolve this draft before continuing."
    :dismissible="true"
    :ui="{ content: 'chart-details-dialog-content' }"
    :content="{ onOpenAutoFocus: captureDialogOpener, onCloseAutoFocus: focusAfterDialogClose }"
  >
    <template #body>
      <div class="grid gap-5">
        <div>
          <span class="section-kicker">UNSAVED CHANGES</span>
          <h2 class="mb-1 mt-2 text-2xl">Continue without this draft?</h2>
          <p class="inspector-intro m-0">
            {{ props.guardMode === 'chart'
              ? 'Apply these Jump Cluster details, discard the draft, or stay here and keep editing.'
              : props.hasModifiedEntitySession
                ? 'Apply these Inspector changes, discard them, or stay here and keep editing.'
                : 'Discard the current inspector changes, or stay here.' }}
          </p>
        </div>
      </div>
    </template>

    <template #footer>
      <div class="flex w-full flex-wrap justify-end gap-2">
        <UButton color="neutral" variant="ghost" @click="emit('resolve-transition', 'stay')">Stay here</UButton>
        <UButton color="error" variant="outline" @click="emit('resolve-transition', 'discard')">
          {{ props.guardMode === 'chart' ? 'Discard and continue' : 'Discard edits and continue' }}
        </UButton>
        <UButton
          v-if="props.guardMode === 'chart' || props.hasModifiedEntitySession"
          color="primary"
          @click="emit('resolve-transition', 'apply')"
        >
          Apply and continue
        </UButton>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
/** Displays the existing guarded transition decision; ordinary chart editing lives in the Inspector. */
import type { TransitionDecision, TransitionGuard } from '../composables/editor-workflows/types'
import { useDialogCloseFocusBarrier } from '../composables/useDialogCloseFocusBarrier'

const open = defineModel<boolean>('open', { required: true })
const closeFocus = useDialogCloseFocusBarrier(open)

const props = defineProps<{
  guardMode: TransitionGuard
  hasModifiedEntitySession: boolean
}>()

const emit = defineEmits<{
  'resolve-transition': [decision: TransitionDecision]
}>()

let dialogOpener: HTMLElement | null = null

function focusableElement(active: Element | null): HTMLElement | null {
  if (active instanceof HTMLElement) return active
  if (active instanceof SVGElement) return active.closest<HTMLElement>('button, a[href], [tabindex]')
  return null
}

function isVisibleFocusTarget(element: HTMLElement): boolean {
  return element.isConnected
    && !element.matches(':disabled')
    && element.getClientRects().length > 0
    && getComputedStyle(element).visibility !== 'hidden'
}

function focusAfterDialogClose(event: Event): void {
  event.preventDefault()
  if (open.value) {
    closeFocus.settleClosingFocus()
    return
  }
  const target = dialogOpener && isVisibleFocusTarget(dialogOpener)
    ? dialogOpener
    : document.getElementById('workspace-main')
  target?.focus()
  dialogOpener = null
  closeFocus.settleClosingFocus()
}

function captureDialogOpener(): void {
  const active = document.activeElement
  dialogOpener = focusableElement(active)
}

defineExpose({ whenClosingFocusSettled: closeFocus.whenClosingFocusSettled })
</script>

<style>
.chart-details-dialog-content button:focus-visible {
  outline: 2px solid var(--focus);
  outline-offset: 2px;
  transition: none;
}
</style>
