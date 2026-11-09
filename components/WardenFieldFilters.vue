<template>
  <section class="grid min-w-0 gap-2" aria-labelledby="warden-field-filters-heading">
    <h3 id="warden-field-filters-heading" class="m-0 font-medium">Fields</h3>
    <UFormField label="Add Field filter">
      <USelect
        v-model="selectedFieldId"
        :items="availableFieldItems"
        placeholder="Choose a Field"
        aria-label="Add Field filter"
        class="w-full"
      />
    </UFormField>

    <p v-if="draftFields.length === 0" class="m-0 text-sm text-muted">
      Choose a Field to add a condition.
    </p>
    <fieldset
      v-for="option in draftFields"
      :key="option.fieldId"
      class="grid min-w-0 gap-2 rounded border border-[var(--line-soft)] p-2"
      :aria-label="`${option.label} filter`"
    >
      <legend class="min-w-0 font-medium [overflow-wrap:anywhere]">{{ option.label }}</legend>
      <UButton
        class="justify-self-end"
        color="neutral"
        variant="ghost"
        size="xs"
        :aria-label="`Remove ${option.label} filter`"
        @click="removeField(option.fieldId)"
      >
        Remove
      </UButton>

      <USelect
        :model-value="draftFor(option.fieldId).operator"
        :items="operatorItems(option)"
        :aria-label="`${option.label} operator`"
        @update:model-value="setOperator(option, String($event))"
      />
      <p v-if="activeConditionSummary(option)" class="m-0 text-sm text-muted" role="status">
        {{ activeConditionSummary(option) }}
      </p>

      <template v-if="draftFor(option.fieldId).operator !== 'no-value'">
        <template v-if="option.type === 'text'">
          <UInput
            :model-value="draftFor(option.fieldId).textValue"
            :aria-label="`${option.label} value`"
            @update:model-value="setTextValue(option, String($event ?? ''))"
          />
        </template>
        <template v-else-if="option.type === 'number' && draftFor(option.fieldId).operator === 'between'">
          <div class="grid min-w-0 grid-cols-2 gap-2">
            <UInput
              :model-value="draftFor(option.fieldId).minimumValue"
              type="number"
              :aria-label="`${option.label} minimum`"
              @update:model-value="setNumberValue(option, 'minimumValue', String($event ?? ''))"
            />
            <UInput
              :model-value="draftFor(option.fieldId).maximumValue"
              type="number"
              :aria-label="`${option.label} maximum`"
              @update:model-value="setNumberValue(option, 'maximumValue', String($event ?? ''))"
            />
          </div>
        </template>
        <template v-else-if="option.type === 'number'">
          <UInput
            :model-value="draftFor(option.fieldId).numberValue"
            type="number"
            :aria-label="`${option.label} value`"
            @update:model-value="setNumberValue(option, 'numberValue', String($event ?? ''))"
          />
        </template>
        <template v-else-if="option.type === 'boolean'">
          <USelect
            :model-value="draftFor(option.fieldId).booleanValue"
            :items="booleanItems"
            placeholder="Choose Yes or No"
            :aria-label="`${option.label} value`"
            @update:model-value="setBooleanValue(option, String($event ?? ''))"
          />
        </template>
        <fieldset v-else class="grid min-w-0 gap-1 border-0 p-0" :aria-label="`${option.label} choices`">
          <UCheckbox
            v-for="choice in option.options"
            :key="choice"
            :label="choice"
            :aria-label="choice"
            :model-value="draftFor(option.fieldId).selectedValues.includes(choice)"
            @update:model-value="toggleChoice(option, choice, $event === true)"
          />
        </fieldset>
      </template>
    </fieldset>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { FieldCondition, FieldFilterOption } from '../utils/field-filter-matching'

interface FieldDraft {
  operator: string
  textValue: string
  numberValue: string
  minimumValue: string
  maximumValue: string
  booleanValue: string
  selectedValues: string[]
}

const props = defineProps<{
  options: readonly FieldFilterOption[]
  conditions: readonly FieldCondition[]
}>()

const emit = defineEmits<{
  'update:conditions': [conditions: FieldCondition[]]
}>()

const selectedFieldId = ref('')
const drafts = ref<Record<string, FieldDraft>>(Object.create(null) as Record<string, FieldDraft>)
const booleanItems = [
  { label: 'Yes', value: 'true' },
  { label: 'No', value: 'false' },
]
const optionById = computed(() => new Map(props.options.map(option => [option.fieldId, option])))
const draftFields = computed(() => props.options.filter(option => option.fieldId in drafts.value))
const hasDrafts = computed(() => draftFields.value.length > 0)
const availableFieldItems = computed(() => props.options
  .filter(option => !(option.fieldId in drafts.value))
  .map(option => ({ label: option.label, value: option.fieldId })))
let appliedConditionSignatures = new Map<string, string>()
let previousOptionTypes = new Map(props.options.map(option => [option.fieldId, option.type]))

watch(() => props.conditions, conditions => {
  const nextSignatures = new Map<string, string>()
  for (const condition of conditions) {
    const signature = JSON.stringify(condition)
    nextSignatures.set(condition.fieldId, signature)
    if (appliedConditionSignatures.get(condition.fieldId) === signature) continue
    const option = optionById.value.get(condition.fieldId)
    if (option) drafts.value[condition.fieldId] = draftFromCondition(condition)
  }
  appliedConditionSignatures = nextSignatures
}, { deep: true, immediate: true })

watch(() => JSON.stringify(props.options), () => {
  const nextOptionTypes = new Map(props.options.map(option => [option.fieldId, option.type]))
  for (const fieldId of Object.keys(drafts.value)) {
    const option = optionById.value.get(fieldId)
    if (!option) {
      delete drafts.value[fieldId]
      continue
    }
    const previousType = previousOptionTypes.get(fieldId)
    if (previousType && previousType !== option.type) {
      const activeCondition = props.conditions.find(condition => condition.fieldId === fieldId)
      drafts.value[fieldId] = activeCondition?.operator === 'no-value'
        ? draftFromCondition(activeCondition)
        : defaultDraft(option)
      continue
    }
    if (option.type === 'single-select') {
      const selectedValues = drafts.value[fieldId]?.selectedValues.filter(value => option.options.includes(value)) ?? []
      drafts.value[fieldId] = { ...drafts.value[fieldId]!, selectedValues }
    }
  }
  for (const fieldId of appliedConditionSignatures.keys()) {
    if (!nextOptionTypes.has(fieldId)) appliedConditionSignatures.delete(fieldId)
  }
  previousOptionTypes = nextOptionTypes
})

function draftFromCondition(condition: FieldCondition): FieldDraft {
  const empty: FieldDraft = {
    operator: condition.operator,
    textValue: '',
    numberValue: '',
    minimumValue: '',
    maximumValue: '',
    booleanValue: '',
    selectedValues: [],
  }
  if (condition.operator === 'no-value') return empty
  switch (condition.type) {
    case 'text': return { ...empty, textValue: condition.value }
    case 'number': return condition.operator === 'between'
      ? { ...empty, minimumValue: String(condition.minimum), maximumValue: String(condition.maximum) }
      : { ...empty, numberValue: String(condition.value) }
    case 'boolean': return { ...empty, booleanValue: String(condition.value) }
    case 'single-select': return { ...empty, selectedValues: [...condition.values] }
  }
}

function defaultDraft(option: FieldFilterOption): FieldDraft {
  const operator = option.type === 'text' ? 'contains' : option.type === 'number' ? 'equals' : 'is'
  return {
    operator,
    textValue: '',
    numberValue: '',
    minimumValue: '',
    maximumValue: '',
    booleanValue: '',
    selectedValues: [],
  }
}

function addSelectedField(): void {
  const fieldId = selectedFieldId.value
  const option = optionById.value.get(fieldId)
  if (!option) return
  const existing = props.conditions.find(condition => condition.fieldId === fieldId)
  drafts.value[fieldId] = existing ? draftFromCondition(existing) : defaultDraft(option)
  selectedFieldId.value = ''
}

watch(selectedFieldId, () => addSelectedField())

function draftFor(fieldId: string): FieldDraft {
  return drafts.value[fieldId] ?? { ...defaultDraft(optionById.value.get(fieldId) ?? { type: 'text' } as FieldFilterOption) }
}

function operatorItems(option: FieldFilterOption): { label: string; value: string }[] {
  const operators = option.type === 'text'
    ? [['Contains', 'contains'], ['Equals', 'equals'], ['Does not contain', 'does-not-contain']]
    : option.type === 'number'
      ? [['=', 'equals'], ['≠', 'not-equals'], ['<', 'less-than'], ['≤', 'less-than-or-equal'], ['>', 'greater-than'], ['≥', 'greater-than-or-equal'], ['Between', 'between']]
      : [['Is', 'is']]
  return [...operators.map(([label, value]) => ({ label: label!, value: value! })), { label: 'No value', value: 'no-value' }]
}

function updateDraft(option: FieldFilterOption, update: Partial<FieldDraft>): void {
  drafts.value[option.fieldId] = { ...draftFor(option.fieldId), ...update }
  commitDraft(option)
}

function setOperator(option: FieldFilterOption, operator: string): void {
  updateDraft(option, { operator })
}

function setTextValue(option: FieldFilterOption, textValue: string): void {
  updateDraft(option, { textValue })
}

function setNumberValue(option: FieldFilterOption, key: 'numberValue' | 'minimumValue' | 'maximumValue', value: string): void {
  updateDraft(option, { [key]: value })
}

function setBooleanValue(option: FieldFilterOption, booleanValue: string): void {
  updateDraft(option, { booleanValue })
}

function toggleChoice(option: FieldFilterOption, choice: string, checked: boolean): void {
  const selectedValues = draftFor(option.fieldId).selectedValues.filter(value => value !== choice)
  if (checked) selectedValues.push(choice)
  updateDraft(option, { selectedValues })
}

function conditionFromDraft(option: FieldFilterOption, draft: FieldDraft): FieldCondition | null {
  if (draft.operator === 'no-value') {
    return { fieldId: option.fieldId, operator: 'no-value' }
  }
  if (option.type === 'text') {
    if ((draft.operator === 'contains' || draft.operator === 'equals' || draft.operator === 'does-not-contain') && draft.textValue.trim()) {
      return { fieldId: option.fieldId, type: 'text', operator: draft.operator, value: draft.textValue }
    }
  } else if (option.type === 'number') {
    if (draft.operator === 'between') {
      const minimum = Number(draft.minimumValue)
      const maximum = Number(draft.maximumValue)
      if (draft.minimumValue.trim() && draft.maximumValue.trim() && Number.isFinite(minimum) && Number.isFinite(maximum) && minimum <= maximum) {
        return { fieldId: option.fieldId, type: 'number', operator: 'between', minimum, maximum }
      }
    } else {
      const value = Number(draft.numberValue)
      if (draft.numberValue.trim() && Number.isFinite(value)
        && ['equals', 'not-equals', 'less-than', 'less-than-or-equal', 'greater-than', 'greater-than-or-equal'].includes(draft.operator)) {
        return { fieldId: option.fieldId, type: 'number', operator: draft.operator as 'equals' | 'not-equals' | 'less-than' | 'less-than-or-equal' | 'greater-than' | 'greater-than-or-equal', value }
      }
    }
  } else if (option.type === 'boolean') {
    if (draft.operator === 'is' && (draft.booleanValue === 'true' || draft.booleanValue === 'false')) {
      return { fieldId: option.fieldId, type: 'boolean', operator: 'is', value: draft.booleanValue === 'true' }
    }
  } else if (draft.operator === 'is' && draft.selectedValues.length > 0) {
    return { fieldId: option.fieldId, type: 'single-select', operator: 'is', values: [...draft.selectedValues] }
  }
  return null
}

function sameCondition(left: FieldCondition, right: FieldCondition): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

function activeConditionSummary(option: FieldFilterOption): string | null {
  const active = props.conditions.find(condition => condition.fieldId === option.fieldId)
  if (!active) return null
  const draftCondition = conditionFromDraft(option, draftFor(option.fieldId))
  if (draftCondition && sameCondition(draftCondition, active)) return null
  if (active.operator === 'no-value') return 'Active condition No value'
  const operatorLabel = operatorItems(option).find(item => item.value === active.operator)?.label ?? active.operator

  switch (active.type) {
    case 'text': return `Active condition ${operatorLabel} “${active.value}”`
    case 'number': return active.operator === 'between'
      ? `Active condition ${operatorLabel} ${active.minimum} and ${active.maximum}`
      : `Active condition ${operatorLabel} ${active.value}`
    case 'boolean': return `Active condition Is ${active.value ? 'Yes' : 'No'}`
    case 'single-select': return `Active condition Is ${active.values.join(' or ')}`
  }
}

function commitDraft(option: FieldFilterOption): void {
  const condition = conditionFromDraft(option, draftFor(option.fieldId))

  if (!condition) return
  emit('update:conditions', [
    ...props.conditions.filter(current => current.fieldId !== option.fieldId),
    condition,
  ])
}

function removeField(fieldId: string): void {
  delete drafts.value[fieldId]
  emit('update:conditions', props.conditions.filter(condition => condition.fieldId !== fieldId))
}

function clearDrafts(): void {
  drafts.value = Object.create(null) as Record<string, FieldDraft>
  selectedFieldId.value = ''
}

defineExpose({ clearDrafts, hasDrafts })
</script>
