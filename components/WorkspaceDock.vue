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

      <UPopover v-model:open="addOpen" :modal="false" :content="{ side: 'top', align: 'start', sideOffset: 8 }">
        <UButton class="workspace-control" color="primary" variant="outline" size="sm" aria-label="Add to map">
          <span aria-hidden="true">+</span>
          Add
        </UButton>
        <template #content>
          <div class="workspace-add-menu" aria-label="Add to map">
            <slot name="add" :close="closeAdd" />
          </div>
        </template>
      </UPopover>

      <div class="workspace-dock-zoom" role="group" aria-label="Map zoom">
        <UButton class="workspace-control" color="neutral" variant="outline" size="sm" aria-label="Zoom out" :disabled="props.zoomLevel <= 25" @click="emit('zoom-by', 1 / 1.2)">
          −
        </UButton>
        <div class="workspace-zoom-range">
          <span class="sr-only">Zoom level</span>
          <USlider
            v-model="sliderValue"
            class="workspace-control workspace-zoom-slider"
            :min="25"
            :max="1600"
            :step="1"
            aria-label="Map zoom level"
            :aria-valuetext="`${props.zoomLevel}%`"
          />
          <output aria-live="polite">{{ props.zoomLevel }}%</output>
        </div>
        <UButton class="workspace-control" color="neutral" variant="outline" size="sm" aria-label="Zoom in" :disabled="props.zoomLevel >= 1600" @click="emit('zoom-by', 1.2)">
          +
        </UButton>
        <UButton class="workspace-control" color="neutral" variant="outline" size="sm" aria-label="Fit map" @click="emit('fit-map')">
          Fit
        </UButton>
      </div>
      <div class="workspace-dock-pan" role="group" aria-label="Pan map">
        <UButton class="workspace-control" color="neutral" variant="outline" size="sm" aria-label="Pan map left" @click="emit('pan-by', -80, 0)">←</UButton>
        <UButton class="workspace-control" color="neutral" variant="outline" size="sm" aria-label="Pan map up" @click="emit('pan-by', 0, -80)">↑</UButton>
        <UButton class="workspace-control" color="neutral" variant="outline" size="sm" aria-label="Pan map down" @click="emit('pan-by', 0, 80)">↓</UButton>
        <UButton class="workspace-control" color="neutral" variant="outline" size="sm" aria-label="Pan map right" @click="emit('pan-by', 80, 0)">→</UButton>
      </div>
    </div>
    <span class="sr-only" role="status" aria-live="polite">{{ props.status }}</span>
  </nav>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { MapInteractionMode } from '../composables/editor-workflows/types'

const props = defineProps<{
  mode: MapInteractionMode
  zoomLevel: number
  status: string
}>()

const emit = defineEmits<{
  'mode-change': [mode: MapInteractionMode]
  'zoom-by': [factor: number]
  'zoom-to': [percentage: number]
  'fit-map': []
  'pan-by': [dx: number, dy: number]
}>()

const modes: Array<{ value: MapInteractionMode; label: string }> = [
  { value: 'navigate', label: 'Navigate' },
  { value: 'select', label: 'Select' },
  { value: 'move', label: 'Move' },
]
const addOpen = ref(false)
const sliderValue = computed({
  get: () => props.zoomLevel,
  set: (value: number | undefined) => {
    if (typeof value === 'number' && Number.isFinite(value)) emit('zoom-to', value)
  },
})

function closeAdd(): void {
  addOpen.value = false
}
</script>
