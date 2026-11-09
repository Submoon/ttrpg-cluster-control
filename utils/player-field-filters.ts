import type { PlayerClusterDocument, PlayerFieldValue, PlayerObjectMarker } from '../domain/player-projection'
import type { FieldCondition, FieldFilterOption } from './field-filter-matching'
import { matchesFieldCondition } from './field-filter-matching'

type PublicFieldGroup = Pick<PlayerFieldValue, 'name' | 'type'>

/** Stable identity for a public Field group; private definition IDs never enter the player document. */
export function playerFieldFilterId(field: PublicFieldGroup): string {
  return JSON.stringify([field.name, field.type])
}

/** Builds Field criteria solely from values explicitly present in the public player document. */
export function playerFieldFilterOptions(document: PlayerClusterDocument): FieldFilterOption[] {
  const groups = new Map<string, { name: string; type: PlayerFieldValue['type']; values: Set<string> }>()

  for (const system of document.systems) {
    if (system.disclosure !== 'revealed') continue
    for (const object of system.map.objects) {
      if (object.disclosure !== 'revealed') continue
      for (const field of object.fields) {
        const fieldId = playerFieldFilterId(field)
        const group = groups.get(fieldId) ?? {
          name: field.name,
          type: field.type,
          values: new Set<string>(),
        }
        if (field.type === 'single-select' && typeof field.value === 'string') group.values.add(field.value)
        groups.set(fieldId, group)
      }
    }
  }

  return [...groups.entries()]
    .map(([fieldId, group]) => ({
      fieldId,
      label: `${fieldTypeLabel(group.type)} · ${group.name}`,
      type: group.type,
      options: [...group.values].sort((left, right) => left.localeCompare(right, 'en')),
    }))
    .sort((left, right) => left.label.localeCompare(right.label, 'en'))
}

/** Applies one condition per public name-and-kind group; assignments within a group are alternatives. */
export function playerObjectMatchesFieldFilters(
  object: PlayerObjectMarker,
  conditions: readonly FieldCondition[],
): boolean {
  if (conditions.length === 0) return true
  if (object.disclosure !== 'revealed') return false

  return conditions.every((condition) => {
    if (condition.operator === 'no-value') return false
    return object.fields.some(field => playerFieldFilterId(field) === condition.fieldId
      && field.type === condition.type
      && matchesFieldCondition(field.value, condition))
  })
}

function fieldTypeLabel(type: PlayerFieldValue['type']): string {
  switch (type) {
    case 'text': return 'Text'
    case 'number': return 'Number'
    case 'boolean': return 'Yes or no'
    case 'single-select': return 'Single select'
  }
}
