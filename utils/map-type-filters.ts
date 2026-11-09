import { customFieldApplicabilityTargetKey, type ObjectFamily, type SystemObject } from '../domain/workspace-model'
import { catalogueSubtypeLabel } from './catalogue-labels'

type ObjectType = Pick<SystemObject, 'family' | 'subtype'>

export interface MapObjectTypeOption {
  value: string
  label: string
  family: ObjectFamily | null
}

/** Identifies a type without using its display label or folding a custom name. */
export function mapObjectTypeKey(object: ObjectType): string {
  return customFieldApplicabilityTargetKey({ kind: 'subtype', family: object.family, subtype: object.subtype })
}

/** Labels Other choices distinctly from catalogue types with the same name. */
export function mapObjectTypeOption(object: ObjectType): MapObjectTypeOption {
  const subtypeLabel = catalogueSubtypeLabel(object)
  const label = object.family !== 'Other'
    ? subtypeLabel
    : object.subtype === 'other' ? 'Other' : `${subtypeLabel} (Other)`
  return { value: mapObjectTypeKey(object), label, family: object.family }
}
