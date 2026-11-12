import { expect, test } from '@playwright/test'
import {
  createLocalWorkspace,
  nativePlayerFieldIds,
  type CustomFieldDefinition,
  type SystemObject,
} from '../domain/workspace'
import { wardenFieldFilterOptions, wardenObjectFieldValue, reconcileFieldConditions, matchesWardenObjectFilters } from '../utils/warden-map-filters'
import type { FieldCondition } from '../utils/field-filter-matching'

function object(overrides: Partial<SystemObject> = {}): SystemObject {
  return {
    id: 'filter-object',
    publication: 'revealed',
    family: 'CelestialBody',
    subtype: 'planet',
    locationKey: 'PL-01',
    name: 'Aurelia',
    description: '',
    playerText: '',
    playerFieldMasks: [],
    placement: { kind: 'system', x: 0.5, y: 0.5 },
    ...overrides,
  }
}

function workspaceWithField(field: CustomFieldDefinition = {
  id: 'field-state', name: 'State', playerShared: false, type: 'single-select', options: ['Known', 'Damaged'],
}) {
  const workspace = createLocalWorkspace('Kestrel Reach', 'Vesper')
  workspace.objectFieldSettings.customFields = [field]
  return workspace
}

test('Warden Field choices include all native and custom Fields and mark inapplicable or stale assignments as absent @pure', () => {
  const workspace = workspaceWithField()
  workspace.objectFieldSettings.customFields.push({
    id: 'field-custom-atmosphere',
    name: 'Atmosphere',
    playerShared: false,
    type: 'text',
  })
  workspace.objectFieldSettings.customFields.push({
    id: 'field-custom-atmosphere-literal-suffix',
    name: 'Atmosphere (Custom)',
    playerShared: false,
    type: 'text',
  })
  const options = wardenFieldFilterOptions(workspace)
  const atmosphere = options.find(option => option.fieldId === nativePlayerFieldIds.atmosphere)
  const portClass = options.find(option => option.fieldId === nativePlayerFieldIds.portClass)
  const state = options.find(option => option.fieldId === 'field-state')

  expect(options.map(option => option.label)).toEqual([
    'Atmosphere', 'Port class', 'State (Custom)', 'Atmosphere (Custom)', 'Atmosphere (Custom) (Custom)',
  ])
  expect(options.find(option => option.fieldId === 'field-custom-atmosphere')?.type).toBe('text')
  expect(atmosphere?.options).toContain('Breathable')
  expect(portClass?.type).toBe('single-select')
  expect(state?.options).toEqual(['Known', 'Damaged'])
  expect(wardenObjectFieldValue(workspace, object({ atmosphere: 'Breathable' }), atmosphere!)).toBe('Breathable')
  expect(wardenObjectFieldValue(workspace, object({ family: 'Installation', subtype: 'station', atmosphere: 'Breathable' }), atmosphere!)).toBeUndefined()
  expect(wardenObjectFieldValue(workspace, object({ customFieldValues: { 'field-state': 'Removed choice' } }), state!)).toBeUndefined()
  expect(wardenObjectFieldValue(workspace, object({ family: 'Installation', subtype: 'station', customFieldValues: { 'field-state': 'Known' } }), {
    ...state!,
  })).toBe('Known')
})

test('condition reconciliation follows Field identities, updates choice lists, and preserves No value across kind changes @pure', () => {
  const conditions: FieldCondition[] = [
    { fieldId: 'field-state', type: 'single-select', operator: 'is', values: ['Known', 'Gone'] },
    { fieldId: 'field-rating', operator: 'no-value' },
    { fieldId: 'deleted-field', type: 'text', operator: 'contains', value: 'signal' },
  ]
  const options = [
    { fieldId: 'field-state', label: 'Condition', type: 'single-select' as const, options: ['Known'] },
    { fieldId: 'field-rating', label: 'Rating', type: 'number' as const, options: [] },
  ]

  const result = reconcileFieldConditions(conditions, options)

  expect(result.changed).toBe(true)
  expect(result.conditions).toEqual([
    { fieldId: 'field-state', type: 'single-select', operator: 'is', values: ['Known'] },
    { fieldId: 'field-rating', operator: 'no-value' },
  ])
})

test('type and publication lists use OR while Fields combine with AND @pure', () => {
  const workspace = workspaceWithField()
  const target = object({ customFieldValues: { 'field-state': 'Known' } })
  const condition: FieldCondition = { fieldId: 'field-state', type: 'single-select', operator: 'is', values: ['Known', 'Damaged'] }
  const typeKey = (value: SystemObject) => `${value.family}:${value.subtype}`

  expect(matchesWardenObjectFilters(
    workspace, target, ['CelestialBody:moon', 'CelestialBody:planet'], ['known-type', 'revealed'], [condition], typeKey,
  )).toBe(true)
  expect(matchesWardenObjectFilters(
    workspace, target, ['CelestialBody:moon'], ['revealed'], [condition], typeKey,
  )).toBe(false)
  expect(matchesWardenObjectFilters(
    workspace, target, ['CelestialBody:planet'], ['known-type'], [condition], typeKey,
  )).toBe(false)
  expect(matchesWardenObjectFilters(
    workspace, target, ['CelestialBody:planet'], ['revealed'], [
      condition,
      { fieldId: 'other-field', operator: 'no-value' },
    ], typeKey,
  )).toBe(false)
})
