import { expect, test } from '@playwright/test'
import type { PlayerClusterDocument, PlayerSystemDocument } from '../domain/player-projection'
import { playerClusterGeometry } from '../utils/player-cluster-geometry'
import { playerSystemGeometry } from '../utils/player-system-geometry'

function crowdedPublicCluster(): PlayerClusterDocument {
  return {
    format: 'ttrpg-cluster-control-player',
    version: 1,
    title: 'Public Cluster',
    systems: [{
      id: 'system-1',
      position: { x: 0, y: 0 },
      disclosure: 'revealed',
      type: 'star-system',
      label: 'Aster',
      map: { objects: [], orbits: [] },
    }],
    routes: Array.from({ length: 512 }, (_, index) => ({
      id: `route-${index + 1}`,
      jumpLevel: (index % 9) + 1,
      fromSystemId: 'system-1',
      destination: { kind: 'system' as const, systemId: 'system-1' },
    })),
  }
}

test('player route labels use a finite deterministic fallback and extend exported bounds @pure', { tag: '@pure' }, () => {
  const document = crowdedPublicCluster()
  const geometry = playerClusterGeometry(document)
  const repeatedGeometry = playerClusterGeometry(document)
  const lastRoute = geometry.routes.at(-1)

  expect(geometry.routes).toHaveLength(512)
  expect(geometry.routes.map(route => [route.labelX, route.labelY]))
    .toEqual(repeatedGeometry.routes.map(route => [route.labelX, route.labelY]))
  expect(geometry.routes.every(route => Number.isFinite(route.labelX) && Number.isFinite(route.labelY))).toBe(true)
  expect(lastRoute?.labelX).toBeGreaterThan(1000)
  expect(geometry.bounds.minX + geometry.bounds.width)
    .toBeGreaterThanOrEqual((lastRoute?.labelX ?? 0) + (lastRoute?.labelWidth ?? 0) / 2)
  expect(Number.isFinite(geometry.bounds.width) && Number.isFinite(geometry.bounds.height)).toBe(true)
})

test('player system bounds include rotated Orbits and public object labels @pure', { tag: '@pure' }, () => {
  const document: PlayerSystemDocument = {
    objects: [{
      id: 'object-1',
      position: { x: 120, y: 230 },
      placement: { kind: 'system' },
      disclosure: 'revealed',
      family: 'CelestialBody',
      subtype: 'planet',
      label: 'Long World Name',
      playerText: '',
      fields: [],
    }],
    orbits: [{
      id: 'orbit-1',
      hostId: null,
      center: { x: -140, y: 40 },
      radii: { horizontal: 64, vertical: 30 },
      rotation: 37,
    }],
  }

  const { bounds } = playerSystemGeometry(document)
  const radians = 37 * Math.PI / 180
  const rotatedExtentX = Math.sqrt(64 ** 2 * Math.cos(37 * Math.PI / 180) ** 2
    + 30 ** 2 * Math.sin(37 * Math.PI / 180) ** 2)
  const rotatedExtentY = Math.sqrt(64 ** 2 * Math.sin(radians) ** 2 + 30 ** 2 * Math.cos(radians) ** 2)

  expect(bounds.left).toBeLessThan(-140 - rotatedExtentX)
  expect(bounds.left + bounds.width).toBeGreaterThan(120 + 16 + 'Long World Name'.length * 18)
  expect(bounds.top).toBeLessThan(40 - rotatedExtentY)
  expect(bounds.top + bounds.height).toBeGreaterThan(230 + 12)
})

test('player image bounds include typed glyph ink without the larger live hit envelope @pure', { tag: '@pure' }, () => {
  const document: PlayerSystemDocument = {
    objects: [{
      id: 'public-object',
      position: { x: 0, y: 0 },
      placement: { kind: 'system' },
      disclosure: 'revealed',
      family: 'CelestialBody',
      subtype: 'star',
      label: 'A',
      playerText: '',
      fields: [],
    }],
    orbits: [],
  }

  expect(playerSystemGeometry(document).bounds).toEqual({
    left: -60,
    top: -64,
    width: 142,
    height: 124,
  })
})
