import { expect, test } from '@playwright/test'
import type { PlayerClusterDocument } from '../domain/player-projection'
import type { FieldCondition } from '../utils/field-filter-matching'
import { searchPlayerDocument } from '../utils/player-search'
import { playerFieldFilterId, playerFieldFilterOptions, playerObjectMatchesFieldFilters } from '../utils/player-field-filters'

function playerDocument(): PlayerClusterDocument {
  return {
    format: 'ttrpg-cluster-control-player',
    version: 1,
    title: 'Starlight Expanse',
    systems: [
      { id: 'system-hidden-neighbor', position: { x: 0, y: 0 }, disclosure: 'unknown', label: 'Unknown presence' },
      {
        id: 'system-known-neighbor',
        position: { x: 1, y: 1 },
        disclosure: 'known-type',
        type: 'star-system',
        label: 'Star system',
      },
      {
        id: 'system-public',
        position: { x: 2, y: 2 },
        disclosure: 'revealed',
        type: 'star-system',
        label: 'Vesper',
        map: {
          objects: [
            {
              id: 'object-public-unknown',
              position: { x: 0, y: 0 },
              placement: { kind: 'system' },
              disclosure: 'unknown',
              label: 'Unknown presence',
            },
            {
              id: 'object-public-known',
              position: { x: 1, y: 1 },
              placement: { kind: 'system' },
              disclosure: 'known-type',
              family: 'CelestialBody',
              subtype: 'planet',
              label: 'Planet',
            },
            {
              id: 'object-public-revealed',
              position: { x: 2, y: 2 },
              placement: { kind: 'system' },
              disclosure: 'revealed',
              family: 'CelestialBody',
              subtype: 'planet',
              label: 'Aurelia',
              playerText: 'Secret prose excluded from search',
              fields: [{ name: 'Secret field', type: 'text', value: 'Private field value' }],
            },
          ],
          orbits: [{
            id: 'orbit-private-id',
            hostId: null,
            center: { x: 3, y: 3 },
            radii: { horizontal: 10, vertical: 10 },
            rotation: 15,
          }],
        },
      },
    ],
    routes: [{
      id: 'route-private-id',
      jumpLevel: 9,
      fromSystemId: 'system-public',
      destination: { kind: 'unknown', position: { x: 4, y: 4 }, label: 'Unknown destination' },
    }],
  }
}

test('player search includes the public title, revealed systems, and inspectable public object labels @pure', () => {
  const document = playerDocument()

  const titleResult = searchPlayerDocument(document, 'starlight')
  const systemResult = searchPlayerDocument(document, 'vesper')
  const objectResult = searchPlayerDocument(document, 'aurelia')

  expect(titleResult.map(result => result.target.kind)).toEqual(['cluster'])
  expect(systemResult.map(result => result.target.kind)).toEqual(['system'])
  expect(systemResult[0]?.target).toMatchObject({ kind: 'system', systemId: 'system-public', document })
  expect(objectResult.map(result => result.target.kind)).toEqual(['object'])
  expect(objectResult[0]?.target).toMatchObject({
    kind: 'object',
    systemId: 'system-public',
    objectId: 'object-public-revealed',
    document,
  })
})

test('player search exposes generic public marker labels and only disclosed type glyphs @pure', () => {
  const document = playerDocument()
  const unknown = searchPlayerDocument(document, 'unknown presence')
  const knownType = searchPlayerDocument(document, 'planet')

  expect(unknown).toHaveLength(1)
  expect(unknown[0]).toMatchObject({
    name: 'Unknown presence',
    typeLabel: 'Unknown presence',
    leadingMark: { kind: 'none' },
    target: { kind: 'object', objectId: 'object-public-unknown' },
  })
  expect(knownType.map(result => result.name)).toEqual(['Aurelia', 'Unknown planet'])
  expect(knownType.every(result => result.leadingMark.kind === 'glyph')).toBe(true)
  expect(knownType.every(result => result.typeLabel === 'Planet')).toBe(true)
})

test('player search excludes locked systems, IDs, routes, prose, Fields, and Orbit metadata @pure', () => {
  const document = playerDocument()

  for (const privateTerm of [
    'system-hidden-neighbor',
    'system-known-neighbor',
    'object-public-revealed',
    'orbit-private-id',
    'route-private-id',
    'Unknown destination',
    'Secret prose',
    'Secret field',
    'Private field value',
  ]) {
    expect(searchPlayerDocument(document, privateTerm), privateTerm).toEqual([])
  }

  expect(searchPlayerDocument(document, 'Unknown presence').map(result => result.target.kind)).toEqual(['object'])
})

test('player navigation targets retain the exact document identity across repeated public IDs @pure', () => {
  const firstDocument = playerDocument()
  const replacementDocument = structuredClone(firstDocument)

  const firstTarget = searchPlayerDocument(firstDocument, 'aurelia')[0]?.target
  const replacementTarget = searchPlayerDocument(replacementDocument, 'aurelia')[0]?.target

  expect(firstTarget?.document).toBe(firstDocument)
  expect(replacementTarget?.document).toBe(replacementDocument)
  expect(replacementTarget?.document).not.toBe(firstTarget?.document)
})

test('player Field options use only published assignments and distinguish same-named kinds @pure', () => {
  const document = playerDocument()
  const system = document.systems.find(candidate => candidate.disclosure === 'revealed')
  if (!system || system.disclosure !== 'revealed') throw new Error('The public fixture has no revealed system.')
  const object = system.map.objects.find(candidate => candidate.disclosure === 'revealed')
  if (!object || object.disclosure !== 'revealed') throw new Error('The public fixture has no revealed object.')
  object.fields = [
    { name: 'Atmosphere', type: 'text', value: 'Vacuum' },
    { name: 'Atmosphere', type: 'text', value: 'Breathable' },
    { name: 'Atmosphere', type: 'single-select', value: 'Thin' },
    { name: 'Survey index', type: 'number', value: 0 },
    { name: 'Safe route', type: 'boolean', value: false },
  ]

  const options = playerFieldFilterOptions(document)
  const atmosphereText = options.find(option => option.fieldId === playerFieldFilterId({ name: 'Atmosphere', type: 'text' }))
  const atmosphereChoice = options.find(option => option.fieldId === playerFieldFilterId({ name: 'Atmosphere', type: 'single-select' }))

  expect(options.map(option => option.label)).toEqual([
    'Number · Survey index',
    'Single select · Atmosphere',
    'Text · Atmosphere',
    'Yes or no · Safe route',
  ])
  expect(atmosphereText).toMatchObject({ label: 'Text · Atmosphere', type: 'text', options: [] })
  expect(atmosphereChoice).toMatchObject({ label: 'Single select · Atmosphere', type: 'single-select', options: ['Thin'] })
  expect(options.some(option => option.fieldId === playerFieldFilterId({ name: 'unpublished', type: 'text' }))).toBe(false)
})

test('player Field filters OR assignments and selected choices, then AND Field criteria @pure', () => {
  const document = playerDocument()
  const system = document.systems.find(candidate => candidate.disclosure === 'revealed')
  if (!system || system.disclosure !== 'revealed') throw new Error('The public fixture has no revealed system.')
  const object = system.map.objects.find(candidate => candidate.disclosure === 'revealed')
  if (!object || object.disclosure !== 'revealed') throw new Error('The public fixture has no revealed object.')
  object.fields = [
    { name: 'Atmosphere', type: 'text', value: 'Vacuum' },
    { name: 'Atmosphere', type: 'text', value: 'Breathable' },
    { name: 'Atmosphere', type: 'single-select', value: 'Thin' },
    { name: 'Survey index', type: 'number', value: 0 },
    { name: 'Safe route', type: 'boolean', value: false },
  ]
  const conditions: FieldCondition[] = [
    {
      fieldId: playerFieldFilterId({ name: 'Atmosphere', type: 'text' }),
      type: 'text',
      operator: 'contains',
      value: 'breath',
    },
    {
      fieldId: playerFieldFilterId({ name: 'Atmosphere', type: 'single-select' }),
      type: 'single-select',
      operator: 'is',
      values: ['Dense', 'Thin'],
    },
    {
      fieldId: playerFieldFilterId({ name: 'Survey index', type: 'number' }),
      type: 'number',
      operator: 'equals',
      value: 0,
    },
    {
      fieldId: playerFieldFilterId({ name: 'Safe route', type: 'boolean' }),
      type: 'boolean',
      operator: 'is',
      value: false,
    },
  ]

  expect(playerObjectMatchesFieldFilters(object, conditions)).toBe(true)
  expect(playerObjectMatchesFieldFilters(object, [
    ...conditions,
    { fieldId: playerFieldFilterId({ name: 'Safe route', type: 'boolean' }), type: 'boolean', operator: 'is', value: true },
  ])).toBe(false)
  expect(playerObjectMatchesFieldFilters(object, [
    { fieldId: playerFieldFilterId({ name: 'Atmosphere', type: 'text' }), operator: 'no-value' },
  ])).toBe(false)
})
