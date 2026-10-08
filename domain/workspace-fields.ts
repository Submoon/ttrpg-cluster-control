/**
 * Scope changes affect visibility only; removing assigned option values requires an explicit caller opt-in.
 */
import type {
  CustomFieldApplicabilityTarget,
  CustomFieldDefinition,
  CustomFieldType,
  LocalWorkspace,
  SystemObject,
} from './workspace-model'
import { isCustomFieldApplicability, validFieldOptions, validName } from './workspace-validation'

/**
 * Replaces a built-in option list, optionally clearing assigned values removed from it.
 * @param workspace Current immutable workspace.
 * @param field Built-in field whose options change.
 * @param options Proposed option values, normalized and checked for duplicates.
 * @param clearInvalidValues Explicitly opt in to clearing assignments that use removed values.
 * @returns Workspace with the new options and any opted-in cleanup.
 * @throws If options are invalid or an assigned value would be removed without opt-in.
 */
export function updateNativeFieldOptions(
  workspace: LocalWorkspace,
  field: 'atmosphere' | 'portClass',
  options: string[],
  clearInvalidValues = false,
): LocalWorkspace {
  const normalized = validFieldOptions(options, `${field === 'atmosphere' ? 'Atmosphere' : 'Port class'} option`)
  const property = field === 'atmosphere' ? 'atmosphereOptions' : 'portClassOptions'
  let hasInvalidValues = false

  for (const system of workspace.cluster.systems) {
    for (const object of system.objects) {
      const value = object[field]
      if (value !== undefined && !normalized.includes(value)) {
        hasInvalidValues = true
        if (!clearInvalidValues) {
          throw new Error(`Cannot remove "${value}" while it is assigned to ${object.name}.`)
        }
      }
    }
  }

  const systems = hasInvalidValues
    ? workspace.cluster.systems.map(system => ({
        ...system,
        objects: system.objects.map(object => {
          const value = object[field]
          if (value === undefined || normalized.includes(value)) return object
          const updatedObject = { ...object }
          delete updatedObject[field]
          return updatedObject
        }),
      }))
    : workspace.cluster.systems

  return {
    ...workspace,
    ...(hasInvalidValues ? { cluster: { ...workspace.cluster, systems } } : {}),
    objectFieldSettings: {
      ...workspace.objectFieldSettings,
      [property]: normalized,
    },
  }
}

/**
 * Adds a reusable field that defaults to all catalogue objects.
 * @param workspace Current immutable workspace.
 * @param name Unique field name, compared case-insensitively.
 * @param type Value type for the new definition.
 * @param options Allowed values when type is single-select.
 * @returns Workspace with the new definition and no object values assigned.
 * @throws If the name or single-select options are invalid or the name already exists.
 */
export function addCustomFieldDefinition(
  workspace: LocalWorkspace,
  name: string,
  type: CustomFieldType,
  options: string[] = [],
): LocalWorkspace {
  const fieldName = validName(name, 'Custom field name')
  if (workspace.objectFieldSettings.customFields.some(field => field.name.toLowerCase() === fieldName.toLowerCase())) {
    throw new Error(`A custom field named "${fieldName}" already exists.`)
  }

  const definition: CustomFieldDefinition = type === 'single-select'
    ? {
        id: crypto.randomUUID(),
        name: fieldName,
        type,
        options: validFieldOptions(options, `${fieldName} option`),
      }
    : { id: crypto.randomUUID(), name: fieldName, type }

  return {
    ...workspace,
    objectFieldSettings: {
      ...workspace.objectFieldSettings,
      customFields: [...workspace.objectFieldSettings.customFields, definition],
    },
  }
}

/**
 * Tests visibility scope only; it does not remove or validate the object's stored field value.
 * @param definition Reusable field definition.
 * @param object Catalogue object whose family and subtype are compared.
 * @returns True for an undefined global scope or a matching category/subtype target.
 */
export function isCustomFieldApplicableToObject(
  definition: CustomFieldDefinition,
  object: SystemObject,
): boolean {
  return definition.applicability === undefined
    || definition.applicability.some(target =>
      target.kind === 'category'
        ? target.family === object.family
        : target.family === object.family && target.subtype === object.subtype,
    )
}

/**
 * Changes which objects display a custom field without changing any stored values.
 * @param workspace Current immutable workspace.
 * @param fieldId Definition to update.
 * @param applicability Target scopes; undefined means all objects and [] means no objects.
 * @returns Workspace with the new scope only.
 * @throws If the definition is missing or any target is invalid or duplicated.
 */
export function updateCustomFieldApplicability(
  workspace: LocalWorkspace,
  fieldId: string,
  applicability: CustomFieldApplicabilityTarget[] | undefined,
): LocalWorkspace {
  if (!workspace.objectFieldSettings.customFields.some(field => field.id === fieldId)) {
    throw new Error('The selected custom field no longer exists.')
  }
  if (applicability !== undefined && !isCustomFieldApplicability(applicability)) {
    throw new Error('Choose valid custom field applicability targets.')
  }

  return {
    ...workspace,
    objectFieldSettings: {
      ...workspace.objectFieldSettings,
      customFields: workspace.objectFieldSettings.customFields.map(field =>
        field.id === fieldId ? { ...field, applicability } : field,
      ),
    },
  }
}

/**
 * Renames a reusable field while preserving its ID and all object assignments.
 * @param workspace Current immutable workspace.
 * @param fieldId Definition to rename.
 * @param name New unique field name.
 * @returns Workspace with the renamed definition.
 * @throws If the definition is missing, the name is invalid, or another definition uses it.
 */
export function renameCustomFieldDefinition(
  workspace: LocalWorkspace,
  fieldId: string,
  name: string,
): LocalWorkspace {
  const definition = workspace.objectFieldSettings.customFields.find(field => field.id === fieldId)
  if (!definition) {
    throw new Error('The selected custom field no longer exists.')
  }

  const fieldName = validName(name, 'Custom field name')
  if (workspace.objectFieldSettings.customFields.some(field =>
    field.id !== fieldId && field.name.toLowerCase() === fieldName.toLowerCase(),
  )) {
    throw new Error(`A custom field named "${fieldName}" already exists.`)
  }

  return {
    ...workspace,
    objectFieldSettings: {
      ...workspace.objectFieldSettings,
      customFields: workspace.objectFieldSettings.customFields.map(field =>
        field.id === fieldId ? { ...field, name: fieldName } : field,
      ),
    },
  }
}

/**
 * Replaces single-select choices; assigned values are preserved unless clearing is explicitly enabled.
 * @param workspace Current immutable workspace.
 * @param fieldId Single-select definition to update.
 * @param options New allowed values.
 * @param clearInvalidValues Explicitly opt in to deleting assignments no longer present in options.
 * @returns Workspace with updated choices and any opted-in cleanup.
 * @throws If the field is missing, not single-select, options are invalid, or values would be removed without opt-in.
 */
export function updateCustomFieldOptions(
  workspace: LocalWorkspace,
  fieldId: string,
  options: string[],
  clearInvalidValues = false,
): LocalWorkspace {
  const definition = workspace.objectFieldSettings.customFields.find(field => field.id === fieldId)
  if (!definition) {
    throw new Error('The selected custom field no longer exists.')
  }
  if (definition.type !== 'single-select') {
    throw new Error('Only single-select custom fields have editable options.')
  }

  const normalized = validFieldOptions(options, `${definition.name} option`)
  let hasInvalidValues = false
  for (const system of workspace.cluster.systems) {
    for (const object of system.objects) {
      const value = object.customFieldValues?.[fieldId]
      if (typeof value === 'string' && !normalized.includes(value)) {
        hasInvalidValues = true
        if (!clearInvalidValues) {
          throw new Error(`Cannot remove "${value}" while it is assigned to ${object.name}.`)
        }
      }
    }
  }

  const systems = hasInvalidValues
    ? workspace.cluster.systems.map(system => ({
        ...system,
        objects: system.objects.map(object => {
          const value = object.customFieldValues?.[fieldId]
          if (typeof value !== 'string' || normalized.includes(value)) return object
          const customFieldValues = { ...object.customFieldValues }
          delete customFieldValues[fieldId]
          return { ...object, customFieldValues }
        }),
      }))
    : workspace.cluster.systems

  return {
    ...workspace,
    ...(hasInvalidValues ? { cluster: { ...workspace.cluster, systems } } : {}),
    objectFieldSettings: {
      ...workspace.objectFieldSettings,
      customFields: workspace.objectFieldSettings.customFields.map(field =>
        field.id === fieldId && field.type === 'single-select'
          ? { ...field, options: normalized }
          : field,
      ),
    },
  }
}

/**
 * Removes a definition and every saved value referring to it from all map objects.
 * This operation does not ask for confirmation; the calling UI owns that decision.
 * @param workspace Current immutable workspace.
 * @param fieldId Definition to remove.
 * @returns Workspace without the definition or its assigned values.
 * @throws If the definition no longer exists.
 */
export function removeCustomFieldDefinition(workspace: LocalWorkspace, fieldId: string): LocalWorkspace {
  if (!workspace.objectFieldSettings.customFields.some(field => field.id === fieldId)) {
    throw new Error('The selected custom field no longer exists.')
  }

  return {
    ...workspace,
    cluster: {
      ...workspace.cluster,
      systems: workspace.cluster.systems.map(system => ({
        ...system,
        objects: system.objects.map(object => {
          if (!object.customFieldValues || !(fieldId in object.customFieldValues)) return object
          const customFieldValues = { ...object.customFieldValues }
          delete customFieldValues[fieldId]
          return { ...object, customFieldValues }
        }),
      })),
    },
    objectFieldSettings: {
      ...workspace.objectFieldSettings,
      customFields: workspace.objectFieldSettings.customFields.filter(field => field.id !== fieldId),
    },
  }
}
