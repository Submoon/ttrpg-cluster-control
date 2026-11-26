/** Pure whole-workspace proposal and immutable application for transferring one hosted object branch. */
import type { LocalWorkspace, StarSystem, SystemObject } from './workspace-model'
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

/** Consequences and a safe destination projection remain available throughout the transfer review. */
export interface SystemObjectTransferReview {
  /** Exact source snapshot used to compute this proposal's labels and consequences. */
  sourceWorkspace: LocalWorkspace
  request: SystemObjectTransferRequest
  branch: SystemObjectBranch
  detachedRouteAttachments: SystemObjectTransferRouteAttachment[]
  clearedStationLinks: SystemObjectTransferStationLink[]
  previewWorkspace: LocalWorkspace
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
  source: StarSystem,
  branchObjectIds: ReadonlySet<string>,
): {
  detachedRouteAttachments: SystemObjectTransferRouteAttachment[]
  clearedStationLinks: SystemObjectTransferStationLink[]
} {
  const detachedRouteAttachments: SystemObjectTransferRouteAttachment[] = []
  for (const route of workspace.cluster.routes) {
    if (route.fromSystemId === source.id && route.fromPointId !== null && branchObjectIds.has(route.fromPointId)) {
      detachedRouteAttachments.push({ routeId: route.id, end: 'from', pointId: route.fromPointId })
    }
    if (route.toSystemId === source.id && route.toPointId !== null && branchObjectIds.has(route.toPointId)) {
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

function buildTransferReview(
  workspace: LocalWorkspace,
  request: SystemObjectTransferRequest,
): SystemObjectTransferReview {
  if (request.sourceSystemId === request.destinationSystemId) {
    throw new Error('Choose a different destination Zone.')
  }
  const source = findSystem(workspace, request.sourceSystemId, 'source')
  const destination = findSystem(workspace, request.destinationSystemId, 'destination')
  const branch = resolveSystemObjectBranch(source, request.rootObjectId)
  if (!branch) throw new Error('The selected map object no longer exists in its source Zone.')
  const root = source.objects.find(object => object.id === request.rootObjectId)
  if (!root) throw new Error('The selected map object no longer exists in its source Zone.')
  if (destination.objects.some(object => object.id === root.id)) {
    throw new Error('The selected map object already exists in the destination Zone.')
  }
  validatePlacement(destination, root.id, request.placement)

  const branchObjectIds = new Set(branch.objectIds)
  const relationships = collectCrossingRelationships(workspace, source, branchObjectIds)
  const previewWorkspace = applyTransfer(workspace, request, branch, relationships)
  return {
    sourceWorkspace: workspace,
    request: { ...request, placement: { ...request.placement } },
    branch,
    ...relationships,
    previewWorkspace,
  }
}

/**
 * Prepares a read-only review, including destination projection and relationship effects.
 */
export function prepareSystemObjectTransfer(
  workspace: LocalWorkspace,
  request: SystemObjectTransferRequest,
): SystemObjectTransferReview {
  return buildTransferReview(workspace, request)
}

/**
 * Validates the reviewed consequences and returns one immutable whole-workspace transfer result.
 * The caller owns publishing this snapshot to history and persistence.
 */
export function applySystemObjectTransfer(
  workspace: LocalWorkspace,
  request: SystemObjectTransferRequest,
): LocalWorkspace {
  return buildTransferReview(workspace, request).previewWorkspace
}

function applyTransfer(
  workspace: LocalWorkspace,
  request: SystemObjectTransferRequest,
  branch: SystemObjectBranch,
  relationships: Pick<SystemObjectTransferReview, 'detachedRouteAttachments' | 'clearedStationLinks'>,
): LocalWorkspace {
  const source = findSystem(workspace, request.sourceSystemId, 'source')
  const destination = findSystem(workspace, request.destinationSystemId, 'destination')
  const branchObjectIds = new Set(branch.objectIds)
  const branchOrbitIds = new Set(branch.orbitIds)
  const clearedStationObjectIds = new Set(relationships.clearedStationLinks.map(link => link.objectId))
  const movedObjects = source.objects.filter(object => branchObjectIds.has(object.id))
  const movedOrbits = source.orbits.filter(orbit => branchOrbitIds.has(orbit.id))
  const root = movedObjects.find(object => object.id === request.rootObjectId)
  if (!root) throw new Error('The selected map object no longer exists in its source Zone.')

  const sourceParentOrbitId = root.placement.kind === 'orbit' ? root.placement.orbitId : undefined
  const retainedSourceAngles = sourceParentOrbitId
    ? captureEffectiveObjectAngles(workspace, source, [sourceParentOrbitId])
    : {}
  const destinationOrbitId = request.placement.kind === 'orbit' ? request.placement.orbitId : undefined
  const retainedDestinationAngles = destinationOrbitId
    ? captureEffectiveObjectAngles(workspace, destination, [destinationOrbitId])
    : {}

  const transferObject = (object: SystemObject): SystemObject => {
    const moves = branchObjectIds.has(object.id)
    const stationMoves = object.jumpStationId ? branchObjectIds.has(object.jumpStationId) : false
    const clearStationLink = object.family === 'JumpPoint'
      && object.jumpStationId !== undefined
      && object.jumpStationId !== null
      && moves !== stationMoves
    const placement = moves && object.id === request.rootObjectId
      ? request.placement.kind === 'system'
        ? { kind: 'system' as const, x: request.placement.x, y: request.placement.y }
        : { kind: 'orbit' as const, orbitId: request.placement.orbitId }
      : object.placement
    const linkCleared = clearStationLink && clearedStationObjectIds.has(object.id)
    if (
      (moves && object.id === request.rootObjectId)
      || linkCleared
    ) {
      return {
        ...object,
        placement,
        ...(linkCleared ? { jumpStationId: null } : {}),
      }
    }
    return object
  }

  const sourceObjects = source.objects
    .filter(object => !branchObjectIds.has(object.id))
    .map(transferObject)
  const sourceOrbits = source.orbits.filter(orbit => !branchOrbitIds.has(orbit.id))
  const destinationObjects = [
    ...destination.objects,
    ...movedObjects.map(transferObject),
  ]
  const destinationOrbits = [...destination.orbits, ...movedOrbits]
  const systems = workspace.cluster.systems.map(system => {
    if (system.id === source.id) return { ...system, objects: sourceObjects, orbits: sourceOrbits }
    if (system.id === destination.id) return { ...system, objects: destinationObjects, orbits: destinationOrbits }
    return system
  })

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

  const retainedOrbitIds = new Set(systems.flatMap(system => system.orbits.map(orbit => orbit.id)))
  const retainedOrbitalObjectIds = new Set(systems.flatMap(system => system.objects
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
  if (request.placement.kind === 'orbit') objectAngles.set(root.id, request.placement.angle)
  else objectAngles.delete(root.id)

  return {
    ...workspace,
    cluster: { ...workspace.cluster, systems, routes },
    layout: {
      ...workspace.layout,
      orbitRadii,
      orbitRotations,
      objectAngles: Object.fromEntries(objectAngles),
    },
  }
}
