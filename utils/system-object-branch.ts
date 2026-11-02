/** Applied-data branch membership and camera bounds for one system object and its hosted descendants. */
import type { StarSystem } from '../domain/workspace'
import type { SvgViewportRect } from './map-zoom'
import {
  objectPositions,
  orbitRadii,
  orbitRotation,
  type SystemMapGeometry,
} from './system-map-geometry'

export interface SystemObjectBranch {
  objectIds: string[]
  orbitIds: string[]
}

export interface MeasuredSystemObjectBranch extends SystemObjectBranch {
  bounds: SvgViewportRect
}

function isFiniteRect(rect: SvgViewportRect): boolean {
  return Number.isFinite(rect.x)
    && Number.isFinite(rect.y)
    && Number.isFinite(rect.width)
    && Number.isFinite(rect.height)
    && Number.isFinite(rect.x + rect.width)
    && Number.isFinite(rect.y + rect.height)
    && rect.width >= 0
    && rect.height >= 0
}

function unionBounds(current: SvgViewportRect | undefined, next: SvgViewportRect): SvgViewportRect {
  if (!current) return next
  const left = Math.min(current.x, next.x)
  const top = Math.min(current.y, next.y)
  const right = Math.max(current.x + current.width, next.x + next.width)
  const bottom = Math.max(current.y + current.height, next.y + next.height)
  return { x: left, y: top, width: right - left, height: bottom - top }
}

/**
 * Resolves only an object's hosted Orbit descendants. Parent placements, siblings, Station links and
 * Jump Route references are outside this directed branch. Visited IDs also make malformed cycles safe.
 */
export function resolveSystemObjectBranch(
  system: StarSystem,
  targetObjectId: string,
): SystemObjectBranch | undefined {
  const objectsById = new Map(system.objects.map(object => [object.id, object]))
  if (!objectsById.has(targetObjectId)) return undefined

  const hostedOrbits = new Map<string, string[]>()
  for (const orbit of system.orbits) {
    if (orbit.hostId === null) continue
    const orbitIds = hostedOrbits.get(orbit.hostId) ?? []
    orbitIds.push(orbit.id)
    hostedOrbits.set(orbit.hostId, orbitIds)
  }

  const objectsByOrbit = new Map<string, string[]>()
  for (const object of system.objects) {
    if (object.placement.kind !== 'orbit') continue
    const objectIds = objectsByOrbit.get(object.placement.orbitId) ?? []
    objectIds.push(object.id)
    objectsByOrbit.set(object.placement.orbitId, objectIds)
  }

  const objectIds = new Set<string>()
  const orbitIds = new Set<string>()
  function visit(objectId: string): void {
    if (objectIds.has(objectId)) return
    objectIds.add(objectId)

    for (const orbitId of hostedOrbits.get(objectId) ?? []) {
      if (orbitIds.has(orbitId)) continue
      orbitIds.add(orbitId)
      for (const childId of objectsByOrbit.get(orbitId) ?? []) visit(childId)
    }
  }

  visit(targetObjectId)
  return { objectIds: [...objectIds], orbitIds: [...orbitIds] }
}

/**
 * Unions measured object glyph bounds with the painted, analytically rotated ellipse bounds for
 * every hosted Orbit in the branch. Input glyph rectangles are local to their translated object group.
 * Returns undefined if the target, any required glyph, or applied geometry cannot be measured safely.
 */
export function measureSystemObjectBranchBounds(
  system: StarSystem,
  targetObjectId: string,
  geometry: SystemMapGeometry,
  objectGlyphBounds: ReadonlyMap<string, SvgViewportRect>,
  orbitStrokeWidth = 2,
): MeasuredSystemObjectBranch | undefined {
  const branch = resolveSystemObjectBranch(system, targetObjectId)
  if (!branch || !Number.isFinite(orbitStrokeWidth) || orbitStrokeWidth < 0) return undefined

  let positions: Map<string, { x: number; y: number }>
  try {
    positions = objectPositions(system, geometry)
  } catch {
    return undefined
  }

  let bounds: SvgViewportRect | undefined
  for (const objectId of branch.objectIds) {
    const position = positions.get(objectId)
    const glyph = objectGlyphBounds.get(objectId)
    if (!position || !glyph || !isFiniteRect(glyph) || (glyph.width === 0 && glyph.height === 0)) {
      return undefined
    }
    bounds = unionBounds(bounds, {
      x: position.x + glyph.x,
      y: position.y + glyph.y,
      width: glyph.width,
      height: glyph.height,
    })
  }

  const orbitsById = new Map(system.orbits.map(orbit => [orbit.id, orbit]))
  for (const orbitId of branch.orbitIds) {
    const orbit = orbitsById.get(orbitId)
    const center = orbit?.hostId === null || !orbit
      ? undefined
      : positions.get(orbit.hostId)
    if (!orbit || !center) return undefined

    const radii = orbitRadii(system, orbit, geometry)
    const rotation = orbitRotation(orbit, geometry)
    const radians = rotation * Math.PI / 180
    const cosine = Math.cos(radians)
    const sine = Math.sin(radians)
    const halfWidth = Math.hypot(radii.horizontal * cosine, radii.vertical * sine) + orbitStrokeWidth / 2
    const halfHeight = Math.hypot(radii.horizontal * sine, radii.vertical * cosine) + orbitStrokeWidth / 2
    if (![halfWidth, halfHeight].every(Number.isFinite)) return undefined
    bounds = unionBounds(bounds, {
      x: center.x - halfWidth,
      y: center.y - halfHeight,
      width: halfWidth * 2,
      height: halfHeight * 2,
    })
  }

  if (!bounds || !isFiniteRect(bounds) || (bounds.width === 0 && bounds.height === 0)) return undefined
  return { ...branch, bounds }
}
