/**
 * Cluster operations keep route references and workspace layout aligned with system changes.
 */
import { defaultObjectFieldSettings } from './workspace-model'
import type {
  JumpCluster,
  JumpPointReference,
  JumpRoute,
  JumpRouteInput,
  ChartDetailsChanges,
  LocalWorkspace,
  Point,
  StarSystem,
} from './workspace-model'
import {
  isJumpLevel,
  isPublicationMode,
  maxNameLength,
  validName,
  validText,
} from './workspace-validation'

type JumpRouteDetails = Omit<JumpRoute, 'id' | 'name' | 'playerShared'>

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
    publication: 'known-type',
    objects: [{
      id: crypto.randomUUID(),
      publication: 'known-type',
      family: 'CelestialBody',
      subtype: 'star',
      locationKey: 'A',
      name: 'Primary Star',
      description: '',
      playerText: '',
      playerFieldMasks: [],
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
    version: 5,
    id: crypto.randomUUID(),
    cluster: {
      id: crypto.randomUUID(),
      name: validName(clusterName, 'Jump Cluster name'),
      playerTitle: 'Player Jump Cluster',
      systems: [system],
      routes: [],
    },
    layout: {
      systemPositions: { [system.id]: initialClusterSystemPosition(0) },
      unresolvedExitPositions: {},
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

/** Creates a route between distinct systems with optional local Jump Points. */
export function createJumpRoute(cluster: JumpCluster, input: JumpRouteInput): JumpRoute
/** @deprecated Point-only compatibility for existing in-repository callers. */
export function createJumpRoute(
  cluster: JumpCluster,
  jumpLevel: number,
  fromPointId: string,
  toPointId: string | null,
  unresolvedExit?: string,
  playerShared?: boolean,
): JumpRoute
export function createJumpRoute(
  cluster: JumpCluster,
  inputOrLevel: JumpRouteInput | number,
  oldFromPointId?: string,
  oldToPointId?: string | null,
  oldUnresolvedExit = 'Uncharted exit',
  oldPlayerShared = false,
): JumpRoute {
  const input = typeof inputOrLevel === 'number'
    ? legacyJumpRouteInput(cluster, inputOrLevel, oldFromPointId, oldToPointId, oldUnresolvedExit, oldPlayerShared)
    : inputOrLevel
  const playerShared = input.playerShared ?? false
  if (typeof playerShared !== 'boolean') {
    throw new Error('Choose whether this Jump Route is shared with players.')
  }
  return {
    id: crypto.randomUUID(),
    ...jumpRouteDetails(cluster, input),
    playerShared,
  }
}

/** Revalidates route endpoints while preserving route identity and omitted sharing settings. */
export function updateJumpRoute(cluster: JumpCluster, routeId: string, input: JumpRouteInput): JumpRoute
/** @deprecated Point-only compatibility for existing in-repository callers. */
export function updateJumpRoute(
  cluster: JumpCluster,
  routeId: string,
  jumpLevel: number,
  fromPointId: string,
  toPointId: string | null,
  unresolvedExit?: string,
  playerShared?: boolean,
): JumpRoute
export function updateJumpRoute(
  cluster: JumpCluster,
  routeId: string,
  inputOrLevel: JumpRouteInput | number,
  oldFromPointId?: string,
  oldToPointId?: string | null,
  oldUnresolvedExit = 'Uncharted exit',
  oldPlayerShared?: boolean,
): JumpRoute {
  const route = cluster.routes.find(candidate => candidate.id === routeId)
  if (!route) throw new Error('The selected Jump Route no longer exists.')
  const input = typeof inputOrLevel === 'number'
    ? legacyJumpRouteInput(cluster, inputOrLevel, oldFromPointId, oldToPointId, oldUnresolvedExit, oldPlayerShared)
    : inputOrLevel
  if (input.playerShared !== undefined && typeof input.playerShared !== 'boolean') {
    throw new Error('Choose whether this Jump Route is shared with players.')
  }
  return {
    id: route.id,
    ...(route.name !== undefined ? { name: route.name } : {}),
    ...jumpRouteDetails(cluster, input),
    playerShared: input.playerShared ?? route.playerShared,
  }
}

function jumpRouteDetails(cluster: JumpCluster, input: JumpRouteInput): JumpRouteDetails {
  if (!isJumpLevel(input.jumpLevel)) throw new Error('Jump level must be a positive integer.')

  const fromSystem = cluster.systems.find(system => system.id === input.fromSystemId)
  if (!fromSystem) throw new Error('Choose an existing system as the route origin.')
  if (input.fromPointId !== null && !fromSystem.objects.some(object =>
    object.id === input.fromPointId && object.family === 'JumpPoint')) {
    throw new Error('Choose a Jump Point in the selected origin system.')
  }

  if (input.toSystemId === null) {
    if (input.toPointId !== null) throw new Error('An unresolved destination cannot include a Jump Point.')
    return {
      jumpLevel: input.jumpLevel,
      fromSystemId: fromSystem.id,
      fromPointId: input.fromPointId,
      toSystemId: null,
      toPointId: null,
      unresolvedExit: validText(input.unresolvedExit ?? '', 'Unresolved exit', maxNameLength),
    }
  }

  const toSystem = cluster.systems.find(system => system.id === input.toSystemId)
  if (!toSystem) throw new Error('Choose an existing system as the route destination.')
  if (toSystem.id === fromSystem.id) throw new Error('Choose a different system as the route destination.')
  if (input.toPointId !== null && !toSystem.objects.some(object =>
    object.id === input.toPointId && object.family === 'JumpPoint')) {
    throw new Error('Choose a Jump Point in the selected destination system.')
  }
  if (input.unresolvedExit !== undefined) {
    throw new Error('A known-system destination cannot include an unresolved-exit label.')
  }
  return {
    jumpLevel: input.jumpLevel,
    fromSystemId: fromSystem.id,
    fromPointId: input.fromPointId,
    toSystemId: toSystem.id,
    toPointId: input.toPointId,
  }
}

function legacyJumpRouteInput(
  cluster: JumpCluster,
  jumpLevel: number,
  fromPointId: string | undefined,
  toPointId: string | null | undefined,
  unresolvedExit: string,
  playerShared?: boolean,
): JumpRouteInput {
  const points = jumpPointsInCluster(cluster)
  const from = points.find(reference => reference.point.id === fromPointId)
  if (!from) throw new Error('Choose an existing Jump Point as the route origin.')
  if (toPointId === null) {
    return {
      jumpLevel,
      fromSystemId: from.system.id,
      fromPointId: from.point.id,
      toSystemId: null,
      toPointId: null,
      unresolvedExit,
      playerShared,
    }
  }
  const to = points.find(reference => reference.point.id === toPointId)
  if (!to) throw new Error('Choose a different existing Jump Point as the route destination.')
  return {
    jumpLevel,
    fromSystemId: from.system.id,
    fromPointId: from.point.id,
    toSystemId: to.system.id,
    toPointId: to.point.id,
    playerShared,
  }
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

/**
 * Updates one system's publication and chart labels while retaining all source contents and layout.
 * @param workspace Current immutable workspace.
 * @param systemId System whose name and publication are changed.
 * @param changes Proposed private/public chart labels and publication mode.
 * @returns A detached workspace with validated, trimmed chart details.
 * @throws If any label, publication mode, or system ID is invalid.
 */
export function updateChartDetails(
  workspace: LocalWorkspace,
  systemId: string,
  changes: ChartDetailsChanges,
): LocalWorkspace {
  if (!workspace.cluster.systems.some(system => system.id === systemId)) {
    throw new Error('The local workspace has no matching star system.')
  }
  if (!isPublicationMode(changes.publication)) {
    throw new Error('Choose a supported publication mode.')
  }

  const clusterName = validName(changes.clusterName, 'Jump Cluster name')
  const systemName = validName(changes.systemName, 'Star system name')
  const playerTitle = validText(changes.playerTitle, 'Player-facing title', maxNameLength)

  return {
    ...workspace,
    cluster: {
      ...workspace.cluster,
      name: clusterName,
      playerTitle,
      systems: workspace.cluster.systems.map(system => system.id === systemId
        ? { ...system, name: systemName, publication: changes.publication }
        : system),
    },
  }
}
