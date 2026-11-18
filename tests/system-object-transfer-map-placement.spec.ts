import { expect, test } from '@playwright/test'
import { createLocalWorkspace } from '../domain/workspace'
import { fromNormalizedMapPoint } from '../domain/workspace-map-coordinates'
import { resolveSystemObjectTransferMapPlacement } from '../utils/system-object-transfer-map-placement'
import {
  objectPositions,
  orbitAngleAtPoint,
  orbitCenter,
  orbitPointAtAngle,
  orbitRadii,
  orbitRotation,
} from '../utils/system-map-geometry'

test('map placement retains the selected destination Orbit and derives its elliptical angle from the pointer @pure', () => {
  const workspace = createLocalWorkspace('Kestrel Reach', 'Source')
  const source = workspace.cluster.systems[0]!
  const destination = {
    ...source,
    id: 'destination',
    name: 'Destination',
    objects: [],
    orbits: [{ id: 'destination-orbit', order: 1, hostId: null, center: { x: 0.48, y: 0.52 } }],
  }
  const orbit = destination.orbits[0]!
  const geometry = {
    objectAngles: {},
    orbitRadii: { [orbit.id]: { horizontal: 136, vertical: 61 } },
    orbitRotations: { [orbit.id]: 31 },
  }
  const pointerPoint = { x: 0.71, y: 0.43 }
  const placement = resolveSystemObjectTransferMapPlacement(
    destination,
    geometry,
    source.objects[0]!.id,
    { kind: 'orbit', orbitId: orbit.id, angle: 0 },
    pointerPoint,
  )

  expect(placement).not.toBeNull()
  expect(placement?.kind).toBe('orbit')
  if (placement?.kind !== 'orbit') return
  expect(placement.orbitId).toBe(orbit.id)

  const positions = objectPositions(destination, geometry)
  const center = orbitCenter(orbit, positions)
  const radii = orbitRadii(destination, orbit, geometry)
  const rotation = orbitRotation(orbit, geometry)
  const expectedAngle = orbitAngleAtPoint(fromNormalizedMapPoint(pointerPoint), center, radii, rotation)
  expect(placement.angle).toBeCloseTo(expectedAngle, 10)
  expect(orbitPointAtAngle(center, radii, placement.angle, rotation)).toEqual(
    orbitPointAtAngle(center, radii, expectedAngle, rotation),
  )
})

test('map placement keeps a chosen Free destination and accepts finite off-envelope coordinates @pure', () => {
  const workspace = createLocalWorkspace('Kestrel Reach', 'Source')
  const source = workspace.cluster.systems[0]!
  const pointerPoint = { x: 1.08, y: -0.12 }
  const placement = resolveSystemObjectTransferMapPlacement(
    source,
    { objectAngles: {}, orbitRadii: {}, orbitRotations: {} },
    source.objects[0]!.id,
    { kind: 'system', x: 0.5, y: 0.5 },
    pointerPoint,
  )

  expect(placement).toEqual({ kind: 'system', x: pointerPoint.x, y: pointerPoint.y })
})
