import { expect, test } from './fixtures'
import type { PlayerObjectMarker } from '../domain/player-projection'
import { playerObjectPresentation } from '../utils/player-object-presentation'
import { playerSystemGeometry } from '../utils/player-system-geometry'

test('public object labels identify disclosed types without restoring private names @pure', { tag: '@pure' }, () => {
  const unknown: PlayerObjectMarker = {
    id: 'object-unknown',
    position: { x: 0, y: 0 },
    placement: { kind: 'system' },
    disclosure: 'unknown',
    label: 'Unknown presence',
  }
  const knownJumpPoint: PlayerObjectMarker = {
    id: 'object-known-jump-point',
    position: { x: 0, y: 0 },
    placement: { kind: 'system' },
    disclosure: 'known-type',
    family: 'JumpPoint',
    subtype: 'jump-point',
    label: 'Jump Point',
  }
  const customType: PlayerObjectMarker = {
    id: 'object-custom-type',
    position: { x: 0, y: 0 },
    placement: { kind: 'system' },
    disclosure: 'known-type',
    family: 'Other',
    subtype: 'NASA Relay',
    label: 'NASA Relay',
  }
  const revealed: PlayerObjectMarker = {
    id: 'object-revealed',
    position: { x: 0, y: 0 },
    placement: { kind: 'system' },
    disclosure: 'revealed',
    family: 'CelestialBody',
    subtype: 'planet',
    label: 'Aurelia',
    playerText: '',
    fields: [],
  }

  expect(playerObjectPresentation(unknown)).toMatchObject({
    label: 'Unknown presence',
    typeLabel: null,
    disclosureLabel: 'Unknown presence',
  })
  expect(playerObjectPresentation(knownJumpPoint)).toMatchObject({
    label: 'Unknown jump point',
    typeLabel: 'Jump Point',
    disclosureLabel: 'Known type',
  })
  expect(playerObjectPresentation(customType)).toMatchObject({
    label: 'Unknown NASA Relay',
    typeLabel: 'NASA Relay',
    disclosureLabel: 'Known type',
  })
  expect(playerObjectPresentation(revealed)).toMatchObject({
    label: 'Aurelia',
    typeLabel: 'Planet',
    disclosureLabel: 'Revealed',
  })
})

test('player system bounds include generic labels for Unknown presence objects @pure', { tag: '@pure' }, () => {
  const document = {
    objects: [{
      id: 'object-unknown',
      position: { x: 0, y: 0 },
      placement: { kind: 'system' as const },
      disclosure: 'unknown' as const,
      label: 'Unknown presence' as const,
    }],
    orbits: [],
  }

  const { bounds } = playerSystemGeometry(document)
  expect(bounds.left + bounds.width).toBeGreaterThanOrEqual(
    16 + 'Unknown presence'.length * 18 + 48,
  )
})
