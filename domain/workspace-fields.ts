import type {
  CustomFieldApplicabilityTarget,
  CustomFieldDefinition,
  CustomFieldType,
  LocalWorkspace,
  SystemObject,
} from './workspace-model'
import { isCustomFieldApplicability, validFieldOptions, validName } from './workspace-validation'

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
