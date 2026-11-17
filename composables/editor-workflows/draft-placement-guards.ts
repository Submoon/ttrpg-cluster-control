import type { Point, StarSystem } from '../../domain/workspace'
import { objectPositions, orbitCenter, orbitRadii, orbitRotation, type SystemMapGeometry } from '../../utils/system-map-geometry'
import type { EntityCommand } from './types'

function samePoint(first: Point, second: Point): boolean {
  return first.x === second.x && first.y === second.y
}

/** Identifies placement commands that would depend on coordinates still in an Inspector draft. */
export function draftPlacementGuard(
  applied: StarSystem,
  appliedLayout: SystemMapGeometry,
  projected: StarSystem,
  projectedLayout: SystemMapGeometry,
): (command: EntityCommand) => boolean {
  const appliedPositions = objectPositions(applied, appliedLayout)
  const projectedPositions = objectPositions(projected, projectedLayout)
  const movedObjects = new Set<string>()
  for (const [id, position] of appliedPositions) {
    const preview = projectedPositions.get(id)
    if (preview && !samePoint(position, preview)) movedObjects.add(id)
  }

  const projectedOrbits = new Map(projected.orbits.map(orbit => [orbit.id, orbit]))
  const movedOrbits = new Set<string>()
  for (const orbit of applied.orbits) {
    const preview = projectedOrbits.get(orbit.id)
    if (!preview) continue
    const radii = orbitRadii(applied, orbit, appliedLayout)
    const previewRadii = orbitRadii(projected, preview, projectedLayout)
    if (orbit.hostId !== preview.hostId
      || !samePoint(orbitCenter(orbit, appliedPositions), orbitCenter(preview, projectedPositions))
      || radii.horizontal !== previewRadii.horizontal || radii.vertical !== previewRadii.vertical
      || orbitRotation(orbit, appliedLayout) !== orbitRotation(preview, projectedLayout)) {
      movedOrbits.add(orbit.id)
    }
  }

  const objectChanged = (id: string | null): boolean => id !== null && movedObjects.has(id)
  const orbitChanged = (id?: string | null): boolean => id != null && movedOrbits.has(id)
  return (command) => {
    switch (command.kind) {
      case 'object-placement':
        return objectChanged(command.objectId) || orbitChanged(command.fromOrbitId) || orbitChanged(command.toOrbitId)
      case 'object-create':
        return orbitChanged(command.orbitId)
      case 'orbit-geometry':
      case 'orbit-center-position':
        return orbitChanged(command.orbitId)
      case 'orbit-host':
        return orbitChanged(command.orbitId) || objectChanged(command.hostId)
      case 'orbit-create':
        return objectChanged(command.hostId)
      default:
        return false
    }
  }
}
