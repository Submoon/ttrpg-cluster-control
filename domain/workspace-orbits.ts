/**
 * Orbit commands enforce host relationships and sibling order, and normalize older circle layouts.
 */
import type { Orbit, OrbitRadii, Point, StarSystem, SystemObject } from './workspace-model'
import { isRecord } from './workspace-validation'

/**
 * Creates an Orbit around an existing object or at the next unused unoccupied-center grid slot.
 * New Orbits append after siblings with the same host.
 * @param system System that will own the Orbit.
 * @param hostId Existing object ID, or null for an unoccupied center.
 * @returns A new Orbit with a generated ID and sibling order.
 * @throws If a non-null hostId does not identify an object in system.
 */
export function createOrbit(system: StarSystem, hostId: string | null): Orbit {
  if (hostId !== null && !system.objects.some(object => object.id === hostId)) {
    throw new Error('Choose an existing map object to host an Orbit.')
  }

  const order = system.orbits
    .filter(orbit => orbit.hostId === hostId)
    .reduce((highest, orbit) => Math.max(highest, orbit.order), 0) + 1
  if (hostId !== null) return { id: crypto.randomUUID(), hostId, order }

  let centerIndex = 0
  let center: Point
  do {
    center = {
      x: 0.18 + (centerIndex % 3) * 0.32,
      y: 0.22 + Math.floor(centerIndex / 3) * 0.3,
    }
    centerIndex += 1
  } while (system.orbits.some(orbit =>
    orbit.hostId === null
      && orbit.center.x === center.x
      && orbit.center.y === center.y,
  ))

  return {
    id: crypto.randomUUID(),
    hostId: null,
    center,
    order,
  }
}

/**
 * Resolves a hosted Orbit's object while preserving null as the unoccupied-center case.
 * @param system System containing objects.
 * @param orbit Orbit whose host is read.
 * @returns Host object, or null when the Orbit has an unoccupied center.
 * @throws If a hosted Orbit references a missing object.
 */
function orbitHost(system: StarSystem, orbit: Orbit): SystemObject | null {
  if (orbit.hostId === null) return null
  const host = system.objects.find(object => object.id === orbit.hostId)
  if (!host) {
    throw new Error(`Orbit "${orbit.id}" has no host object.`)
  }
  return host
}

/**
 * Returns the default circular radius in SVG scene units for this host and sibling order.
 * @param system System containing the Orbit host, when hosted.
 * @param orbit Orbit whose host and order determine the default.
 * @returns A scene-unit radius used for both axes when no saved radii exist.
 * @throws If the Orbit names a missing object host.
 */
export function defaultOrbitRadius(system: StarSystem, orbit: Orbit): number {
  const host = orbitHost(system, orbit)
  return host === null || host.subtype === 'star'
    ? 112 + (orbit.order - 1) * 58
    : 46 + (orbit.order - 1) * 28
}

/**
 * Returns the smallest allowed radius for either Orbit axis in SVG scene units.
 * @param system System containing the Orbit host, when hosted.
 * @param orbit Orbit whose host determines the minimum.
 * @returns A positive minimum radius that clears the host mark.
 * @throws If the Orbit names a missing object host.
 */
export function minimumOrbitRadius(system: StarSystem, orbit: Orbit): number {
  const host = orbitHost(system, orbit)
  return Math.ceil((host === null ? 0 : host.subtype === 'star' ? 23 : 14) + 16)
}

/**
 * Checks whether an object can enter an Orbit without becoming its own ancestor.
 * The host chain is followed iteratively so malformed cycles also return false.
 * @param system System containing objects and Orbits.
 * @param objectId Object being moved or created.
 * @param orbitId Proposed Orbit ID.
 * @returns False for a missing Orbit, invalid host chain, or recursive placement.
 */
export function canPlaceObjectInOrbit(system: StarSystem, objectId: string, orbitId: string): boolean {
  const orbit = system.orbits.find(candidate => candidate.id === orbitId)
  if (!orbit) {
    return false
  }
  if (orbit.hostId === null) return true

  const visited = new Set<string>()
  let host = system.objects.find(object => object.id === orbit.hostId)
  while (host && !visited.has(host.id)) {
    if (host.id === objectId) {
      return false
    }
    visited.add(host.id)
    if (host.placement.kind === 'system') {
      return true
    }

    const placement = host.placement
    const parentOrbit = system.orbits.find(candidate => candidate.id === placement.orbitId)
    if (!parentOrbit) return false
    if (parentOrbit.hostId === null) return true
    host = system.objects.find(object => object.id === parentOrbit?.hostId)
  }
  return false
}

/**
 * Swaps an Orbit with its adjacent sibling under the same host.
 * @param system System containing the Orbit.
 * @param orbitId Orbit to move.
 * @param direction -1 for the previous sibling or 1 for the next.
 * @returns A new system with the order swapped, or the original system at an end.
 * @throws If orbitId does not identify an Orbit in system.
 */
export function moveOrbit(system: StarSystem, orbitId: string, direction: -1 | 1): StarSystem {
  const orbit = system.orbits.find(candidate => candidate.id === orbitId)
  if (!orbit) {
    throw new Error('The selected Orbit no longer exists.')
  }

  const siblings = system.orbits
    .filter(candidate => candidate.hostId === orbit.hostId)
    .sort((left, right) => left.order - right.order)
  const index = siblings.findIndex(candidate => candidate.id === orbitId)
  const adjacent = siblings[index + direction]
  if (!adjacent) {
    return system
  }

  return {
    ...system,
    orbits: system.orbits.map(candidate => {
      if (candidate.id === orbit.id) return { ...candidate, order: adjacent.order }
      if (candidate.id === adjacent.id) return { ...candidate, order: orbit.order }
      return candidate
    }),
  }
}

/**
 * Moves an unoccupied center in normalized map coordinates or attaches it to an object.
 * Attachment preserves the Orbit ID, appends it under the new host, and closes its old center's order gap.
 * @param system System containing the Orbit and optional new host.
 * @param orbitId Unoccupied Orbit to move.
 * @param center Normalized center coordinates; used only when hostId is null.
 * @param hostId Existing object ID to attach to, or null to keep an unoccupied center.
 * @returns A new system with the Orbit host, center, and affected sibling orders updated.
 * @throws If the Orbit is missing or hosted, coordinates are non-finite, or hostId is invalid.
 */
export function moveOrbitCenter(
  system: StarSystem,
  orbitId: string,
  center: Point,
  hostId: string | null,
): StarSystem {
  const orbit = system.orbits.find(candidate => candidate.id === orbitId)
  if (!orbit) {
    throw new Error('The selected Orbit no longer exists.')
  }
  if (orbit.hostId !== null) {
    throw new Error('Only an Orbit with an unoccupied center can be moved.')
  }
  if (!Number.isFinite(center.x) || !Number.isFinite(center.y)) {
    throw new Error('Orbit center coordinates must be finite numbers.')
  }
  if (hostId !== null && !system.objects.some(object => object.id === hostId)) {
    throw new Error('Choose an existing map object to host an Orbit.')
  }

  const order = hostId === null
    ? orbit.order
    : system.orbits
      .filter(candidate => candidate.hostId === hostId)
      .reduce((highest, candidate) => Math.max(highest, candidate.order), 0) + 1

  return {
    ...system,
    orbits: system.orbits.map(candidate => {
      if (candidate.id === orbitId) {
        return hostId === null
          ? { id: orbit.id, hostId: null, center, order }
          : { id: orbit.id, hostId, order }
      }
      if (hostId !== null && candidate.hostId === null && candidate.order > orbit.order) {
        return { ...candidate, order: candidate.order - 1 }
      }
      return candidate
    }),
  }
}

/**
 * Detaches a hosted Orbit to a normalized unoccupied center without changing its ID or child placements.
 * Its former host's later siblings are reindexed; the detached Orbit appends among unhosted Orbits.
 * @param system System containing the Orbit.
 * @param orbitId Hosted Orbit to detach.
 * @param center Normalized coordinates for the new unoccupied center.
 * @returns A new system with the Orbit detached and sibling orders normalized.
 * @throws If the Orbit is missing, already unhosted, or center coordinates are non-finite.
 */
export function detachOrbit(system: StarSystem, orbitId: string, center: Point): StarSystem {
  const orbit = system.orbits.find(candidate => candidate.id === orbitId)
  if (!orbit) {
    throw new Error('The selected Orbit no longer exists.')
  }
  if (orbit.hostId === null) {
    throw new Error('The selected Orbit already has an unoccupied center.')
  }
  if (!Number.isFinite(center.x) || !Number.isFinite(center.y)) {
    throw new Error('Orbit center coordinates must be finite numbers.')
  }

  const hostId = orbit.hostId
  const nextUnhostedOrder = system.orbits
    .filter(candidate => candidate.hostId === null)
    .reduce((highest, candidate) => Math.max(highest, candidate.order), 0) + 1

  return {
    ...system,
    orbits: system.orbits.map(candidate => {
      if (candidate.id === orbit.id) {
        return { id: orbit.id, hostId: null, center, order: nextUnhostedOrder }
      }
      if (candidate.hostId === hostId && candidate.order > orbit.order) {
        return { ...candidate, order: candidate.order - 1 }
      }
      return candidate
    }),
  }
}

/** Checks for finite horizontal/vertical radii before legacy records are normalized. */
function isOrbitRadii(value: unknown): value is OrbitRadii {
  return isRecord(value)
    && typeof value.horizontal === 'number'
    && Number.isFinite(value.horizontal)
    && typeof value.vertical === 'number'
    && Number.isFinite(value.vertical)
}

/**
 * Converts supported stored radius shapes to horizontal/vertical pairs.
 * Numeric legacy values become circles; legacy ellipse entries must not duplicate current keys.
 * @param orbitRadii Current or older radius record.
 * @param legacyEllipseRadii Optional older separate ellipse record.
 * @returns Normalized radii, or null when either record is malformed or keys conflict.
 */
export function normalizeOrbitRadii(
  orbitRadii: unknown,
  legacyEllipseRadii: unknown = {},
): Record<string, OrbitRadii> | null {
  if (!isRecord(orbitRadii) || !isRecord(legacyEllipseRadii)) return null

  const normalized = new Map<string, OrbitRadii>()
  for (const [orbitId, radii] of Object.entries(orbitRadii)) {
    if (typeof radii === 'number' && Number.isFinite(radii)) {
      normalized.set(orbitId, { horizontal: radii, vertical: radii })
    } else if (isOrbitRadii(radii)) {
      normalized.set(orbitId, radii)
    } else {
      return null
    }
  }
  for (const [orbitId, radii] of Object.entries(legacyEllipseRadii)) {
    if (normalized.has(orbitId) || !isOrbitRadii(radii)) {
      return null
    }
    normalized.set(orbitId, radii)
  }
  return Object.fromEntries(normalized)
}

/** Checks both ellipse axes against the shared minimum radius, in scene units. */
export function orbitRadiiMeetMinimum(radii: OrbitRadii, minimum: number): boolean {
  return radii.horizontal >= minimum && radii.vertical >= minimum
}

/**
 * Wraps an Orbit rotation into [0, 360) degrees and canonicalizes zero.
 * @param degrees Finite angle in degrees.
 * @returns Equivalent rotation between 0 inclusive and 360 exclusive.
 * @throws If degrees is not finite.
 */
export function normalizeOrbitRotation(degrees: number): number {
  if (!Number.isFinite(degrees)) {
    throw new Error('Orbit rotation must be finite.')
  }
  const normalized = ((degrees % 360) + 360) % 360
  return normalized === 0 ? 0 : normalized
}

/**
 * Validates and normalizes a stored Orbit-rotation record.
 * @param value Unknown map keyed by Orbit ID with degree values.
 * @returns Normalized rotations, or null if the input is not a finite numeric record.
 */
export function normalizeOrbitRotations(value: unknown): Record<string, number> | null {
  if (!isRecord(value)) return null
  const rotations = new Map<string, number>()
  for (const [orbitId, rotation] of Object.entries(value)) {
    if (typeof rotation !== 'number' || !Number.isFinite(rotation)) return null
    rotations.set(orbitId, normalizeOrbitRotation(rotation))
  }
  return Object.fromEntries(rotations)
}
