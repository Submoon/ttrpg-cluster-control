<template>
  <nav class="workspace-dock" role="toolbar" aria-label="Workspace navigation">
    <div class="workspace-dock-tools">
      <div class="workspace-dock-mode" role="group" aria-label="Map interaction mode">
        <UButton
          v-for="mode in modes"
          :key="mode.value"
          color="neutral"
          :variant="props.mode === mode.value ? 'solid' : 'outline'"
          size="sm"
          :aria-pressed="props.mode === mode.value"
          class="workspace-control"
          @click="emit('mode-change', mode.value)"
        >
          {{ mode.label }}
        </UButton>
      </div>

      <UPopover
        v-model:open="addOpen"
        :modal="false"
        :content="{ side: 'top', align: 'start', sideOffset: 8, collisionPadding: 12, avoidCollisions: true }"
        :ui="{ content: 'workspace-add-popover-content' }"
      >
        <UButton
          class="workspace-control workspace-dock-add"
          color="primary"
          variant="outline"
          size="sm"
          aria-label="Add to map"
          aria-controls="workspace-add-menu"
          :aria-expanded="addOpen"
        >
          <UIcon name="i-lucide-plus" aria-hidden="true" />
          Add
        </UButton>
        <template #content>
          <div
            id="workspace-add-menu"
            class="workspace-add-menu"
            role="group"
            aria-label="Add to map"
            :data-map-obstruction="addOpen ? '' : undefined"
          >
            <slot name="add" :close="closeAdd" />
          </div>
        </template>
      </UPopover>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import type { MapInteractionMode } from '../composables/editor-workflows/types'

const props = withDefaults(defineProps<{
  mode: MapInteractionMode
  closeSignal?: string
}>(), {
  closeSignal: '',
})

const emit = defineEmits<{
  'mode-change': [mode: MapInteractionMode]
}>()

const modes: Array<{ value: MapInteractionMode; label: string }> = [
  { value: 'navigate', label: 'Navigate' },
  { value: 'select', label: 'Select' },
  { value: 'move', label: 'Move' },
]
const addOpen = ref(false)

watch(() => props.closeSignal, () => closeAdd())

function closeAdd(): void {
  addOpen.value = false
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
