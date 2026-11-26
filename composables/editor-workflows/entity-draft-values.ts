/** Projects a saved map object and its current field definitions into the Inspector's editable string draft. */
import type { ObjectFieldSettings, CatalogueObject } from '../../domain/workspace'
import type { ObjectDraft } from './types'

/**
 * Creates the same complete string-valued draft for consultation and editing.
 * Empty values are included for currently defined custom fields; stored values retain their display text.
 */
export function objectDraftValuesFor(
  object: CatalogueObject | undefined,
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
    playerText: object ? object.playerText : '',
    playerFieldMasks: object ? [...object.playerFieldMasks].sort() : [],
    publication: object?.publication ?? 'hidden',
    markerColor: object?.markerColor ?? null,
    subtype: object?.subtype ?? '',
    placement: object?.placement.kind === 'orbit'
      ? `orbit:${object.placement.orbitId}` : object?.placement.kind ?? 'system',
    ...(object?.placement.kind === 'route'
      ? { routePercentage: String(Number((object.placement.progression * 100).toPrecision(15))) }
      : {}),
    atmosphere: object?.atmosphere ?? '',
    portClass: object?.portClass ?? '',
    jumpStationId: object?.jumpStationId ?? '',
    customFieldValues,
  }
}
