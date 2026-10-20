<template>
  <aside
    v-show="props.visible"
    :id="props.panelId"
    class="workspace-resizable-panel"
    :class="[`workspace-resizable-panel-${props.side}`, { 'workspace-resizable-panel-compact': props.compact }]"
    :style="{ width: `${panelWidth}px` }"
    :data-map-obstruction="props.visible && !props.compact ? '' : undefined"
    :role="props.compact ? 'dialog' : 'complementary'"
    :aria-modal="props.compact ? 'true' : undefined"
    :aria-label="props.label"
  >
    <UDashboardPanel :resizable="false" :ui="panelUi" class="workspace-panel-surface">
      <div
        class="workspace-side-panel-content"
        :class="{ 'workspace-side-panel-content-inspector': props.panelId === 'workspace-inspector-panel' }"
      >
        <UButton
          v-if="props.showCloseButton"
          class="workspace-control panel-close-button"
          color="neutral"
          variant="outline"
          size="sm"
          type="button"
          :aria-label="props.panelId.includes('hierarchy') ? 'Close hierarchy panel' : 'Close inspector panel'"
          :aria-controls="props.panelId"
          @click="emit('close')"
        >×</UButton>
        <slot />
      </div>
    </UDashboardPanel>

    <UDashboardResizeHandle
      v-if="!props.compact"
      as="div"
      class="workspace-panel-resize-handle workspace-control"
      role="separator"
      aria-orientation="vertical"
      :aria-label="`Resize ${props.label.toLowerCase()} panel`"
      :aria-controls="props.panelId"
      :aria-valuemin="MIN_PANEL_WIDTH"
      :aria-valuemax="panelMaxWidth"
      :aria-valuenow="panelWidth"
      tabindex="0"
      @pointerdown="startResize"
      @pointermove="continueResize"
      @pointerup="endResize"
      @pointercancel="endResize"
      @lostpointercapture="endResize"
      @keydown="resizeByKeyboard"
      @dblclick="resetWidth"
    />
    <div v-if="props.compact && props.showCompactRecovery" class="workspace-compact-recovery">
      <slot name="compact-recovery" />
    </div>
  </aside>
</template>

<script setup lang="ts">
/** One mounted dashboard panel with bounded, session-only pointer and keyboard width state. */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

const MIN_PANEL_WIDTH = 220
const MAX_PANEL_WIDTH = 520
const PANEL_CENTER_RESERVE = 280

const props = withDefaults(defineProps<{
  panelId: string
  label: string
  side: 'left' | 'right'
  visible: boolean
  compact: boolean
  board: HTMLElement | null
  showCloseButton?: boolean
  showCompactRecovery?: boolean
}>(), {
  showCloseButton: true,
  showCompactRecovery: true,
})

const emit = defineEmits<{ close: [] }>()

const panelUi = { root: 'workspace-panel-surface' }
const preferredWidth = ref(props.side === 'left' ? 300 : 360)
const boardWidth = ref(0)
const panelMaxWidth = computed(() => Math.max(
  MIN_PANEL_WIDTH,
  Math.min(MAX_PANEL_WIDTH, (boardWidth.value - PANEL_CENTER_RESERVE) / 2),
))
const panelWidth = computed(() => Math.min(panelMaxWidth.value, Math.max(MIN_PANEL_WIDTH, preferredWidth.value)))

let observer: ResizeObserver | undefined
let resizeTarget: HTMLElement | null = null
let activePointerId: number | null = null
let pointerStartX = 0
let pointerStartWidth = 0

function updateBoardWidth(): void {
  boardWidth.value = props.board?.getBoundingClientRect().width ?? 0
}

function observeBoard(board: HTMLElement | null): void {
  observer?.disconnect()
  observer = undefined
  if (!board) {
    boardWidth.value = 0
    return
  }
  updateBoardWidth()
  observer = new ResizeObserver(updateBoardWidth)
  observer.observe(board)
}

watch(() => props.board, observeBoard, { flush: 'post' })
onMounted(() => observeBoard(props.board))
watch(() => [props.visible, props.compact] as const, ([visible, compact]) => {
  if (!visible || compact) cancelActivePointer()
}, { flush: 'sync' })

function startResize(event: PointerEvent): void {
  if (event.button !== 0 || props.compact || !props.visible || activePointerId !== null) return
  const handle = event.currentTarget
  if (!(handle instanceof HTMLElement)) return
  activePointerId = event.pointerId
  pointerStartX = event.clientX
  pointerStartWidth = panelWidth.value
  resizeTarget = handle
  handle.setPointerCapture(event.pointerId)
  event.preventDefault()
}

function continueResize(event: PointerEvent): void {
  if (activePointerId !== event.pointerId) return
  const delta = props.side === 'left'
    ? event.clientX - pointerStartX
    : pointerStartX - event.clientX
  preferredWidth.value = Math.min(panelMaxWidth.value, Math.max(MIN_PANEL_WIDTH, pointerStartWidth + delta))
}

function endResize(event: PointerEvent): void {
  if (activePointerId !== event.pointerId) return
  const handle = resizeTarget
  activePointerId = null
  resizeTarget = null
  if (handle?.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId)
}

function resizeByKeyboard(event: KeyboardEvent): void {
  const step = event.shiftKey ? 48 : 16
  let nextWidth: number | undefined
  if (event.key === 'Home') nextWidth = MIN_PANEL_WIDTH
  else if (event.key === 'End') nextWidth = panelMaxWidth.value
  else if (event.key === 'ArrowRight') nextWidth = panelWidth.value + (props.side === 'left' ? step : -step)
  else if (event.key === 'ArrowLeft') nextWidth = panelWidth.value + (props.side === 'right' ? step : -step)
  if (nextWidth === undefined) return
  event.preventDefault()
  preferredWidth.value = Math.min(panelMaxWidth.value, Math.max(MIN_PANEL_WIDTH, nextWidth))
}

function resetWidth(event: MouseEvent): void {
  event.preventDefault()
  cancelActivePointer()
  preferredWidth.value = props.side === 'left' ? 300 : 360
}

function cancelActivePointer(): void {
  const handle = resizeTarget
  const pointerId = activePointerId
  activePointerId = null
  resizeTarget = null
  if (handle && pointerId !== null && handle.hasPointerCapture(pointerId)) handle.releasePointerCapture(pointerId)
}

onBeforeUnmount(() => {
  observer?.disconnect()
  observer = undefined
  cancelActivePointer()
})
</script>
