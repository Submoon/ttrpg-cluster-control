<template>
  <FocusScope
    as-child
    :present="props.compactModalOpen"
    :trapped="props.compactModalOpen && !props.overlayOpen"
    :loop="props.compactModalOpen"
    @mount-auto-focus="focusActivePanel"
  >
    <div
      class="map-editor-layout"
      :class="{ 'compact-modal-open': props.compactModalOpen }"
      @focusin="redirectFocusFromLayoutRoot"
    >
      <div class="map-editor-header-row" :inert="props.compactModalOpen || undefined">
        <slot name="header" />
      </div>

      <div class="map-editor-dock-row" :inert="props.compactModalOpen || undefined">
        <slot name="dock" />
      </div>

      <div
        class="editor-grid"
        :class="{
          'system-map-editor-grid': props.mode === 'system',
          'hierarchy-hidden': !props.hierarchyVisible,
          'inspector-hidden': !props.inspectorVisible,
        }"
      >
        <div
          id="workspace-hierarchy-panel"
          v-show="props.hierarchyVisible"
          class="workspace-side-panel hierarchy-panel"
          :class="{ 'compact-recovery-visible': props.compactModalOpen && props.compactPanel === 'hierarchy' }"
          :inert="props.compactModalOpen && props.compactPanel !== 'hierarchy' || undefined"
          :role="props.compactModalOpen && props.compactPanel === 'hierarchy' ? 'dialog' : 'complementary'"
          :aria-modal="props.compactModalOpen && props.compactPanel === 'hierarchy' ? 'true' : undefined"
          :aria-label="props.hierarchyLabel"
        >
          <UDashboardPanel :resizable="false" :ui="panelUi" class="map-dashboard-panel">
            <div ref="hierarchyContent" class="workspace-side-panel-content">
              <UButton
                class="workspace-control panel-close-button"
                color="neutral"
                variant="outline"
                size="sm"
                type="button"
                aria-label="Close hierarchy panel"
                aria-controls="workspace-hierarchy-panel"
                @click="emit('close-panel', 'hierarchy')"
              >×</UButton>
              <slot name="hierarchy" />
            </div>
          </UDashboardPanel>
          <div v-if="props.compactModalOpen && props.compactPanel === 'hierarchy'" class="workspace-compact-recovery">
            <slot name="compact-recovery" />
          </div>
        </div>

        <div class="workspace-map-column" :inert="props.compactModalOpen || undefined">
          <slot name="map" />
        </div>

        <div
          id="workspace-inspector-panel"
          v-show="props.inspectorVisible"
          class="workspace-side-panel inspector-panel"
          :class="{ 'compact-recovery-visible': props.compactModalOpen && props.compactPanel === 'inspector' }"
          :inert="props.compactModalOpen && props.compactPanel !== 'inspector' || undefined"
          :role="props.compactModalOpen && props.compactPanel === 'inspector' ? 'dialog' : 'complementary'"
          :aria-modal="props.compactModalOpen && props.compactPanel === 'inspector' ? 'true' : undefined"
          :aria-label="props.inspectorLabel"
        >
          <UDashboardPanel :resizable="false" :ui="panelUi" class="map-dashboard-panel">
            <div ref="inspectorContent" class="workspace-side-panel-content">
              <UButton
                class="workspace-control panel-close-button"
                color="neutral"
                variant="outline"
                size="sm"
                type="button"
                aria-label="Close inspector panel"
                aria-controls="workspace-inspector-panel"
                @click="emit('close-panel', 'inspector')"
              >×</UButton>
              <slot name="inspector" />
            </div>
          </UDashboardPanel>
          <div v-if="props.compactModalOpen && props.compactPanel === 'inspector'" class="workspace-compact-recovery">
            <slot name="compact-recovery" />
          </div>
        </div>
      </div>
    </div>
  </FocusScope>
</template>

<script setup lang="ts">
/** Keeps both legacy panel trees mounted while switching their desktop and exclusive compact presentation. */
import { nextTick, ref, watch } from 'vue'
import { FocusScope } from 'reka-ui'
import type { WorkspacePanel } from '../composables/editor-workflows/types'

const props = defineProps<{
  mode: 'cluster' | 'system'
  hierarchyLabel: string
  inspectorLabel: string
  hierarchyVisible: boolean
  inspectorVisible: boolean
  compactModalOpen: boolean
  compactPanel: WorkspacePanel | null
  overlayOpen: boolean
}>()

const emit = defineEmits<{
  'close-panel': [panel: WorkspacePanel]
}>()

const panelUi = { root: 'map-dashboard-panel' }
const hierarchyContent = ref<HTMLElement | null>(null)
const inspectorContent = ref<HTMLElement | null>(null)
type FocusableElement = (HTMLElement | SVGElement) & Pick<HTMLElement, 'focus'>
type FocusReturnTarget = { element: FocusableElement; selector?: string }
let focusBeforeCompact: FocusReturnTarget | null = null

function focusReturnTarget(element: Element | null): FocusReturnTarget | null {
  if (element instanceof HTMLElement) return { element }
  if (element instanceof SVGElement && typeof (element as SVGElement & { focus?: unknown }).focus === 'function') {
    const focusable = element as FocusableElement
    const stableAttribute = ['data-object-id', 'data-orbit-id', 'data-route-id', 'data-system-id']
      .find(attribute => element.hasAttribute(attribute))
    const stableId = stableAttribute ? element.getAttribute(stableAttribute) : null
    return {
      element: focusable,
      ...(stableAttribute && stableId ? { selector: `[${stableAttribute}="${CSS.escape(stableId)}"]` } : {}),
    }
  }
  return null
}

function focusActivePanel(event: Event): void {
  event.preventDefault()
  nextTick(focusFirstActivePanelControl)
}

function focusFirstActivePanelControl(): void {
  const panel = props.compactPanel === 'hierarchy' ? hierarchyContent.value : inspectorContent.value
  panel?.querySelector<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]')?.focus()
}

function redirectFocusFromLayoutRoot(event: FocusEvent): void {
  if (!props.compactModalOpen || props.overlayOpen || !props.compactPanel || event.target !== event.currentTarget) return
  const layoutRoot = event.currentTarget
  nextTick(() => {
    if (!props.compactModalOpen || props.overlayOpen || document.activeElement !== layoutRoot) return
    focusFirstActivePanelControl()
  })
}

watch(() => props.compactModalOpen, (open, wasOpen) => {
  if (typeof document === 'undefined') return
  if (open && !wasOpen) {
    focusBeforeCompact = focusReturnTarget(document.activeElement)
    nextTick(() => {
      const panel = props.compactPanel === 'hierarchy' ? hierarchyContent.value : inspectorContent.value
      panel?.querySelector<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]')?.focus()
    })
  } else if (!open && wasOpen) {
    nextTick(() => {
      const element = focusBeforeCompact?.element.isConnected
        ? focusBeforeCompact.element
        : focusBeforeCompact?.selector
          ? document.querySelector(focusBeforeCompact.selector)
          : null
      if (element && 'focus' in element && !element.closest('[inert]') && !element.closest('[style*="display: none"]')) {
        element.focus()
      }
      focusBeforeCompact = null
    })
  }
}, { flush: 'sync' })

watch(() => props.compactPanel, async panel => {
  if (!props.compactModalOpen || !panel) return
  await nextTick()
  const container = panel === 'hierarchy' ? hierarchyContent.value : inspectorContent.value
  container?.querySelector<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]')?.focus()
})
</script>
