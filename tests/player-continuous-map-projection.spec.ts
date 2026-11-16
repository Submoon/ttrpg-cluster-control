import { expect, test } from './fixtures'
import { playerContinuousDetailSystemIds, projectPlayerContinuousMap } from '../utils/player-continuous-map-projection'
import type { PlayerClusterDocument } from '../domain/player-projection'

function publicDocument(): PlayerClusterDocument {
  return {
    format: 'ttrpg-cluster-control-player',
    version: 1,
    title: 'Pilgrim Reach',
    systems: [
      {
        id: 'system-1',
        position: { x: 100, y: 120 },
        disclosure: 'unknown',
        label: 'Unknown presence',
      },
      {
        id: 'system-2',
        position: { x: 500, y: 300 },
        disclosure: 'known-type',
        type: 'star-system',
        label: 'Star system',
      },
      {
        id: 'system-3',
        position: { x: 900, y: 500 },
        disclosure: 'revealed',
        type: 'star-system',
        label: 'Vesper',
        map: {
          objects: [{
            id: 'object-1',
            position: { x: 280, y: 200 },
            placement: { kind: 'system' },
            disclosure: 'revealed',
            family: 'CelestialBody',
            subtype: 'planet',
            label: 'Pilgrim World',
            playerText: '',
            fields: [],
          }],
          orbits: [{
            id: 'orbit-1',
            hostId: null,
            center: { x: 260, y: 240 },
            radii: { horizontal: 90, vertical: 40 },
            rotation: 30,
          }],
        },
      },
      {
        id: 'system-4',
        position: { x: 1300, y: 750 },
        disclosure: 'revealed',
        type: 'star-system',
        label: 'Empty Reach',
        map: { objects: [], orbits: [] },
      },
    ],
    routes: [
      { id: 'route-1', jumpLevel: 2, fromSystemId: 'system-2', destination: { kind: 'system', systemId: 'system-3' } },
      {
        id: 'route-2',
        jumpLevel: 4,
        fromSystemId: 'system-3',
        destination: { kind: 'unknown', position: { x: 1180, y: 530 }, label: 'Unknown destination' },
      },
    ],
  }
}

test('player continuous geometry keeps generic anchors and projects only public interior geometry @pure', () => {
  const projection = projectPlayerContinuousMap(publicDocument())

  expect(projection.systems).toHaveLength(4)
  expect(projection.systems[0]).toMatchObject({ id: 'system-1', disclosure: 'unknown', anchor: { x: 100, y: 120 } })
  expect(projection.systems[1]).toMatchObject({ id: 'system-2', disclosure: 'known-type', anchor: { x: 500, y: 300 } })
  expect(projection.systems[0]?.geometry).toBeUndefined()
  expect(projection.systems[1]?.geometry).toBeUndefined()

  const revealed = projection.systems[2]
  expect(revealed?.geometry?.objects[0]).toMatchObject({
    id: 'object-1',
    name: 'Pilgrim World',
    position: { x: 280, y: 200 },
    scenePosition: { x: 860, y: 484 },
    locationKey: '',
  })
  expect(revealed?.geometry?.orbits[0]).toMatchObject({
    id: 'orbit-1',
    sceneCenter: { x: 856, y: 492 },
    sceneRadii: { horizontal: 18, vertical: 8 },
    rotation: 30,
  })
  expect(revealed?.geometry?.envelope).toEqual(expect.objectContaining({ width: expect.any(Number), height: expect.any(Number) }))
  expect(projection.systems[3]?.geometry?.envelope.width).toBeGreaterThanOrEqual(120)
  expect(projection.systems[3]?.geometry?.envelope.height).toBeGreaterThanOrEqual(88)
  expect(projection.bounds.x).toBeLessThan(100)
  expect(projection.bounds.y).toBeLessThan(120)
  expect(projection.bounds.x + projection.bounds.width).toBeGreaterThan(1300)
  expect(projection.routes.map(route => route.id)).toEqual(['route-1', 'route-2'])
})

test('player continuous bounds and camera inputs ignore data outside the detached public document @pure', () => {
  const publicProjection = projectPlayerContinuousMap(publicDocument())
  const extendedInput = {
    ...publicDocument(),
    privateSystems: [{ position: { x: 900_000_000, y: -900_000_000 } }],
    privateBounds: { width: 1_000_000_000, height: 1_000_000_000 },
  }
  const extendedProjection = projectPlayerContinuousMap(extendedInput)

  expect(extendedProjection.bounds).toEqual(publicProjection.bounds)
  expect(JSON.parse(JSON.stringify(extendedProjection.systems))).toEqual(JSON.parse(JSON.stringify(publicProjection.systems)))
})

test('player system detail uses independent public envelope thresholds with collapse hysteresis @pure', () => {
  const projection = projectPlayerContinuousMap(publicDocument())
  const fitDetail = playerContinuousDetailSystemIds(projection.systems, 1, new Set())
  const revealedDetail = playerContinuousDetailSystemIds(projection.systems, 2.5, new Set())
  const retainedDetail = playerContinuousDetailSystemIds(projection.systems, 1.58, new Set(['system-3']))
  const collapsedDetail = playerContinuousDetailSystemIds(projection.systems, 1.58, new Set())

  expect(fitDetail).not.toContain('system-3')
  expect(revealedDetail).toContain('system-3')
  expect(retainedDetail).toContain('system-3')
  expect(collapsedDetail).not.toContain('system-3')
  expect(revealedDetail).not.toContain('system-1')
  expect(revealedDetail).not.toContain('system-2')
})
