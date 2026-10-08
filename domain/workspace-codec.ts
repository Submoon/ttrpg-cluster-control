/**
 * Versioned export projections preserve durable map layout without temporary view state.
 */
import type { JumpClusterExport, LocalWorkspace, StarSystemExport } from './workspace-model'

/**
 * Projects the complete Cluster and durable workspace layout into the version 1 JSON export shape.
 * @param workspace Workspace to export.
 * @returns Cluster data, shared field definitions, and saved map layout; no transient renderer state.
 */
export function exportJumpCluster(workspace: LocalWorkspace): JumpClusterExport {
  return {
    format: 'mothership-campaign-map',
    version: 1,
    type: 'cluster',
    cluster: workspace.cluster,
    objectFieldSettings: workspace.objectFieldSettings,
    layout: {
      version: 1,
      ...workspace.layout,
    },
  }
}

/**
 * Projects one system with its own Orbit radii, rotations, and placed-object angles.
 * Shared field settings are retained; Cluster routes and systemPositions are intentionally omitted.
 * @param workspace Workspace containing the system and shared field definitions.
 * @param systemId System to export.
 * @returns Standalone system export with only that system's Orbit/object layout.
 * @throws If systemId no longer identifies a system in the workspace.
 */
export function exportStarSystem(workspace: LocalWorkspace, systemId: string): StarSystemExport {
  const system = workspace.cluster.systems.find(candidate => candidate.id === systemId)
  if (!system) {
    throw new Error('The selected star system no longer exists.')
  }

  const orbitIds = new Set(system.orbits.map(orbit => orbit.id))
  const orbitalObjectIds = new Set(system.objects
    .filter(object => object.placement.kind === 'orbit')
    .map(object => object.id))
  // A standalone system carries only its own Orbit/object layout, never Cluster routes or system positions.
  return {
    format: 'mothership-campaign-map',
    version: 1,
    type: 'system',
    system,
    objectFieldSettings: workspace.objectFieldSettings,
    layout: {
      version: 1,
      orbitRadii: Object.fromEntries(Object.entries(workspace.layout.orbitRadii)
        .filter(([orbitId]) => orbitIds.has(orbitId))),
      orbitRotations: Object.fromEntries(Object.entries(workspace.layout.orbitRotations)
        .filter(([orbitId]) => orbitIds.has(orbitId))),
      objectAngles: Object.fromEntries(Object.entries(workspace.layout.objectAngles)
        .filter(([objectId]) => orbitalObjectIds.has(objectId))),
    },
  }
}
