import type { Orbit, OrbitRadii, Point, StarSystem, SystemObject } from './workspace-model'
import { isRecord } from './workspace-validation'

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

function orbitHost(system: StarSystem, orbit: Orbit): SystemObject | null {
  if (orbit.hostId === null) return null
  const host = system.objects.find(object => object.id === orbit.hostId)
  if (!host) {
    throw new Error(`Orbit "${orbit.id}" has no host object.`)
  }
  return host
}

export function defaultOrbitRadius(system: StarSystem, orbit: Orbit): number {
  const host = orbitHost(system, orbit)
  return host === null || host.subtype === 'star'
    ? 112 + (orbit.order - 1) * 58
    : 46 + (orbit.order - 1) * 28
}

export function minimumOrbitRadius(system: StarSystem, orbit: Orbit): number {
  const host = orbitHost(system, orbit)
  return Math.ceil((host === null ? 0 : host.subtype === 'star' ? 23 : 14) + 16)
}

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

function isOrbitRadii(value: unknown): value is OrbitRadii {
  return isRecord(value)
    && typeof value.horizontal === 'number'
    && Number.isFinite(value.horizontal)
    && typeof value.vertical === 'number'
    && Number.isFinite(value.vertical)
}

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

export function orbitRadiiMeetMinimum(radii: OrbitRadii, minimum: number): boolean {
  return radii.horizontal >= minimum && radii.vertical >= minimum
}

export function normalizeOrbitRotation(degrees: number): number {
  if (!Number.isFinite(degrees)) {
    throw new Error('Orbit rotation must be finite.')
  }
  const normalized = ((degrees % 360) + 360) % 360
  return normalized === 0 ? 0 : normalized
}

export function normalizeOrbitRotations(value: unknown): Record<string, number> | null {
  if (!isRecord(value)) return null
  const rotations = new Map<string, number>()
  for (const [orbitId, rotation] of Object.entries(value)) {
    if (typeof rotation !== 'number' || !Number.isFinite(rotation)) return null
    rotations.set(orbitId, normalizeOrbitRotation(rotation))
  }
  return Object.fromEntries(rotations)
}
