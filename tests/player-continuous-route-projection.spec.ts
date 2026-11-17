import { expect, test } from './fixtures'
import type { PlayerClusterDocument } from '../domain/player-projection'
import { projectPlayerContinuousMap } from '../utils/player-continuous-map-projection'
import { projectPlayerContinuousRouteEndpoints } from '../utils/player-continuous-route-projection'

function publicDocument(): PlayerClusterDocument {
  return {
    format: 'ttrpg-cluster-control-player',
    version: 2,
    title: 'Pilgrim Reach',
    systems: [
      {
        id: 'system-1',
        position: { x: 100, y: 200 },
        disclosure: 'revealed',
        type: 'star-system',
        label: 'Vesper',
        map: {
          objects: [{
            id: 'object-1',
            position: { x: 280, y: 200 },
            placement: { kind: 'system' },
            disclosure: 'revealed',
            family: 'JumpPoint',
            subtype: 'jump-point',
            label: 'North Aperture',
            playerText: '',
            fields: [],
          }],
          orbits: [],
        },
      },
      {
        id: 'system-2',
        position: { x: 700, y: 420 },
        disclosure: 'revealed',
        type: 'star-system',
        label: 'Morrow',
        map: {
          objects: [{
            id: 'object-2',
            position: { x: 680, y: 210 },
            placement: { kind: 'system' },
            disclosure: 'revealed',
            family: 'JumpPoint',
            subtype: 'jump-point',
            label: 'Sable Mouth',
            playerText: '',
            fields: [],
          }],
          orbits: [],
        },
      },
    ],
    routes: [
      {
        id: 'route-1',
        jumpLevel: 3,
        fromSystemId: 'system-1',
        fromPointId: 'object-1',
        destination: { kind: 'system', systemId: 'system-2', pointId: 'object-2' },
      },
      {
        id: 'route-2',
        jumpLevel: 2,
        fromSystemId: 'system-1',
        destination: { kind: 'unknown', position: { x: 340, y: 120 }, label: 'Unknown destination' },
      },
    ],
  }
}

test('public route endpoints attach only to independently Revealed Jump Points at detail @pure', () => {
  const document = publicDocument()
  const systems = projectPlayerContinuousMap(document).systems
  const overview = projectPlayerContinuousRouteEndpoints(document, systems, new Set())
  const originDetailed = projectPlayerContinuousRouteEndpoints(document, systems, new Set(['system-1']))
  const bothDetailed = projectPlayerContinuousRouteEndpoints(document, systems, new Set(['system-1', 'system-2']))

  expect(overview[0]).toMatchObject({
    start: { x: 100, y: 200 },
    end: { x: 700, y: 420 },
    originLabel: 'North Aperture (Vesper)',
    destinationLabel: 'Sable Mouth (Morrow)',
  })
  expect(originDetailed[0]?.start).toEqual({ x: 60, y: 184 })
  expect(originDetailed[0]?.end).toEqual({ x: 700, y: 420 })
  expect(bothDetailed[0]).toMatchObject({
    start: { x: 60, y: 184 },
    end: { x: 740, y: 406 },
    originLabel: 'North Aperture (Vesper)',
    destinationLabel: 'Sable Mouth (Morrow)',
    accessibleLabel: 'Jump Level 3 from North Aperture (Vesper) to Sable Mouth (Morrow)',
  })
})

test('anonymous public destinations retain exact authorized geometry and generic labels @pure', () => {
  const document = publicDocument()
  const descriptors = projectPlayerContinuousRouteEndpoints(
    document,
    projectPlayerContinuousMap(document).systems,
    new Set(['system-1']),
  )

  expect(descriptors[1]).toMatchObject({
    start: { x: 100, y: 200 },
    end: { x: 340, y: 120 },
    originLabel: 'Vesper',
    destinationLabel: 'Unknown destination',
    destinationCaption: 'Unknown destination',
    accessibleLabel: 'Jump Level 2 from Vesper to Unknown destination',
    unresolved: true,
  })
  expect(JSON.stringify(descriptors)).not.toContain('stationId')
})

test('invalid public endpoint references fail closed to the revealed system anchor @pure', () => {
  const document = publicDocument()
  const origin = document.systems[0]
  if (origin?.disclosure !== 'revealed') throw new Error('Fixture origin must be Revealed.')
  origin.map.objects[0]!.family = 'CelestialBody'
  const descriptors = projectPlayerContinuousRouteEndpoints(
    document,
    projectPlayerContinuousMap(document).systems,
    new Set(['system-1', 'system-2']),
  )

  expect(descriptors[0]?.start).toEqual(origin.position)
  expect(descriptors[0]?.originLabel).toBe('Vesper')
})
