import { expect, test } from '@playwright/test'
import type { PlayerClusterDocument, PlayerSystemDocument } from '../domain/player-projection'
import { playerClusterGeometry } from '../utils/player-cluster-geometry'
import { playerSystemGeometry } from '../utils/player-system-geometry'
import {
  CLUSTER_SYSTEM_CARD,
  PLAYER_CLUSTER_SYSTEM_CARD,
  PLAYER_CLUSTER_SYSTEM_CARD_NAME_POSITION,
  PLAYER_CLUSTER_SYSTEM_SEAL,
  PLAYER_CLUSTER_UNKNOWN_MARKER_RADIUS,
  playerClusterSystemMarkerBounds,
  playerClusterSystemMarkerVisibleBounds,
} from '../utils/cluster-system-presentation'

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

test('public cluster cards are compact while Warden and Unknown footprints stay unchanged @pure', { tag: '@pure' }, () => {
  expect(CLUSTER_SYSTEM_CARD).toMatchObject({ x: -78, y: -38, width: 156, height: 76, cornerRadius: 4 })
  expect(PLAYER_CLUSTER_SYSTEM_CARD).toMatchObject({ x: -60, y: -22, width: 120, height: 44, cornerRadius: 4 })
  expect(PLAYER_CLUSTER_SYSTEM_SEAL).toMatchObject({ x: -46, y: -14, radius: 3 })
  expect(PLAYER_CLUSTER_SYSTEM_CARD_NAME_POSITION).toEqual({ x: 0, y: 5 })
  expect(PLAYER_CLUSTER_UNKNOWN_MARKER_RADIUS).toBe(18)
  expect(playerClusterSystemMarkerBounds({ x: 0, y: 0 }, false)).toEqual({
    left: -18,
    top: -18,
    right: 18,
    bottom: 18,
  })
  expect(playerClusterSystemMarkerBounds({ x: 0, y: 0 }, true)).toEqual({
    left: -60,
    top: -22,
    right: 60,
    bottom: 22,
  })
  const wideTitle = playerClusterSystemMarkerVisibleBounds({ x: 0, y: 0 }, true, 'A'.repeat(80))
  expect(wideTitle.right - wideTitle.left).toBeGreaterThanOrEqual(80 * 14)

  const document: PlayerClusterDocument = {
    format: 'ttrpg-cluster-control-player',
    version: 1,
    title: 'Public Reach',
    systems: [
      { id: 'system-1', position: { x: 0, y: 0 }, disclosure: 'unknown', label: 'Unknown presence' },
      {
        id: 'system-2',
        position: { x: 300, y: 0 },
        disclosure: 'revealed',
        type: 'star-system',
        label: 'Aster',
        map: { objects: [], orbits: [] },
      },
    ],
    routes: [{
      id: 'route-1',
      jumpLevel: 1,
      fromSystemId: 'system-1',
      destination: { kind: 'system', systemId: 'system-2' },
    }],
  }
  const geometry = playerClusterGeometry(document)

  expect(geometry.routes[0]?.path).toBe('M 18 0 Q 129 32 240 0')
  expect(geometry.routes[0]?.label).toBe('Jump-1')
  expect(geometry.routes[0]?.labelWidth).toBe(78)
  expect(geometry.routes[0]?.accessibleLabel).toBe('Jump Level 1 from Unknown presence to Aster')
  expect(geometry.bounds.minX).toBeLessThan(-18)
  expect(geometry.bounds.minY).toBeLessThan(-22)
  expect(geometry.bounds.minX + geometry.bounds.width).toBeGreaterThan(360)
  expect(geometry.bounds.minY + geometry.bounds.height).toBeGreaterThan(22)

  const selfRoute = playerClusterGeometry({
    ...document,
    systems: [document.systems[1]!],
    routes: [{
      id: 'self-route',
      jumpLevel: 1,
      fromSystemId: 'system-2',
      destination: { kind: 'system', systemId: 'system-2' },
    }],
  }).routes[0]
  expect(selfRoute?.path).toBe('M 254 -22 Q 300 -82 346 -22')
})

test('only routes occluded by overlapping endpoints or a covered Unknown destination use foreground paint @pure', { tag: '@pure' }, () => {
  const system = (id: string, x: number): PlayerClusterDocument['systems'][number] => ({
    id,
    position: { x, y: 0 },
    disclosure: 'revealed',
    type: 'star-system',
    label: id,
    map: { objects: [], orbits: [] },
  })
  const sharedRoute = {
    id: 'route-shared',
    jumpLevel: 1,
    fromSystemId: 'system-1',
    destination: { kind: 'system' as const, systemId: 'system-2' },
  }
  const cluster = (systems: PlayerClusterDocument['systems'], routes: PlayerClusterDocument['routes']): PlayerClusterDocument => ({
    format: 'ttrpg-cluster-control-player',
    version: 1,
    title: 'Public Reach',
    systems,
    routes,
  })

  const overlapping = playerClusterGeometry(cluster([system('system-1', 0), system('system-2', 100)], [sharedRoute]))
  const ordinary = playerClusterGeometry(cluster([system('system-1', 0), system('system-2', 300)], [sharedRoute]))
  const coveredExit = playerClusterGeometry(cluster(
    [
      { id: 'system-1', position: { x: 0, y: 0 }, disclosure: 'unknown', label: 'Unknown presence' },
      system('system-2', 300),
    ],
    [{
      id: 'route-exit',
      jumpLevel: 1,
      fromSystemId: 'system-1',
      destination: { kind: 'unknown', position: { x: 240, y: 0 }, label: 'Unknown destination' },
    }],
  ))
  const clippedEndpointExit = playerClusterGeometry(cluster(
    [
      system('system-cover', 0),
      { id: 'system-origin', position: { x: 300, y: 100 }, disclosure: 'unknown', label: 'Unknown presence' },
    ],
    [{
      id: 'route-clipped-endpoint',
      jumpLevel: 1,
      fromSystemId: 'system-origin',
      destination: { kind: 'unknown', position: { x: 61, y: 0 }, label: 'Unknown destination' },
    }],
  ))

  expect(overlapping.routes[0]?.foreground).toBe(true)
  expect(ordinary.routes[0]?.foreground).toBe(false)
  expect(coveredExit.routes[0]?.foreground).toBe(true)
  expect(clippedEndpointExit.routes[0]?.foreground).toBe(true)
  expect(coveredExit.routes[0]?.label).toBe('Jump-1')
  expect(coveredExit.routes[0]?.accessibleLabel).toBe('Jump Level 1 to Unknown destination')
  expect(coveredExit.routes[0]?.destination).toMatchObject({
    position: { x: 240, y: 0 },
    label: 'Unknown destination',
  })
})

test('unresolved destination captions mirror around a covering card or paint in foreground when both sides are covered @pure', { tag: '@pure' }, () => {
  const system = (id: string, x: number, y: number): PlayerClusterDocument['systems'][number] => ({
    id,
    position: { x, y },
    disclosure: 'revealed',
    type: 'star-system',
    label: id,
    map: { objects: [], orbits: [] },
  })
  const document = (cards: PlayerClusterDocument['systems']): PlayerClusterDocument => ({
    format: 'ttrpg-cluster-control-player',
    version: 1,
    title: 'Caption Reach',
    systems: [system('system-1', 0, 0), ...cards],
    routes: [{
      id: 'route-exit',
      jumpLevel: 1,
      fromSystemId: 'system-1',
      destination: { kind: 'unknown', position: { x: 300, y: 0 }, label: 'Unknown destination' },
    }],
  })

  const mirroredCaption = playerClusterGeometry(document([system('system-2', 220, 54)])).routes[0]
  expect(mirroredCaption?.destination).toMatchObject({
    position: { x: 300, y: 0 },
    label: 'Unknown destination',
    labelX: 290,
    labelY: -54,
  })
  expect(mirroredCaption?.foreground).toBe(false)

  const foregroundCaption = playerClusterGeometry(document([
    system('system-2', 220, 54),
    system('system-3', 220, -54),
  ])).routes[0]
  expect(foregroundCaption?.destination).toMatchObject({ label: 'Unknown destination', labelY: 54 })
  expect(foregroundCaption?.foreground).toBe(true)
})

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
