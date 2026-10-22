<template>
  <section class="field-definition-editor" aria-label="Field definition editor" tabindex="-1">
    <header class="field-definition-editor-heading">
      <div>
        <span class="section-kicker">{{ props.definition.kind }} field / {{ props.definition.type }}</span>
        <h3>{{ props.definition.name }}</h3>
      </div>
      <span class="field-definition-value-count">{{ props.assignments.length }} saved values</span>
    </header>

    <section v-if="!props.editing" class="field-definition-saved-details" aria-label="Saved definition details">
      <dl>
        <div>
          <dt>Definition type</dt>
          <dd>{{ props.definition.type }}</dd>
        </div>
        <div v-if="props.definition.kind === 'custom'">
          <dt>Applicability</dt>
          <dd>{{ fieldApplicabilitySummary(props.definition) }}</dd>
        </div>
      </dl>
      <div v-if="props.definition.type === 'single-select'" class="field-definition-saved-choices">
        <h4>Saved choices</h4>
        <ul>
          <li v-for="(option, index) in props.definition.options" :key="`${index}:${option}`">{{ option }}</li>
        </ul>
      </div>
    </section>

    <template v-else>
      <UFormField v-if="props.definition.kind === 'custom'" label="Custom field name">
        <UInput
          id="field-definition-name"
          aria-label="Custom field name"
          :model-value="props.draft?.name ?? props.definition.name"
          maxlength="80"
          autocomplete="off"
          :disabled="props.saving || props.changePending"
          @update:model-value="updateName"
        />
      </UFormField>

      <UFormField v-if="props.definition.kind === 'custom'" label="Value type">
        <USelect
          id="field-definition-type"
          aria-label="Value type"
          :model-value="props.draft?.type ?? props.definition.type"
          :items="customFieldTypeItems"
          :disabled="props.saving || props.changePending"
          @update:model-value="updateType"
        />
      </UFormField>

      <UFormField
        v-if="props.definition.kind === 'custom' ? props.draft?.type === 'single-select' : props.definition.type === 'single-select'"
        :label="`${props.draft?.name ?? props.definition.name} choices`"
      >
        <UTextarea
          id="field-definition-options"
          :aria-label="`${props.draft?.name ?? props.definition.name} choices`"
          :model-value="props.draft?.options ?? props.definition.options.join('\n')"
          :rows="4"
          :disabled="props.saving || props.changePending"
          @update:model-value="updateOptions"
        />
      </UFormField>

      <fieldset
        v-if="props.definition.kind === 'custom'"
        class="field-definition-applicability"
        :disabled="props.saving || props.changePending"
      >
        <legend>Field applicability</legend>
        <UCheckbox
          :model-value="appliesToAllObjects"
          label="All catalogue objects"
          @update:model-value="setAllObjects"
        />
        <div v-if="!appliesToAllObjects" class="field-definition-target-groups">
          <section>
            <h4>Categories</h4>
            <UCheckbox
              v-for="group in applicabilityGroups"
              :key="group.family"
              :model-value="hasCustomFieldApplicabilityTarget({ kind: 'category', family: group.family })"
              :label="`Category ${group.label}`"
              @update:model-value="value => toggleCustomFieldApplicabilityTarget({ kind: 'category', family: group.family }, value)"
            />
          </section>
          <section>
            <h4>Subtypes</h4>
            <UCheckbox
              v-for="type in catalogueTypes"
              :key="`${type.family}:${type.value}`"
              :model-value="hasCustomFieldApplicabilityTarget({ kind: 'subtype', family: type.family, subtype: type.value })"
              :label="`Subtype ${type.label}`"
              @update:model-value="value => toggleCustomFieldApplicabilityTarget({ kind: 'subtype', family: type.family, subtype: type.value }, value)"
            />
          </section>
        </div>
      </fieldset>
    </template>

    <FieldDefinitionValues
      :assignments="props.assignments"
      heading="Existing field values"
      region-label="Existing field values"
      empty-message="No values are assigned to this field."
    />
    <div v-if="!props.editing" class="field-definition-actions">
      <UButton
        color="primary"
        size="sm"
        type="button"
        :disabled="props.saving || props.changePending"
        aria-label="Edit field definition"
        @click="emit('request-edit')"
      >
        Edit definition
      </UButton>
    </div>
  </section>
</template>

<script setup lang="ts">
/** Parent-owned field-definition drafts flow into this controlled presentation as raw strings. */
import { computed } from 'vue'
import {
  catalogueTypes,
  customFieldApplicabilityTargetKey,
  type CustomFieldType,
  type CustomFieldApplicabilityTarget,
} from '../../domain/workspace'
import type { FieldDefinitionDraft } from '../../composables/editor-workflows/types'
import FieldDefinitionValues from './FieldDefinitionValues.vue'
import {
  applicabilityGroups,
  fieldApplicabilitySummary,
  type FieldDefinitionSummary,
  type FieldValueAssignment,
} from './model'

const props = defineProps<{
  definition: FieldDefinitionSummary
  assignments: FieldValueAssignment[]
  draft: FieldDefinitionDraft | null
  saving: boolean
  changePending: boolean
  editing: boolean
}>()

const emit = defineEmits<{
  'request-edit': []
  'patch-definition': [patch: Partial<FieldDefinitionDraft>]
}>()

const customFieldTypeItems = [
  { label: 'Text', value: 'text' },
  { label: 'Number', value: 'number' },
  { label: 'Boolean', value: 'boolean' },
  { label: 'Single-select', value: 'single-select' },
]

const appliesToAllObjects = computed(() => props.draft?.applicability === undefined)
const applicabilityTargets = computed(() => props.draft?.applicability ?? [])

function updateName(value: unknown): void {
  emit('patch-definition', { name: String(value ?? '') })
}

function updateOptions(value: unknown): void {
  emit('patch-definition', { options: String(value ?? '') })
}

function updateType(value: unknown): void {
  if (value === 'text' || value === 'number' || value === 'boolean' || value === 'single-select') {
    emit('patch-definition', { type: value as CustomFieldType })
  }
}

function hasCustomFieldApplicabilityTarget(target: CustomFieldApplicabilityTarget): boolean {
  const targetKey = customFieldApplicabilityTargetKey(target)
  return applicabilityTargets.value.some(candidate => customFieldApplicabilityTargetKey(candidate) === targetKey)
}

function setAllObjects(value: boolean | 'indeterminate'): void {
  emit('patch-definition', { applicability: value === true ? undefined : [] })
}

function toggleCustomFieldApplicabilityTarget(
  target: CustomFieldApplicabilityTarget,
  value: boolean | 'indeterminate',
): void {
  const targetKey = customFieldApplicabilityTargetKey(target)
  const targets = applicabilityTargets.value.filter(candidate => customFieldApplicabilityTargetKey(candidate) !== targetKey)
  if (value === true) targets.push(target)
  emit('patch-definition', { applicability: targets })
}
</script>

<style scoped>
.field-definition-editor {
  display: grid;
  align-content: start;
  gap: 0.9rem;
  min-width: 0;
  min-height: 0;
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

.field-definition-saved-details {
  display: grid;
  gap: 0.75rem;
  border: 1px solid var(--line-soft);
  padding: 0.75rem;
  background: var(--panel-bg);
}

.field-definition-saved-details dl {
  display: grid;
  gap: 0.5rem;
  margin: 0;
}

.field-definition-saved-details dl > div {
  display: grid;
  grid-template-columns: minmax(5rem, 0.35fr) minmax(0, 1fr);
  gap: 0.5rem;
}

.field-definition-saved-details dt,
.field-definition-saved-choices h4 {
  margin: 0;
  color: var(--text-muted);
  font-size: 0.62rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.field-definition-saved-details dd {
  margin: 0;
  overflow-wrap: anywhere;
  color: var(--text-secondary);
  font-size: 0.72rem;
}

.field-definition-saved-choices ul {
  display: grid;
  gap: 0.3rem;
  margin: 0.4rem 0 0;
  padding: 0;
  list-style: none;
}

.field-definition-saved-choices li {
  border: 1px solid var(--line-soft);
  padding: 0.35rem 0.5rem;
  color: var(--text-primary);
  font-size: 0.72rem;
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

.field-definition-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

@media (max-width: 760px) {
  .field-definition-editor { padding: 0.75rem; }
  .field-definition-target-groups { grid-template-columns: 1fr; }
}
</style>
