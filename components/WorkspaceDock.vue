<template>
  <nav class="workspace-dock" role="toolbar" aria-label="Workspace navigation">
    <div class="workspace-dock-tools">
      <div class="workspace-dock-mode" role="group" aria-label="Map interaction mode">
        <UButton
          v-for="mode in modes"
          :key="mode.value"
          color="neutral"
          :variant="!addActive && props.mode === mode.value ? 'solid' : 'outline'"
          size="sm"
          :aria-pressed="!addActive && props.mode === mode.value"
          class="workspace-control"
          @click="emit('mode-change', mode.value)"
        >
          {{ mode.label }}
        </UButton>
      </div>

      <UPopover
        v-model:open="addOpen"
        :modal="false"
        :content="{
          side: 'top',
          align: 'start',
          sideOffset: 8,
          collisionPadding: 12,
          avoidCollisions: true,
          onEscapeKeyDown: consumeChooserEscape,
        }"
        :ui="{ content: 'workspace-add-popover-content' }"
      >
        <UButton
          class="workspace-control workspace-dock-add"
          color="primary"
          :variant="addActive ? 'solid' : 'outline'"
          size="sm"
          aria-label="Add to map"
          aria-controls="workspace-add-menu"
          :aria-describedby="props.creationSession || props.clusterAddLabel ? 'workspace-dock-add-type' : undefined"
          :aria-expanded="addOpen"
          :aria-pressed="addActive"
          ref="addTrigger"
        >
          <UIcon name="i-lucide-plus" aria-hidden="true" />
          <span>Add</span>
          <span v-if="props.creationSession || props.clusterAddLabel" class="workspace-dock-add-separator" aria-hidden="true">·</span>
          <span
            v-if="props.creationSession || props.clusterAddLabel"
            id="workspace-dock-add-type"
            class="workspace-dock-add-type"
          >{{ props.clusterAddLabel ?? props.creationTypeLabel }}</span>
        </UButton>
        <template #content>
          <div
            id="workspace-add-menu"
            ref="addMenu"
            class="workspace-add-menu"
            role="group"
            aria-label="Add to map"
            :data-map-obstruction="addOpen ? '' : undefined"
          >
            <slot name="add" :close="closeAdd" />
          </div>
        </template>
      </UPopover>

      <SystemCreationControls
        :session="props.creationSession"
        :type-label="props.creationTypeLabel"
        :selected-system="props.selectedSystem"
        :chooser-open="addOpen"
        @update-input="(key, value) => emit('update-creation-input', key, value)"
        @add-from-inputs="emit('add-from-inputs')"
        @choose-candidate="emit('choose-creation-candidate', $event)"
      />
      <ClusterSystemPlacementControls
        v-if="props.clusterAddLabel === 'System' || props.clusterMoveTargeting"
        :purpose="props.clusterAddLabel === 'System' ? 'add' : 'move'"
        :inputs="props.clusterSystemPositionInputs"
        :input-errors="props.clusterSystemPositionInputErrors"
        @update-input="(key, value) => emit('update-cluster-system-input', key, value)"
        @add-from-inputs="emit('add-cluster-system-from-inputs')"
        @preview-move-from-inputs="emit('preview-cluster-system-move-from-inputs')"
      />
    </div>
  </nav>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch, type ComponentPublicInstance } from 'vue'
import type { ClusterSystemPositionInput, ClusterSystemPositionInputs, MapInteractionMode, SystemCreationSession } from '../composables/editor-workflows/types'
import type { StarSystem } from '../domain/workspace'
import ClusterSystemPlacementControls from './ClusterSystemPlacementControls.vue'
import SystemCreationControls from './SystemCreationControls.vue'

const props = withDefaults(defineProps<{
  mode: MapInteractionMode
  closeSignal?: string
  creationSession?: SystemCreationSession | null
  creationTypeLabel?: string
  clusterAddLabel?: string | null
  clusterMoveTargeting?: boolean
  clusterSystemPositionInputs?: ClusterSystemPositionInputs
  clusterSystemPositionInputErrors?: Record<ClusterSystemPositionInput, string>
  selectedSystem?: StarSystem
}>(), {
  closeSignal: '',
  creationSession: null,
  creationTypeLabel: 'object',
})

const emit = defineEmits<{
  'mode-change': [mode: MapInteractionMode]
  'update-creation-input': [key: keyof SystemCreationSession['inputs'], value: string]
  'add-from-inputs': []
  'choose-creation-candidate': [key: string]
  'update-cluster-system-input': [key: ClusterSystemPositionInput, value: string]
  'add-cluster-system-from-inputs': []
  'preview-cluster-system-move-from-inputs': []
}>()

const modes: Array<{ value: MapInteractionMode; label: string }> = [
  { value: 'navigate', label: 'Navigate' },
  { value: 'select', label: 'Select' },
  { value: 'move', label: 'Move' },
]
const addActive = computed(() => !!(props.creationSession || props.clusterAddLabel))
const addOpen = defineModel<boolean>('addOpen', { default: false })
const addTrigger = ref<ComponentPublicInstance | null>(null)
const addMenu = ref<HTMLElement | null>(null)

type DismissedAddSequence = {
  pointerId: number | null
  pointerType: string
  origin: EventTarget | null
  touchIdentifier: number | null
}

let dismissedAddSequence: DismissedAddSequence | null = null

const touchCapture: AddEventListenerOptions = { capture: true, passive: false }

function addTriggerElement(): HTMLElement | null {
  const root = addTrigger.value?.$el
  return root instanceof HTMLElement ? root : null
}

function eventIsWithin(event: Event, root: HTMLElement | null): boolean {
  if (!root) return false
  return event.composedPath().some(target => target instanceof Node && (target === root || root.contains(target)))
}

function eventMatchesOrigin(event: Event, origin: EventTarget | null): boolean {
  if (!origin) return false
  if (event.composedPath().includes(origin)) return true
  return origin instanceof Node && event.target instanceof Node
    && (origin.contains(event.target) || event.target.contains(origin))
}

function isInsideHigherModal(): boolean {
  // An active modal owns all outside interactions, including its backdrop.
  return Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"][aria-modal="true"]'))
    .some(dialog => dialog.getClientRects().length > 0 && !dialog.closest('[inert]'))
}

function isInsideAddUi(event: Event): boolean {
  return eventIsWithin(event, addTriggerElement()) || eventIsWithin(event, addMenu.value)
}

function consumeOutsideEvent(event: Event): void {
  if (event.cancelable) event.preventDefault()
  event.stopImmediatePropagation()
}

function dismissAddForPointerDown(event: PointerEvent): void {
  const sequence = dismissedAddSequence
  if (sequence) {
    // A touchstart can precede its compatibility PointerEvent. Keep that same contact consumed.
    if (sequence.pointerId === null && sequence.pointerType === 'touch'
      && event.pointerType === 'touch' && event.isPrimary && eventMatchesOrigin(event, sequence.origin)) {
      sequence.pointerId = event.pointerId
      consumeOutsideEvent(event)
      return
    }
    // A new physical contact starts a fresh sequence; stale compatibility clicks cannot eat it.
    dismissedAddSequence = null
  }

  if (!addOpen.value || !event.isPrimary || event.button < 0
    || isInsideHigherModal() || isInsideAddUi(event)) return

  dismissedAddSequence = {
    pointerId: event.pointerId,
    pointerType: event.pointerType,
    origin: event.target,
    touchIdentifier: null,
  }
  closeAdd()
  consumeOutsideEvent(event)
}

function dismissAddForTouchStart(event: TouchEvent): void {
  if (event.changedTouches.length !== 1) return
  const touch = event.changedTouches[0]
  if (!touch) return

  const sequence = dismissedAddSequence
  if (sequence) {
    const isSameContact = sequence.pointerType === 'touch'
      && (sequence.touchIdentifier === touch.identifier
        || sequence.touchIdentifier === null && eventMatchesOrigin(event, sequence.origin))
    if (isSameContact) {
      sequence.touchIdentifier = touch.identifier
      consumeOutsideEvent(event)
      return
    }
    dismissedAddSequence = null
  }

  if (!addOpen.value || isInsideHigherModal() || isInsideAddUi(event)) return
  dismissedAddSequence = {
    pointerId: null,
    pointerType: 'touch',
    origin: event.target,
    touchIdentifier: touch.identifier,
  }
  closeAdd()
  consumeOutsideEvent(event)
}

function consumeDismissedPointerEnd(event: PointerEvent): void {
  if (dismissedAddSequence?.pointerId === event.pointerId) consumeOutsideEvent(event)
}

function consumeDismissedTouchEnd(event: TouchEvent): void {
  const identifier = dismissedAddSequence?.touchIdentifier
  if (identifier === null || identifier === undefined || event.changedTouches.length !== 1) return
  if (event.changedTouches[0]?.identifier === identifier) consumeOutsideEvent(event)
}

function consumeDismissedClick(event: MouseEvent): void {
  const sequence = dismissedAddSequence
  if (!sequence || event.detail === 0) return

  const pointerId = 'pointerId' in event ? (event as PointerEvent).pointerId : null
  if (pointerId !== sequence.pointerId && !eventMatchesOrigin(event, sequence.origin)) return
  consumeOutsideEvent(event)
  dismissedAddSequence = null
}

function consumeDismissedContextMenu(event: MouseEvent): void {
  const sequence = dismissedAddSequence
  // Keyboard context-menu activation reports button 0/detail 0; leave that action alone.
  if (!sequence || (event.detail === 0 && event.button === 0)) return

  const pointerId = 'pointerId' in event ? (event as PointerEvent).pointerId : null
  if (pointerId !== sequence.pointerId && !eventMatchesOrigin(event, sequence.origin)) return
  consumeOutsideEvent(event)
}

function installAddDismissalAdapter(): void {
  document.addEventListener('pointerdown', dismissAddForPointerDown, true)
  document.addEventListener('pointerup', consumeDismissedPointerEnd, true)
  document.addEventListener('pointercancel', consumeDismissedPointerEnd, true)
  document.addEventListener('touchstart', dismissAddForTouchStart, touchCapture)
  document.addEventListener('touchend', consumeDismissedTouchEnd, touchCapture)
  document.addEventListener('touchcancel', consumeDismissedTouchEnd, touchCapture)
  document.addEventListener('click', consumeDismissedClick, true)
  document.addEventListener('auxclick', consumeDismissedClick, true)
  document.addEventListener('contextmenu', consumeDismissedContextMenu, true)
}

function removeAddDismissalAdapter(): void {
  document.removeEventListener('pointerdown', dismissAddForPointerDown, true)
  document.removeEventListener('pointerup', consumeDismissedPointerEnd, true)
  document.removeEventListener('pointercancel', consumeDismissedPointerEnd, true)
  document.removeEventListener('touchstart', dismissAddForTouchStart, true)
  document.removeEventListener('touchend', consumeDismissedTouchEnd, true)
  document.removeEventListener('touchcancel', consumeDismissedTouchEnd, true)
  document.removeEventListener('click', consumeDismissedClick, true)
  document.removeEventListener('auxclick', consumeDismissedClick, true)
  document.removeEventListener('contextmenu', consumeDismissedContextMenu, true)
  dismissedAddSequence = null
}

onMounted(installAddDismissalAdapter)
onBeforeUnmount(removeAddDismissalAdapter)

watch(() => props.closeSignal, () => closeAdd())

function closeAdd(): void {
  addOpen.value = false
}

function consumeChooserEscape(event: KeyboardEvent): void {
  event.preventDefault()
  event.stopPropagation()
  closeAdd()
}
</script>

<style scoped>
.workspace-dock-tools,
.workspace-dock-mode {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 8px;
}

.workspace-dock-tools {
  flex-wrap: wrap;
}

.workspace-dock-mode {
  flex-wrap: wrap;
}

.workspace-dock-add {
  flex: 0 0 auto;
}

.workspace-dock-add-type {
  display: inline-block;
  min-width: 0;
  white-space: nowrap;
}

@media (max-width: 480px) {
  .workspace-dock-add-type {
    max-width: 7ch;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}

.workspace-add-menu {
  display: grid;
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  max-width: 100%;
  gap: 0.35rem;
  padding: 0.5rem;
  border: 1px solid var(--line);
  border-radius: 0.35rem;
  background: var(--panel-raised);
  color: var(--text-primary);
  box-shadow: 0 0.7rem 2rem rgb(0 0 0 / 35%);
}

:global(.workspace-add-popover-content) {
  box-sizing: border-box;
  min-width: min(15rem, var(--reka-popover-content-available-width, calc(100vw - 1.5rem)));
  max-width: min(34rem, var(--reka-popover-content-available-width, calc(100vw - 1.5rem)));
  max-height: min(38rem, var(--reka-popover-content-available-height, calc(100vh - 1.5rem)));
  overflow: auto;
}

:global(.workspace-add-popover-content .object-palette) {
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  max-width: 100%;
}

:global(.workspace-add-popover-content .object-palette-heading) {
  min-width: 0;
  flex-wrap: wrap;
}

:global(.workspace-add-popover-content .object-palette-hint) {
  min-width: 0;
  white-space: normal;
  overflow-wrap: anywhere;
}

:global(.workspace-add-popover-content .object-palette-categories),
:global(.workspace-add-popover-content .object-palette-items) {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  gap: 0.25rem;
}

:global(.workspace-add-popover-content .object-palette-controls) {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 0.35rem;
}

:global(.workspace-add-popover-content .object-palette-orbit) {
  white-space: normal;
}
</style>
