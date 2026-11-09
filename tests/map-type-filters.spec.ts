import { expect, test } from '@playwright/test'
import { mapObjectTypeOption } from '../utils/map-type-filters'

test('type filter choices distinguish catalogue types and exact custom Other names @pure', () => {
  const planet = mapObjectTypeOption({ family: 'CelestialBody', subtype: 'planet' })
  const customPlanet = mapObjectTypeOption({ family: 'Other', subtype: 'Planet' })
  const relay = mapObjectTypeOption({ family: 'Other', subtype: 'Relay' })
  const lowerCaseRelay = mapObjectTypeOption({ family: 'Other', subtype: 'relay' })

  expect(planet.label).toBe('Planet')
  expect(customPlanet.label).toBe('Planet (Other)')
  expect(new Set([planet.value, customPlanet.value, relay.value, lowerCaseRelay.value]).size).toBe(4)
})
