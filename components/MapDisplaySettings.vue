<template>
  <div class="grid gap-4">
    <div class="grid gap-2">
      <label for="map-detail-zoom-percent" class="text-sm font-medium">Minimum zoom for map details</label>
      <div class="flex items-center gap-4">
        <USlider
          class="min-w-0 flex-1"
          :model-value="props.display.detailZoom"
          :min="WARDEN_DETAIL_ZOOM_MIN"
          :max="WARDEN_DETAIL_ZOOM_MAX"
          :step="1"
          aria-label="Minimum zoom for map details"
          :aria-valuetext="`${props.display.detailZoom}%`"
          @update:model-value="value => typeof value === 'number' && emit('change', { detailZoom: value })"
        />
        <div class="flex shrink-0 items-center gap-1">
          <UInputNumber
            id="map-detail-zoom-percent"
            class="w-20"
            :model-value="detailZoomInput"
            :min="WARDEN_DETAIL_ZOOM_MIN"
            :max="WARDEN_DETAIL_ZOOM_MAX"
            :step="1"
            :increment="false"
            :decrement="false"
            disable-wheel-change
            @update:model-value="updateDetailZoomInput"
            @blur="restoreDetailZoomInput"
          />
          <span class="text-sm" aria-hidden="true">%</span>
        </div>
      </div>
    </div>
    <UFormField label="Label density" description="Compact shows object names and Location keys for selected objects.">
      <USelect
        class="w-full max-w-72"
        :model-value="props.display.labels"
        :items="labelOptions"
        @update:model-value="labels => (labels === 'standard' || labels === 'compact') && emit('change', { labels })"
      />
    </UFormField>
    <UFormField label="Map animations" description="Reduced uses a shorter wheel zoom and immediate map detail transitions.">
      <USelect
        class="w-full max-w-72"
        :model-value="props.display.animation"
        :items="animationOptions"
        @update:model-value="animation => (animation === 'system' || animation === 'reduced' || animation === 'off') && emit('change', { animation })"
      />
    </UFormField>
    <UFormField label="When opening the map">
      <USelect
        class="w-full max-w-72"
        :model-value="props.display.startup"
        :items="startupOptions"
        @update:model-value="startup => (startup === 'fit' || startup === 'resume') && emit('change', { startup })"
      />
    </UFormField>
  </div>
</template>

<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import type { WardenDisplayPreferences } from '../composables/useWardenDisplayPreferences'
import { WARDEN_DETAIL_ZOOM_MAX, WARDEN_DETAIL_ZOOM_MIN } from '../utils/continuous-map-projection'

const props = defineProps<{ display: WardenDisplayPreferences }>()
const emit = defineEmits<{ change: [patch: Partial<WardenDisplayPreferences>] }>()
const detailZoomInput = ref<number | null>(props.display.detailZoom)

watch(() => props.display.detailZoom, percent => { detailZoomInput.value = percent })

function updateDetailZoomInput(percent: number | null | undefined): void {
  detailZoomInput.value = percent ?? null
  if (typeof percent === 'number') emit('change', { detailZoom: percent })
}

async function restoreDetailZoomInput(): Promise<void> {
  await nextTick()
  if (detailZoomInput.value === null) detailZoomInput.value = props.display.detailZoom
}

const labelOptions = [
  { label: 'Standard', value: 'standard' },
  { label: 'Compact', value: 'compact' },
] satisfies { label: string; value: WardenDisplayPreferences['labels'] }[]
const animationOptions = [
  { label: 'Follow system', value: 'system' },
  { label: 'Reduced', value: 'reduced' },
  { label: 'Off', value: 'off' },
] satisfies { label: string; value: WardenDisplayPreferences['animation'] }[]
const startupOptions = [
  { label: 'Fit the Jump Cluster', value: 'fit' },
  { label: 'Resume last view', value: 'resume' },
] satisfies { label: string; value: WardenDisplayPreferences['startup'] }[]
</script>
