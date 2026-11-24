<template>
  <nav class="workspace-zoom-controls" role="toolbar" aria-label="Map zoom controls">
    <UTooltip text="Zoom out">
      <UButton
        class="workspace-control"
        color="neutral"
        variant="outline"
        size="sm"
        icon="i-lucide-minus"
        aria-label="Zoom out"
        :disabled="props.zoomLevel <= props.minimumZoomLevel"
        @click="emit('zoom-by', 1 / 1.2)"
      />
    </UTooltip>

    <output class="workspace-zoom-value" aria-live="polite">{{ formatPercentage(displayZoomLevel) }}%</output>

    <UTooltip text="Zoom in">
      <UButton
        class="workspace-control"
        color="neutral"
        variant="outline"
        size="sm"
        icon="i-lucide-plus"
        aria-label="Zoom in"
        :disabled="props.zoomLevel >= maximumZoomLevel"
        @click="emit('zoom-by', 1.2)"
      />
    </UTooltip>

    <UTooltip text="Fit map">
      <UButton
        class="workspace-control workspace-zoom-fit"
        color="neutral"
        variant="outline"
        size="sm"
        icon="i-lucide-expand"
        aria-label="Fit map"
        @click="emit('fit-map')"
      />
    </UTooltip>

    <UTooltip v-if="props.centerAvailable" text="Center selected target">
      <UButton
        class="workspace-control"
        color="neutral"
        variant="outline"
        size="sm"
        icon="i-lucide-focus"
        aria-label="Center selected target"
        @click="emit('center-map')"
      />
    </UTooltip>

    <UPopover
      v-model:open="navigationOpen"
      :modal="false"
      :content="{ side: 'top', align: 'end', sideOffset: 8, collisionPadding: 12 }"
    >
      <UButton
        class="workspace-control workspace-zoom-navigation-toggle"
        color="neutral"
        :variant="navigationOpen ? 'soft' : 'outline'"
        size="sm"
        icon="i-lucide-move"
        aria-label="Open map navigation controls"
        title="More map controls"
        aria-controls="workspace-zoom-navigation-panel"
        :aria-expanded="navigationOpen"
      />

      <template #content>
        <div
          id="workspace-zoom-navigation-panel"
          class="workspace-zoom-navigation"
          data-map-obstruction
          role="group"
          aria-label="Map zoom"
        >
          <div class="workspace-zoom-slider-heading">
            <label for="workspace-map-zoom-level">Zoom level</label>
            <output aria-live="polite">{{ formatPercentage(displayZoomLevel) }}%</output>
          </div>
          <USlider
            id="workspace-map-zoom-level"
            v-model="sliderValue"
            class="workspace-control workspace-zoom-slider"
            :min="displayMinimumZoomLevel"
            :max="displayMaximumZoomLevel"
            :step="percentageFactor"
            aria-label="Map zoom level"
            :aria-valuetext="`${formatPercentage(displayZoomLevel)}%`"
          />

          <div class="workspace-zoom-pan" role="group" aria-label="Pan map">
            <UButton
              class="workspace-control workspace-zoom-pan-up"
              color="neutral"
              variant="outline"
              size="sm"
              icon="i-lucide-chevron-up"
              aria-label="Pan map up"
              @click="emit('pan-by', 0, -80)"
            />
            <UButton
              class="workspace-control workspace-zoom-pan-left"
              color="neutral"
              variant="outline"
              size="sm"
              icon="i-lucide-chevron-left"
              aria-label="Pan map left"
              @click="emit('pan-by', -80, 0)"
            />
            <UButton
              class="workspace-control workspace-zoom-pan-down"
              color="neutral"
              variant="outline"
              size="sm"
              icon="i-lucide-chevron-down"
              aria-label="Pan map down"
              @click="emit('pan-by', 0, 80)"
            />
            <UButton
              class="workspace-control workspace-zoom-pan-right"
              color="neutral"
              variant="outline"
              size="sm"
              icon="i-lucide-chevron-right"
              aria-label="Pan map right"
              @click="emit('pan-by', 80, 0)"
            />
          </div>
          <p class="workspace-zoom-range-note">Zoom ranges from {{ formatPercentage(displayMinimumZoomLevel) }}% to {{ formatPercentage(displayMaximumZoomLevel) }}%.</p>
        </div>
      </template>
    </UPopover>
  </nav>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { CONTINUOUS_MAP_SYSTEM_SCALE } from '../utils/continuous-map-projection'
import { MAP_ZOOM_MAX_SCALE, MAP_ZOOM_MIN_SCALE } from '../utils/map-zoom'

const props = withDefaults(defineProps<{
  zoomLevel: number
  minimumZoomLevel?: number
  systemRelative?: boolean
  compactModalOpen?: boolean
  centerAvailable?: boolean
}>(), {
  compactModalOpen: false,
  minimumZoomLevel: MAP_ZOOM_MIN_SCALE * 100,
})

const emit = defineEmits<{
  'zoom-by': [factor: number]
  'zoom-to': [percentage: number]
  'fit-map': []
  'center-map': []
  'pan-by': [dx: number, dy: number]
}>()

const navigationOpen = ref(false)
const maximumZoomLevel = MAP_ZOOM_MAX_SCALE * 100
// A Warden system at 100% maps local system units to viewport units at 1:1.
const percentageFactor = computed(() => props.systemRelative ? CONTINUOUS_MAP_SYSTEM_SCALE : 1)
const displayZoomLevel = computed(() => props.zoomLevel * percentageFactor.value)
const displayMinimumZoomLevel = computed(() => props.minimumZoomLevel * percentageFactor.value)
const displayMaximumZoomLevel = computed(() => maximumZoomLevel * percentageFactor.value)

function formatPercentage(value: number): string {
  if (value < 1) return Number(value.toPrecision(3)).toString()
  return String(props.systemRelative ? Number(value.toFixed(1)) : Math.round(value))
}
watch(() => props.compactModalOpen, open => {
  if (open) navigationOpen.value = false
})
const sliderValue = computed({
  get: () => displayZoomLevel.value,
  set: (value: number | undefined) => {
    if (typeof value === 'number' && Number.isFinite(value)) emit('zoom-to', value / percentageFactor.value)
  },
})
</script>

<style scoped>
.workspace-zoom-controls {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 8px;
  border: 1px solid var(--line-soft);
  border-radius: 0.35rem;
  padding: 0.25rem;
  background: var(--panel);
  color: var(--text-primary);
  box-shadow: 0 0.45rem 1.4rem rgb(0 0 0 / 20%);
}

.workspace-zoom-value {
  min-width: 3.5rem;
  color: var(--text-secondary);
  font: 0.7rem Consolas, monospace;
  text-align: center;
}

.workspace-zoom-navigation {
  display: grid;
  width: min(15rem, calc(100vw - 1.5rem));
  gap: 0.7rem;
  padding: 0.75rem;
  border: 1px solid var(--line);
  border-radius: 0.35rem;
  background: var(--panel-raised);
  color: var(--text-primary);
  box-shadow: 0 0.7rem 2rem rgb(0 0 0 / 35%);
}

.workspace-zoom-slider-heading {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5rem;
  color: var(--text-secondary);
  font-size: 0.8rem;
}

.workspace-zoom-slider-heading output {
  color: var(--text-primary);
  font: 0.7rem Consolas, monospace;
}

.workspace-zoom-slider {
  margin-block: 0.25rem;
}

.workspace-zoom-pan {
  display: grid;
  grid-template: repeat(3, 2.5rem) / repeat(3, 2.5rem);
  justify-content: center;
  gap: 0.2rem;
}

.workspace-zoom-pan-up {
  grid-area: 1 / 2;
}

.workspace-zoom-pan-left {
  grid-area: 2 / 1;
}

.workspace-zoom-pan-down {
  grid-area: 3 / 2;
}

.workspace-zoom-pan-right {
  grid-area: 2 / 3;
}

.workspace-zoom-range-note {
  margin: 0;
  color: var(--text-muted);
  font-size: 0.7rem;
  text-align: center;
}

@media (max-width: 760px), (max-height: 600px) {
  .workspace-zoom-controls {
    gap: 8px;
    padding: 0.18rem;
  }

  .workspace-zoom-controls > :deep(button) {
    min-width: 2.3rem;
    min-height: 2.3rem;
  }

  .workspace-zoom-value {
    min-width: 3rem;
    font-size: 0.65rem;
  }
}

@media (min-width: 761px) and (max-height: 600px) {
  .workspace-zoom-navigation {
    width: min(18rem, calc(100vw - 1.5rem));
    grid-template:
      'heading pan' auto
      'slider pan' auto
      'note pan' auto
      / minmax(0, 1fr) auto;
    align-items: center;
    gap: 0.15rem 0.5rem;
    padding: 0.4rem;
  }

  .workspace-zoom-slider-heading {
    grid-area: heading;
    font-size: 0.7rem;
  }

  .workspace-zoom-slider {
    grid-area: slider;
    width: 100%;
    margin: 0;
  }

  .workspace-zoom-pan {
    grid-area: pan;
    grid-template: 2.5rem / repeat(4, 2.5rem);
    gap: 0.1rem;
  }

  .workspace-zoom-pan-up { grid-area: 1 / 2; }
  .workspace-zoom-pan-left { grid-area: 1 / 1; }
  .workspace-zoom-pan-down { grid-area: 1 / 3; }
  .workspace-zoom-pan-right { grid-area: 1 / 4; }

  .workspace-zoom-range-note {
    grid-area: note;
    text-align: left;
  }
}
</style>
