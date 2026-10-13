<template>
  <section class="inspector-card" :aria-label="`${title} inspector`">
    <header class="inspector-heading">
      <div>
        <p class="proto-eyebrow">{{ eyebrow }}</p>
        <h2>{{ title }}</h2>
        <p class="inspector-subtitle">{{ subtitle }}</p>
      </div>
      <UButton size="sm" color="neutral" variant="ghost" aria-label="Hide inspector" @click="emit('hide')">
        Hide
      </UButton>
    </header>

    <div class="inspector-form">
      <UFormField :label="kind === 'route' ? 'Route name' : kind === 'object' ? 'Chart label' : 'Name'">
        <UInput v-model="name" size="lg" :placeholder="kind === 'route' ? 'Jump-4' : 'Name this mark'" />
      </UFormField>

      <UFormField v-if="kind === 'object' || kind === 'system' || kind === 'chart'" label="Session notes">
        <UTextarea v-model="description" :rows="3" placeholder="What should the table know?" />
      </UFormField>

      <template v-if="kind === 'route'">
        <UFormField label="Jump level">
          <UInput v-model.number="jumpLevel" type="number" min="1" max="99" />
        </UFormField>
        <UFormField v-if="routeIsUnresolved" label="Unresolved exit">
          <UInput v-model="unresolvedExit" placeholder="Beyond the known chart" />
        </UFormField>
        <p class="inspector-hint">{{ routeSummary }}</p>
      </template>

      <section v-if="kind === 'object' && customFields.length" class="custom-field-stack">
        <div class="section-row">
          <p class="proto-eyebrow">LOCAL FIELD NOTES</p>
          <UButton size="xs" color="neutral" variant="ghost" @click="emit('manage-fields')">Manage</UButton>
        </div>
        <UFormField v-for="field in customFields" :key="field.id" :label="field.name">
          <USelect
            v-if="field.type === 'single-select'"
            :model-value="String(fieldValues[field.id] ?? '')"
            @update:model-value="value => fieldValues[field.id] = value"
            :items="field.options.map(option => ({ label: option, value: option }))"
            :placeholder="`Choose ${field.name.toLowerCase()}`"
          />
          <UInput
            v-else
            :model-value="String(fieldValues[field.id] ?? '')"
            :type="field.type === 'number' ? 'number' : 'text'"
            :placeholder="field.type === 'boolean' ? 'true / false' : 'Not recorded'"
            @update:model-value="setCustomValue(field, $event)"
          />
        </UFormField>
      </section>

      <div class="inspector-actions">
        <UButton color="primary" :disabled="!dirty" @click="emit('apply')">Apply changes</UButton>
        <UButton color="neutral" variant="outline" :disabled="!dirty" @click="emit('discard')">Discard</UButton>
      </div>
      <div class="save-card" :class="`is-${saveState}`" role="status" aria-live="polite">
        <span class="save-dot" aria-hidden="true"></span>
        <div>
          <strong>{{ saveState === 'error' ? 'Simulated save error' : saveState === 'saving' ? 'Simulating save' : 'Prototype state' }}</strong>
          <p>{{ saveMessage }}</p>
          <UButton v-if="saveState === 'error'" size="xs" color="error" variant="outline" @click="emit('retry-save')">
            Retry simulated save
          </UButton>
        </div>
      </div>
      <UButton v-if="canDelete" class="delete-link" color="error" variant="ghost" @click="emit('delete')">
        Delete {{ kind === 'route' ? 'route' : 'mark' }}…
      </UButton>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { CustomFieldDefinition, CustomFieldValue } from '../domain/workspace'

const name = defineModel<string>('name', { required: true })
const description = defineModel<string>('description', { required: true })
const jumpLevel = defineModel<number>('jumpLevel', { required: true })
const unresolvedExit = defineModel<string>('unresolvedExit', { required: true })
const fieldValues = defineModel<Record<string, CustomFieldValue>>('fieldValues', { required: true })

withDefaults(defineProps<{
  kind: 'object' | 'route' | 'system' | 'chart' | 'orbit'
  eyebrow: string
  title: string
  subtitle: string
  dirty: boolean
  canDelete: boolean
  routeIsUnresolved: boolean
  routeSummary: string
  customFields: CustomFieldDefinition[]
  saveState: 'saved' | 'saving' | 'error'
  saveMessage: string
}>(), {})

const emit = defineEmits<{
  hide: []
  apply: []
  discard: []
  delete: []
  'manage-fields': []
  'retry-save': []
}>()

function setCustomValue(field: CustomFieldDefinition, value: string | number): void {
  if (field.type === 'number') {
    fieldValues.value[field.id] = value === '' ? '' : Number(value)
  } else if (field.type === 'boolean') {
    fieldValues.value[field.id] = String(value).toLowerCase() === 'true'
  } else {
    fieldValues.value[field.id] = String(value)
  }
}
</script>

<style scoped>
.inspector-card {
  min-width: 0;
  color: var(--proto-ink);
}

.inspector-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.5rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--proto-line);
}

.inspector-heading h2 {
  margin: 0.2rem 0 0.35rem;
  font: 500 1.4rem/1.08 var(--proto-display-font);
}

.inspector-subtitle,
.inspector-hint {
  margin: 0;
  color: var(--proto-muted);
  font-size: 0.76rem;
  line-height: 1.5;
}

.inspector-form {
  display: grid;
  gap: 0.9rem;
  padding-top: 1rem;
}

.section-row,
.inspector-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.custom-field-stack {
  display: grid;
  gap: 0.65rem;
  border-top: 1px solid var(--proto-line);
  padding-top: 0.7rem;
}

.custom-field-stack .proto-eyebrow { margin: 0; }

.save-card {
  display: flex;
  gap: 0.65rem;
  align-items: flex-start;
  padding: 0.75rem;
  border: 1px solid var(--proto-line);
  background: var(--proto-soft);
  font-size: 0.72rem;
}

.save-card strong { font-size: 0.72rem; }
.save-card p { margin: 0.22rem 0 0.45rem; color: var(--proto-muted); line-height: 1.45; }
.save-card.is-error { border-color: var(--proto-danger); background: color-mix(in srgb, var(--proto-danger) 12%, var(--proto-surface)); }
.save-dot { width: 0.5rem; height: 0.5rem; margin-top: 0.22rem; border-radius: 50%; background: var(--proto-good); }
.is-error .save-dot { background: var(--proto-danger); }
.is-saving .save-dot { background: var(--proto-accent); animation: breathe 900ms ease-in-out infinite alternate; }
.delete-link { justify-self: start; }

@keyframes breathe { to { opacity: 0.35; transform: scale(0.7); } }
</style>
