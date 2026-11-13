<template>
  <UPopover
    v-model:open="open"
    :portal="props.portal"
    :modal="false"
    :content="{ side: 'bottom', align: 'end', sideOffset: 8, collisionPadding: 12, onCloseAutoFocus: closeFocus.settleClosingFocus }"
  >
    <UTooltip :text="props.iconOnly ? 'Map files' : undefined">
      <UButton
        ref="trigger"
        class="workspace-control workspace-map-files-toggle"
        :class="{ 'workspace-map-icon-control': props.iconOnly }"
        color="neutral"
        :variant="open ? 'soft' : 'outline'"
        size="sm"
        aria-label="Map files"
        :aria-controls="panelId"
        :aria-expanded="open"
        :title="props.iconOnly ? undefined : scopeLabel"
      >
        <template v-if="props.iconOnly">
          <UIcon name="i-lucide-folder-open" aria-hidden="true" />
        </template>
        <template v-else>
          <span>Map files</span>
          <UIcon :name="open ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'" aria-hidden="true" />
        </template>
      </UButton>
    </UTooltip>

    <template #content>
      <div
        :id="panelId"
        class="workspace-map-files-content"
        role="group"
        :aria-label="scopeLabel"
        :data-map-obstruction="open ? '' : undefined"
      >
        <p class="workspace-map-files-heading">{{ props.scope }}</p>
        <slot />
      </div>
    </template>
  </UPopover>
</template>

<script setup lang="ts">
import { computed, useId, useTemplateRef } from 'vue'
import { useDialogCloseFocusBarrier } from '../composables/useDialogCloseFocusBarrier'

const props = withDefaults(defineProps<{
  scope: string
  /** Show only the files icon with a tooltip in map chrome. */
  iconOnly?: boolean
  panelId?: string
  portal?: boolean
}>(), { iconOnly: false, portal: true })
const open = defineModel<boolean>('open', { required: true })
const closeFocus = useDialogCloseFocusBarrier(open)
const trigger = useTemplateRef('trigger')
const generatedPanelId = useId()
const panelId = computed(() => props.panelId ?? `map-files-${generatedPanelId}`)
const scopeLabel = computed(() => `Map file actions for ${props.scope}`)

function focusTrigger(): void {
  const button = trigger.value?.$el
  if (button instanceof HTMLElement) button.focus({ preventScroll: true })
}

defineExpose({ whenClosingFocusSettled: closeFocus.whenClosingFocusSettled, focusTrigger })
</script>

<style scoped>
.workspace-map-files-content {
  position: relative;
  z-index: 60;
  display: grid;
  width: min(22rem, calc(100vw - 1.5rem));
  max-height: min(70vh, 32rem, max(0px, var(--reka-popover-content-available-height, 70vh)));
  gap: 0.65rem;
  overflow: auto;
  scroll-padding-block: 0.8rem;
  border: 1px solid var(--line);
  border-radius: 0.35rem;
  padding: 0.8rem;
  background: var(--panel-raised);
  color: var(--text-primary);
  box-shadow: 0 0.7rem 2rem rgb(0 0 0 / 35%);
}

/* Release both layers during exit, even when a parent modal sets inline pointer-events. */
:global([data-reka-popper-content-wrapper] > [data-slot="content"][data-state="closed"]:has(> .workspace-map-files-content)),
:global([data-reka-popper-content-wrapper]:has(> [data-slot="content"][data-state="closed"] > .workspace-map-files-content)) {
  pointer-events: none !important;
}

.workspace-map-files-heading {
  margin: 0;
  color: var(--text-muted);
  font: 0.625rem Consolas, monospace;
  letter-spacing: 0.08em;
  overflow-wrap: anywhere;
  text-transform: uppercase;
}
</style>
