import { createWorkspaceWithPrimaryStar } from './support/primary-star-fixture'
import { expect, test } from '@playwright/test'
import { createOrbit } from '../domain/workspace'
import { creationCandidatesAtPoint, objectPositions, orbitPointAtAngle } from '../utils/system-map-geometry'
import {
  createContinuousObjectAddRequestLease,
  resolveContinuousObjectOwnerIds,
  resolveContinuousObjectOwnerResolution,
  selectContinuousObjectAddCandidate,
  continuousOrbitAddKeyboardPoint,
} from '../utils/continuous-map-editing'
import { continuousObjectDragTarget, hasMapDragThreshold } from '../utils/continuous-object-drag'

const systems = [
  { id: 'vesper', envelope: { x: 0, y: 0, width: 100, height: 100 } },
  { id: 'altair', envelope: { x: 200, y: 0, width: 100, height: 100 } },
]

test('a definite map hit owns an Add click before envelope inference @pure', () => {
  expect(resolveContinuousObjectOwnerIds({ x: 250, y: 50 }, systems, 'vesper')).toEqual(['vesper'])
  expect(resolveContinuousObjectOwnerResolution({ x: 250, y: 50 }, systems, 'vesper')).toEqual({
    systemIds: ['vesper'],
    requiresOwnerChoice: false,
  })
})

test('a unique envelope owns an Add click, while overlap and outside require an owner choice @pure', () => {
  expect(resolveContinuousObjectOwnerIds({ x: 50, y: 50 }, systems)).toEqual(['vesper'])
  const overlap = [systems[0]!, { id: 'altair', envelope: { x: 50, y: 20, width: 100, height: 100 } }]
  expect(resolveContinuousObjectOwnerIds({ x: 75, y: 50 }, overlap)).toEqual(['vesper', 'altair'])
  expect(resolveContinuousObjectOwnerIds({ x: 150, y: 150 }, systems)).toEqual(['vesper', 'altair'])
})

test('outside-space Add still asks for an owner when the workspace has one system @pure', () => {
  expect(resolveContinuousObjectOwnerResolution({ x: 500, y: 500 }, [systems[0]!])).toEqual({
    systemIds: ['vesper'],
    requiresOwnerChoice: true,
  })
})

test('a pinned Add owner remains selected even when the next point overlaps another envelope @pure', () => {
  const overlap = [systems[0]!, { id: 'altair', envelope: { x: 50, y: 20, width: 100, height: 100 } }]
  expect(resolveContinuousObjectOwnerResolution({ x: 75, y: 50 }, overlap, 'vesper')).toEqual({
    systemIds: ['vesper'],
    requiresOwnerChoice: false,
  })
})

test('an occupied object hit can use its nearest legal Orbit candidate @pure', () => {
  const orbit = {
    key: 'orbit:outer',
    label: 'Outer Orbit',
    target: { kind: 'orbit' as const, orbitId: 'outer', angle: 0.4 },
    error: null,
  }
  const occupied = {
    key: 'occupied:planet',
    label: 'Object mark: Planet',
    target: { kind: 'host' as const, objectId: 'planet' },
    error: 'Planet already occupies this mark.',
  }
  expect(selectContinuousObjectAddCandidate([orbit, occupied], { kind: 'object', id: 'planet' }))
    .toEqual({ candidate: orbit, error: null })
  expect(selectContinuousObjectAddCandidate([occupied], { kind: 'object', id: 'planet' }))
    .toEqual({ error: 'This object mark is occupied. Choose an Orbit or clear map position.' })
  const innerOrbit = { ...orbit, target: { ...orbit.target, orbitId: 'inner' } }
  expect(selectContinuousObjectAddCandidate([orbit, innerOrbit], { kind: 'orbit', id: 'inner' }))
    .toEqual({ candidate: innerOrbit, error: null })
})

test('keyboard Add on an Orbit chooses a point on its rotated ring @pure', () => {
  expect(continuousOrbitAddKeyboardPoint({
    sceneCenter: { x: 200, y: 100 },
    sceneRadii: { horizontal: 40, vertical: 20 },
    rotation: 90,
  }, { x: 12, y: -5 })).toEqual({ x: 212, y: 135 })
})

test('a collapsed system cannot attach Add to a hidden Orbit but keeps occupied marks blocked @pure', () => {
  const workspace = createWorkspaceWithPrimaryStar('Kestrel Reach', 'Vesper')
  const source = workspace.cluster.systems[0]!
  const star = source.objects[0]!
  const orbit = createOrbit(source, star.id)
  const system = { ...source, orbits: [orbit] }
  const geometry = {
    objectAngles: {},
    orbitRadii: { [orbit.id]: { horizontal: 100, vertical: 100 } },
    orbitRotations: {},
  }
  const starPoint = objectPositions(system, geometry).get(star.id)!
  const ringPoint = orbitPointAtAngle(starPoint, geometry.orbitRadii[orbit.id]!, 0, 0)

  expect(creationCandidatesAtPoint(system, ringPoint, { kind: 'object', subtype: 'planet' }, geometry)
    .map(candidate => candidate.target.kind)).toContain('orbit')
  expect(creationCandidatesAtPoint(system, ringPoint, { kind: 'object', subtype: 'planet' }, geometry, false)
    .map(candidate => candidate.target.kind)).toEqual(['free'])
  expect(creationCandidatesAtPoint(system, starPoint, { kind: 'object', subtype: 'planet' }, geometry, false)[0])
    .toMatchObject({ target: { kind: 'host', objectId: star.id }, error: expect.any(String) })
})

test('object Add can place beside a mark when the visible hit radius is smaller than the legacy clearance @pure', () => {
  const system = createWorkspaceWithPrimaryStar('Kestrel Reach', 'Vesper').cluster.systems[0]!
  const star = system.objects[0]!
  const geometry = { objectAngles: {}, orbitRadii: {}, orbitRotations: {} }
  const center = objectPositions(system, geometry).get(star.id)!
  const type = { kind: 'object', subtype: 'planet' } as const
  const hitRadius = 12

  const clear = { x: center.x + 30, y: center.y }
  expect(creationCandidatesAtPoint(system, clear, type, geometry, true, hitRadius))
    .toMatchObject([{ target: { kind: 'free' }, error: null }])
  expect(creationCandidatesAtPoint(system, { x: center.x + 8, y: center.y }, type, geometry, true, hitRadius))
    .toMatchObject([{ target: { kind: 'host', objectId: star.id }, error: expect.any(String) }])
})

test('an overview Orbit Add offers a free center near a hidden host and checks detached Orbit spacing @pure', () => {
  const workspace = createWorkspaceWithPrimaryStar('Kestrel Reach', 'Vesper')
  const system = workspace.cluster.systems[0]!
  const star = system.objects[0]!
  const anchor = { x: 480, y: 280 }
  const geometry = { objectAngles: {}, orbitRadii: {}, orbitRotations: {} }
  const type = { kind: 'orbit' } as const

  expect(creationCandidatesAtPoint(system, anchor, type, geometry)).toMatchObject([
    { target: { kind: 'host', objectId: star.id }, error: null },
  ])
  expect(creationCandidatesAtPoint(system, anchor, type, geometry, false)).toMatchObject([
    { target: { kind: 'free', point: { x: 0.5, y: 0.5 } }, error: null },
  ])

  const detached = { ...createOrbit(system, null), hostId: null, center: { x: 0.5, y: 0.5 } }
  expect(creationCandidatesAtPoint({ ...system, orbits: [detached] }, anchor, type, geometry, false)).toMatchObject([
    { target: { kind: 'free' }, error: expect.stringContaining('too close') },
  ])
})

test('clearing an older Add request cannot cancel a newer Add operation @pure', () => {
  const lease = createContinuousObjectAddRequestLease<string>()
  const older = lease.capture('planet')
  const newer = lease.capture('moon')

  expect(lease.clear(older)).toBe(false)
  expect(lease.isCurrent(newer)).toBe(true)
  expect(lease.clear(newer)).toBe(true)
  expect(lease.isCurrent(newer)).toBe(false)
})

test('continuous Move preserves the off-center grab point and uses a client-pixel threshold @pure', () => {
  const projection = {
    unprojectLocalPoint: (point: { x: number; y: number }) => ({
      x: (point.x - 100) / 0.2,
      y: (point.y - 60) / 0.2,
    }),
  }
  const anchorDelta = { x: 12, y: -8 }
  const pointerStart = { x: 100 + 500 * 0.2 + anchorDelta.x, y: 60 + 280 * 0.2 + anchorDelta.y }
  const pointerCurrent = { x: pointerStart.x + 2, y: pointerStart.y + 1 }

  expect(continuousObjectDragTarget(projection, anchorDelta, { x: 560, y: 315 }, pointerStart, pointerCurrent))
    .toEqual({ x: 570, y: 320 })
  expect(hasMapDragThreshold({ x: 100, y: 100 }, { x: 103.9, y: 100 })).toBe(false)
  expect(hasMapDragThreshold({ x: 100, y: 100 }, { x: 104, y: 100 })).toBe(true)
})
