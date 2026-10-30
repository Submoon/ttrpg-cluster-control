import { expect, test } from './fixtures'
import type { Orbit, StarSystem, SystemObject } from '../domain/workspace'
import type { SystemMapGeometry } from '../utils/system-map-geometry'
import { measureSystemObjectBranchBounds, resolveSystemObjectBranch } from '../utils/system-object-branch'

function object(
  id: string,
  subtype: SystemObject['subtype'],
  placement: SystemObject['placement'],
  jumpStationId?: string,
): SystemObject {
  const families: Record<SystemObject['subtype'], SystemObject['family']> = {
    star: 'CelestialBody',
    planet: 'CelestialBody',
    moon: 'CelestialBody',
    asteroid: 'SmallBody/Field',
    belt: 'SmallBody/Field',
    station: 'Installation',
    base: 'Installation',
    colony: 'Installation',
    vessel: 'Vessel',
    derelict: 'Vessel',
    'jump-point': 'JumpPoint',
    anomaly: 'Phenomenon',
    nebula: 'Phenomenon',
    hazard: 'Phenomenon',
    other: 'Other',
  }
  const family = families[subtype]
  if (!family) throw new Error(`The branch fixture has no family for ${subtype}.`)
  return {
    id,
    family,
    subtype,
    locationKey: `KEY-${id}`,
    name: id,
    description: '',
    placement,
    ...(jumpStationId ? { jumpStationId } : {}),
  }
}

function hostedOrbit(id: string, hostId: string): Orbit {
  return { id, hostId, order: 1 }
}

test('an object branch follows hosted Orbits and excludes parents, siblings, Station references and routes @pure', () => {
  const parent = object('parent', 'star', { kind: 'system', x: 0.5, y: 0.5 })
  const station = object('station', 'station', { kind: 'system', x: 0.2, y: 0.2 })
  const target = object('target', 'jump-point', { kind: 'orbit', orbitId: 'parent-ring' }, station.id)
  const sibling = object('sibling', 'planet', { kind: 'orbit', orbitId: 'parent-ring' })
  const nested = object('nested', 'moon', { kind: 'orbit', orbitId: 'target-ring' })
  const leaf = object('leaf', 'base', { kind: 'orbit', orbitId: 'nested-ring' })
  const system: StarSystem = {
    id: 'system',
    name: 'Branch System',
    objects: [parent, station, target, sibling, nested, leaf],
    orbits: [
      hostedOrbit('parent-ring', parent.id),
      hostedOrbit('target-ring', target.id),
      hostedOrbit('nested-ring', nested.id),
    ],
  }

  expect(resolveSystemObjectBranch(system, target.id)).toEqual({
    objectIds: ['target', 'nested', 'leaf'],
    orbitIds: ['target-ring', 'nested-ring'],
  })
  expect(resolveSystemObjectBranch(system, 'missing')).toBeUndefined()
})

test('a malformed hosted cycle is visited once per object and Orbit @pure', () => {
  const target = object('target', 'planet', { kind: 'orbit', orbitId: 'nested-ring' })
  const child = object('child', 'moon', { kind: 'orbit', orbitId: 'target-ring' })
  const system: StarSystem = {
    id: 'system',
    name: 'Branch System',
    objects: [target, child],
    orbits: [hostedOrbit('target-ring', target.id), hostedOrbit('nested-ring', child.id)],
  }

  expect(resolveSystemObjectBranch(system, target.id)).toEqual({
    objectIds: ['target', 'child'],
    orbitIds: ['target-ring', 'nested-ring'],
  })
})

test('a branch includes multiple hosted Orbits and each deeper descendant @pure', () => {
  const target = object('target', 'star', { kind: 'system', x: 0.5, y: 0.5 })
  const east = object('east', 'planet', { kind: 'orbit', orbitId: 'east-ring' })
  const eastDeep = object('east-deep', 'moon', { kind: 'orbit', orbitId: 'east-deep-ring' })
  const west = object('west', 'planet', { kind: 'orbit', orbitId: 'west-ring' })
  const westDeep = object('west-deep', 'moon', { kind: 'orbit', orbitId: 'west-deep-ring' })
  const system: StarSystem = {
    id: 'system',
    name: 'Branch System',
    objects: [target, east, eastDeep, west, westDeep],
    orbits: [
      hostedOrbit('east-ring', target.id),
      hostedOrbit('east-deep-ring', east.id),
      hostedOrbit('west-ring', target.id),
      hostedOrbit('west-deep-ring', west.id),
    ],
  }

  expect(resolveSystemObjectBranch(system, target.id)).toEqual({
    objectIds: ['target', 'east', 'east-deep', 'west', 'west-deep'],
    orbitIds: ['east-ring', 'east-deep-ring', 'west-ring', 'west-deep-ring'],
  })
})

test('branch bounds use the painted extents of a rotated Orbit ellipse and visible glyph bounds @pure', () => {
  const target = object('target', 'planet', { kind: 'system', x: 0.5, y: 0.5 })
  const orbit = hostedOrbit('target-ring', target.id)
  const system: StarSystem = {
    id: 'system',
    name: 'Branch System',
    objects: [target],
    orbits: [orbit],
  }
  const geometry: SystemMapGeometry = {
    objectAngles: {},
    orbitRadii: { [orbit.id]: { horizontal: 100, vertical: 50 } },
    orbitRotations: { [orbit.id]: 90 },
  }
  const bounds = measureSystemObjectBranchBounds(
    system,
    target.id,
    geometry,
    new Map([[target.id, { x: -12, y: -6, width: 24, height: 12 }]]),
  )

  expect(bounds).toEqual({
    objectIds: ['target'],
    orbitIds: ['target-ring'],
    bounds: { x: 429, y: 179, width: 102, height: 202 },
  })
  expect(measureSystemObjectBranchBounds(system, 'missing', geometry, new Map())).toBeUndefined()
})

test('branch bounds use exact diagonal ellipse extents @pure', () => {
  const target = object('target', 'planet', { kind: 'system', x: 0.5, y: 0.5 })
  const orbit = hostedOrbit('target-ring', target.id)
  const system: StarSystem = {
    id: 'system',
    name: 'Branch System',
    objects: [target],
    orbits: [orbit],
  }
  const geometry: SystemMapGeometry = {
    objectAngles: {},
    orbitRadii: { [orbit.id]: { horizontal: 100, vertical: 50 } },
    orbitRotations: { [orbit.id]: 45 },
  }
  const measured = measureSystemObjectBranchBounds(
    system,
    target.id,
    geometry,
    new Map([[target.id, { x: -12, y: -6, width: 24, height: 12 }]]),
  )
  if (!measured) throw new Error('The diagonal branch bounds are unavailable.')

  expect(measured.bounds.x).toBeCloseTo(399.943, 3)
  expect(measured.bounds.y).toBeCloseTo(199.943, 3)
  expect(measured.bounds.width).toBeCloseTo(160.114, 3)
  expect(measured.bounds.height).toBeCloseTo(160.114, 3)
})
