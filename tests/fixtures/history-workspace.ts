import { createLocalWorkspace, type LocalWorkspace, type StarSystem, type SystemObject } from '../../domain/workspace'
import { createWorkspaceSnapshot } from '../../utils/workspace-storage'

/** Valid campaign-scale data with nested Orbits, routes, Fields and multibyte text. */
export function createHistoryMeasurementWorkspace(systemCount: number, objectsPerSystem: number): LocalWorkspace {
  const workspace = createLocalWorkspace('Measured Reach', 'Measured System')
  workspace.objectFieldSettings.customFields = [
    { id: 'measurement-notes', name: 'Campaign notes', type: 'text' },
    { id: 'measurement-threat', name: 'Threat', type: 'number' },
    { id: 'measurement-known', name: 'Known', type: 'boolean' },
  ]
  workspace.cluster.systems = []
  workspace.layout.systemPositions = {}
  for (let systemIndex = 0; systemIndex < systemCount; systemIndex += 1) {
    const id = `measurement-system-${systemIndex}`
    const objects: SystemObject[] = Array.from({ length: objectsPerSystem }, (_, objectIndex) => ({
      id: `${id}-object-${objectIndex}`,
      locationKey: `M${objectIndex}`,
      name: `Measured object ${objectIndex}`,
      family: objectIndex === 3 ? 'JumpPoint' : 'CelestialBody',
      subtype: objectIndex === 3 ? 'jump-point' : objectIndex === 0 ? 'star' : 'planet',
      description: '星🚀'.repeat(300),
      placement: objectIndex === 1 || objectIndex === 2
        ? { kind: 'orbit', orbitId: `${id}-orbit-${objectIndex}` }
        : { kind: 'system', x: (objectIndex % 10) / 10, y: Math.floor(objectIndex / 10) / 10 },
      customFieldValues: {
        'measurement-notes': '地図'.repeat(500),
        'measurement-threat': 0,
        'measurement-known': false,
      },
    }))
    const system: StarSystem = {
      id, name: `Measured System ${systemIndex}`, objects,
      orbits: [
        { id: `${id}-orbit-1`, hostId: `${id}-object-0`, order: 1 },
        { id: `${id}-orbit-2`, hostId: `${id}-object-1`, order: 1 },
      ],
    }
    workspace.cluster.systems.push(system)
    workspace.layout.systemPositions[id] = { x: (systemIndex % 5) / 5, y: Math.floor(systemIndex / 5) / 5 }
    workspace.layout.orbitRadii[`${id}-orbit-1`] = { horizontal: 800, vertical: 700 }
    workspace.layout.orbitRadii[`${id}-orbit-2`] = { horizontal: 200, vertical: 180 }
    workspace.layout.orbitRotations[`${id}-orbit-1`] = 35
    workspace.layout.objectAngles[`${id}-object-1`] = 0.4
    workspace.layout.objectAngles[`${id}-object-2`] = 1.2
    if (systemIndex > 0) {
      workspace.cluster.routes.push({
        id: `measurement-route-${systemIndex}`,
        fromPointId: `measurement-system-${systemIndex - 1}-object-3`,
        toPointId: `${id}-object-3`, jumpLevel: 1,
      })
    }
  }
  return createWorkspaceSnapshot(workspace)
}
