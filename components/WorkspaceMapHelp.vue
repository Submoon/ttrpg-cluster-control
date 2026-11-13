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
          <section class="grid gap-2" aria-labelledby="map-help-navigation-heading">
            <h3 id="map-help-navigation-heading" class="m-0 text-base font-semibold">Navigate and inspect</h3>
            <ul class="m-0 grid list-disc gap-1.5 pl-5">
              <li>Choose <strong>Navigate</strong> and drag empty map space to move the view. Scroll the wheel to zoom, or use <strong>Fit map</strong> to see the whole map.</li>
              <li>
                The <strong>Jump Cluster</strong> map shows star systems and their routes. In <strong>Navigate</strong>, click a system to open its map.
                Choose <strong>Back</strong> to return to the Jump Cluster.
              </li>
              <li>Choose <strong>Select</strong> and click an item. Open <strong>Inspect</strong> if its details are hidden.</li>
              <li>Use <strong>Hierarchy</strong> to browse the map, or type an object name in <strong>Search</strong> and choose a result to find it.</li>
            </ul>
          </section>

          <section class="grid gap-2" aria-labelledby="map-help-right-click-heading">
            <h3 id="map-help-right-click-heading" class="m-0 text-base font-semibold">Right-click and right-drag</h3>
            <ul class="m-0 grid list-disc gap-1.5 pl-5">
              <li>Hold the right mouse button and drag to move the view while using any map tool.</li>
              <li>
                In <strong>Select</strong>, right-click a system on the Jump Cluster map or an object in a star system to open its menu.
                Choose <strong>Change Visibility</strong> to control what players see on a shared map.
              </li>
              <li>
                In <strong>Select</strong>, click an object or Shift-click to select several. Right-click a selected object, choose
                <strong>Move selection</strong>, then drag a selected object to move the selection.
              </li>
              <li>To open the menu from the keyboard, focus the system or object and press <strong>Shift+F10</strong> or the <strong>Context Menu</strong> key.</li>
            </ul>
          </section>

          <section class="grid gap-2" aria-labelledby="map-help-add-heading">
            <h3 id="map-help-add-heading" class="m-0 text-base font-semibold">Add an object</h3>
            <ol class="m-0 grid list-decimal gap-1.5 pl-5">
              <li>
                In a star system, choose <strong>Add</strong>, then a category and object type.
                For example, choose <strong>Celestial bodies</strong> then <strong>Planet</strong>, or <strong>Installations</strong> then <strong>Station</strong>.
              </li>
              <li>
                Click an empty spot to place the object freely, or click an <strong>Orbit</strong> (a ring on the map) to place it on that path.
                If several destinations are offered, choose one from the list.
              </li>
              <li>Click again to add another object of the same type. Choose <strong>Quit Add</strong> when you’re done.</li>
            </ol>
            <p>To create a ring, choose <strong>Add Orbit</strong> in <strong>Add</strong>. Click an object to center the ring on it, or click empty space to set its center there.</p>
          </section>

          <section class="grid gap-2" aria-labelledby="map-help-edit-heading">
            <h3 id="map-help-edit-heading" class="m-0 text-base font-semibold">Edit, move, and undo</h3>
            <ul class="m-0 grid list-disc gap-1.5 pl-5">
              <li>To change an object's details, open it in <strong>Inspect</strong>, choose <strong>Edit</strong>, and finish with <strong>Apply changes</strong>.</li>
              <li>In a star system, choose <strong>Move</strong> and drag an object. If a placement preview opens, choose the target and confirm the new position.</li>
              <li>
                On the Jump Cluster map, choose <strong>Move</strong> and click a system.
                Choose <strong>Move selected system on map</strong>, click a new spot, then choose <strong>Confirm move</strong>.
              </li>
              <li>Choose <strong>Undo</strong> to take back your last change. Choose <strong>Redo</strong> to bring it back.</li>
            </ul>
          </section>

          <section class="grid gap-2" aria-labelledby="map-help-shortcuts-heading">
            <h3 id="map-help-shortcuts-heading" class="m-0 text-base font-semibold">Keyboard shortcuts</h3>
            <ul class="m-0 grid list-disc gap-1.5 pl-5">
              <li>Focus the map or one of its items, then press N for Navigate, S for Select, M for Move, or A to open Add.</li>
              <li>Press Ctrl+K on Windows or Linux, or Cmd+K on Mac, to open Search.</li>
              <li>Press Ctrl+Z or Cmd+Z to Undo. Redo with Ctrl+Shift+Z, Cmd+Shift+Z, or Ctrl+Y.</li>
              <li>Choose Navigate, focus the map, then use the arrow keys to move the view.</li>
              <li>After choosing an object type in Add, focus the star system map and press Enter or Space to target the center of the view.</li>
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
