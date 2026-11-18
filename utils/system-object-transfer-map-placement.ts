import { canPlaceObjectInOrbit, type Point, type StarSystem, type SystemObjectTransferPlacement } from '../domain/workspace'
import { fromNormalizedMapPoint } from '../domain/workspace-map-coordinates'
import {
  objectPositions,
  orbitAngleAtPoint,
  orbitCenter,
  orbitRadii,
  orbitRotation,
  type SystemMapGeometry,
} from './system-map-geometry'

type TransferPlacementCandidate =
  | { readonly kind: 'system'; readonly x: number; readonly y: number }
  | { readonly kind: 'orbit'; readonly orbitId: string; readonly angle: number }

/** Resolves a destination pointer point while retaining an explicitly selected eligible Orbit. */
export function resolveSystemObjectTransferMapPlacement(
  system: StarSystem,
  geometry: SystemMapGeometry,
  rootObjectId: string,
  selectedPlacement: TransferPlacementCandidate | null,
  normalizedPoint: Readonly<Point>,
): SystemObjectTransferPlacement | null {
  if (!Number.isFinite(normalizedPoint.x) || !Number.isFinite(normalizedPoint.y)) return null
  if (selectedPlacement?.kind !== 'orbit') {
    return { kind: 'system', x: normalizedPoint.x, y: normalizedPoint.y }
  }

  const orbit = system.orbits.find(candidate => candidate.id === selectedPlacement.orbitId)
  if (!orbit || !canPlaceObjectInOrbit(system, rootObjectId, orbit.id)) return null
  try {
    const positions = objectPositions(system, geometry)
    const angle = orbitAngleAtPoint(
      fromNormalizedMapPoint(normalizedPoint),
      orbitCenter(orbit, positions),
      orbitRadii(system, orbit, geometry),
      orbitRotation(orbit, geometry),
    )
    return Number.isFinite(angle) ? { kind: 'orbit', orbitId: orbit.id, angle } : null
  } catch {
    return null
  }
}
