<template>
  <UPopover
    v-model:open="open"
    :modal="false"
    :content="{ side: 'top', align: 'start', sideOffset: 8, collisionPadding: 12, avoidCollisions: true }"
    :ui="{ content: 'system-object-placement-content' }"
  >
    <UButton
      class="workspace-control system-object-placement-trigger"
      color="neutral"
      variant="outline"
      size="sm"
      aria-label="Placement"
      aria-controls="system-object-placement-form"
      :aria-expanded="open"
    >
      <UIcon name="i-lucide-crosshair" aria-hidden="true" />
      Placement
    </UButton>
    <template #content>
      <form
        id="system-object-placement-form"
        class="system-object-placement-form"
        aria-label="Object placement"
        @submit.prevent="emit('preview-position')"
      >
        <p class="system-object-placement-heading">OBJECT PLACEMENT</p>
        <div v-if="props.candidates.length" class="system-object-placement-candidates system-object-placement-wide" role="group" aria-label="Choose destination Orbit">
          <div v-for="candidate in props.candidates" :key="candidate.key" class="system-object-placement-candidate">
            <UButton
              class="workspace-control system-object-placement-wide"
              color="neutral"
              variant="outline"
              size="sm"
              type="button"
              :disabled="candidate.error !== null"
              :aria-describedby="candidate.error ? `system-object-placement-candidate-error-${candidate.key}` : undefined"
              @click="emit('choose-candidate', candidate.key)"
            >
              {{ candidate.label }}
            </UButton>
            <p v-if="candidate.error" :id="`system-object-placement-candidate-error-${candidate.key}`" class="system-object-placement-candidate-error" role="note">
              {{ candidate.error }}
            </p>
          </div>
        </div>
        <template v-else>
          <UFormField
            label="Destination"
            description="Choose Free placement for precise positioning, or drag an attached object into empty space to detach."
            class="system-object-placement-wide"
          >
            <USelect
              :model-value="props.destination"
              :items="props.destinationOptions"
              aria-label="Destination"
              @update:model-value="emit('update-destination', String($event ?? ''))"
            />
          </UFormField>
          <template v-if="props.destination === freePlacementValue">
            <UFormField label="Object position X" :error="props.error || undefined">
              <UInput
                :model-value="props.positionXInput"
                type="number"
                step="any"
                inputmode="decimal"
                autocomplete="off"
                aria-label="Object position X"
                @update:model-value="emit('update-position-x-input', String($event))"
              />
            </UFormField>
            <UFormField label="Object position Y" :error="props.error || undefined">
              <UInput
                :model-value="props.positionYInput"
                type="number"
                step="any"
                inputmode="decimal"
                autocomplete="off"
                aria-label="Object position Y"
                @update:model-value="emit('update-position-y-input', String($event))"
              />
            </UFormField>
          </template>
          <UFormField v-else label="Orbit position (degrees)" class="system-object-placement-wide" :error="props.error || undefined">
            <UInput
              :model-value="props.positionInput"
              type="number"
              step="any"
              inputmode="decimal"
              autocomplete="off"
              aria-label="Orbit position (degrees)"
              @update:model-value="emit('update-position-input', String($event))"
            />
          </UFormField>
          <div v-if="props.preview" class="system-object-placement-actions system-object-placement-wide">
            <UButton class="workspace-control" color="primary" variant="solid" size="sm" type="button" @click="emit('confirm-position', props.preview.token)">
              Confirm position
            </UButton>
            <UButton class="workspace-control" color="neutral" variant="outline" size="sm" type="button" @click="emit('cancel-preview')">
              Cancel preview
            </UButton>
          </div>
          <UButton v-else class="workspace-control system-object-placement-wide" color="primary" variant="solid" size="sm" type="submit">
            Preview position
          </UButton>
        </template>
        <p v-if="props.error && props.candidates.length" class="system-object-placement-error system-object-placement-wide" role="alert">
          {{ props.error }}
        </p>
      </form>
    </template>
  </UPopover>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import {
  FREE_SYSTEM_OBJECT_PLACEMENT,
  type SystemObjectMoveCandidate,
  type SystemObjectMoveDestinationOption,
  type SystemObjectMovePreview,
} from '../composables/editor-workflows/types'

const freePlacementValue = FREE_SYSTEM_OBJECT_PLACEMENT
const props = defineProps<{
  destination: string
  destinationOptions: SystemObjectMoveDestinationOption[]
  candidates: SystemObjectMoveCandidate[]
  candidateRequest: number
  positionInput: string
  positionXInput: string
  positionYInput: string
  preview: SystemObjectMovePreview | null
  error: string
}>()

const emit = defineEmits<{
  'update-destination': [value: string]
  'update-position-input': [value: string]
  'update-position-x-input': [value: string]
  'update-position-y-input': [value: string]
  'choose-candidate': [key: string]
  'preview-position': []
  'confirm-position': [token: number]
  'cancel-preview': []
}>()

const open = ref(false)
watch(() => props.candidateRequest, request => {
  if (request > 0 && props.candidates.length > 0) open.value = true
}, { immediate: true })
</script>

<style scoped>
:global(.system-object-placement-content) {
  box-sizing: border-box;
  min-width: min(18rem, var(--reka-popover-content-available-width, calc(100vw - 1.5rem)));
  max-width: min(24rem, var(--reka-popover-content-available-width, calc(100vw - 1.5rem)));
  max-height: min(30rem, var(--reka-popover-content-available-height, calc(100dvh - 1.5rem)));
  overflow-y: auto;
}

.system-object-placement-form {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.65rem;
  padding: 0.75rem;
  border: 1px solid var(--line);
  border-radius: 0.35rem;
  background: var(--panel-raised);
  color: var(--text-primary);
}

.system-object-placement-heading,
.system-object-placement-wide {
  grid-column: 1 / -1;
}

.system-object-placement-heading {
  margin: 0;
  color: var(--text-muted);
  font: 0.625rem Consolas, monospace;
  letter-spacing: 0.09em;
}

.system-object-placement-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.system-object-placement-candidates {
  display: grid;
  gap: 0.55rem;
}

.system-object-placement-candidate {
  display: grid;
  gap: 0.2rem;
}

.system-object-placement-candidate-error,
.system-object-placement-error {
  margin: 0;
  color: var(--text-muted);
  font-size: 0.75rem;
}
</style>
