import { expect, test } from '@playwright/test'
import type { PlayerClusterDocument } from '../domain/player-projection'
import { searchPlayerDocument } from '../utils/player-search'

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
