import type { PlayerClusterDocument, PlayerObjectMarker } from '../domain/player-projection'
import { mapObjectTypeKey, mapObjectTypeOption, type MapObjectTypeOption } from './map-type-filters'

/** Shared public category for presences whose underlying object type is not disclosed. */
export const PLAYER_UNKNOWN_TYPE_KEY = 'player:type-not-revealed'

const unknownTypeOption: MapObjectTypeOption = { value: PLAYER_UNKNOWN_TYPE_KEY, label: 'Type not revealed', family: null }

/** Builds the available Type choices from revealed maps in the supplied public document. */
export function playerTypeFilterOptions(
  document: PlayerClusterDocument,
): MapObjectTypeOption[] {
  const options = new Map<string, MapObjectTypeOption>()
  let hasUnknownObjects = false

  for (const system of document.systems) {
    if (system.disclosure !== 'revealed') continue
    for (const object of system.map.objects) {
      if (object.disclosure === 'unknown') {
        hasUnknownObjects = true
        continue
      }
      const option = mapObjectTypeOption(object)
      options.set(option.value, option)
    }
  }

  const result = [...options.values()].sort((left, right) => left.label.localeCompare(right.label, 'en'))
  if (hasUnknownObjects) result.push(unknownTypeOption)
  return result
}

/** Type alternatives are ORed; an empty set leaves every public object at normal opacity. */
export function playerObjectMatchesTypeFilters(
  object: PlayerObjectMarker,
  selectedTypes: readonly string[],
): boolean {
  if (selectedTypes.length === 0) return true
  if (object.disclosure === 'unknown') return selectedTypes.includes(PLAYER_UNKNOWN_TYPE_KEY)
  return selectedTypes.includes(mapObjectTypeKey(object))
}
