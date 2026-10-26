<template>
  <UModal
    v-model:open="open"
    title="Edit chart names"
    :description="guardMode ? 'Resolve this draft before continuing.' : `Rename the current Jump Cluster and ${props.targetSystemName || 'star system'}.`"
    :dismissible="true"
    :content="{ onOpenAutoFocus: focusOnDialogOpen, onCloseAutoFocus: focusAfterDialogClose }"
    :ui="{ content: 'chart-names-dialog-content max-h-[calc(100dvh-2rem)] overflow-hidden', body: 'min-h-0 overflow-y-auto' }"
  >
    <template #body>
      <div v-if="guardMode" class="grid gap-5">
        <div>
          <span class="section-kicker">UNSAVED CHANGES</span>
          <h2 class="mb-1 mt-2 text-2xl">Continue without this draft?</h2>
          <p class="inspector-intro m-0">
            {{ guardMode === 'chart'
              ? 'Apply these chart names, discard the draft, or stay here and keep editing.'
              : hasModifiedEntitySession
                ? 'Apply these Inspector changes, discard them, or stay here and keep editing.'
                : 'Discard the current inspector changes, or stay here and keep editing.' }}
          </p>
        </div>
      </div>
      <form v-else id="chart-names-form" class="grid gap-4" @submit.prevent="emit('apply')">
        <span class="section-kicker">CHART DETAILS / RENAME</span>
        <UFormField label="Jump Cluster" :error="clusterError || undefined" class="grid gap-1.5">
          <UInput
            id="chart-dialog-cluster-name"
            v-model="clusterName"
            maxlength="80"
            autocomplete="off"
          />
          <template #error="{ error }">
            <span v-if="typeof error === 'string' && error" role="alert">{{ error }}</span>
          </template>
        </UFormField>
        <UFormField label="Star system" :error="systemError || undefined" class="grid gap-1.5">
          <UInput
            id="chart-dialog-system-name"
            v-model="systemName"
            maxlength="80"
            autocomplete="off"
          />
          <template #error="{ error }">
            <span v-if="typeof error === 'string' && error" role="alert">{{ error }}</span>
          </template>
        </UFormField>
        <UAlert
          v-if="props.formError && !clusterError && !systemError"
          color="error"
          variant="subtle"
          :description="props.formError"
          role="alert"
        />
      </form>
    </template>

    <template #footer>
      <div class="flex w-full flex-wrap justify-end gap-2">
        <template v-if="guardMode">
          <UButton color="neutral" variant="ghost" @click="emit('resolve-transition', 'stay')">Stay here</UButton>
          <UButton color="error" variant="outline" @click="emit('resolve-transition', 'discard')">
            {{ guardMode === 'chart' ? 'Discard and continue' : 'Discard edits and continue' }}
          </UButton>
          <UButton
            v-if="guardMode === 'chart' || hasModifiedEntitySession"
            color="primary"
            @click="emit('resolve-transition', 'apply')"
          >
            Apply and continue
          </UButton>
        </template>
        <template v-else>
          <UButton color="neutral" variant="ghost" @click="emit('discard')">Discard draft</UButton>
          <UButton color="primary" type="submit" form="chart-names-form" :disabled="!props.hasUncommittedNames">Apply names</UButton>
        </template>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
/** Parent-owned chart session presented in a hideable Nuxt UI modal. */
import { computed, nextTick, watch } from 'vue'
import type { TransitionDecision, TransitionGuard } from '../composables/editor-workflows/types'

const open = defineModel<boolean>('open', { required: true })
const clusterName = defineModel<string>('clusterName', { required: true })
const systemName = defineModel<string>('systemName', { required: true })

const props = defineProps<{
  formError: string
  guardMode: TransitionGuard
  hasUncommittedNames: boolean
  hasModifiedEntitySession: boolean
  targetSystemName?: string
}>()

const clusterError = computed(() => props.formError.startsWith('Jump Cluster name') ? props.formError : '')
const systemError = computed(() => props.formError.startsWith('Star system name') ? props.formError : '')

const emit = defineEmits<{
  apply: []
  discard: []
  'resolve-transition': [decision: TransitionDecision]
}>()

let dialogOpener: HTMLElement | null = null

function focusableElement(active: Element | null): HTMLElement | null {
  if (active instanceof HTMLElement) return active
  if (active instanceof SVGElement) {
    return active.closest<HTMLElement>('button, a[href], [tabindex]')
  }
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
  const target = dialogOpener && isVisibleFocusTarget(dialogOpener)
    ? dialogOpener
    : document.getElementById('workspace-main')
  target?.focus()
  dialogOpener = null
}

function focusNameField(): void {
  const target = props.formError.startsWith('Star system name')
    ? 'chart-dialog-system-name'
    : 'chart-dialog-cluster-name'
  document.getElementById(target)?.focus()
}

function focusOnDialogOpen(event: Event): void {
  dialogOpener = focusableElement(document.activeElement)
  if (props.guardMode) return
  event.preventDefault()
  focusNameField()
}

watch(
  () => [props.formError, props.guardMode, open.value] as const,
  async ([error, guard, visible]) => {
    if (!visible || guard) return
    await nextTick()
    if (error) focusNameField()
  },
  { flush: 'post' },
)
</script>

<style>
.chart-names-dialog-content button:focus-visible {
  outline: 2px solid var(--focus);
  outline-offset: 2px;
  transition: none;
}
</style>
