/** Pure whole-workspace proposal and immutable application for transferring one hosted object branch. */
import { catalogueBranches, routeContentsFor, type RouteLanding } from './workspace-route-objects'
import type { CatalogueObject, LocalWorkspace, Orbit, RouteObject, RouteContents, StarSystem, SystemObject } from './workspace-model'
import { canPlaceObjectInOrbit } from './workspace-orbits'
import { captureEffectiveObjectAngles } from './workspace-placement'
import { resolveSystemObjectBranch, type SystemObjectBranch } from './workspace-object-branch'
import { fromNormalizedMapPoint } from './workspace-map-coordinates'

export type SystemObjectTransferPlacement =
  | { kind: 'system'; x: number; y: number }
  | { kind: 'orbit'; orbitId: string; angle: number }

export interface SystemObjectTransferRequest {
  sourceSystemId: string
  rootObjectId: string
  destinationSystemId: string
  placement: SystemObjectTransferPlacement
}

export interface SystemObjectTransferRouteAttachment {
  routeId: string
  end: 'from' | 'to'
  pointId: string
}

export interface SystemObjectTransferStationLink {
  objectId: string
  stationId: string
  direction: 'incoming' | 'outgoing'
}

export type CatalogueTransferSource =
  | { kind: 'system'; systemId: string }
  | { kind: 'route'; routeId: string }

export type CatalogueTransferLanding =
  | { kind: 'system'; systemId: string; placement: SystemObjectTransferPlacement }
  | ({ kind: 'route' } & RouteLanding)

export interface CatalogueObjectTransferRequest {
  source: CatalogueTransferSource
  rootObjectId: string
  landing: CatalogueTransferLanding
}

/** The source snapshot, exact landing workspace and relationships shown for acceptance. */
export interface CatalogueObjectTransferReview {
  sourceWorkspace: LocalWorkspace
  request: CatalogueObjectTransferRequest
  branch: SystemObjectBranch
  detachedRouteAttachments: SystemObjectTransferRouteAttachment[]
  clearedStationLinks: SystemObjectTransferStationLink[]
  previewWorkspace: LocalWorkspace
}

export interface SystemObjectTransferReview extends Omit<CatalogueObjectTransferReview, 'request'> {
  request: SystemObjectTransferRequest
}

interface TransferContents {
  objects: readonly CatalogueObject[]
  orbits: readonly Orbit[]
}

/** Resolves the current owner of an object after transfer, Undo, or Redo. */
export function resolveSystemObjectHistoryTarget(
  workspace: LocalWorkspace,
  objectId: string,
): { kind: 'object'; id: string; systemId: string } | null {
  let owner: StarSystem | null = null
  for (const system of workspace.cluster.systems) {
    if (!system.objects.some(object => object.id === objectId)) continue
    if (owner) return null
    owner = system
  }
  return owner ? { kind: 'object', id: objectId, systemId: owner.id } : null
}

/** Finds the surviving owner of a unique catalogue identity after history traversal. */
export function resolveCatalogueObjectHistoryTarget(workspace: LocalWorkspace, objectId: string) {
  const local = resolveSystemObjectHistoryTarget(workspace, objectId)
  if (local) return local
  const routes = workspace.cluster.routes.filter(route => routeContentsFor(workspace.cluster, route.id)
    ?.objects.some(object => object.id === objectId))
  return routes.length === 1 ? { kind: 'route-object' as const, id: objectId, routeId: routes[0]!.id } : null
}

function findSystem(workspace: LocalWorkspace, systemId: string, label: string): StarSystem {
  const system = workspace.cluster.systems.find(candidate => candidate.id === systemId)
  if (!system) throw new Error(`The ${label} Zone no longer exists.`)
  return system
}

function validatePlacement(
  destination: StarSystem,
  rootObjectId: string,
  placement: SystemObjectTransferPlacement,
): void {
  if (placement.kind === 'system') {
    if (!Number.isFinite(placement.x) || !Number.isFinite(placement.y)) {
      throw new Error('Schematic X and Y must be finite numbers.')
    }
    const scenePoint = fromNormalizedMapPoint(placement)
    if (!Number.isFinite(scenePoint.x) || !Number.isFinite(scenePoint.y)) {
      throw new Error('Choose a free position that can be represented on the destination map.')
    }
    return
  }
  if (!Number.isFinite(placement.angle)) throw new Error('Object Orbit angle must be finite.')
  if (!canPlaceObjectInOrbit(destination, rootObjectId, placement.orbitId)) {
    throw new Error('Choose a valid destination Orbit for this object.')
  }
}

function collectCrossingRelationships(
  workspace: LocalWorkspace,
  source: TransferContents,
  sourceSystemId: string | undefined,
  branchObjectIds: ReadonlySet<string>,
): {
  detachedRouteAttachments: SystemObjectTransferRouteAttachment[]
  clearedStationLinks: SystemObjectTransferStationLink[]
} {
  const detachedRouteAttachments: SystemObjectTransferRouteAttachment[] = []
  for (const route of workspace.cluster.routes) {
    if (route.fromSystemId === sourceSystemId && route.fromPointId !== null && branchObjectIds.has(route.fromPointId)) {
      detachedRouteAttachments.push({ routeId: route.id, end: 'from', pointId: route.fromPointId })
    }
    if (route.toSystemId === sourceSystemId && route.toPointId !== null && branchObjectIds.has(route.toPointId)) {
      detachedRouteAttachments.push({ routeId: route.id, end: 'to', pointId: route.toPointId })
    }
  }

  const clearedStationLinks: SystemObjectTransferStationLink[] = []
  for (const object of source.objects) {
    const stationId = object.jumpStationId
    if (object.family !== 'JumpPoint' || !stationId) continue
    const objectMoves = branchObjectIds.has(object.id)
    const stationMoves = branchObjectIds.has(stationId)
    if (objectMoves === stationMoves) continue
    clearedStationLinks.push({
      objectId: object.id,
      stationId,
      direction: objectMoves ? 'outgoing' : 'incoming',
    })
  }
  return { detachedRouteAttachments, clearedStationLinks }
}

function findContents(
  workspace: LocalWorkspace,
  owner: CatalogueTransferSource,
  label: string,
): TransferContents {
  if (owner.kind === 'system') return findSystem(workspace, owner.systemId, label)
  if (!workspace.cluster.routes.some(route => route.id === owner.routeId)) {
    throw new Error(`The ${label} Jump Route no longer exists.`)
  }
  return routeContentsFor(workspace.cluster, owner.routeId) ?? { objects: [], orbits: [] }
}

function replaceContents(
  cluster: LocalWorkspace['cluster'],
  owner: CatalogueTransferSource,
  contents: TransferContents,
): LocalWorkspace['cluster'] {
  if (owner.kind === 'system') {
    const objects = contents.objects.map((object): SystemObject => {
      const { placement } = object
      if (placement.kind === 'route') throw new Error('Choose a valid landing within the destination Zone.')
      return { ...object, placement }
    })
    return {
      ...cluster,
      systems: cluster.systems.map(system => system.id === owner.systemId
        ? { ...system, objects, orbits: [...contents.orbits] }
        : system),
    }
  }

  const routeContents = { ...cluster.routeContents }
  if (!contents.objects.length && !contents.orbits.length) {
    delete routeContents[owner.routeId]
  } else {
    const objects = contents.objects.map((object): RouteObject => {
      const { placement } = object
      if (placement.kind === 'system') throw new Error('Choose a valid position on the destination Jump Route.')
      return { ...object, placement }
    })
    const orbits = contents.orbits.map((orbit): RouteContents['orbits'][number] => {
      if (orbit.hostId === null) throw new Error('Only hosted Orbits can move onto a Jump Route.')
      return { id: orbit.id, hostId: orbit.hostId, order: orbit.order }
    })
    return { ...cluster, routeContents: { ...routeContents, [owner.routeId]: { objects, orbits } } }
  }
  return { ...cluster, routeContents }
}

/** Proposes an immutable move between different catalogue owners while retaining the hosted branch. */
export function prepareCatalogueObjectTransfer(
  workspace: LocalWorkspace,
  request: CatalogueObjectTransferRequest,
): CatalogueObjectTransferReview {
  const { source: sourceOwner, landing, rootObjectId } = request
  if ((sourceOwner.kind === 'system' && landing.kind === 'system' && sourceOwner.systemId === landing.systemId)
    || (sourceOwner.kind === 'route' && landing.kind === 'route' && sourceOwner.routeId === landing.routeId)) {
    throw new Error('Choose a different destination.')
  }
  const source = findContents(workspace, sourceOwner, 'source')
  const destination = findContents(workspace, landing, 'destination')
  const branch = resolveSystemObjectBranch(source, rootObjectId)
  const root = source.objects.find(object => object.id === rootObjectId)
  if (!branch || !root) throw new Error('The selected map object no longer exists in its source.')

  const branchObjectIds = new Set(branch.objectIds)
  const branchOrbitIds = new Set(branch.orbitIds)
  if (destination.objects.some(object => branchObjectIds.has(object.id))
    || destination.orbits.some(orbit => branchOrbitIds.has(orbit.id))) {
    throw new Error('Part of the hosted branch already exists at the destination.')
  }

  let placement: CatalogueObject['placement']
  if (landing.kind === 'system') {
    validatePlacement(findSystem(workspace, landing.systemId, 'destination'), root.id, landing.placement)
    placement = landing.placement.kind === 'orbit'
      ? { kind: 'orbit', orbitId: landing.placement.orbitId }
      : { ...landing.placement }
  } else {
    if (!Number.isFinite(landing.progression) || landing.progression < 0 || landing.progression > 1) {
      throw new Error('Route position must be between 0% and 100%.')
    }
    placement = { kind: 'route', progression: landing.progression }
  }

  const relationships = collectCrossingRelationships(
    workspace, source, sourceOwner.kind === 'system' ? sourceOwner.systemId : undefined, branchObjectIds,
  )
  const clearedStationObjectIds = new Set(relationships.clearedStationLinks.map(link => link.objectId))
  function clearStationLink(object: CatalogueObject): CatalogueObject {
    return clearedStationObjectIds.has(object.id) ? { ...object, jumpStationId: null } : object
  }
  const movedObjects = source.objects.filter(object => branchObjectIds.has(object.id)).map(object => {
    const moved = clearStationLink(object)
    if (moved.id !== rootObjectId) return moved
    const relocated = { ...moved, placement }
    delete relocated.legacyZonePlacement
    return relocated
  })
  const movedOrbits = source.orbits.filter(orbit => branchOrbitIds.has(orbit.id))
  const withSource = replaceContents(workspace.cluster, sourceOwner, {
    objects: source.objects.filter(object => !branchObjectIds.has(object.id)).map(clearStationLink),
    orbits: source.orbits.filter(orbit => !branchOrbitIds.has(orbit.id)),
  })
  const withDestination = replaceContents(withSource, landing, {
    objects: [...destination.objects, ...movedObjects],
    orbits: [...destination.orbits, ...movedOrbits],
  })
  const sourceParentOrbitId = root.placement.kind === 'orbit' ? root.placement.orbitId : undefined
  const retainedSourceAngles = sourceParentOrbitId
    ? captureEffectiveObjectAngles(workspace, source, [sourceParentOrbitId])
    : {}
  const retainedDestinationAngles = placement.kind === 'orbit'
    ? captureEffectiveObjectAngles(workspace, destination, [placement.orbitId])
    : {}

  const detachedRouteEnds = new Map<string, Set<'from' | 'to'>>()
  for (const attachment of relationships.detachedRouteAttachments) {
    const ends = detachedRouteEnds.get(attachment.routeId) ?? new Set<'from' | 'to'>()
    ends.add(attachment.end)
    detachedRouteEnds.set(attachment.routeId, ends)
  }
  const routes = workspace.cluster.routes.map(route => {
    const detachedEnds = detachedRouteEnds.get(route.id)
    const detachFrom = detachedEnds?.has('from') ?? false
    const detachTo = detachedEnds?.has('to') ?? false
    if (!detachFrom && !detachTo) return route
    if (detachFrom && detachTo && route.toSystemId !== null) {
      return { ...route, fromPointId: null, toPointId: null }
    }
    if (detachFrom) return { ...route, fromPointId: null }
    if (detachTo && route.toSystemId !== null) return { ...route, toPointId: null }
    return route
  })

  const cluster = { ...withDestination, routes }
  const branches = catalogueBranches(cluster)
  const retainedOrbitIds = new Set(branches.flatMap(branch => branch.orbits.map(orbit => orbit.id)))
  const retainedOrbitalObjectIds = new Set(branches.flatMap(branch => branch.objects
    .filter(object => object.placement.kind === 'orbit')
    .map(object => object.id)))
  const orbitRadii = Object.fromEntries(Object.entries(workspace.layout.orbitRadii)
    .filter(([orbitId]) => retainedOrbitIds.has(orbitId)))
  const orbitRotations = Object.fromEntries(Object.entries(workspace.layout.orbitRotations)
    .filter(([orbitId]) => retainedOrbitIds.has(orbitId)))
  const objectAngles = new Map(Object.entries(workspace.layout.objectAngles)
    .filter(([objectId]) => retainedOrbitalObjectIds.has(objectId)))
  for (const [objectId, angle] of Object.entries(retainedSourceAngles)) objectAngles.set(objectId, angle)
  for (const [objectId, angle] of Object.entries(retainedDestinationAngles)) objectAngles.set(objectId, angle)
  if (landing.kind === 'system' && landing.placement.kind === 'orbit') {
    objectAngles.set(root.id, landing.placement.angle)
  } else {
    objectAngles.delete(root.id)
  }

  return {
    sourceWorkspace: workspace,
    request,
    branch,
    ...relationships,
    previewWorkspace: {
      ...workspace,
      cluster,
      layout: {
        ...workspace.layout,
        orbitRadii,
        orbitRotations,
        objectAngles: Object.fromEntries(objectAngles),
      },
    },
  }
}

/** Prepares the Zone-to-Zone review using the shared hosted-branch transfer rules. */
export function prepareSystemObjectTransfer(
  workspace: LocalWorkspace,
  request: SystemObjectTransferRequest,
): SystemObjectTransferReview {
  if (request.sourceSystemId === request.destinationSystemId) throw new Error('Choose a different destination Zone.')
  const review = prepareCatalogueObjectTransfer(workspace, {
    source: { kind: 'system', systemId: request.sourceSystemId },
    rootObjectId: request.rootObjectId,
    landing: { kind: 'system', systemId: request.destinationSystemId, placement: request.placement },
  })
  return { ...review, request: { ...request, placement: { ...request.placement } } }
}

/** Validates and applies the exact Zone-to-Zone transfer to an immutable snapshot. */
export function applySystemObjectTransfer(
  workspace: LocalWorkspace,
  request: SystemObjectTransferRequest,
): LocalWorkspace {
  return prepareSystemObjectTransfer(workspace, request).previewWorkspace
}
