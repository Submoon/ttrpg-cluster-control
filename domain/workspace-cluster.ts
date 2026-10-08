import { defaultObjectFieldSettings } from './workspace-model'
import type {
  JumpCluster,
  JumpPointReference,
  JumpRoute,
  LocalWorkspace,
  Point,
  StarSystem,
} from './workspace-model'
import { isJumpLevel, maxNameLength, validName, validText } from './workspace-validation'

type JumpRouteDetails = Pick<JumpRoute, 'jumpLevel' | 'fromPointId'> & (
  | { toPointId: string; unresolvedExit?: never }
  | { toPointId: null; unresolvedExit: string }
)

function initialStarSystem(name: string): StarSystem {
  return {
    id: crypto.randomUUID(),
    name: validName(name, 'Star system name'),
    objects: [{
      id: crypto.randomUUID(),
      family: 'CelestialBody',
      subtype: 'star',
      locationKey: 'A',
      name: 'Primary Star',
      description: '',
      placement: { kind: 'system', x: 0.5, y: 0.5 },
    }],
    orbits: [],
  }
}

export function initialClusterSystemPosition(index: number): Point {
  return {
    x: 0.18 + (index % 3) * 0.32,
    y: 0.35 + Math.floor(index / 3) * 0.3,
  }
}

export function createLocalWorkspace(clusterName: string, systemName: string): LocalWorkspace {
  const system = initialStarSystem(systemName)

  return {
    id: crypto.randomUUID(),
    cluster: {
      id: crypto.randomUUID(),
      name: validName(clusterName, 'Jump Cluster name'),
      systems: [system],
      routes: [],
    },
    layout: {
      systemPositions: { [system.id]: initialClusterSystemPosition(0) },
      orbitRadii: {},
      orbitRotations: {},
      objectAngles: {},
    },
    objectFieldSettings: defaultObjectFieldSettings(),
  }
}

export function addStarSystem(
  workspace: LocalWorkspace,
  name = `New System ${workspace.cluster.systems.length + 1}`,
): { workspace: LocalWorkspace; system: StarSystem } {
  const system = initialStarSystem(name)
  const index = workspace.cluster.systems.length
  return {
    system,
    workspace: {
      ...workspace,
      cluster: {
        ...workspace.cluster,
        systems: [...workspace.cluster.systems, system],
      },
      layout: {
        ...workspace.layout,
        systemPositions: {
          ...workspace.layout.systemPositions,
          [system.id]: initialClusterSystemPosition(index),
        },
      },
    },
  }
}

export function replaceWorkspaceSystem(workspace: LocalWorkspace, system: StarSystem): LocalWorkspace {
  const systems = workspace.cluster.systems.map(candidate =>
    candidate.id === system.id ? system : candidate,
  )
  const orbitIds = new Set(systems.flatMap(candidate => candidate.orbits.map(orbit => orbit.id)))
  const orbitalObjectIds = new Set(systems.flatMap(candidate =>
    candidate.objects
      .filter(object => object.placement.kind === 'orbit')
      .map(object => object.id),
  ))

  return {
    ...workspace,
    cluster: {
      ...workspace.cluster,
      systems,
    },
    layout: {
      ...workspace.layout,
      orbitRadii: Object.fromEntries(Object.entries(workspace.layout.orbitRadii)
        .filter(([orbitId]) => orbitIds.has(orbitId))),
      orbitRotations: Object.fromEntries(Object.entries(workspace.layout.orbitRotations)
        .filter(([orbitId]) => orbitIds.has(orbitId))),
      objectAngles: Object.fromEntries(Object.entries(workspace.layout.objectAngles)
        .filter(([objectId]) => orbitalObjectIds.has(objectId))),
    },
  }
}

export function jumpPointsInCluster(cluster: JumpCluster): JumpPointReference[] {
  return cluster.systems.flatMap(system =>
    system.objects
      .filter(object => object.family === 'JumpPoint')
      .map(point => ({ point, system })),
  )
}

export function createJumpRoute(
  cluster: JumpCluster,
  jumpLevel: number,
  fromPointId: string,
  toPointId: string | null,
  unresolvedExit = 'Uncharted exit',
): JumpRoute {
  return {
    id: crypto.randomUUID(),
    ...jumpRouteDetails(cluster, jumpLevel, fromPointId, toPointId, unresolvedExit),
  }
}

export function updateJumpRoute(
  cluster: JumpCluster,
  routeId: string,
  jumpLevel: number,
  fromPointId: string,
  toPointId: string | null,
  unresolvedExit = 'Uncharted exit',
): JumpRoute {
  const route = cluster.routes.find(candidate => candidate.id === routeId)
  if (!route) {
    throw new Error('The selected Jump Route no longer exists.')
  }

  const details = jumpRouteDetails(cluster, jumpLevel, fromPointId, toPointId, unresolvedExit)
  return {
    id: route.id,
    ...(route.name !== undefined ? { name: route.name } : {}),
    ...details,
  }
}

function jumpRouteDetails(
  cluster: JumpCluster,
  jumpLevel: number,
  fromPointId: string,
  toPointId: string | null,
  unresolvedExit: string,
): JumpRouteDetails {
  if (!isJumpLevel(jumpLevel)) {
    throw new Error('Jump level must be a positive integer.')
  }

  const jumpPoints = jumpPointsInCluster(cluster)
  if (!jumpPoints.some(({ point }) => point.id === fromPointId)) {
    throw new Error('Choose an existing Jump Point as the route origin.')
  }
  if (toPointId !== null && (
    toPointId === fromPointId
    || !jumpPoints.some(({ point }) => point.id === toPointId)
  )) {
    throw new Error('Choose a different existing Jump Point as the route destination.')
  }

  if (toPointId === null) {
    return {
      jumpLevel,
      fromPointId,
      toPointId,
      unresolvedExit: validText(unresolvedExit, 'Unresolved exit', maxNameLength),
    }
  }
  return { jumpLevel, fromPointId, toPointId }
}

export function renameLocalWorkspace(
  workspace: LocalWorkspace,
  clusterName: string,
  systemName: string,
  systemId = workspace.cluster.systems[0]?.id,
): LocalWorkspace {
  if (!systemId || !workspace.cluster.systems.some(system => system.id === systemId)) {
    throw new Error('The local workspace has no matching star system.')
  }

  return {
    ...workspace,
    cluster: {
      ...workspace.cluster,
      name: validName(clusterName, 'Jump Cluster name'),
      systems: workspace.cluster.systems.map(system =>
        system.id === systemId
          ? { ...system, name: validName(systemName, 'Star system name') }
          : system,
      ),
    },
  }
}
