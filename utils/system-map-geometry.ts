/**
 * Pure scene-coordinate transforms and hit testing for nested elliptical Orbits; gesture overrides stay transient.
 */
import {
  canPlaceObjectInOrbit,
  defaultOrbitRadius,
  normalizeOrbitRotation,
  type Orbit,
  type OrbitRadii,
  type Point,
  type StarSystem,
  type SystemObject,
} from '../domain/workspace'
import { defaultObjectOrbitAngle } from '../domain/workspace-placement'
import type {
  SystemCreationCandidate,
  SystemCreationType,
} from '../composables/editor-workflows/types'
import { catalogueObjectLabel } from './catalogue-labels'

export interface SystemMapGeometry {
  /** Saved object orbital parameter angles, in radians. */
  objectAngles: Readonly<Record<string, number>>
  /** Saved horizontal/vertical Orbit radii, in SVG scene units. */
  orbitRadii: Readonly<Record<string, OrbitRadii>>
  /** Saved Orbit ellipse rotations, in degrees. */
  orbitRotations: Readonly<Record<string, number>>
}

/** In-progress pointer geometry in SVG scene coordinates; never written to workspace state by this module. */
export interface MapGeometryOverrides {
  /** Object positions in SVG scene coordinates. */
  positions: ReadonlyMap<string, Point>
  /** Unoccupied Orbit centers in SVG scene coordinates. */
  orbitCenters: ReadonlyMap<string, Point>
  /** Orbit extents in SVG scene units. */
  orbitRadii: ReadonlyMap<string, OrbitRadii>
  /** Orbit rotations in degrees. */
  orbitRotations: ReadonlyMap<string, number>
}

/** Orbit ring hit used by existing-object move resolution, including cycle-invalid destinations. */
export interface OrbitPlacementHit {
  orbit: Orbit
  angle: number
  point: Point
  distance: number
  valid: boolean
}

/**
 * Resolves an unoccupied Orbit's normalized center to scene coordinates or returns its host's position.
 * @param orbit Orbit whose center is requested.
 * @param positions Resolved system-object positions in SVG scene coordinates.
 * @param overrides Optional temporary scene-coordinate centers for an active drag.
 * @returns Orbit center in SVG scene coordinates.
 * @throws If a hosted Orbit's object position is unavailable.
 */
export function orbitCenter(
  orbit: Orbit,
  positions: ReadonlyMap<string, Point>,
  overrides?: ReadonlyMap<string, Point>,
): Point {
  if (orbit.hostId === null) {
    const override = overrides?.get(orbit.id)
    if (override) return override
    return {
      x: 64 + orbit.center.x * 832,
      y: 72 + orbit.center.y * 416,
    }
  }
  return requiredPosition(positions, orbit.hostId)
}

/**
 * Converts an SVG scene point to normalized coordinates relative to the initial map body, without clamping.
 * @param point Position in SVG scene coordinates.
 * @returns Normalized system-map placement or Orbit-center coordinates.
 */
export function toNormalizedMapPoint(point: Point): Point {
  return {
    x: (point.x - 64) / 832,
    y: (point.y - 72) / 416,
  }
}

/**
 * Resolves drag overrides, saved radii, or the domain's circular default in that order.
 * @param system System used to derive the host-specific default.
 * @param orbit Orbit being measured.
 * @param geometry Saved radii and system layout.
 * @param overrides Optional temporary scene-unit radii.
 * @returns Horizontal and vertical radii in SVG scene units.
 */
export function orbitRadii(
  system: StarSystem,
  orbit: Orbit,
  geometry: SystemMapGeometry,
  overrides?: ReadonlyMap<string, OrbitRadii>,
): OrbitRadii {
  const radius = defaultOrbitRadius(system, orbit)
  return overrides?.get(orbit.id)
    ?? geometry.orbitRadii[orbit.id]
    ?? { horizontal: radius, vertical: radius }
}

/**
 * Resolves a temporary Orbit rotation before its saved rotation, defaulting to zero degrees.
 * @param orbit Orbit whose ellipse is rotated.
 * @param geometry Saved system layout.
 * @param overrides Optional temporary rotations in degrees.
 * @returns Rotation in degrees.
 */
export function orbitRotation(
  orbit: Orbit,
  geometry: SystemMapGeometry,
  overrides?: ReadonlyMap<string, number>,
): number {
  return overrides?.get(orbit.id) ?? geometry.orbitRotations[orbit.id] ?? 0
}

/**
 * Rotates a scene-coordinate point around a scene-coordinate center.
 * @param point Point to rotate.
 * @param center Rotation origin.
 * @param degrees Clockwise-positive SVG rotation in degrees.
 * @returns Rotated point in the same coordinate space.
 */
export function rotatePoint(point: Point, center: Point, degrees: number): Point {
  const radians = degrees * Math.PI / 180
  const cosine = Math.cos(radians)
  const sine = Math.sin(radians)
  const x = point.x - center.x
  const y = point.y - center.y
  return {
    x: center.x + x * cosine - y * sine,
    y: center.y + x * sine + y * cosine,
  }
}

/**
 * Resolves an ellipse parameter angle to a scene point, then applies its degree-based rotation.
 * @param center Orbit center in SVG scene coordinates.
 * @param radii Horizontal and vertical extents in SVG scene units.
 * @param angle Orbital parameter angle in radians.
 * @param rotation Ellipse rotation in degrees.
 * @returns Point on the rotated ellipse in SVG scene coordinates.
 */
export function orbitPointAtAngle(
  center: Point,
  radii: OrbitRadii,
  angle: number,
  rotation: number,
): Point {
  return rotatePoint({
    x: center.x + Math.cos(angle) * radii.horizontal,
    y: center.y + Math.sin(angle) * radii.vertical,
  }, center, rotation)
}

/** Projects a scene point onto a rotated Orbit and returns the shared angle and rendered position. */
export function projectPointToOrbit(
  point: Point,
  center: Point,
  radii: OrbitRadii,
  rotation: number,
): { angle: number; point: Point } {
  const angle = orbitAngleAtPoint(point, center, radii, rotation)
  return {
    angle,
    point: orbitPointAtAngle(center, radii, angle, rotation),
  }
}

/**
 * Places the rotation handle 28 scene units beyond the ellipse's upper vertical axis before rotation.
 * @param center Orbit center in SVG scene coordinates.
 * @param radii Orbit extents in SVG scene units.
 * @param rotation Ellipse rotation in degrees.
 * @returns Rotation-handle position in SVG scene coordinates.
 */
export function orbitRotationHandlePoint(
  center: Point,
  radii: OrbitRadii,
  rotation: number,
): Point {
  return rotatePoint({
    x: center.x,
    y: center.y - radii.vertical - 28,
  }, center, rotation)
}

/**
 * Chooses a CSS resize cursor for an ellipse axis at its current rotation.
 * @param axis Axis being dragged.
 * @param rotation Orbit ellipse angle in degrees.
 * @returns One of the four diagonal or cardinal resize cursor names.
 */
export function orbitAxisCursor(axis: 'horizontal' | 'vertical', rotation: number): string {
  const axisRotation = normalizeOrbitRotation(rotation + (axis === 'vertical' ? 90 : 0)) % 180
  const direction = Math.round(axisRotation / 45) % 4
  return ['ew-resize', 'nwse-resize', 'ns-resize', 'nesw-resize'][direction]!
}

/**
 * Finds the closest ellipse parameter angle to a scene point, returning radians in [-pi, pi].
 * Circles use atan2; ellipses use a 32-sample seed followed by local golden-section refinement.
 * @param point Pointer location in SVG scene coordinates.
 * @param center Orbit center in SVG scene coordinates.
 * @param radii Ellipse extents in SVG scene units.
 * @param rotation Ellipse rotation in degrees.
 * @returns Approximate closest-point parameter angle in radians.
 */
export function orbitAngleAtPoint(
  point: Point,
  center: Point,
  radii: OrbitRadii,
  rotation: number,
): number {
  const localPoint = rotatePoint(point, center, -rotation)
  const x = localPoint.x - center.x
  const y = localPoint.y - center.y
  if (radii.horizontal === radii.vertical) return Math.atan2(y, x)

  const distanceSquared = (angle: number) => {
    const dx = x - Math.cos(angle) * radii.horizontal
    const dy = y - Math.sin(angle) * radii.vertical
    return dx * dx + dy * dy
  }
  const step = (Math.PI * 2) / 32
  let closestAngle = 0
  let closestDistance = Number.POSITIVE_INFINITY
  for (let index = 0; index < 32; index += 1) {
    const angle = index * step
    const distance = distanceSquared(angle)
    if (distance < closestDistance) {
      closestAngle = angle
      closestDistance = distance
    }
  }

  let lower = closestAngle - step
  let upper = closestAngle + step
  const ratio = (Math.sqrt(5) - 1) / 2
  let first = upper - (upper - lower) * ratio
  let second = lower + (upper - lower) * ratio
  let firstDistance = distanceSquared(first)
  let secondDistance = distanceSquared(second)
  // ponytail: <=5.2e-6 rad interval; use a scale-aware analytic solver if extreme radii expose error.
  for (let iteration = 0; iteration < 24; iteration += 1) {
    if (firstDistance < secondDistance) {
      upper = second
      second = first
      secondDistance = firstDistance
      first = upper - (upper - lower) * ratio
      firstDistance = distanceSquared(first)
    } else {
      lower = first
      first = second
      firstDistance = secondDistance
      second = lower + (upper - lower) * ratio
      secondDistance = distanceSquared(second)
    }
  }

  const angle = (lower + upper) / 2
  return Math.atan2(Math.sin(angle), Math.cos(angle))
}

/**
 * Resolves every system object's nested Orbit placement into SVG scene coordinates.
 * Missing saved angles use an in-memory sibling-order default; supplied gesture overrides take precedence.
 * @param system System objects and Orbit host relationships.
 * @param geometry Durable Orbit sizes/rotations and object angles.
 * @param overrides Optional temporary drag geometry; no override is persisted or written back.
 * @returns Scene position for each object ID.
 * @throws If a placement/host is missing or nested placement contains a recursive cycle.
 */
export function objectPositions(
  system: StarSystem,
  geometry: SystemMapGeometry,
  overrides?: MapGeometryOverrides,
): Map<string, Point> {
  const objectsById = new Map(system.objects.map(object => [object.id, object]))
  const childrenByOrbit = new Map<string, SystemObject[]>()
  const positions = new Map<string, Point>()
  const visiting = new Set<string>()

  for (const object of system.objects) {
    if (object.placement.kind !== 'orbit') continue
    const children = childrenByOrbit.get(object.placement.orbitId) ?? []
    children.push(object)
    childrenByOrbit.set(object.placement.orbitId, children)
  }

  function locate(object: SystemObject): Point {
    const cached = positions.get(object.id)
    if (cached) return cached
    const override = overrides?.positions.get(object.id)
    if (override) {
      positions.set(object.id, override)
      return override
    }
    if (visiting.has(object.id)) {
      throw new Error('The system map contains a circular Orbit relationship.')
    }
    visiting.add(object.id)

    let point: Point
    if (object.placement.kind === 'system') {
      point = {
        x: 64 + object.placement.x * 832,
        y: 72 + object.placement.y * 416,
      }
    } else {
      const placement = object.placement
      const orbit = system.orbits.find(candidate => candidate.id === placement.orbitId)
      if (!orbit) {
        throw new Error('The system map contains an object with an invalid Orbit host.')
      }

      let center: Point
      if (orbit.hostId === null) {
        center = orbitCenter(orbit, positions, overrides?.orbitCenters)
      } else {
        const host = objectsById.get(orbit.hostId)
        if (!host) {
          throw new Error('The system map contains an object with an invalid Orbit host.')
        }
        center = locate(host)
      }
      const siblings = childrenByOrbit.get(orbit.id) ?? []
      const index = siblings.findIndex(candidate => candidate.id === object.id)
      const angle = geometry.objectAngles[object.id]
        ?? defaultObjectOrbitAngle(index, siblings.length)
      point = orbitPointAtAngle(
        center,
        orbitRadii(system, orbit, geometry, overrides?.orbitRadii),
        angle,
        orbitRotation(orbit, geometry, overrides?.orbitRotations),
      )
    }

    visiting.delete(object.id)
    positions.set(object.id, point)
    return point
  }

  for (const object of system.objects) locate(object)
  return positions
}

/**
 * Collects objects placed in an Orbit and every nested Orbit hosted by those objects.
 * @param system System whose placement and host links define the moving branch.
 * @param orbitId Root Orbit being moved.
 * @returns IDs of objects whose resolved positions move with that Orbit.
 */
export function objectsMovedWithOrbit(system: StarSystem, orbitId: string): Set<string> {
  const pendingOrbitIds = [orbitId]
  const visitedOrbitIds = new Set<string>()
  const objectIds = new Set<string>()

  while (pendingOrbitIds.length > 0) {
    const currentOrbitId = pendingOrbitIds.pop()
    if (!currentOrbitId || visitedOrbitIds.has(currentOrbitId)) continue
    visitedOrbitIds.add(currentOrbitId)

    for (const object of system.objects) {
      if (
        object.placement.kind !== 'orbit'
        || object.placement.orbitId !== currentOrbitId
        || objectIds.has(object.id)
      ) {
        continue
      }
      objectIds.add(object.id)
      for (const childOrbit of system.orbits) {
        if (childOrbit.hostId === object.id) pendingOrbitIds.push(childOrbit.id)
      }
    }
  }

  return objectIds
}

/**
 * Searches for a nearby unoccupied center with point clearance from unaffected objects and centers.
 * Objects in the Orbit's own nested branch are excluded; the search does not guarantee whole-ring clearance.
 * @param system System containing a hosted Orbit.
 * @param orbitId Orbit to detach.
 * @param geometry Durable layout used to resolve current scene positions.
 * @returns A normalized center, or undefined if the Orbit is missing or already unoccupied.
 * @throws If geometry cannot be resolved or no finite point-clear location is found.
 */
export function getDetachedOrbitCenter(
  system: StarSystem,
  orbitId: string,
  geometry: SystemMapGeometry,
): Point | undefined {
  const orbit = system.orbits.find(candidate => candidate.id === orbitId)
  if (!orbit || orbit.hostId === null) return undefined

  const positions = objectPositions(system, geometry)
  const origin = orbitCenter(orbit, positions)
  const movingObjectIds = objectsMovedWithOrbit(system, orbit.id)
  const occupiedPoints = [
    ...Array.from(positions.entries())
      .filter(([objectId]) => !movingObjectIds.has(objectId))
      .map(([, point]) => point),
    ...system.orbits
      .filter(candidate => candidate.id !== orbit.id && candidate.hostId === null)
      .map(candidate => orbitCenter(candidate, positions)),
  ]
  const centerClearance = 40
  const distanceStep = 32
  const maxOccupiedDistance = occupiedPoints.reduce(
    (farthest, point) => Math.max(
      farthest,
      Math.hypot(point.x - origin.x, point.y - origin.y),
    ),
    0,
  )
  const searchLimit = maxOccupiedDistance + centerClearance + distanceStep
  if (!Number.isFinite(searchLimit)) {
    throw new Error('Could not find a finite nearby center for this Orbit.')
  }

  for (let radius = 48; radius <= searchLimit; radius += distanceStep) {
    for (let direction = 0; direction < 8; direction += 1) {
      const angle = direction * Math.PI / 4
      const center = {
        x: origin.x + Math.cos(angle) * radius,
        y: origin.y + Math.sin(angle) * radius,
      }
      if (occupiedPoints.every(point =>
        Math.hypot(point.x - center.x, point.y - center.y) >= centerClearance,
      )) {
        return toNormalizedMapPoint(center)
      }
    }
  }

  throw new Error('Could not find an empty nearby location for this Orbit.')
}

/**
 * Retrieves a resolved system-object position for a geometry calculation that requires it.
 * @param positions Position map in SVG scene coordinates.
 * @param objectId Required object ID.
 * @returns Its scene-coordinate position.
 * @throws If no position has been resolved for objectId.
 */
export function requiredPosition(positions: ReadonlyMap<string, Point>, objectId: string): Point {
  const position = positions.get(objectId)
  if (!position) {
    throw new Error(`No schematic position exists for map object "${objectId}".`)
  }
  return position
}

/**
 * Hit-tests the nearest ellipse within 16 SVG scene units, optionally excluding cyclic object placements.
 * @param system System whose Orbit ellipses are tested.
 * @param point Pointer location in SVG scene coordinates.
 * @param positions Resolved object positions in SVG scene coordinates.
 * @param geometry Saved radii, rotations, and object angles.
 * @param objectId Optional object being dropped; candidate Orbits that would create a host cycle are excluded.
 * @param orbitRadiiOverrides Optional temporary drag radii.
 * @param orbitRotationsOverrides Optional temporary degree-based drag rotations.
 * @param orbitCenterOverrides Optional temporary scene-coordinate unoccupied centers.
 * @returns Nearest eligible Orbit, or undefined when none is within the hit tolerance.
 * @throws If a required hosted-object position cannot be resolved.
 */
export function orbitAtPoint(
  system: StarSystem,
  point: Point,
  positions: ReadonlyMap<string, Point>,
  geometry: SystemMapGeometry,
  objectId?: string,
  orbitRadiiOverrides?: ReadonlyMap<string, OrbitRadii>,
  orbitRotationsOverrides?: ReadonlyMap<string, number>,
  orbitCenterOverrides?: ReadonlyMap<string, Point>,
): Orbit | undefined {
  return orbitPlacementHitsAtPoint(
    system,
    point,
    positions,
    geometry,
    objectId,
    orbitRadiiOverrides,
    orbitRotationsOverrides,
    orbitCenterOverrides,
  ).find(candidate => candidate.valid)?.orbit
}

/**
 * Returns every Orbit ring within the existing placement tolerance, retaining cycle-invalid hits.
 * @param system System whose Orbit ellipses are tested.
 * @param point Pointer location in SVG scene coordinates.
 * @param positions Resolved object positions in SVG scene coordinates.
 * @param geometry Saved radii, rotations, and object angles.
 * @param objectId Optional object being moved; supplied IDs mark recursive host targets invalid.
 * @param orbitRadiiOverrides Optional temporary drag radii.
 * @param orbitRotationsOverrides Optional temporary degree-based drag rotations.
 * @param orbitCenterOverrides Optional temporary scene-coordinate unoccupied centers.
 * @returns All raw ring hits ordered by distance, then by their source system order.
 * @throws If a required hosted-object position cannot be resolved.
 */
export function orbitPlacementHitsAtPoint(
  system: StarSystem,
  point: Point,
  positions: ReadonlyMap<string, Point>,
  geometry: SystemMapGeometry,
  objectId?: string,
  orbitRadiiOverrides?: ReadonlyMap<string, OrbitRadii>,
  orbitRotationsOverrides?: ReadonlyMap<string, number>,
  orbitCenterOverrides?: ReadonlyMap<string, Point>,
): OrbitPlacementHit[] {
  return system.orbits
    .map((orbit, index) => {
      const center = orbitCenter(orbit, positions, orbitCenterOverrides)
      const radii = orbitRadii(system, orbit, geometry, orbitRadiiOverrides)
      const rotation = orbitRotation(orbit, geometry, orbitRotationsOverrides)
      const angle = orbitAngleAtPoint(point, center, radii, rotation)
      const projectedPoint = orbitPointAtAngle(center, radii, angle, rotation)
      const distance = Math.hypot(point.x - projectedPoint.x, point.y - projectedPoint.y)
      return {
        orbit,
        angle,
        point: projectedPoint,
        distance,
        valid: !objectId || canPlaceObjectInOrbit(system, objectId, orbit.id),
        index,
      }
    })
    .filter(candidate => candidate.distance <= 16)
    .sort((left, right) => left.distance - right.distance || left.index - right.index)
    .map(candidate => ({
      orbit: candidate.orbit,
      angle: candidate.angle,
      point: candidate.point,
      distance: candidate.distance,
      valid: candidate.valid,
    }))
}

/**
 * Resolves the first supported map-placement candidate for a catalogue object.
 * The click point is raw SVG scene geometry; the returned free point uses the saved normalized map frame.
 * Existing marks and their labels remain occupied targets instead of silently becoming free centers.
 */
export function creationCandidatesAtPoint(
  system: StarSystem,
  point: Point,
  type: SystemCreationType,
  geometry: SystemMapGeometry,
): SystemCreationCandidate[] {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return []

  const positions = objectPositions(system, geometry)
  const nearbyObjects = system.objects
    .map(object => ({ object, position: positions.get(object.id)! }))
    // Glyph, key and name labels all belong to the same non-empty object mark.
    .map(entry => ({ ...entry, distance: Math.hypot(point.x - entry.position.x, point.y - entry.position.y) }))
    .filter(entry => entry.distance <= 52)
    .sort((left, right) => left.distance - right.distance)

  if (type.kind === 'object') {
    const nearbyOrbits = system.orbits
      .map(orbit => {
        const center = orbitCenter(orbit, positions)
        const radii = orbitRadii(system, orbit, geometry)
        const rotation = orbitRotation(orbit, geometry)
        const angle = orbitAngleAtPoint(point, center, radii, rotation)
        const projected = orbitPointAtAngle(center, radii, angle, rotation)
        return { orbit, angle, distance: Math.hypot(point.x - projected.x, point.y - projected.y) }
      })
      // Keep the manipulation resolver's existing scene-unit tolerance for placement targeting.
      .filter(candidate => candidate.distance <= 16)
      .sort((left, right) => left.distance - right.distance || left.orbit.order - right.orbit.order)

    const orbitCandidates: SystemCreationCandidate[] = nearbyOrbits.map(({ orbit, angle }) => ({
      key: `orbit:${orbit.id}`,
      label: orbitLabel(system, orbit),
      target: { kind: 'orbit', orbitId: orbit.id, angle },
      error: null,
    }))
    const occupiedObjectCandidates: SystemCreationCandidate[] = nearbyObjects.map(({ object }) => ({
      key: `occupied:${object.id}`,
      label: `Object mark: ${catalogueObjectLabel(object)}`,
      target: { kind: 'host', objectId: object.id },
      error: `${catalogueObjectLabel(object)} already occupies this mark. Choose an Orbit or a clear map position.`,
    }))

    if (orbitCandidates.length > 0) return [...orbitCandidates, ...occupiedObjectCandidates]
    if (occupiedObjectCandidates.length > 0) return occupiedObjectCandidates
    return [{
      key: `free:${point.x}:${point.y}`,
      label: 'Free map position',
      target: { kind: 'free', point: toNormalizedMapPoint(point) },
      error: null,
    }]
  }

  if (nearbyObjects.length > 0) {
    return nearbyObjects.map(({ object }) => ({
      key: `host:${object.id}`,
      label: `Orbit around ${object.name}`,
      target: { kind: 'host', objectId: object.id },
      error: null,
    }))
  }

  const nearbyCenter = system.orbits
    .filter(orbit => orbit.hostId === null)
    .map(orbit => ({ orbit, center: orbitCenter(orbit, positions) }))
    .map(entry => ({ ...entry, distance: Math.hypot(point.x - entry.center.x, point.y - entry.center.y) }))
    .find(entry => entry.distance < 40)

  return [{
    key: `center:${point.x}:${point.y}`,
    label: 'New unoccupied Orbit center',
    target: { kind: 'free', point: toNormalizedMapPoint(point) },
    error: nearbyCenter
      ? `This center is too close to ${orbitLabel(system, nearbyCenter.orbit)}. Choose another map position.`
      : null,
  }]
}

function orbitLabel(system: StarSystem, orbit: Orbit): string {
  if (orbit.hostId === null) return `Orbit ${orbit.order} around unoccupied center`
  const host = system.objects.find(object => object.id === orbit.hostId)
  if (!host) throw new Error(`Orbit "${orbit.id}" has no host object.`)
  return `Orbit ${orbit.order} around ${host.name}`
}
