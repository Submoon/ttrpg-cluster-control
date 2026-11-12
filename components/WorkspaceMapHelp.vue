<template>
  <UModal
    v-model:open="open"
    title="Map editor help"
    :content="dialogContent"
    :ui="{
      content: 'w-[calc(100vw-2rem)] max-w-2xl max-h-[calc(100dvh-2rem)] overflow-hidden',
      body: 'flex min-h-0 overflow-hidden p-0',
    }"
  >
    <UButton
      class="workspace-control"
      color="neutral"
      variant="outline"
      size="sm"
      aria-label="Help"
    >
      Help
    </UButton>

    <template #body>
      <div
        class="min-h-0 flex-1 overflow-y-auto p-4 text-sm leading-relaxed outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary sm:p-6"
        tabindex="0"
        role="region"
        aria-label="Map editor help guide"
      >
        <div class="grid gap-5">
          <section class="grid gap-2" aria-labelledby="map-help-mouse-heading">
            <h3 id="map-help-mouse-heading" class="m-0 text-base font-semibold">Mouse and map controls</h3>
            <ul class="m-0 grid list-disc gap-1.5 pl-5">
              <li>Choose Navigate, then drag empty map space to move around. Scroll the wheel to zoom in or out.</li>
              <li>Use Zoom in, Zoom out, or Fit map to change the view.</li>
              <li>Choose Select, then click a system, route, object, or Orbit (a ring on the map). If details are hidden, click Inspect to open them.</li>
              <li>To add a star, choose Add, Celestial bodies, then Add Star. Click an empty place in the star system.</li>
              <li>On the Jump Cluster map, choose Move and click a system. Choose Move selected system on map, click a new spot, then choose Confirm move.</li>
              <li>Choose Search, type an object name, then select a result to find it on the map.</li>
              <li>Choose Undo to take back your last change. Choose Redo to bring it back.</li>
            </ul>
          </section>

          <section class="grid gap-2" aria-labelledby="map-help-shortcuts-heading">
            <h3 id="map-help-shortcuts-heading" class="m-0 text-base font-semibold">Keyboard shortcuts</h3>
            <ul class="m-0 grid list-disc gap-1.5 pl-5">
              <li>Focus the map or one of its items, then press N for Navigate, S for Select, M for Move, or A to open Add.</li>
              <li>Press Ctrl+K on Windows or Linux, or Cmd+K on Mac, to open Search.</li>
              <li>Press Ctrl+Z or Cmd+Z to Undo. Redo with Ctrl+Shift+Z, Cmd+Shift+Z, or Ctrl+Y.</li>
              <li>With the map in Navigate, focus it and use the arrow keys to move the view.</li>
            </ul>
          </section>
        </div>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, watch } from 'vue'
import type { ModalProps } from '@nuxt/ui/components/Modal.vue'

const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ 'active-change': [active: boolean] }>()
const dialogContent: ModalProps['content'] & { 'aria-modal': 'true'; onCloseAutoFocus: () => void } = {
  'aria-modal': 'true',
  onCloseAutoFocus: () => {
    void nextTick(() => {
      if (!open.value) emit('active-change', false)
    })
  },
}

watch(open, isOpen => {
  if (isOpen) emit('active-change', true)
}, { flush: 'sync', immediate: true })

onBeforeUnmount(() => {
  if (open.value) emit('active-change', false)
})
</script>
