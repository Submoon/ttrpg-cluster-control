<template>
  <nav class="field-definition-list" aria-label="Field definitions">
    <section>
      <h3>Native fields</h3>
      <button
        v-for="field in props.nativeFields"
        :key="field.id"
        class="field-definition-choice"
        type="button"
        :aria-pressed="props.selectedFieldId === field.id"
        :class="{ active: props.selectedFieldId === field.id }"
        @click="emit('select', field.id)"
      >
        <span>{{ field.name }}</span>
        <small>Native / {{ field.type }}</small>
      </button>
    </section>
    <section>
      <div class="field-definition-list-heading">
        <h3>Custom fields</h3>
        <button
          class="quiet-button field-definition-add"
          type="button"
          @click="emit('create-custom-field')"
        >
          New custom field
        </button>
      </div>
      <button
        v-for="field in props.customFields"
        :key="field.id"
        class="field-definition-choice"
        type="button"
        :aria-pressed="props.selectedFieldId === field.id"
        :class="{ active: props.selectedFieldId === field.id }"
        @click="emit('select', field.id)"
      >
        <span>{{ field.name }}</span>
        <small>Custom / {{ field.type }}</small>
        <small>{{ fieldApplicabilitySummary(field) }}</small>
      </button>
      <p v-if="!props.customFields.length" class="empty-copy">
        No custom fields are defined yet.
      </p>
    </section>
  </nav>
</template>

<script setup lang="ts">
/**
 * Lists native and custom definitions, returning selection and creation intents to the dialog owner.
 */
import { fieldApplicabilitySummary, type FieldDefinitionSummary } from './model'

const props = defineProps<{
  nativeFields: FieldDefinitionSummary[]
  customFields: FieldDefinitionSummary[]
  selectedFieldId: string
}>()

const emit = defineEmits<{
  select: [fieldId: string]
  'create-custom-field': []
}>()
</script>

<style scoped>
.field-definition-list {
  display: grid;
  align-content: start;
  gap: 1rem;
  border-right: 1px solid var(--line-soft);
  padding: 0.9rem;
}

.field-definition-list h3 {
  margin: 0 0 0.5rem;
  color: var(--text-muted);
  font-size: 0.6rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.field-definition-list-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.45rem;
}

.field-definition-list-heading h3 {
  margin: 0;
}

.field-definition-add {
  min-height: 1.8rem;
  padding: 0.25rem 0.45rem;
  font-size: 0.62rem;
}

.field-definition-choice {
  display: grid;
  width: 100%;
  gap: 0.2rem;
  border: 1px solid transparent;
  border-radius: 2px;
  padding: 0.5rem;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  text-align: left;
}

.field-definition-choice:hover,
.field-definition-choice.active {
  border-color: var(--accent);
  background: var(--accent-soft);
  color: var(--text-primary);
}

.field-definition-choice small {
  color: var(--text-muted);
  font: 0.58rem Consolas, monospace;
}

.field-definition-choice small + small {
  overflow-wrap: anywhere;
  font-family: inherit;
  font-size: 0.54rem;
  letter-spacing: normal;
  line-height: 1.4;
}

.field-definition-list .empty-copy {
  margin: 0;
}

@media (max-width: 760px) {
  .field-definition-list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    border-right: 0;
    border-bottom: 1px solid var(--line-soft);
  }

  .field-definition-list > section:nth-child(2) {
    grid-column: 1 / -1;
  }
}
</style>
