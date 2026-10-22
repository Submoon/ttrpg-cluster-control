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
      :class="{
        'compact-modal-open': props.compactModalOpen,
        'compact-viewport': props.isCompactViewport,
        'compact-route-session-open': props.compactModalOpen && props.compactPanel === 'inspector' && props.routeSessionActive,
      }"
      @focusin="redirectFocusFromLayoutRoot"
    >
      <div class="map-editor-header-row" :inert="props.compactModalOpen || undefined">
        <slot name="header" />
      </div>

      <UDashboardGroup class="workspace-dashboard-group" data-workspace-dashboard :persistent="false" unit="px">
        <div ref="mapBoard" class="workspace-map-board" data-map-board>
          <div class="workspace-map-canvas-region" :inert="props.compactModalOpen || undefined">
            <slot name="map" />
          </div>
          <div ref="mapChromeRegion" class="workspace-map-chrome-region" :inert="props.compactModalOpen || undefined">
            <slot name="map-chrome" />
          </div>
          <div ref="bottomControlsRegion" class="workspace-bottom-controls" :inert="props.compactModalOpen || undefined">
            <div class="workspace-feedback-region">
              <slot name="feedback" />
            </div>
            <div class="workspace-dock-region" data-map-obstruction>
              <slot name="dock" />
            </div>
            <div class="workspace-zoom-region" data-map-obstruction>
              <slot name="zoom" />
            </div>
          </div>
        </div>

        <WorkspaceResizablePanel
          panel-id="workspace-hierarchy-panel"
          :label="props.hierarchyLabel"
          side="left"
          :visible="props.hierarchyVisible"
          :compact="props.compactModalOpen && props.compactPanel === 'hierarchy'"
          :board="mapBoard"
          :inert="props.compactModalOpen && props.compactPanel !== 'hierarchy' || undefined"
          @close="emit('close-panel', 'hierarchy')"
        >
          <template #compact-recovery><slot name="compact-recovery" /></template>
          <slot name="hierarchy" />
        </WorkspaceResizablePanel>

        <WorkspaceResizablePanel
          panel-id="workspace-inspector-panel"
          :label="props.inspectorLabel"
          side="right"
          :visible="props.inspectorVisible"
          :compact="props.compactModalOpen && props.compactPanel === 'inspector'"
          :board="mapBoard"
          :show-header-actions="props.mode === 'system'"
          :show-close-button="!props.entityInspectorActive"
          :show-compact-recovery="!props.entityInspectorActive"
          :inert="props.compactModalOpen && props.compactPanel !== 'inspector' || undefined"
          @close="emit('close-panel', 'inspector')"
        >
          <template #header-actions><slot name="inspector-header-actions" /></template>
          <template #compact-recovery><slot name="compact-recovery" /></template>
          <slot name="inspector" />
        </WorkspaceResizablePanel>
      </UDashboardGroup>
    </div>
  </FocusScope>
</template>

<script setup lang="ts">
/** Keeps both editor trees mounted while switching between full-board overlays and exclusive compact panels. */
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { FocusScope } from 'reka-ui'
import type { WorkspacePanel } from '../composables/editor-workflows/types'
import WorkspaceResizablePanel from './WorkspaceResizablePanel.vue'

const props = withDefaults(defineProps<{
  mode: 'cluster' | 'system'
  hierarchyLabel: string
  inspectorLabel: string
  hierarchyVisible: boolean
  inspectorVisible: boolean
  entityInspectorActive: boolean
  compactModalOpen: boolean
  compactPanel: WorkspacePanel | null
  overlayOpen: boolean
  isCompactViewport: boolean
  routeSessionActive?: boolean
}>(), {
  routeSessionActive: false,
})

const emit = defineEmits<{
  'close-panel': [panel: WorkspacePanel]
}>()

const mapBoard = ref<HTMLElement | null>(null)
const mapChromeRegion = ref<HTMLElement | null>(null)
const bottomControlsRegion = ref<HTMLElement | null>(null)
let clearanceObserver: ResizeObserver | undefined

onMounted(async () => {
  await nextTick()
  updateMeasuredClearances()
  if (typeof ResizeObserver === 'undefined') return
  clearanceObserver = new ResizeObserver(updateMeasuredClearances)
  if (mapChromeRegion.value) clearanceObserver.observe(mapChromeRegion.value)
  if (bottomControlsRegion.value) clearanceObserver.observe(bottomControlsRegion.value)
})

onBeforeUnmount(() => {
  clearanceObserver?.disconnect()
  clearanceObserver = undefined
})
type FocusableElement = (HTMLElement | SVGElement) & Pick<HTMLElement, 'focus'>
type FocusReturnTarget = { element: FocusableElement; selector?: string }
let focusBeforeCompact: FocusReturnTarget | null = null

function panelContent(panel: WorkspacePanel): HTMLElement | null {
  return document.querySelector<HTMLElement>(panel === 'hierarchy'
    ? '#workspace-hierarchy-panel .workspace-side-panel-content'
    : '#workspace-inspector-panel .workspace-side-panel-content')
}

function updateMeasuredClearances(): void {
  const board = mapBoard.value
  const dashboard = board?.parentElement
  if (!board || !dashboard) return
  const dashboardBounds = dashboard.getBoundingClientRect()
  const chromeBounds = mapChromeRegion.value?.getBoundingClientRect()
  const controlsBounds = bottomControlsRegion.value?.getBoundingClientRect()
  const chromeClearance = chromeBounds ? Math.max(0, chromeBounds.bottom - dashboardBounds.top + 12) : 12
  const controlsClearance = controlsBounds ? Math.max(0, dashboardBounds.bottom - controlsBounds.top + 12) : 12
  dashboard.style.setProperty('--workspace-map-chrome-clearance', `${chromeClearance}px`)
  dashboard.style.setProperty('--workspace-bottom-controls-clearance', `${controlsClearance}px`)
}

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

function focusFirstActivePanelControl(): void {
  if (typeof document === 'undefined') return
  const panel = props.compactPanel
  if (!panel) return
  panelContent(panel)?.querySelector<HTMLElement>(
    'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]',
  )?.focus()
}

function focusActivePanel(event: Event): void {
  event.preventDefault()
  nextTick(focusFirstActivePanelControl)
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
    nextTick(focusFirstActivePanelControl)
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
  panelContent(panel)?.querySelector<HTMLElement>(
    'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]',
  )?.focus()
})
</script>

<style>
.map-editor-layout.compact-modal-open.compact-route-session-open #workspace-inspector-panel {
  display: flex;
  flex-direction: column;
}

.map-editor-layout.compact-modal-open.compact-route-session-open #workspace-inspector-panel > .workspace-panel-surface {
  height: auto;
  min-height: 0;
  flex: 1 1 auto;
}

.map-editor-layout.compact-modal-open.compact-route-session-open #workspace-inspector-panel .workspace-compact-recovery {
  position: relative;
  inset-inline: auto;
  bottom: auto;
  z-index: auto;
  flex: 0 0 auto;
  max-height: min(34dvh, 12rem);
  box-shadow: none;
}

.map-editor-layout.compact-modal-open.compact-route-session-open .workspace-side-panel-content-inspector {
  padding-bottom: 0;
}
</style>
