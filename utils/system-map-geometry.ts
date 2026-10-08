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

export interface SystemMapGeometry {
  objectAngles: Readonly<Record<string, number>>
  orbitRadii: Readonly<Record<string, OrbitRadii>>
  orbitRotations: Readonly<Record<string, number>>
}

export interface MapGeometryOverrides {
  positions: ReadonlyMap<string, Point>
  orbitCenters: ReadonlyMap<string, Point>
  orbitRadii: ReadonlyMap<string, OrbitRadii>
  orbitRotations: ReadonlyMap<string, number>
}

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

export function toNormalizedMapPoint(point: Point): Point {
  return {
    x: (point.x - 64) / 832,
    y: (point.y - 72) / 416,
  }
}

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

export function orbitRotation(
  orbit: Orbit,
  geometry: SystemMapGeometry,
  overrides?: ReadonlyMap<string, number>,
): number {
  return overrides?.get(orbit.id) ?? geometry.orbitRotations[orbit.id] ?? 0
}

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

export function orbitAxisCursor(axis: 'horizontal' | 'vertical', rotation: number): string {
  const axisRotation = normalizeOrbitRotation(rotation + (axis === 'vertical' ? 90 : 0)) % 180
  const direction = Math.round(axisRotation / 45) % 4
  return ['ew-resize', 'nwse-resize', 'ns-resize', 'nesw-resize'][direction]!
}

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
        ?? -Math.PI / 2 + (index / Math.max(1, siblings.length)) * Math.PI * 2
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

export function requiredPosition(positions: ReadonlyMap<string, Point>, objectId: string): Point {
  const position = positions.get(objectId)
  if (!position) {
    throw new Error(`No schematic position exists for map object "${objectId}".`)
  }
  return position
}

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
  return system.orbits
    .map(orbit => {
      const center = orbitCenter(orbit, positions, orbitCenterOverrides)
      const radii = orbitRadii(system, orbit, geometry, orbitRadiiOverrides)
      const rotation = orbitRotation(orbit, geometry, orbitRotationsOverrides)
      const angle = orbitAngleAtPoint(point, center, radii, rotation)
      const nearestPoint = orbitPointAtAngle(center, radii, angle, rotation)
      return {
        orbit,
        distance: Math.hypot(point.x - nearestPoint.x, point.y - nearestPoint.y),
      }
    })
    .filter(({ orbit, distance }) =>
      distance <= 16 && (!objectId || canPlaceObjectInOrbit(system, objectId, orbit.id)),
    )
    .sort((left, right) => left.distance - right.distance)[0]?.orbit
}
