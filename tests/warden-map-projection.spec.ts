import { expect, test } from '@playwright/test'
import type { Point, StarSystem, SystemObject } from '../domain/workspace'
import {
  CONTINUOUS_MAP_LOCAL_ORIGIN,
  CONTINUOUS_MAP_SYSTEM_SCALE,
  clampWardenClusterAnchor,
  projectContinuousSystemGeometry,
  projectWardenSystem,
  unprojectWardenClusterAnchor,
  unprojectWardenLocalPoint,
} from '../utils/continuous-map-projection'
import { orbitPointAtAngle } from '../utils/system-map-geometry'

const star: SystemObject = {
  id: 'star',
  family: 'CelestialBody',
  subtype: 'star',
  locationKey: 'STAR1',
  name: 'Primary',
  publication: 'known-type',
  description: '',
  playerText: '',
  playerFieldMasks: [],
  placement: { kind: 'system', x: 0.5, y: 0.5 },
}

const offCenterStar: SystemObject = {
  ...star,
  id: 'far-star',
  locationKey: 'STAR2',
  name: 'Outer Lamp',
  placement: { kind: 'system', x: 1.4, y: -0.35 },
}

function systemWithContents(): StarSystem {
  const planet: SystemObject = {
    ...star,
    id: 'planet',
    family: 'CelestialBody',
    subtype: 'planet',
    locationKey: 'PL1',
    name: 'Distant world',
    placement: { kind: 'orbit', orbitId: 'inner' },
  }
  const moon: SystemObject = {
    ...star,
    id: 'moon',
    subtype: 'moon',
    locationKey: 'MO1',
    name: 'Far moon',
    placement: { kind: 'orbit', orbitId: 'outer' },
  }
  return {
    id: 'system-a',
    name: 'Aster Reach',
    publication: 'known-type',
    objects: [star, planet, moon, offCenterStar],
    orbits: [
      { id: 'inner', hostId: star.id, order: 1 },
      { id: 'outer', hostId: planet.id, order: 2 },
      { id: 'detached', hostId: null, center: { x: 1.35, y: 0.2 }, order: 3 },
    ],
  }
}

const layout = {
  objectAngles: { planet: 0, moon: Math.PI / 2 },
  orbitRadii: {
    inner: { horizontal: 160, vertical: 72 },
    outer: { horizontal: 130, vertical: 55 },
    detached: { horizontal: 85, vertical: 30 },
  },
  orbitRotations: { inner: 33, outer: 71, detached: 48 },
}

test('continuous Warden projection keeps the legacy anchor and all local geometry in one uniform frame', { tag: '@pure' }, () => {
  const projected = projectWardenSystem(
    systemWithContents(),
    { x: 0.3, y: 0.6 },
    layout,
  )

  expect(projected.anchor.x).toBeCloseTo(332.8)
  expect(projected.anchor.y).toBeCloseTo(316.8)
  expect(projected.localOrigin).toEqual(CONTINUOUS_MAP_LOCAL_ORIGIN)
  expect(projected.scale).toBe(CONTINUOUS_MAP_SYSTEM_SCALE)

  const origin = projected.projectLocalPoint(CONTINUOUS_MAP_LOCAL_ORIGIN)
  expect(origin.x).toBeCloseTo(projected.anchor.x)
  expect(origin.y).toBeCloseTo(projected.anchor.y)
  expect(unprojectWardenClusterAnchor(projected.anchor).x).toBeCloseTo(0.3)
  expect(unprojectWardenClusterAnchor(projected.anchor).y).toBeCloseTo(0.6)

  const planet = projected.objects.find(object => object.id === 'planet')!
  const projectedPlanet = projected.projectLocalPoint(planet.position)
  const localPlanet = unprojectWardenLocalPoint(projected, projectedPlanet)
  expect(localPlanet.x).toBeCloseTo(planet.position.x)
  expect(localPlanet.y).toBeCloseTo(planet.position.y)
  const distantStar = projected.objects.find(object => object.id === 'far-star')!
  expect(projected.envelope.x).toBeLessThan(distantStar.scenePosition.x)
  expect(projected.envelope.x + projected.envelope.width).toBeGreaterThan(distantStar.scenePosition.x)

  const innerOrbit = projected.orbits.find(orbit => orbit.id === 'inner')!
  expect(innerOrbit.sceneRadii.horizontal).toBeCloseTo(32)
  expect(innerOrbit.sceneRadii.vertical).toBeCloseTo(14.4)
  expect(innerOrbit.rotation).toBe(33)
})

test('system envelopes contain rotated Orbits, off-center objects, anchors, and empty-system minimum frames', { tag: '@pure' }, () => {
  const projected = projectWardenSystem(
    systemWithContents(),
    { x: 0.5, y: 0.5 },
    layout,
  )
  const anchor = projected.anchor
  const frame = projected.envelope

  expect(frame.x).toBeLessThan(anchor.x)
  expect(frame.x + frame.width).toBeGreaterThan(anchor.x)
  expect(frame.y).toBeLessThan(anchor.y)
  expect(frame.y + frame.height).toBeGreaterThan(anchor.y)

  for (const orbit of projected.orbits) {
    for (let sample = 0; sample < 48; sample += 1) {
      const angle = (sample / 48) * Math.PI * 2
      const point = orbitPointAtAngle(orbit.sceneCenter, orbit.sceneRadii, angle, orbit.rotation)
      expect(point.x).toBeGreaterThan(frame.x)
      expect(point.x).toBeLessThan(frame.x + frame.width)
      expect(point.y).toBeGreaterThan(frame.y)
      expect(point.y).toBeLessThan(frame.y + frame.height)
    }
  }

  const overlapped = projectWardenSystem(
    systemWithContents(),
    { x: 0.5, y: 0.5 },
    layout,
  )
  expect(overlapped.anchor).toEqual(projected.anchor)
  expect(overlapped.envelope.x).toBe(projected.envelope.x)

  const empty = projectWardenSystem({
    id: 'empty', name: 'Quiet Frame', publication: 'known-type', objects: [], orbits: [],
  }, { x: 1.2, y: -0.4 }, layout)
  expect(empty.anchor.x).toBeCloseTo(995.2)
  expect(empty.anchor.y).toBeCloseTo(-51.2)
  expect(empty.envelope.width).toBeGreaterThanOrEqual(120)
  expect(empty.envelope.height).toBeGreaterThanOrEqual(88)
})

test('continuous anchor dragging clamps the same coordinates the existing writer commits', { tag: '@pure' }, () => {
  const proposed: Point = { x: -0.25, y: 1.4 }
  expect(clampWardenClusterAnchor(proposed)).toEqual({ x: 0, y: 1 })
})

test('the shared projection accepts resolved detached geometry without a source system record', { tag: '@pure' }, () => {
  const projected = projectContinuousSystemGeometry({
    id: 'public-system',
    name: 'Public Reach',
    anchor: { x: 300, y: 200 },
    objects: [{ id: 'public-object', name: 'Visible World', locationKey: 'PL1', position: { x: 700, y: 140 } }],
    orbits: [{ id: 'public-orbit', center: { x: 480, y: 280 }, radii: { horizontal: 90, vertical: 35 }, rotation: 41 }],
  }, 0.5)

  expect(projected.anchor).toEqual({ x: 300, y: 200 })
  expect(projected.objects[0]?.scenePosition).toEqual({ x: 410, y: 130 })
  expect(projected.orbits[0]?.sceneRadii).toEqual({ horizontal: 45, vertical: 17.5 })
})
