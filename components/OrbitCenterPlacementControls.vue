<template>
  <div v-if="props.available" class="orbit-center-placement-controls" role="group" aria-label="Orbit center placement controls">
    <UButton
      v-if="!props.targeting"
      class="workspace-control"
      color="neutral"
      variant="outline"
      size="sm"
      type="button"
      @click="emit('begin')"
    >
      <UIcon name="i-lucide-crosshair" aria-hidden="true" />
      Move center on map
    </UButton>

    <template v-else>
      <p class="orbit-center-placement-status" role="status" aria-live="polite">
        Click a destination or use the arrow keys to preview the Orbit center move.
      </p>
      <div v-if="props.preview" class="orbit-center-placement-actions">
        <UButton
          class="workspace-control"
          color="primary"
          variant="solid"
          size="sm"
          type="button"
          @click="emit('confirm', props.preview.token)"
        >Confirm center position</UButton>
        <UButton
          class="workspace-control"
          color="neutral"
          variant="outline"
          size="sm"
          type="button"
          @click="emit('cancel')"
        >Cancel preview</UButton>
      </div>
      <UButton
        v-else
        class="workspace-control"
        color="neutral"
        variant="outline"
        size="sm"
        type="button"
        @click="emit('cancel')"
      >Cancel move</UButton>
    </template>

    <p v-if="props.error" class="orbit-center-placement-error" role="alert">{{ props.error }}</p>
  </div>
</template>

<script setup lang="ts">
import type { OrbitCenterMovePreview } from '../composables/editor-workflows/types'

const props = defineProps<{
  available: boolean
  targeting: boolean
  preview: OrbitCenterMovePreview | null
  error: string
}>()

const emit = defineEmits<{
  begin: []
  confirm: [token: number]
  cancel: []
}>()
</script>

<style scoped>
.orbit-center-placement-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.45rem;
}

.orbit-center-placement-status,
.orbit-center-placement-error {
  margin: 0;
  color: var(--text-muted);
  font-size: 0.75rem;
}

.orbit-center-placement-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
}

.orbit-center-placement-error { color: var(--color-error, #e88f87); }
</style>
