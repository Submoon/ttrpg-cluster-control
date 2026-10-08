<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  catalogueTypes,
  customFieldApplicabilityTargetKey,
  type CustomFieldApplicabilityTarget,
} from '../../domain/workspace'
import FieldDefinitionValues from './FieldDefinitionValues.vue'
import {
  applicabilityGroups,
  fieldOptionsFromText,
  sameCustomFieldApplicability,
  type FieldDefinitionSummary,
  type FieldDefinitionUpdate,
  type FieldValueAssignment,
  type PendingFieldDefinitionChange,
} from './model'

const props = defineProps<{
  definition: FieldDefinitionSummary
  assignments: FieldValueAssignment[]
  saving: boolean
  changePending: boolean
}>()

const emit = defineEmits<{
  'clear-error': []
  'request-change': [change: PendingFieldDefinitionChange]
}>()

const fieldDefinitionNameDraft = ref('')
const fieldDefinitionOptionsDraft = ref('')
const fieldDefinitionAppliesToAll = ref(true)
const fieldDefinitionApplicabilityTargets = ref<CustomFieldApplicabilityTarget[]>([])
const fieldDefinitionEditing = ref(false)

const affectedFieldAssignments = computed(() => {
  if (props.definition.type !== 'single-select') return []
  const options = fieldOptionsFromText(fieldDefinitionOptionsDraft.value)
  return props.assignments.filter(assignment =>
    typeof assignment.value === 'string' && !options.includes(assignment.value),
  )
})

function hasCustomFieldApplicabilityTarget(target: CustomFieldApplicabilityTarget): boolean {
  const targetKey = customFieldApplicabilityTargetKey(target)
  return fieldDefinitionApplicabilityTargets.value.some(candidate =>
    customFieldApplicabilityTargetKey(candidate) === targetKey,
  )
}

function toggleCustomFieldApplicabilityTarget(target: CustomFieldApplicabilityTarget): void {
  const targetKey = customFieldApplicabilityTargetKey(target)
  const index = fieldDefinitionApplicabilityTargets.value.findIndex(candidate =>
    customFieldApplicabilityTargetKey(candidate) === targetKey,
  )
  if (index === -1) fieldDefinitionApplicabilityTargets.value.push(target)
  else fieldDefinitionApplicabilityTargets.value.splice(index, 1)
}

function syncFieldDefinitionDraft(): void {
  const definition = props.definition
  fieldDefinitionNameDraft.value = definition.kind === 'custom' ? definition.name : ''
  fieldDefinitionOptionsDraft.value = definition.type === 'single-select'
    ? definition.options.join('\n')
    : ''
  fieldDefinitionAppliesToAll.value = definition.kind === 'native' || definition.applicability === undefined
  fieldDefinitionApplicabilityTargets.value = definition.kind === 'custom'
    ? [...(definition.applicability ?? [])]
    : []
}

function reset(): void {
  fieldDefinitionEditing.value = false
  syncFieldDefinitionDraft()
}

watch(() => props.definition.id, reset, { immediate: true })
watch(() => props.definition, () => {
  if (!fieldDefinitionEditing.value) syncFieldDefinitionDraft()
})

function beginFieldDefinitionEdit(): void {
  fieldDefinitionEditing.value = true
  emit('clear-error')
}

function cancelFieldDefinitionEdit(): void {
  reset()
  emit('clear-error')
}

function saveFieldDefinitionChanges(): void {
  const definition = props.definition
  const name = definition.kind === 'custom' ? fieldDefinitionNameDraft.value.trim() : definition.name
  const options = definition.type === 'single-select'
    ? fieldOptionsFromText(fieldDefinitionOptionsDraft.value)
    : definition.options
  const applicability = definition.kind === 'custom' && !fieldDefinitionAppliesToAll.value
    ? fieldDefinitionApplicabilityTargets.value
    : undefined
  const nameChanged = definition.kind === 'custom' && name !== definition.name
  const optionsChanged = definition.type === 'single-select'
    && (definition.options.length !== options.length
      || definition.options.some((option, index) => option !== options[index]))
  const applicabilityChanged = definition.kind === 'custom'
    && !sameCustomFieldApplicability(definition.applicability, applicability)
  if (!nameChanged && !optionsChanged && !applicabilityChanged) {
    reset()
    return
  }

  const update: FieldDefinitionUpdate = {
    fieldId: definition.id,
    name,
    options,
    applicability: applicability === undefined ? undefined : [...applicability],
  }
  const affectedAssignments = definition.type === 'single-select'
    ? props.assignments.filter(assignment =>
        typeof assignment.value === 'string' && !options.includes(assignment.value),
      )
    : []
  emit('request-change', {
    kind: 'save',
    update,
    fieldName: definition.name,
    affectedAssignments,
  })
}

function requestFieldDefinitionRemoval(): void {
  const definition = props.definition
  if (definition.kind !== 'custom') return
  emit('request-change', {
    kind: 'remove',
    fieldId: definition.id,
    fieldName: definition.name,
    affectedAssignments: props.assignments,
  })
}

defineExpose({
  isEditing: () => fieldDefinitionEditing.value,
  reset,
})
</script>

<template>
  <section class="field-definition-editor" aria-label="Field definition editor">
    <header class="field-definition-editor-heading">
      <div>
        <span class="section-kicker">{{ props.definition.kind }} field / {{ props.definition.type }}</span>
        <h3>{{ props.definition.name }}</h3>
      </div>
      <span class="field-definition-value-count">{{ props.assignments.length }} saved values</span>
    </header>

    <label v-if="props.definition.kind === 'custom'" for="field-definition-name">
      Custom field name
      <input
        id="field-definition-name"
        v-model="fieldDefinitionNameDraft"
        aria-label="Custom field name"
        maxlength="80"
        :disabled="!fieldDefinitionEditing || props.saving || props.changePending"
      >
    </label>

    <label
      v-if="props.definition.type === 'single-select'"
      for="field-definition-options"
    >
      {{ props.definition.name }} choices
      <textarea
        id="field-definition-options"
        v-model="fieldDefinitionOptionsDraft"
        :aria-label="`${props.definition.name} choices`"
        rows="4"
        :disabled="!fieldDefinitionEditing || props.saving || props.changePending"
      />
    </label>

    <fieldset
      v-if="props.definition.kind === 'custom'"
      class="field-definition-applicability"
      :disabled="!fieldDefinitionEditing || props.saving || props.changePending"
    >
      <legend>Field applicability</legend>
      <label class="field-definition-target-choice">
        <input
          v-model="fieldDefinitionAppliesToAll"
          type="radio"
          name="field-applicability-mode"
          :value="true"
        >
        All catalogue objects
      </label>
      <label class="field-definition-target-choice">
        <input
          v-model="fieldDefinitionAppliesToAll"
          type="radio"
          name="field-applicability-mode"
          :value="false"
        >
        Selected catalogue targets
      </label>
      <div v-if="!fieldDefinitionAppliesToAll" class="field-definition-target-groups">
        <section>
          <h4>Categories</h4>
          <label
            v-for="group in applicabilityGroups"
            :key="group.family"
            class="field-definition-target-choice"
          >
            <input
              type="checkbox"
              :checked="hasCustomFieldApplicabilityTarget({ kind: 'category', family: group.family })"
              @change="toggleCustomFieldApplicabilityTarget({ kind: 'category', family: group.family })"
            >
            Category {{ group.label }}
          </label>
        </section>
        <section>
          <h4>Subtypes</h4>
          <label
            v-for="type in catalogueTypes"
            :key="`${type.family}:${type.value}`"
            class="field-definition-target-choice"
          >
            <input
              type="checkbox"
              :checked="hasCustomFieldApplicabilityTarget({ kind: 'subtype', family: type.family, subtype: type.value })"
              @change="toggleCustomFieldApplicabilityTarget({ kind: 'subtype', family: type.family, subtype: type.value })"
            >
            Subtype {{ type.label }}
          </label>
        </section>
      </div>
    </fieldset>

    <FieldDefinitionValues
      :assignments="props.assignments"
      heading="Existing field values"
      region-label="Existing field values"
      empty-message="No values are assigned to this field."
    />
    <FieldDefinitionValues
      v-if="affectedFieldAssignments.length"
      :assignments="affectedFieldAssignments"
      heading="Values that will be cleared"
      region-label="Affected values preview"
      affected
    />

    <div class="field-definition-actions">
      <button
        v-if="!fieldDefinitionEditing"
        class="primary-button"
        type="button"
        :disabled="props.saving || props.changePending"
        aria-label="Edit field definition"
        @click="beginFieldDefinitionEdit"
      >
        Edit
      </button>
      <button
        v-else
        class="primary-button"
        type="button"
        :disabled="props.saving || props.changePending"
        @click="saveFieldDefinitionChanges"
      >
        Save changes
      </button>
      <button
        v-if="fieldDefinitionEditing"
        class="quiet-button"
        type="button"
        :disabled="props.changePending"
        @click="cancelFieldDefinitionEdit"
      >
        Cancel
      </button>
      <button
        v-if="props.definition.kind === 'custom' && fieldDefinitionEditing"
        class="quiet-button"
        type="button"
        :disabled="props.saving || props.changePending"
        @click="requestFieldDefinitionRemoval"
      >
        Delete field definition
      </button>
    </div>
  </section>
</template>

<style scoped>
.field-definition-editor {
  display: grid;
  align-content: start;
  gap: 0.9rem;
  min-width: 0;
  padding: 1rem;
}

.field-definition-editor-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  border-bottom: 1px solid var(--line-soft);
  padding-bottom: 0.75rem;
}

.field-definition-editor-heading h3 {
  overflow-wrap: anywhere;
  margin: 0.4rem 0 0;
  font-family: Georgia, serif;
  font-size: 1.35rem;
  font-weight: 500;
}

.field-definition-value-count {
  flex: 0 0 auto;
  color: var(--text-muted);
  font: 0.58rem Consolas, monospace;
  text-align: right;
}

.field-definition-editor > label {
  display: grid;
  gap: 0.35rem;
  color: var(--text-secondary);
  font-size: 0.68rem;
}

.field-definition-editor input,
.field-definition-editor textarea {
  width: 100%;
  border: 1px solid var(--line);
  border-radius: 2px;
  padding: 0.55rem 0.65rem;
  background: var(--control-bg);
  color: var(--text-primary);
  font: inherit;
}

.field-definition-editor input:focus,
.field-definition-editor textarea:focus {
  border-color: var(--accent);
  outline: 2px solid var(--accent-soft);
  outline-offset: 1px;
}

.field-definition-applicability {
  display: grid;
  gap: 0.55rem;
  min-width: 0;
  margin: 0;
  border: 1px solid var(--line-soft);
  padding: 0.8rem;
  background: var(--panel-bg);
}

.field-definition-applicability legend {
  padding: 0 0.35rem;
  color: var(--text-secondary);
  font-size: 0.66rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.field-definition-target-choice {
  display: flex;
  align-items: flex-start;
  gap: 0.45rem;
  color: var(--text-secondary);
  font-size: 0.68rem;
  line-height: 1.4;
}

.field-definition-applicability input[type="radio"],
.field-definition-applicability input[type="checkbox"] {
  flex: 0 0 auto;
  width: auto;
  margin: 0.1rem 0 0;
  border: 0;
  padding: 0;
  background: transparent;
  accent-color: var(--accent);
}

.field-definition-target-groups {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.9rem;
  border-top: 1px solid var(--line-soft);
  padding-top: 0.75rem;
}

.field-definition-target-groups > section {
  display: grid;
  align-content: start;
  gap: 0.4rem;
  min-width: 0;
}

.field-definition-target-groups > section > h4 {
  margin: 0 0 0.15rem;
  color: var(--text-muted);
  font-size: 0.6rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

@media (max-width: 760px) {
  .field-definition-editor {
    padding: 0.75rem;
  }

  .field-definition-target-groups {
    grid-template-columns: 1fr;
  }
}
</style>
