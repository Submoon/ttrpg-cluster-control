/**
 * Cluster operations keep route references and workspace layout aligned with system changes.
 */
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

/**
 * Builds a named system with its generated identity and one centered primary star.
 * @param name Name to validate for the new system.
 * @returns New system data; the caller supplies its cluster membership and layout position.
 * @throws If the name is blank or exceeds the domain name limit.
 */
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

/**
 * Returns the next schematic cluster-grid coordinate for a zero-based system index.
 * Values are normalized layout coordinates and are not clamped for large clusters.
 * @param index Zero-based position in the cluster's system list.
 * @returns A normalized cluster-map position.
 */
export function initialClusterSystemPosition(index: number): Point {
  return {
    x: 0.18 + (index % 3) * 0.32,
    y: 0.35 + Math.floor(index / 3) * 0.3,
  }
}

/**
 * Creates an in-memory workspace containing one cluster and its initial star system.
 * This does not persist anything; callers own the save boundary.
 * @param clusterName Name validated for the new Jump Cluster.
 * @param systemName Name validated for the initial star system.
 * @returns A new workspace with default field settings and initial layout.
 * @throws If either name is blank or exceeds the domain name limit.
 */
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

/**
 * Adds a new system and its initial cluster position without changing existing systems.
 * @param workspace Current immutable workspace.
 * @param name Optional name; defaults to the next "New System" label.
 * @returns Both the added system and the resulting workspace.
 * @throws If the supplied system name is invalid.
 */
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

/**
 * Replaces the system with the same ID and prunes layout entries made stale by its new contents.
 * The input workspace is not mutated; an unmatched ID is not added to the cluster.
 * @param workspace Current immutable workspace.
 * @param system Replacement contents for an existing system.
 * @returns A workspace with the matching system and retained layout references.
 */
export function replaceWorkspaceSystem(workspace: LocalWorkspace, system: StarSystem): LocalWorkspace {
  // Prune geometry for removed Orbits and objects no longer placed in an Orbit after replacement.
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

/**
 * Collects logical Jump Point objects with their owning systems for route selection and display.
 * @param cluster Cluster whose systems are searched.
 * @returns References to every object in the JumpPoint family.
 */
export function jumpPointsInCluster(cluster: JumpCluster): JumpPointReference[] {
  return cluster.systems.flatMap(system =>
    system.objects
      .filter(object => object.family === 'JumpPoint')
      .map(point => ({ point, system })),
  )
}

/**
 * Creates a route between distinct logical Jump Points or to an unresolved external exit.
 * Physical Station references are independent of this route endpoint contract.
 * @param cluster Cluster used to validate endpoint IDs.
 * @param jumpLevel Positive safe-integer route classification.
 * @param fromPointId Existing logical origin Jump Point ID.
 * @param toPointId Existing destination ID, or null for an external exit.
 * @param unresolvedExit Label used only when toPointId is null.
 * @returns A new route with a generated ID.
 * @throws If the level, endpoint IDs, or unresolved-exit label is invalid.
 */
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

/**
 * Revalidates route endpoints while preserving the existing route ID and optional name.
 * @param cluster Cluster used to validate endpoint IDs.
 * @param routeId ID of the route to update.
 * @param jumpLevel Positive safe-integer route classification.
 * @param fromPointId Existing logical origin Jump Point ID.
 * @param toPointId Existing destination ID, or null for an external exit.
 * @param unresolvedExit Label used only when toPointId is null.
 * @returns Updated route data with its prior identity and name.
 * @throws If the route is missing or any new route detail is invalid.
 */
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

/**
 * Validates route level and logical Jump Point endpoints, requiring a label for a null destination.
 * @param cluster Cluster whose Jump Points define valid endpoint IDs.
 * @param jumpLevel Positive safe-integer level.
 * @param fromPointId Existing origin Jump Point.
 * @param toPointId Different existing destination, or null for an unresolved external exit.
 * @param unresolvedExit External-exit label used only for a null destination.
 * @returns Validated route details without generated or preserved identity.
 * @throws If the level or endpoints are invalid, or the unresolved label is blank/overlong.
 */
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

/**
 * Renames the cluster and one selected system without changing their IDs or other contents.
 * @param workspace Current immutable workspace.
 * @param clusterName New Jump Cluster name.
 * @param systemName New name for the selected system.
 * @param systemId System to rename; defaults to the first cluster system.
 * @returns The renamed workspace.
 * @throws If either name is invalid or systemId does not identify a system in the cluster.
 */
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
