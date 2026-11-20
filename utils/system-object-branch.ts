/** Applied-data branch membership and camera bounds for one system object and its hosted descendants. */
import type { StarSystem } from '../domain/workspace'
import type { SvgViewportRect } from './map-zoom'
import { resolveSystemObjectBranch } from '../domain/workspace-object-branch'
import type { SystemObjectBranch } from '../domain/workspace-object-branch'
import {
  objectPositions,
  orbitRadii,
  orbitRotation,
  type SystemMapGeometry,
} from './system-map-geometry'

export { resolveSystemObjectBranch }
export type { SystemObjectBranch }

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
