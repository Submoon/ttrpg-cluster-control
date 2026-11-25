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
      ref="trigger"
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
          <section class="grid gap-2" aria-labelledby="map-help-navigation-heading">
            <h3 id="map-help-navigation-heading" class="m-0 text-base font-semibold">Navigate and inspect</h3>
            <ul class="m-0 grid list-disc gap-1.5 pl-5">
              <li>Scroll or pinch to zoom between the Jump Cluster and system detail. Drag empty map space with one finger to pan. Use <strong>Fit map</strong> to see the whole Cluster.</li>
              <li>Choose <strong>Center selection</strong> to frame the inspected system, object, Orbit, or Jump Route.</li>
              <li>Choose <strong>Select</strong> and click an item. Open <strong>Inspect</strong> if its details are hidden.</li>
              <li>Use <strong>Hierarchy</strong> to browse the map, or type an object name in <strong>Search</strong> and choose a result to find it.</li>
            </ul>
          </section>

          <section class="grid gap-2" aria-labelledby="map-help-right-click-heading">
            <h3 id="map-help-right-click-heading" class="m-0 text-base font-semibold">Right-click and right-drag</h3>
            <ul class="m-0 grid list-disc gap-1.5 pl-5">
              <li>Hold the right mouse button and drag to move the view while using any map tool.</li>
              <li>
                Right-click an object, Orbit, system, or Jump Route to open its menu.
                Choose <strong>Change Visibility</strong> to control what players see on a shared map.
              </li>
              <li>
                Right-click an object on the map or in <strong>Hierarchy</strong> to select it and open its menu.
                Right-clicking an already selected object keeps the current selection. Choose <strong>Move selection</strong>, then drag a selected object.
              </li>
              <li>To open the menu from the keyboard, focus a map or Hierarchy item and press <strong>Shift+F10</strong> or the <strong>Context Menu</strong> key.</li>
            </ul>
          </section>

          <section class="grid gap-2" aria-labelledby="map-help-add-heading">
            <h3 id="map-help-add-heading" class="m-0 text-base font-semibold">Add an object</h3>
            <ol class="m-0 grid list-decimal gap-1.5 pl-5">
              <li>
                Choose <strong>Add</strong>, then a category and object type.
                For example, choose <strong>Celestial bodies</strong> then <strong>Planet</strong>, or <strong>Installations</strong> then <strong>Station</strong>.
              </li>
              <li>
                Click an empty spot to place the object freely, or click an <strong>Orbit</strong> (a ring on the map) to place it on that path.
                Choose the owning system when prompted.
              </li>
              <li>Click again to add another object of the same type. Choose <strong>Quit Add</strong> when you’re done.</li>
            </ol>
            <p>To create an Orbit, choose <strong>Add Orbit</strong> under <strong>Add</strong>. Click an object to host it, or click empty space for an unoccupied center. Empty Orbits remain on the chart.</p>
          </section>

          <section class="grid gap-2" aria-labelledby="map-help-edit-heading">
            <h3 id="map-help-edit-heading" class="m-0 text-base font-semibold">Edit, move, and undo</h3>
            <ul class="m-0 grid list-disc gap-1.5 pl-5">
              <li>To change an object's details, open it in <strong>Inspect</strong>, choose <strong>Edit</strong>, and finish with <strong>Apply changes</strong>.</li>
              <li>Choose <strong>Move</strong> and drag an object. If a placement preview opens, choose the target and confirm the new position.</li>
              <li>In <strong>Move</strong>, drag an unoccupied Orbit center or use its map placement controls. Drag the center onto an object to attach the Orbit to it.</li>
              <li>
                On the Jump Cluster map, choose <strong>Move</strong> and click a system.
                Choose <strong>Move selected system on map</strong>, click a new spot, then choose <strong>Confirm move</strong>.
              </li>
              <li>Choose <strong>Undo</strong> to take back your last change. Choose <strong>Redo</strong> to bring it back.</li>
            </ul>
          </section>

          <section class="grid gap-2" aria-labelledby="map-help-publication-heading">
            <h3 id="map-help-publication-heading" class="m-0 text-base font-semibold">Player visibility</h3>
            <ul class="m-0 grid list-disc gap-1.5 pl-5">
              <li><strong>Hidden</strong> hides a location. An object needed as an Orbit host can still appear as an unknown presence. <strong>Unknown presence</strong> shows a marker without its name or type. <strong>Known type</strong> also shows the type. <strong>Revealed</strong> shows the name.</li>
              <li>Players can open a <strong>Revealed</strong> star system. Objects inside follow their own visibility settings.</li>
              <li>A <strong>Shared</strong> Jump Route appears when at least one endpoint system is visible. Hidden systems are anonymized and Jump Point names stay private.</li>
            </ul>
          </section>

          <section class="grid gap-2" aria-labelledby="map-help-shortcuts-heading">
            <h3 id="map-help-shortcuts-heading" class="m-0 text-base font-semibold">Keyboard shortcuts</h3>
            <ul class="m-0 grid list-disc gap-1.5 pl-5">
              <li>Focus the map or one of its items, then press S for Select, M for Move, or A to open Add.</li>
              <li>Press Ctrl+K on Windows or Linux, or Cmd+K on Mac, to open Search.</li>
              <li>Press Ctrl+Z or Cmd+Z to Undo. Redo with Ctrl+Shift+Z, Cmd+Shift+Z, or Ctrl+Y.</li>
              <li>Focus the map and use the arrow keys to pan. In Add, press Enter or Space to use the focused mark or the center of the view.</li>
            </ul>
          </section>
        </div>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import type { ModalProps } from '@nuxt/ui/components/Modal.vue'
import { createDialogFocusTarget, restoreDialogFocus } from '../utils/dialog-focus'

const open = defineModel<boolean>('open', { required: true })
const props = defineProps<{
  externalOpener?: HTMLElement | null
  focusFallback?: () => void
}>()
const emit = defineEmits<{ 'active-change': [active: boolean] }>()
const trigger = ref<{ $el?: HTMLElement } | null>(null)
const dialogContent: ModalProps['content'] & { 'aria-modal': 'true' } = {
  'aria-modal': 'true',
  onCloseAutoFocus: (event) => {
    event.preventDefault()
    const opener = createDialogFocusTarget(props.externalOpener ?? null)
    void nextTick(async () => {
      if (open.value) return
      emit('active-change', false)
      await nextTick()
      if (open.value) return
      const desktopTrigger = createDialogFocusTarget(trigger.value?.$el ?? null)
      if (restoreDialogFocus(opener, desktopTrigger) === 'none') props.focusFallback?.()
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
