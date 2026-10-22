import { expect, test } from '@playwright/test'
import {
  addCustomFieldDefinition,
  createLocalWorkspace,
  createSystemObject,
  isCustomFieldApplicableToObject,
  isCustomFieldValueCompatible,
  replaceWorkspaceSystem,
  updateCustomFieldApplicability,
  updateCustomFieldType,
  updateSystemObject,
} from '../domain/workspace'
import type { CatalogueSubtype, CustomFieldType, CustomFieldValue, LocalWorkspace } from '../domain/workspace'

type TypedFieldCase = {
  name: string
  type: CustomFieldType
  value: CustomFieldValue
  options?: string[]
}

function addDomainObject(
  workspace: LocalWorkspace,
  subtype: CatalogueSubtype,
): { workspace: LocalWorkspace; object: ReturnType<typeof createSystemObject> } {
  const system = workspace.cluster.systems[0]!
  const object = createSystemObject(system, subtype)
  return {
    workspace: replaceWorkspaceSystem(workspace, {
      ...system,
      objects: [...system.objects, object],
    }),
    object,
  }
}

function customValue(workspace: LocalWorkspace, objectId: string, fieldId: string): CustomFieldValue | undefined {
  const object = workspace.cluster.systems[0]?.objects.find(candidate => candidate.id === objectId)
  return object?.customFieldValues?.[fieldId]
}

test('custom field values keep their type and hidden assignments remain valid', () => {
  let workspace = createLocalWorkspace('Kestrel Reach', 'Vesper')
  const { workspace: withPlanet, object: planet } = addDomainObject(workspace, 'planet')
  const { workspace: withStation, object: station } = addDomainObject(withPlanet, 'station')
  workspace = withStation

  const typedFields: TypedFieldCase[] = [
    { name: 'Campaign notes', type: 'text', value: 'Survey record.' },
    { name: 'Threat level', type: 'number', value: 0 },
    { name: 'Hostile', type: 'boolean', value: false },
    { name: 'Signal class', type: 'single-select', options: ['Amber', 'Blue'], value: 'Amber' },
  ]
  const fieldIds = new Map<string, string>()
  for (const field of typedFields) {
    workspace = addCustomFieldDefinition(workspace, field.name, field.type, field.options)
    const definition = workspace.objectFieldSettings.customFields.find(candidate => candidate.name === field.name)
    if (!definition) throw new Error(`Expected ${field.name} to be added.`)
    fieldIds.set(field.name, definition.id)
    expect(isCustomFieldValueCompatible(field.value, field.type, field.options)).toBe(true)
  }

  workspace = addCustomFieldDefinition(workspace, 'Planet-only note', 'text')
  const hiddenDefinitionId = workspace.objectFieldSettings.customFields.find(field => field.name === 'Planet-only note')!.id
  workspace = updateCustomFieldApplicability(workspace, hiddenDefinitionId, [
    { kind: 'subtype', family: 'CelestialBody', subtype: 'planet' },
  ])
  const hiddenDefinition = workspace.objectFieldSettings.customFields.find(field => field.id === hiddenDefinitionId)!

  const storedValues = Object.fromEntries(typedFields.map(field => [fieldIds.get(field.name)!, field.value]))
  let system = workspace.cluster.systems[0]!
  system = updateSystemObject(system, planet.id, {
    customFieldValues: storedValues as Record<string, CustomFieldValue>,
  }, workspace.objectFieldSettings)
  system = updateSystemObject(system, station.id, {
    customFieldValues: { [hiddenDefinition.id]: 'Hidden station record.' },
  }, workspace.objectFieldSettings)
  workspace = replaceWorkspaceSystem(workspace, system)

  const storedPlanet = workspace.cluster.systems[0]!.objects.find(object => object.id === planet.id)!
  const storedStation = workspace.cluster.systems[0]!.objects.find(object => object.id === station.id)!
  expect(storedPlanet.customFieldValues).toEqual(Object.fromEntries(
    typedFields.map(field => [fieldIds.get(field.name)!, field.value]),
  ))
  expect(storedStation.customFieldValues).toEqual({ [hiddenDefinition.id]: 'Hidden station record.' })
  expect(isCustomFieldApplicableToObject(hiddenDefinition, planet)).toBe(true)
  expect(isCustomFieldApplicableToObject(hiddenDefinition, station)).toBe(false)
  expect(isCustomFieldValueCompatible(Number.NaN, 'number')).toBe(false)
  expect(isCustomFieldValueCompatible(1, 'boolean')).toBe(false)
  expect(isCustomFieldValueCompatible('Mauve', 'single-select', ['Amber', 'Blue'])).toBe(false)
})

test('field type changes preserve compatible strings and clear incompatible values only with opt-in', () => {
  let workspace = createLocalWorkspace('Kestrel Reach', 'Vesper')
  const { workspace: withPlanet, object: planet } = addDomainObject(workspace, 'planet')
  const { workspace: withStation, object: station } = addDomainObject(withPlanet, 'station')
  workspace = withStation
  workspace = addCustomFieldDefinition(workspace, 'Signal', 'single-select', ['Amber', 'Blue'])
  workspace = addCustomFieldDefinition(workspace, 'Threat level', 'number')
  workspace = addCustomFieldDefinition(workspace, 'Hostile', 'boolean')
  workspace = addCustomFieldDefinition(workspace, 'Planet-only note', 'text')

  const signal = workspace.objectFieldSettings.customFields.find(field => field.name === 'Signal')!
  const threat = workspace.objectFieldSettings.customFields.find(field => field.name === 'Threat level')!
  const hostile = workspace.objectFieldSettings.customFields.find(field => field.name === 'Hostile')!
  const hiddenId = workspace.objectFieldSettings.customFields.find(field => field.name === 'Planet-only note')!.id
  workspace = updateCustomFieldApplicability(workspace, hiddenId, [
    { kind: 'subtype', family: 'CelestialBody', subtype: 'planet' },
  ])
  const hidden = workspace.objectFieldSettings.customFields.find(field => field.id === hiddenId)!

  let system = workspace.cluster.systems[0]!
  system = updateSystemObject(system, planet.id, {
    customFieldValues: { [signal.id]: 'Amber', [threat.id]: 0, [hostile.id]: false },
  }, workspace.objectFieldSettings)
  system = updateSystemObject(system, station.id, {
    customFieldValues: { [hidden.id]: 'Hidden station record.' },
  }, workspace.objectFieldSettings)
  workspace = replaceWorkspaceSystem(workspace, system)

  const textWorkspace = updateCustomFieldType(workspace, signal.id, 'text')
  expect(textWorkspace.objectFieldSettings.customFields.find(field => field.id === signal.id)).toMatchObject({
    id: signal.id,
    name: 'Signal',
    type: 'text',
  })
  expect(customValue(textWorkspace, planet.id, signal.id)).toBe('Amber')
  expect(customValue(textWorkspace, planet.id, threat.id)).toBe(0)
  expect(customValue(textWorkspace, planet.id, hostile.id)).toBe(false)
  expect(customValue(textWorkspace, station.id, hidden.id)).toBe('Hidden station record.')
  expect(isCustomFieldApplicableToObject(hidden, station)).toBe(false)
  expect(isCustomFieldValueCompatible('Amber', 'text')).toBe(true)

  system = textWorkspace.cluster.systems[0]!
  system = updateSystemObject(system, station.id, {
    customFieldValues: { [signal.id]: 'Mauve', [hidden.id]: 'Hidden station record.' },
  }, textWorkspace.objectFieldSettings)
  const textWithMismatchedAssignment = replaceWorkspaceSystem(textWorkspace, system)

  expect(() => updateCustomFieldType(textWithMismatchedAssignment, signal.id, 'single-select', ['Amber']))
    .toThrow()
  expect(textWithMismatchedAssignment.objectFieldSettings.customFields.find(field => field.id === signal.id))
    .toMatchObject({ name: 'Signal', type: 'text' })
  expect(customValue(textWithMismatchedAssignment, planet.id, signal.id)).toBe('Amber')
  expect(customValue(textWithMismatchedAssignment, station.id, signal.id)).toBe('Mauve')

  const selectWorkspace = updateCustomFieldType(
    textWithMismatchedAssignment,
    signal.id,
    'single-select',
    ['Amber'],
    true,
  )
  expect(selectWorkspace.objectFieldSettings.customFields.find(field => field.id === signal.id)).toMatchObject({
    name: 'Signal',
    type: 'single-select',
    options: ['Amber'],
  })
  expect(customValue(selectWorkspace, planet.id, signal.id)).toBe('Amber')
  expect(customValue(selectWorkspace, station.id, signal.id)).toBeUndefined()
  expect(customValue(selectWorkspace, station.id, hidden.id)).toBe('Hidden station record.')
  expect(customValue(selectWorkspace, planet.id, threat.id)).toBe(0)
  expect(customValue(selectWorkspace, planet.id, hostile.id)).toBe(false)

  expect(workspace.objectFieldSettings.customFields.find(field => field.id === signal.id)).toMatchObject({
    name: 'Signal',
    type: 'single-select',
    options: ['Amber', 'Blue'],
  })
  expect(customValue(workspace, planet.id, signal.id)).toBe('Amber')
  expect(customValue(workspace, station.id, signal.id)).toBeUndefined()
})
