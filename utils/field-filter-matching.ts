import type { CustomFieldType } from '../domain/workspace'
import { normalizeSearchText } from './normalize-search-text'

export type FieldCondition =
  | { fieldId: string; operator: 'no-value' }
  | { fieldId: string; type: 'text'; operator: 'contains' | 'does-not-contain' | 'equals'; value: string }
  | { fieldId: string; type: 'number'; operator: 'no-value' }
  | { fieldId: string; type: 'number'; operator: 'equals' | 'not-equals' | 'less-than' | 'less-than-or-equal' | 'greater-than' | 'greater-than-or-equal'; value: number }
  | { fieldId: string; type: 'number'; operator: 'between'; minimum: number; maximum: number }
  | { fieldId: string; type: 'boolean'; operator: 'no-value' }
  | { fieldId: string; type: 'boolean'; operator: 'is'; value: boolean }
  | { fieldId: string; type: 'single-select'; operator: 'no-value' }
  | { fieldId: string; type: 'single-select'; operator: 'is'; values: string[] }

export interface FieldFilterOption {
  fieldId: string
  label: string
  type: CustomFieldType
  options: readonly string[]
}

function isMissingValue(value: unknown, type: CustomFieldType): boolean {
  switch (type) {
    case 'text':
      return typeof value !== 'string' || value.trim().length === 0
    case 'number':
      return typeof value !== 'number' || !Number.isFinite(value)
    case 'boolean':
      return typeof value !== 'boolean'
    case 'single-select':
      return typeof value !== 'string' || value.trim().length === 0
  }
}

function isMissingFieldValue(value: unknown): boolean {
  return value === undefined
    || value === null
    || (typeof value === 'string' && value.trim().length === 0)
    || (typeof value === 'number' && !Number.isFinite(value))
    || (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean')
}

/** Compares one typed Field value with a valid condition; missing and inapplicable values share `no-value`. */
export function matchesFieldCondition(value: unknown, condition: FieldCondition): boolean {
  if (condition.operator === 'no-value') return isMissingFieldValue(value)
  if (isMissingValue(value, condition.type)) return false

  switch (condition.type) {
    case 'text': {
      if (typeof value !== 'string') return false
      const candidate = normalizeSearchText(value)
      const expected = normalizeSearchText(condition.value)
      if (condition.operator === 'equals') return candidate === expected
      if (condition.operator === 'contains') return candidate.includes(expected)
      return !candidate.includes(expected)
    }
    case 'number': {
      if (typeof value !== 'number' || !Number.isFinite(value)) return false
      switch (condition.operator) {
        case 'equals': return value === condition.value
        case 'not-equals': return value !== condition.value
        case 'less-than': return value < condition.value
        case 'less-than-or-equal': return value <= condition.value
        case 'greater-than': return value > condition.value
        case 'greater-than-or-equal': return value >= condition.value
        case 'between': return value >= condition.minimum && value <= condition.maximum
      }
      return false
    }
    case 'boolean':
      return typeof value === 'boolean' && condition.operator === 'is' && value === condition.value
    case 'single-select':
      return typeof value === 'string' && condition.operator === 'is' && condition.values.includes(value)
  }
}
