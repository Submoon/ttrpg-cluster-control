<template>
  <div class="grid gap-4">
    <UFormField label="Minimum zoom for map details">
      <div class="flex items-center gap-4">
        <USlider
          class="min-w-0 flex-1"
          :model-value="props.display.detailZoom"
          :min="WARDEN_DETAIL_ZOOM_MIN"
          :max="WARDEN_DETAIL_ZOOM_MAX"
          :step="5"
          aria-label="Minimum zoom for map details"
          :aria-valuetext="`${props.display.detailZoom}%`"
          @update:model-value="value => typeof value === 'number' && emit('change', { detailZoom: value })"
        />
        <output class="text-sm tabular-nums">{{ props.display.detailZoom }}%</output>
      </div>
    </UFormField>
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
import type { WardenDisplayPreferences } from '../composables/useWardenDisplayPreferences'
import { WARDEN_DETAIL_ZOOM_MAX, WARDEN_DETAIL_ZOOM_MIN } from '../utils/continuous-map-projection'

const props = defineProps<{ display: WardenDisplayPreferences }>()
const emit = defineEmits<{ change: [patch: Partial<WardenDisplayPreferences>] }>()
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
