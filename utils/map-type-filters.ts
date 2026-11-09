import { customFieldApplicabilityTargetKey, type SystemObject } from '../domain/workspace-model'
import { catalogueSubtypeLabel } from './catalogue-labels'

type ObjectType = Pick<SystemObject, 'family' | 'subtype'>

/** Identifies a type without using its display label or folding a custom name. */
export function mapObjectTypeKey(object: ObjectType): string {
  return customFieldApplicabilityTargetKey({ kind: 'subtype', family: object.family, subtype: object.subtype })
}

/** Labels Other choices distinctly from catalogue types with the same name. */
export function mapObjectTypeOption(object: ObjectType): { value: string, label: string } {
  const subtypeLabel = catalogueSubtypeLabel(object)
  const label = object.family !== 'Other'
    ? subtypeLabel
    : object.subtype === 'other' ? 'Other' : `${subtypeLabel} (Other)`
  return { value: mapObjectTypeKey(object), label }
}
