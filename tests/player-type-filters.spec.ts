import { expect, test } from './fixtures'
import type { PlayerClusterDocument, PlayerObjectMarker, PlayerSystemDocument } from '../domain/player-projection'
import type { ObjectFamily } from '../domain/workspace'
import { mapObjectTypeKey } from '../utils/map-type-filters'
import {
  PLAYER_UNKNOWN_TYPE_KEY,
  playerObjectMatchesTypeFilters,
  playerTypeFilterOptions,
} from '../utils/player-type-filters'

type UnknownPlayerObject = Extract<PlayerObjectMarker, { disclosure: 'unknown' }>
type KnownPlayerObject = Extract<PlayerObjectMarker, { disclosure: 'known-type' }>
type RevealedPlayerObject = Extract<PlayerObjectMarker, { disclosure: 'revealed' }>

function publicObject(id: string, disclosure: 'unknown'): UnknownPlayerObject
function publicObject(id: string, disclosure: 'known-type', family: ObjectFamily, subtype: string): KnownPlayerObject
function publicObject(id: string, disclosure: 'revealed', family: ObjectFamily, subtype: string): RevealedPlayerObject
function publicObject(
  id: string,
  disclosure: 'unknown' | 'known-type' | 'revealed',
  family?: ObjectFamily,
  subtype?: string,
): PlayerObjectMarker {
  const position = { x: 0, y: 0 }
  const placement = { kind: 'system' as const }
  if (disclosure === 'unknown') {
    return { id, position, placement, disclosure, label: 'Unknown presence' }
  }
  if (!family || !subtype) throw new Error('A disclosed type needs its public family and subtype.')
  if (disclosure === 'known-type') {
    return { id, position, placement, disclosure, family, subtype, label: subtype }
  }
  return {
    id,
    position,
    placement,
    disclosure,
    family,
    subtype,
    label: `Public ${subtype}`,
    playerText: '',
    fields: [],
  }
}

function publicSystem(objects: PlayerObjectMarker[]): PlayerSystemDocument {
  return { objects, orbits: [] }
}

test('player Type choices come only from public maps and Unknown objects share one public category @pure', () => {
  const planet = publicObject('planet', 'known-type', 'CelestialBody', 'planet')
  const revealedPlanet = publicObject('revealed-planet', 'revealed', 'CelestialBody', 'planet')
  const moon = publicObject('moon', 'revealed', 'CelestialBody', 'moon')
  const unknown = publicObject('unknown', 'unknown')
  const document: PlayerClusterDocument = {
    format: 'ttrpg-cluster-control-player',
    version: 1,
    title: 'Public Reach',
    systems: [
      { id: 'revealed-a', position: { x: 0, y: 0 }, disclosure: 'revealed', type: 'star-system', label: 'A', map: publicSystem([planet, revealedPlanet, moon, unknown]) },
      { id: 'revealed-b', position: { x: 1, y: 1 }, disclosure: 'revealed', type: 'star-system', label: 'B', map: publicSystem([publicObject('remote-unknown', 'unknown')]) },
      { id: 'not-revealed', position: { x: 2, y: 2 }, disclosure: 'unknown', label: 'Unknown presence' },
    ],
    routes: [],
  }

  const options = playerTypeFilterOptions(document)

  expect(options.map(option => option.label)).toEqual(['Moon', 'Planet', 'Type not revealed'])
  expect(options.filter(option => option.value === mapObjectTypeKey(planet))).toHaveLength(1)
  expect(options.find(option => option.value === PLAYER_UNKNOWN_TYPE_KEY)).toEqual({
    value: PLAYER_UNKNOWN_TYPE_KEY,
    label: 'Type not revealed',
    family: null,
  })
})

test('player Type alternatives match with OR and the unfiltered view matches every disclosure @pure', () => {
  const planet = publicObject('planet', 'known-type', 'CelestialBody', 'planet')
  const moon = publicObject('moon', 'revealed', 'CelestialBody', 'moon')
  const unknown = publicObject('unknown', 'unknown')

  expect(playerObjectMatchesTypeFilters(planet, [])).toBe(true)
  expect(playerObjectMatchesTypeFilters(unknown, [])).toBe(true)
  expect(playerObjectMatchesTypeFilters(planet, [mapObjectTypeKey(moon), mapObjectTypeKey(planet)])).toBe(true)
  expect(playerObjectMatchesTypeFilters(moon, [mapObjectTypeKey(planet)])).toBe(false)
  expect(playerObjectMatchesTypeFilters(unknown, [PLAYER_UNKNOWN_TYPE_KEY])).toBe(true)
  expect(playerObjectMatchesTypeFilters(unknown, [mapObjectTypeKey(planet)])).toBe(false)
})
