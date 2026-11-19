import { expect, test } from './fixtures'
import type { PlayerClusterDocument } from '../domain/player-projection'
import { continuousMapRoundedRectBoundaryPoint } from '../utils/continuous-map-route-geometry'
import { continuousSystemFrames } from '../utils/continuous-system-frames'
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
        fromPointId: 'object-1',
        destination: { kind: 'unknown', position: { x: 340, y: 120 }, label: 'Unknown destination' },
      },
    ],
  }
}

test('public route endpoints attach only to independently Revealed Jump Points at detail @pure', () => {
  const document = publicDocument()
  const systems = projectPlayerContinuousMap(document).systems
  const frames = continuousSystemFrames(systems.flatMap(system => system.geometry ? [{
    id: system.id,
    anchor: system.anchor,
    envelope: system.geometry.envelope,
  }] : []))
  const origin = systems[0]!
  const destination = systems[1]!
  const originMarker = document.systems[0]!
  const destinationMarker = document.systems[1]!
  const originPoint = origin.geometry!.objects[0]!.scenePosition
  const destinationPoint = destination.geometry!.objects[0]!.scenePosition
  const originEdge = (toward: { x: number; y: number }) =>
    continuousMapRoundedRectBoundaryPoint(origin.anchor, frames.get(origin.id)!, toward)
  const destinationEdge = (toward: { x: number; y: number }) =>
    continuousMapRoundedRectBoundaryPoint(destination.anchor, frames.get(destination.id)!, toward)
  const overview = projectPlayerContinuousRouteEndpoints(document, systems, new Set())
  const originDetailed = projectPlayerContinuousRouteEndpoints(document, systems, new Set(['system-1']))
  const bothDetailed = projectPlayerContinuousRouteEndpoints(document, systems, new Set(['system-1', 'system-2']))

  expect(overview[0]).toMatchObject({
    start: originMarker.position,
    end: destinationMarker.position,
    originLabel: 'North Aperture (Vesper)',
    destinationLabel: 'Sable Mouth (Morrow)',
  })
  expect(originDetailed[0]?.start).toEqual(originPoint)
  expect(originDetailed[0]?.end).toEqual(destinationMarker.position)
  expect(bothDetailed[0]).toMatchObject({
    start: originPoint,
    end: destinationPoint,
    originLabel: 'North Aperture (Vesper)',
    destinationLabel: 'Sable Mouth (Morrow)',
    accessibleLabel: 'Jump Level 3 from North Aperture (Vesper) to Sable Mouth (Morrow)',
  })

  const unassociatedDocument = publicDocument()
  unassociatedDocument.routes = [{
    id: 'unassociated',
    jumpLevel: 1,
    fromSystemId: 'system-1',
    destination: { kind: 'system', systemId: 'system-2' },
  }]
  const unassociated = projectPlayerContinuousRouteEndpoints(unassociatedDocument, systems, new Set())[0]
  expect(unassociated?.start).toEqual(originEdge(destination.anchor))
  expect(unassociated?.end).toEqual(destinationEdge(origin.anchor))
})

test('anonymous public destinations retain exact authorized geometry and generic labels @pure', () => {
  const document = publicDocument()
  const systems = projectPlayerContinuousMap(document).systems
  const origin = systems[0]!
  const originPoint = origin.geometry!.objects[0]!.scenePosition
  const unknownExit = document.routes[1]!.destination
  if (unknownExit.kind !== 'unknown') throw new Error('Fixture route must use an anonymous destination.')
  const overview = projectPlayerContinuousRouteEndpoints(
    document,
    systems,
    new Set(),
  )
  const originDetailed = projectPlayerContinuousRouteEndpoints(document, systems, new Set(['system-1']))

  expect(overview[1]).toMatchObject({
    start: document.systems[0]!.position,
    end: { x: 340, y: 120 },
    originLabel: 'North Aperture (Vesper)',
    destinationLabel: 'Unknown destination',
    destinationCaption: 'Unknown destination',
    accessibleLabel: 'Jump Level 2 from North Aperture (Vesper) to Unknown destination',
    unresolved: true,
  })
  expect(originDetailed[1]).toMatchObject({
    start: originPoint,
    end: { x: 340, y: 120 },
    unresolved: true,
  })
  expect(JSON.stringify(originDetailed[1])).not.toContain('stationId')
})

test('invalid public endpoint references fall back to the revealed system frame edge @pure', () => {
  const document = publicDocument()
  const origin = document.systems[0]
  if (origin?.disclosure !== 'revealed') throw new Error('Fixture origin must be Revealed.')
  const marker = origin.map.objects[0]
  if (marker?.disclosure !== 'revealed') throw new Error('Fixture marker must be Revealed.')
  origin.map.objects[0] = { ...marker, family: 'CelestialBody', subtype: 'planet' }
  const descriptors = projectPlayerContinuousRouteEndpoints(
    document,
    projectPlayerContinuousMap(document).systems,
    new Set(['system-1', 'system-2']),
  )
  const systems = projectPlayerContinuousMap(document).systems
  const routeOrigin = document.systems[0]!
  const frames = continuousSystemFrames(systems.flatMap(system => system.geometry ? [{
    id: system.id,
    anchor: system.anchor,
    envelope: system.geometry.envelope,
  }] : []))
  const destinationPoint = systems[1]!.geometry!.objects[0]!.scenePosition

  expect(descriptors[0]?.start).toEqual(continuousMapRoundedRectBoundaryPoint(
    routeOrigin.position,
    frames.get(routeOrigin.id)!,
    destinationPoint,
  ))
  expect(descriptors[0]?.originLabel).toBe('Vesper')
})

test('generic public system markers keep their authorized anchors without frame geometry @pure', () => {
  const document = publicDocument()
  const genericSystem = document.systems[1]
  if (!genericSystem) throw new Error('Fixture destination must exist.')
  document.systems[1] = {
    id: genericSystem.id,
    position: { ...genericSystem.position },
    disclosure: 'known-type',
    type: 'star-system',
    label: 'Star system',
  }
  document.routes = [
    {
      id: 'anonymous-endpoint',
      jumpLevel: 1,
      fromSystemId: 'system-1',
      fromPointId: null,
      destination: { kind: 'system', systemId: 'system-2' },
    },
  ]

  const systems = projectPlayerContinuousMap(document).systems
  const descriptor = projectPlayerContinuousRouteEndpoints(document, systems, new Set())[0]
  const marker = systems[1]!

  expect(marker).not.toHaveProperty('geometry')
  expect(descriptor?.end).toEqual(marker.anchor)
  const origin = systems[0]!
  expect(descriptor?.start).toEqual(continuousMapRoundedRectBoundaryPoint(
    origin.anchor,
    continuousSystemFrames(systems.flatMap(system => system.geometry ? [{
      id: system.id,
      anchor: system.anchor,
      envelope: system.geometry.envelope,
    }] : [])).get(origin.id)!,
    marker.anchor,
  ))
})
