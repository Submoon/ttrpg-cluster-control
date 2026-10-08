import type { JumpClusterExport, LocalWorkspace, StarSystemExport } from './workspace-model'

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

export function exportStarSystem(workspace: LocalWorkspace, systemId: string): StarSystemExport {
  const system = workspace.cluster.systems.find(candidate => candidate.id === systemId)
  if (!system) {
    throw new Error('The selected star system no longer exists.')
  }

  const orbitIds = new Set(system.orbits.map(orbit => orbit.id))
  const orbitalObjectIds = new Set(system.objects
    .filter(object => object.placement.kind === 'orbit')
    .map(object => object.id))
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
