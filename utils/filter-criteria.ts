import type { PublicationMode } from '../domain/workspace'
import type { FieldCondition } from './field-filter-matching'

/** The shared Type/Publication/Field criteria shape used by Warden map and Search filters. */
export interface WardenFilterCriteria {
  readonly types: readonly string[]
  readonly publicationModes: readonly PublicationMode[]
  readonly fieldConditions: readonly FieldCondition[]
}

/** Counts each active Type and Publication group once, plus one for every active Field condition. */
export function countActiveFilterCriteria(criteria: WardenFilterCriteria): number {
  return Number(criteria.types.length > 0)
    + Number(criteria.publicationModes.length > 0)
    + criteria.fieldConditions.length
}
