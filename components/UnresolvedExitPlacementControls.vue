<template>
  <section class="unresolved-exit-placement" aria-label="Unresolved exit placement">
    <p class="unresolved-exit-placement-heading">MOVE EXIT TARGET</p>
    <p v-if="props.preview" class="unresolved-exit-placement-help" role="status">
      Choose a destination on the map. Use the arrow keys to adjust it.
    </p>
    <p v-if="props.error" class="unresolved-exit-placement-error" role="alert">
      {{ props.error }}
    </p>
    <div class="unresolved-exit-placement-actions">
      <UButton
        v-if="!props.preview"
        class="workspace-control"
        color="primary"
        variant="solid"
        size="sm"
        type="button"
        @click="emit('begin')"
      >
        Move on map
      </UButton>
      <template v-else>
        <UButton class="workspace-control" color="primary" variant="solid" size="sm" type="button" @click="emit('confirm')">
          Confirm move
        </UButton>
        <UButton class="workspace-control" color="neutral" variant="outline" size="sm" type="button" @click="emit('cancel')">
          Cancel move
        </UButton>
      </template>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { UnresolvedExitMovePreview } from '../composables/editor-workflows/useUnresolvedExitPlacement'

const props = defineProps<{
  preview: UnresolvedExitMovePreview | null
  error: string
}>()

const emit = defineEmits<{
  begin: []
  confirm: []
  cancel: []
}>()
</script>

<style scoped>
.unresolved-exit-placement {
  display: grid;
  gap: 0.55rem;
  min-width: min(17rem, calc(100vw - 2rem));
  padding: 0.75rem;
  border: 1px solid var(--line);
  border-radius: 0.35rem;
  background: var(--panel-raised);
  color: var(--text-primary);
}

.unresolved-exit-placement-heading {
  margin: 0;
  color: var(--text-muted);
  font: 0.625rem Consolas, monospace;
  letter-spacing: 0.09em;
}

.unresolved-exit-placement-help,
.unresolved-exit-placement-error {
  margin: 0;
  font-size: 0.75rem;
}

.unresolved-exit-placement-help {
  color: var(--text-muted);
}

.unresolved-exit-placement-error {
  color: var(--color-error-500, #ef4444);
}

.unresolved-exit-placement-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}
</style>
