import { addStarSystem, createJumpRoute, createLocalWorkspace, createSystemObject } from '../../domain/workspace'

/** A complete source campaign with one route root and its hosted occupant. */
export function workspaceWithRouteObjects() {
  const initial = createLocalWorkspace('Kestrel Reach', 'Vesper')
  const origin = initial.cluster.systems[0]!
  const { workspace, system: destination } = addStarSystem(initial, 'Aster')
  const route = createJumpRoute(workspace.cluster, {
    jumpLevel: 3,
    fromSystemId: origin.id,
    fromPointId: null,
    toSystemId: destination.id,
    toPointId: null,
  })
  const root = {
    ...createSystemObject(origin, 'vessel'),
    id: 'route-vessel',
    name: 'Survey vessel',
    description: 'Private expedition log',
    playerText: 'Survey in progress',
    markerColor: '#2299ff',
    placement: { kind: 'route', progression: 0.25 } as const,
  }
  const orbit = { id: 'route-vessel-orbit', hostId: root.id, order: 1 }
  const occupant = {
    ...createSystemObject(origin, 'anomaly'),
    id: 'route-anomaly',
    name: 'Captured echo',
    placement: { kind: 'orbit', orbitId: orbit.id } as const,
  }
  const branch = { objects: [root, occupant], orbits: [orbit] }

  return {
    route,
    root,
    orbit,
    occupant,
    branch,
    workspace: {
      ...workspace,
      version: 7 as const,
      cluster: {
        ...workspace.cluster,
        routes: [route],
        routeContents: { [route.id]: branch },
      },
      layout: {
        ...workspace.layout,
        orbitRadii: { [orbit.id]: { horizontal: 92, vertical: 45 } },
        orbitRotations: { [orbit.id]: 90 },
        objectAngles: { [occupant.id]: 0 },
      },
    },
  }
}
