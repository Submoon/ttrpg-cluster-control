import { expect, test } from '@playwright/test'
import { matchesFieldCondition, type FieldCondition } from '../utils/field-filter-matching'

test('text conditions normalize case and accents and treat blank values as missing @pure', () => {
  const contains: FieldCondition = { fieldId: 'field-text', type: 'text', operator: 'contains', value: 'epave' }
  const excludes: FieldCondition = { fieldId: 'field-text', type: 'text', operator: 'does-not-contain', value: 'épave' }
  const equals: FieldCondition = { fieldId: 'field-text', type: 'text', operator: 'equals', value: 'Épave' }

  expect(matchesFieldCondition('Épave abandonnée', contains)).toBe(true)
  expect(matchesFieldCondition('EPAVE', equals)).toBe(true)
  expect(matchesFieldCondition('Relais', excludes)).toBe(true)
  expect(matchesFieldCondition('Épave', excludes)).toBe(false)
  expect(matchesFieldCondition('  ', contains)).toBe(false)
  expect(matchesFieldCondition('  ', { fieldId: 'field-text', operator: 'no-value' })).toBe(true)
  expect(matchesFieldCondition(undefined, { fieldId: 'field-text', operator: 'no-value' })).toBe(true)
})

test('numeric conditions support inclusive comparisons and inclusive ranges @pure', () => {
  expect(matchesFieldCondition(3, { fieldId: 'danger', type: 'number', operator: 'equals', value: 3 })).toBe(true)
  expect(matchesFieldCondition(3, { fieldId: 'danger', type: 'number', operator: 'not-equals', value: 4 })).toBe(true)
  expect(matchesFieldCondition(3, { fieldId: 'danger', type: 'number', operator: 'less-than-or-equal', value: 3 })).toBe(true)
  expect(matchesFieldCondition(3, { fieldId: 'danger', type: 'number', operator: 'greater-than-or-equal', value: 3 })).toBe(true)
  expect(matchesFieldCondition(3, { fieldId: 'danger', type: 'number', operator: 'between', minimum: 3, maximum: 5 })).toBe(true)
  expect(matchesFieldCondition(0, { fieldId: 'danger', operator: 'no-value' })).toBe(false)
  expect(matchesFieldCondition(Number.NaN, { fieldId: 'danger', type: 'number', operator: 'equals', value: 3 })).toBe(false)
  expect(matchesFieldCondition(undefined, { fieldId: 'danger', type: 'number', operator: 'equals', value: 3 })).toBe(false)
})

test('boolean and single-select conditions preserve false and use any selected choice @pure', () => {
  expect(matchesFieldCondition(false, { fieldId: 'active', type: 'boolean', operator: 'is', value: false })).toBe(true)
  expect(matchesFieldCondition(false, { fieldId: 'active', operator: 'no-value' })).toBe(false)
  expect(matchesFieldCondition('Known', { fieldId: 'status', type: 'single-select', operator: 'is', values: ['Known', 'Damaged'] })).toBe(true)
  expect(matchesFieldCondition(undefined, { fieldId: 'status', type: 'single-select', operator: 'is', values: ['Known'] })).toBe(false)
})
