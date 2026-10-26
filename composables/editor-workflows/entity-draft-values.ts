/** Projects a saved map object and its current field definitions into the Inspector's editable string draft. */
import type { ObjectFieldSettings, SystemObject } from '../../domain/workspace'
import type { ObjectDraft } from './types'

/**
 * Creates the same complete string-valued draft for consultation and editing.
 * Empty values are included for currently defined custom fields; stored values retain their display text.
 */
export function objectDraftValuesFor(
  object: SystemObject | undefined,
  settings: ObjectFieldSettings,
): ObjectDraft {
  const customFieldIds = new Set([
    ...settings.customFields.map(field => field.id),
    ...Object.keys(object?.customFieldValues ?? {}),
  ])
  const customFieldValues = Object.fromEntries([...customFieldIds].map(fieldId => {
    const value = object?.customFieldValues?.[fieldId]
    return [fieldId, value === undefined ? '' : String(value)]
  }))

  return {
    locationKey: object?.locationKey ?? '',
    name: object?.name ?? '',
    description: object?.description ?? '',
    subtype: object?.subtype ?? '',
    placement: object?.placement.kind === 'orbit' ? `orbit:${object.placement.orbitId}` : 'system',
    x: object?.placement.kind === 'system' ? String(object.placement.x) : '',
    y: object?.placement.kind === 'system' ? String(object.placement.y) : '',
    atmosphere: object?.atmosphere ?? '',
    portClass: object?.portClass ?? '',
    jumpStationId: object?.jumpStationId ?? '',
    customFieldValues,
  }
}
