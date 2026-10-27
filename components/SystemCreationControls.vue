<template>
  <div
    v-if="props.session"
    class="system-creation-controls"
    role="group"
    :aria-label="`${props.typeLabel} creation controls`"
  >
    <UPopover
      v-model:open="placementOpen"
      :modal="false"
      :content="{ side: 'top', align: 'center', sideOffset: 8, collisionPadding: 12, avoidCollisions: true }"
      :ui="{ content: 'system-creation-placement-content' }"
    >
      <UButton
        class="workspace-control"
        color="neutral"
        variant="outline"
        size="sm"
        aria-label="Placement"
        :aria-expanded="placementOpen"
      >
        Placement
      </UButton>

      <template #content>
        <form class="system-creation-placement-form" aria-label="Placement" @submit.prevent="emit('add-from-inputs')">
          <div class="system-creation-form-heading">
            <span class="section-kicker">PLACEMENT</span>
            <p v-if="props.session.type.kind === 'orbit'">Choose a host or click the map to place an unoccupied center, then set its ellipse.</p>
            <p v-else>Choose a map position or place the object on an existing Orbit.</p>
          </div>

          <template v-if="props.session.type.kind === 'object'">
            <UFormField label="Orbit placement" class="system-creation-form-wide" :error="props.session.errors.orbitId">
              <USelect
                aria-label="Orbit placement"
                :model-value="objectOrbitValue"
                :items="objectOrbitItems"
                @update:model-value="updateObjectOrbit"
              />
            </UFormField>
            <p v-if="objectOrbitValue === freeValue" class="system-creation-form-wide m-0 text-xs text-[var(--text-muted)]" role="status">
              Click a free location on the map to add this object.
            </p>
            <UFormField v-else label="Angle (degrees)" :error="props.session.errors.angleDegrees">
              <UInput
                :model-value="props.session.inputs.angleDegrees"
                type="number"
                step="any"
                inputmode="decimal"
                aria-label="Angle (degrees)"
                @update:model-value="updateInput('angleDegrees', $event)"
              />
            </UFormField>
            <UFormField v-if="props.session.type.subtype === 'other'" label="Type label" class="system-creation-form-wide" :error="props.session.errors.otherType">
              <UInput
                :model-value="props.session.inputs.otherType"
                aria-label="Type label"
                @update:model-value="updateInput('otherType', $event)"
              />
            </UFormField>
          </template>

          <template v-else>
            <UFormField label="Orbit center or host" class="system-creation-form-wide" :error="props.session.errors.hostId">
              <USelect
                aria-label="Orbit center or host"
                :model-value="hostValue"
                :items="hostItems"
                @update:model-value="updateHost"
              />
            </UFormField>
            <p v-if="hostValue === centerValue" class="system-creation-form-wide m-0 text-xs text-[var(--text-muted)]" role="status">
              Click a free location on the map to place this Orbit center.
            </p>
            <UFormField label="Horizontal radius" :error="props.session.errors.horizontalRadius">
              <UInput
                :model-value="props.session.inputs.horizontalRadius"
                type="number"
                step="any"
                inputmode="decimal"
                aria-label="Horizontal radius"
                @update:model-value="updateInput('horizontalRadius', $event)"
              />
            </UFormField>
            <UFormField label="Vertical radius" :error="props.session.errors.verticalRadius">
              <UInput
                :model-value="props.session.inputs.verticalRadius"
                type="number"
                step="any"
                inputmode="decimal"
                aria-label="Vertical radius"
                @update:model-value="updateInput('verticalRadius', $event)"
              />
            </UFormField>
            <UFormField label="Rotation" :error="props.session.errors.rotation">
              <UInput
                :model-value="props.session.inputs.rotation"
                type="number"
                step="any"
                inputmode="decimal"
                aria-label="Rotation"
                @update:model-value="updateInput('rotation', $event)"
              />
            </UFormField>
          </template>

          <p v-if="props.session.errors.form" class="system-creation-error system-creation-form-wide" role="alert">
            {{ props.session.errors.form }}
          </p>
          <UButton
            v-if="props.session.type.kind === 'orbit' || objectOrbitValue !== freeValue"
            class="workspace-control system-creation-form-wide"
            color="primary"
            type="submit"
            aria-label="Add"
          >
            Add
          </UButton>
        </form>
      </template>
    </UPopover>

    <div v-if="props.session.candidates.length" class="system-creation-candidates" role="group" aria-label="Placement targets">
      <UButton
        v-for="candidate in props.session.candidates"
        :key="candidate.key"
        class="workspace-control system-creation-candidate"
        color="neutral"
        :variant="candidate.error ? 'outline' : 'soft'"
        size="sm"
        :aria-label="candidate.error ? `${candidate.label}: ${candidate.error}` : candidate.label"
        :disabled="!!candidate.error"
        @click="emit('choose-candidate', candidate.key)"
      >
        <span>{{ candidate.label }}</span>
        <span v-if="candidate.error" class="system-creation-candidate-error">{{ candidate.error }}</span>
      </UButton>
    </div>
    <span v-if="visibleSessionError" class="system-creation-error" role="alert">
      {{ visibleSessionError }}
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { StarSystem } from '../domain/workspace'
import type { SystemCreationSession } from '../composables/editor-workflows/types'

type CreationInputKey = keyof SystemCreationSession['inputs']
const freeValue = '__free__'
const centerValue = '__center__'

const props = defineProps<{
  session: SystemCreationSession | null
  typeLabel: string
  chooserOpen: boolean
  selectedSystem?: StarSystem
}>()

const emit = defineEmits<{
  'update-input': [key: CreationInputKey, value: string]
  'add-from-inputs': []
  'choose-candidate': [key: string]
}>()

const placementOpen = ref(false)
const visibleSessionError = computed(() => {
  const session = props.session
  if (!session) return ''
  if (session.errors.target) return session.errors.target
  if (placementOpen.value) return ''
  return Object.values(session.errors).find(Boolean) ?? ''
})
const objectOrbitValue = computed(() => props.session?.inputs.orbitId || freeValue)
const hostValue = computed(() => props.session?.inputs.hostId || centerValue)
const objectOrbitItems = computed(() => [
  { label: 'Free map position', value: freeValue },
  ...(props.selectedSystem?.orbits ?? []).map(orbit => {
    const host = orbit.hostId === null
      ? 'unoccupied center'
      : props.selectedSystem?.objects.find(object => object.id === orbit.hostId)?.name ?? 'unknown host'
    return { label: `Orbit ${orbit.order} around ${host}`, value: orbit.id }
  }),
])
const hostItems = computed(() => [
  { label: 'Unoccupied center', value: centerValue },
  ...(props.selectedSystem?.objects ?? []).map(object => ({ label: `Around ${object.name}`, value: object.id })),
])

watch(() => [props.chooserOpen, props.session?.id] as const, ([chooserOpen]) => {
  if (chooserOpen) placementOpen.value = false
})

function updateInput(key: CreationInputKey, value: unknown): void {
  emit('update-input', key, String(value ?? ''))
}

function updateObjectOrbit(value: unknown): void {
  updateInput('orbitId', String(value ?? '') === freeValue ? '' : String(value ?? ''))
}

function updateHost(value: unknown): void {
  updateInput('hostId', String(value ?? '') === centerValue ? '' : String(value ?? ''))
}

</script>

<style scoped>
.system-creation-controls {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
}

.system-creation-candidates { display: flex; flex-wrap: wrap; gap: 0.3rem; }
.system-creation-candidate { white-space: normal; }
.system-creation-candidate-error { display: block; font-size: 0.72rem; }

.system-creation-error {
  margin: 0;
  color: var(--color-error, #e88f87);
  font-size: 0.78rem;
}

:global(.system-creation-placement-content) {
  box-sizing: border-box;
  min-width: min(16rem, var(--reka-popover-content-available-width, calc(100vw - 1.5rem)));
  max-width: min(24rem, var(--reka-popover-content-available-width, calc(100vw - 1.5rem)));
}

.system-creation-placement-form {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.65rem;
  padding: 0.8rem;
  background: var(--panel-raised);
  color: var(--text-primary);
}

.system-creation-form-heading,
.system-creation-form-wide { grid-column: 1 / -1; }
.system-creation-form-heading p { margin: 0.25rem 0 0; color: var(--text-secondary); font-size: 0.78rem; }

@media (max-width: 760px), (max-height: 600px) {
  .system-creation-controls { max-width: 100%; }
}
</style>
