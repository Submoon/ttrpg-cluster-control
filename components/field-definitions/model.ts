/**
 * Pure projections for the field-definition UI; stored workspace values remain owned by the domain model.
 */
import {
  catalogueTypes,
  customFieldApplicabilityTargetKey,
  type CustomFieldApplicabilityTarget,
  type CustomFieldType,
  type CustomFieldValue,
  type LocalWorkspace,
  type ObjectFamily,
} from '../../domain/workspace'

export type NativeFieldId = 'native:atmosphere' | 'native:port-class'

export type FieldDefinitionSummary =
  | {
      id: NativeFieldId
      name: 'Atmosphere' | 'Port class'
      kind: 'native'
      nativeField: 'atmosphere' | 'portClass'
      type: 'single-select'
      options: string[]
    }
  | {
      id: string
      name: string
      kind: 'custom'
      type: CustomFieldType
      options: string[]
      applicability?: CustomFieldApplicabilityTarget[]
    }

export interface FieldValueAssignment {
  objectId: string
  objectName: string
  systemName: string
  value: CustomFieldValue
}

export type FieldDefinitionUpdate = {
  fieldId: string
  name: string
  options: string[]
  applicability: CustomFieldApplicabilityTarget[] | undefined
}

export type CustomFieldCreate = {
  name: string
  type: CustomFieldType
  options: string[]
}

export type PendingFieldDefinitionChange =
  | {
      kind: 'save'
      update: FieldDefinitionUpdate
      fieldName: string
      affectedAssignments: FieldValueAssignment[]
    }
  | {
      kind: 'remove'
      fieldId: string
      fieldName: string
      affectedAssignments: FieldValueAssignment[]
    }

export const applicabilityGroups = [
  { family: 'CelestialBody', label: 'Celestial bodies' },
  { family: 'SmallBody/Field', label: 'Small bodies and fields' },
  { family: 'Installation', label: 'Installations' },
  { family: 'Vessel', label: 'Vessels' },
  { family: 'JumpPoint', label: 'Jump Points' },
  { family: 'Phenomenon', label: 'Phenomena' },
  { family: 'Other', label: 'Other' },
] satisfies Array<{ family: ObjectFamily; label: string }>

/**
 * Projects built-in and custom definitions into one dialog list without modifying workspace settings.
 * @param workspace Current workspace.
 * @returns Native options and custom definitions with a consistent UI shape.
 */
export function fieldDefinitionSummaries(workspace: LocalWorkspace): FieldDefinitionSummary[] {
  const settings = workspace.objectFieldSettings
  return [
    {
      id: 'native:atmosphere',
      name: 'Atmosphere',
      kind: 'native',
      nativeField: 'atmosphere',
      type: 'single-select',
      options: settings.atmosphereOptions,
    },
    {
      id: 'native:port-class',
      name: 'Port class',
      kind: 'native',
      nativeField: 'portClass',
      type: 'single-select',
      options: settings.portClassOptions,
    },
    ...settings.customFields.map((field): FieldDefinitionSummary => ({
      id: field.id,
      name: field.name,
      kind: 'custom',
      type: field.type,
      options: field.type === 'single-select' ? field.options : [],
      applicability: field.applicability,
    })),
  ] satisfies FieldDefinitionSummary[]
}

/**
 * Parses newline-separated option drafts, trimming values and dropping blank lines.
 * @param value Textarea value.
 * @returns Non-empty option labels in entered order; uniqueness is validated by the domain command.
 */
export function fieldOptionsFromText(value: string): string[] {
  return value.split(/\r?\n/u).map(option => option.trim()).filter(Boolean)
}

function customFieldApplicabilityTargetLabel(target: CustomFieldApplicabilityTarget): string {
  if (target.kind === 'category') {
    return `Category ${applicabilityGroups.find(group => group.family === target.family)?.label ?? target.family}`
  }
  const subtype = catalogueTypes.find(type =>
    type.family === target.family && type.value === target.subtype,
  )?.label ?? target.subtype
  return `Subtype ${subtype}`
}

/**
 * Describes a field's visibility scope, distinguishing global, explicitly empty, and selected-target scopes.
 * @param definition Field summary to label.
 * @returns Compact user-facing applicability text.
 */
export function fieldApplicabilitySummary(definition: FieldDefinitionSummary): string {
  if (definition.kind === 'native' || definition.applicability === undefined) {
    return 'All catalogue objects'
  }
  return definition.applicability.length
    ? definition.applicability.map(customFieldApplicabilityTargetLabel).join(', ')
    : 'No catalogue targets'
}

/**
 * Collects saved native/custom assignments from every system, including currently out-of-scope objects.
 * @param workspace Workspace whose objects hold the values.
 * @param definition Definition whose saved assignments are listed.
 * @returns Object/system/value records, excluding unset and empty-string values.
 */
export function fieldValueAssignments(
  workspace: LocalWorkspace,
  definition: FieldDefinitionSummary,
): FieldValueAssignment[] {
  const assignments: FieldValueAssignment[] = []
  for (const system of workspace.cluster.systems) {
    for (const object of system.objects) {
      const value = definition.kind === 'native'
        ? object[definition.nativeField]
        : object.customFieldValues?.[definition.id]
      if (value === undefined || value === '') continue
      assignments.push({
        objectId: object.id,
        objectName: object.name,
        systemName: system.name,
        value,
      })
    }
  }
  return assignments
}

/**
 * Compares explicit applicability sets by canonical target identity, independent of target order.
 * @param first Existing optional scope.
 * @param second Proposed optional scope.
 * @returns True when both are global or contain the same targets.
 */
export function sameCustomFieldApplicability(
  first: CustomFieldApplicabilityTarget[] | undefined,
  second: CustomFieldApplicabilityTarget[] | undefined,
): boolean {
  if (first === undefined || second === undefined) return first === second
  const secondKeys = new Set(second.map(customFieldApplicabilityTargetKey))
  return first.length === second.length
    && first.every(target => secondKeys.has(customFieldApplicabilityTargetKey(target)))
}
