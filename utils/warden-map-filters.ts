import {
  isCustomFieldApplicableToObject,
  isCustomFieldValueCompatible,
  nativePlayerFieldIds,
  type CustomFieldDefinition,
  type LocalWorkspace,
  type PublicationMode,
  type SystemObject,
} from '../domain/workspace'
import { matchesFieldCondition, type FieldCondition, type FieldFilterOption } from './field-filter-matching'
import { mapObjectTypeKey } from './map-type-filters'

const nativeFieldOptions = [
  { fieldId: nativePlayerFieldIds.atmosphere, label: 'Atmosphere', type: 'single-select' as const },
  { fieldId: nativePlayerFieldIds.portClass, label: 'Port class', type: 'single-select' as const },
] as const

/** Lists every built-in and custom Field in stable identity order. */
export function wardenFieldFilterOptions(workspace: LocalWorkspace): FieldFilterOption[] {
  const settings = workspace.objectFieldSettings
  return [
    { ...nativeFieldOptions[0], options: settings.atmosphereOptions },
    { ...nativeFieldOptions[1], options: settings.portClassOptions },
    ...settings.customFields.map(field => ({
      fieldId: field.id,
      label: `${field.name} (Custom)`,
      type: field.type,
      options: field.type === 'single-select' ? field.options : [],
    })),
  ]
}

/** Returns a valid assigned value; absent, inapplicable and stale values share the No value case. */
export function wardenObjectFieldValue(
  workspace: LocalWorkspace,
  object: SystemObject,
  option: FieldFilterOption,
): unknown {
  return readWardenObjectFieldValue(workspace, object, option, new Map(
    workspace.objectFieldSettings.customFields.map(field => [field.id, field]),
  ))
}

function readWardenObjectFieldValue(
  workspace: LocalWorkspace,
  object: SystemObject,
  option: FieldFilterOption,
  definitionsById: ReadonlyMap<string, CustomFieldDefinition>,
): unknown {
  if (option.fieldId === nativePlayerFieldIds.atmosphere) {
    if (object.family !== 'CelestialBody' || (object.subtype !== 'planet' && object.subtype !== 'moon')) return undefined
    const value = object.atmosphere
    return typeof value === 'string' && option.options.includes(value) ? value : undefined
  }
  if (option.fieldId === nativePlayerFieldIds.portClass) {
    if (object.family !== 'Installation') return undefined
    const value = object.portClass
    return typeof value === 'string' && option.options.includes(value) ? value : undefined
  }

  const definition = definitionsById.get(option.fieldId)
  if (!definition || !isCustomFieldApplicableToObject(definition, object)) return undefined
  const value = object.customFieldValues?.[option.fieldId]
  return isCustomFieldValueCompatible(
    value,
    definition.type,
    definition.type === 'single-select' ? definition.options : [],
  ) ? value : undefined
}

/** Validates stored criteria by stable Field identity and kind, pruning removed single-select choices. */
export function reconcileFieldConditions(
  conditions: readonly FieldCondition[],
  options: readonly FieldFilterOption[],
): { conditions: FieldCondition[]; changed: boolean } {
  const optionsById = new Map(options.map(option => [option.fieldId, option]))
  const seenIds = new Set<string>()
  const reconciled: FieldCondition[] = []
  let changed = false

  for (const condition of conditions) {
    const option = optionsById.get(condition.fieldId)
    if (!option || seenIds.has(condition.fieldId)) {
      changed = true
      continue
    }
    seenIds.add(condition.fieldId)

    if (condition.operator === 'no-value') {
      reconciled.push(condition)
      continue
    }
    if (option.type !== condition.type) {
      changed = true
      continue
    }

    if (condition.type === 'single-select' && condition.operator === 'is') {
      const validValues = [...new Set(condition.values.filter(value => option.options.includes(value)))]
      if (validValues.length === 0) {
        changed = true
        continue
      }
      if (validValues.length !== condition.values.length || validValues.some((value, index) => value !== condition.values[index])) {
        changed = true
      }
      reconciled.push({ ...condition, values: validValues })
      continue
    }

    if (condition.type === 'text') {
      if (condition.value.trim().length === 0) {
        changed = true
        continue
      }
      reconciled.push(condition)
      continue
    }

    if (condition.type === 'number') {
      const validRange = condition.operator === 'between'
        ? Number.isFinite(condition.minimum) && Number.isFinite(condition.maximum) && condition.minimum <= condition.maximum
        : Number.isFinite(condition.value)
      if (!validRange) {
        changed = true
        continue
      }
      reconciled.push(condition)
      continue
    }

    reconciled.push(condition)
  }

  return { conditions: reconciled, changed }
}

export function matchesPublicationFilter(
  publication: PublicationMode,
  selectedModes: readonly PublicationMode[],
): boolean {
  return selectedModes.length === 0 || selectedModes.includes(publication)
}

/** Evaluates the shared AND/OR rules for one object against current workspace definitions. */
export function matchesWardenObjectFilters(
  workspace: LocalWorkspace,
  object: SystemObject,
  selectedTypes: readonly string[],
  selectedPublicationModes: readonly PublicationMode[],
  fieldConditions: readonly FieldCondition[],
  typeKey: (object: SystemObject) => string = mapObjectTypeKey,
  options = wardenFieldFilterOptions(workspace),
): boolean {
  return createWardenObjectFilterMatcher(
    workspace,
    selectedTypes,
    selectedPublicationModes,
    fieldConditions,
    typeKey,
    options,
  )(object)
}

/** Compiles stable definition and option lookups once for a computed filter snapshot. */
export function createWardenObjectFilterMatcher(
  workspace: LocalWorkspace,
  selectedTypes: readonly string[],
  selectedPublicationModes: readonly PublicationMode[],
  fieldConditions: readonly FieldCondition[],
  typeKey: (object: SystemObject) => string = mapObjectTypeKey,
  options = wardenFieldFilterOptions(workspace),
): (object: SystemObject) => boolean {
  const optionsById = new Map(options.map(option => [option.fieldId, option]))
  const definitionsById = new Map(workspace.objectFieldSettings.customFields.map(field => [field.id, field]))
  return object => {
    if (selectedTypes.length > 0 && !selectedTypes.includes(typeKey(object))) return false
    if (!matchesPublicationFilter(object.publication, selectedPublicationModes)) return false

    return fieldConditions.every(condition => {
      const option = optionsById.get(condition.fieldId)
      if (!option || (condition.operator !== 'no-value' && option.type !== condition.type)) return false
      return matchesFieldCondition(
        readWardenObjectFieldValue(workspace, object, option, definitionsById),
        condition,
      )
    })
  }
}
