<template>
  <UPopover v-model:open="open" :modal="false" :content="{ side: 'top', align: 'start', sideOffset: 8, collisionPadding: 12 }">
    <UButton
      class="workspace-control cluster-system-placement-trigger"
      color="neutral"
      variant="outline"
      size="sm"
      aria-label="Placement"
      aria-controls="cluster-system-placement-form"
      :aria-expanded="open"
    >
      <UIcon name="i-lucide-crosshair" aria-hidden="true" />
      Placement
    </UButton>
    <template #content>
      <form
        id="cluster-system-placement-form"
        class="cluster-system-placement-form"
        :aria-label="props.purpose === 'move' ? 'System move coordinates' : 'System placement coordinates'"
        @submit.prevent="submit"
      >
        <p class="cluster-system-placement-heading">CLUSTER POSITION</p>
        <div class="cluster-system-placement-fields">
          <UFormField label="X" :error="props.inputErrors?.x">
            <UInput
              :model-value="props.inputs?.x ?? '0.5'"
              type="text"
              inputmode="decimal"
              autocomplete="off"
              aria-label="System position X"
              @update:model-value="emit('update-input', 'x', String($event))"
            />
          </UFormField>
          <UFormField label="Y" :error="props.inputErrors?.y">
            <UInput
              :model-value="props.inputs?.y ?? '0.5'"
              type="text"
              inputmode="decimal"
              autocomplete="off"
              aria-label="System position Y"
              @update:model-value="emit('update-input', 'y', String($event))"
            />
          </UFormField>
        </div>
        <UButton class="workspace-control" color="primary" variant="solid" size="sm" type="submit">
          {{ props.purpose === 'move' ? 'Preview move' : 'Add at coordinates' }}
        </UButton>
      </form>
    </template>
  </UPopover>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { ClusterSystemPositionInput, ClusterSystemPositionInputs } from '../composables/editor-workflows/types'

const props = defineProps<{
  purpose?: 'add' | 'move'
  inputs?: ClusterSystemPositionInputs
  inputErrors?: Record<ClusterSystemPositionInput, string>
}>()

const emit = defineEmits<{
  'update-input': [key: ClusterSystemPositionInput, value: string]
  'add-from-inputs': []
  'preview-move-from-inputs': []
}>()

const open = ref(false)

function submit(): void {
  open.value = false
  if (props.purpose === 'move') emit('preview-move-from-inputs')
  else emit('add-from-inputs')
}
</script>

<style scoped>
.cluster-system-placement-form {
  display: grid;
  min-width: min(16rem, calc(100vw - 2rem));
  gap: 0.65rem;
  padding: 0.75rem;
  border: 1px solid var(--line);
  border-radius: 0.35rem;
  background: var(--panel-raised);
  color: var(--text-primary);
}

.cluster-system-placement-heading {
  margin: 0;
  color: var(--text-muted);
  font: 0.625rem Consolas, monospace;
  letter-spacing: 0.09em;
}

.cluster-system-placement-fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.5rem;
}
</style>
