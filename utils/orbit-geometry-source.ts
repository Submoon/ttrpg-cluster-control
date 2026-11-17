import type { LocalWorkspace, Orbit, StarSystem } from '../domain/workspace'
import {
  objectPositions,
  orbitCenter,
  orbitRadii,
  orbitRotation,
} from './system-map-geometry'

/** Fingerprints one Orbit's resolved owner-local shape and host for stale direct-edit guards. */
export function orbitGeometrySource(workspace: LocalWorkspace, system: StarSystem, orbit: Orbit): string {
  const geometry = {
    objectAngles: workspace.layout.objectAngles,
    orbitRadii: workspace.layout.orbitRadii,
    orbitRotations: workspace.layout.orbitRotations,
  }
  return JSON.stringify({
    hostId: orbit.hostId,
    center: orbitCenter(orbit, objectPositions(system, geometry)),
    radii: orbitRadii(system, orbit, geometry),
    rotation: orbitRotation(orbit, geometry),
  })
}
