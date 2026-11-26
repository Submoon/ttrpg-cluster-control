import { prepareCatalogueObjectTransfer, setWorkspaceSystemFrame, workspaceSystemFrame, type CatalogueObjectTransferRequest, type CatalogueObjectTransferReview, type LocalWorkspace, type Point, type StarSystem } from '../domain/workspace'
import { initialClusterSystemPosition } from '../domain/workspace-cluster'
import { resolveSystemObjectBranch } from '../domain/workspace-object-branch'
import { projectWardenSystem, systemFrameInsetsFromRect, type ContinuousWardenSystemProjection } from './continuous-map-projection'
import { planBoundedZoneLanding } from './continuous-map-elastic-placement'
import { continuousSystemFrames } from './continuous-system-frames'
import type { SvgViewportRect } from './map-zoom'

/** Captures every hosted mark and its rigid extent relative to the manipulated object. */
export function projectZoneObjectBranch(
  system: StarSystem,
  projection: ContinuousWardenSystemProjection,
  rootObjectId: string,
) {
  const branch = resolveSystemObjectBranch(system, rootObjectId)
  const root = projection.objects.find(object => object.id === rootObjectId)
  if (!branch || !root) return null

  const objectIds = new Set(branch.objectIds)
  const orbitIds = new Set(branch.orbitIds)
  const objects = projection.objects.filter(object => objectIds.has(object.id))
  const orbits = projection.orbits.filter(orbit => orbitIds.has(orbit.id))
  const relativeBounds = zoneBranchBounds(root.scenePosition, objects, orbits)
  return {
    rootObjectId,
    root: root.scenePosition,
    projection,
    objects,
    orbits,
    relativeBounds,
    objectSubtypes: new Map(system.objects.map(object => [object.id, object.subtype] as const)),
  }
}

function zoneBranchBounds(
  root: Point,
  objects: ContinuousWardenSystemProjection['objects'],
  orbits: ContinuousWardenSystemProjection['orbits'],
): SvgViewportRect {
  let left = 0
  let right = 0
  let top = 0
  let bottom = 0
  const include = (point: Point, halfWidth: number, halfHeight: number) => {
    left = Math.min(left, point.x - root.x - halfWidth)
    right = Math.max(right, point.x - root.x + halfWidth)
    top = Math.min(top, point.y - root.y - halfHeight)
    bottom = Math.max(bottom, point.y - root.y + halfHeight)
  }
  for (const object of objects) include(object.scenePosition, 0, 0)
  for (const orbit of orbits) {
    const radians = orbit.rotation * Math.PI / 180
    const cosine = Math.cos(radians)
    const sine = Math.sin(radians)
    include(
      orbit.sceneCenter,
      Math.hypot(orbit.sceneRadii.horizontal * cosine, orbit.sceneRadii.vertical * sine),
      Math.hypot(orbit.sceneRadii.horizontal * sine, orbit.sceneRadii.vertical * cosine),
    )
  }
  return { x: left, y: top, width: right - left, height: bottom - top }
}


/**
 * Fits an explicit local placement against the applied workspace's frame and neighbors.
 * A review or numeric command may grow a frame for a branch whose root is already on its chosen Zone.
 */
export function fitZoneObjectWorkspace(
  before: LocalWorkspace,
  next: LocalWorkspace,
  systemId: string,
  rootObjectId: string,
): LocalWorkspace {
  return fitZoneObjectLanding(before, next, systemId, rootObjectId).workspace
}

/** Fits one rigid group in its owner. Secondary selected objects and hosted geometry grow the same frame. */
export function fitZoneObjectLanding(
  before: LocalWorkspace,
  next: LocalWorkspace,
  systemId: string,
  rootObjectId: string,
  group?: { movedObjectIds: readonly string[]; pixelsPerSceneUnit?: number },
): { workspace: LocalWorkspace; frame?: SvgViewportRect } {
  const inputs = before.cluster.systems.map((system, index) => {
    const projection = projectInWorkspace(before, system, index)
    return { id: system.id, anchor: projection.anchor, envelope: projection.preferredFrame ?? projection.envelope, projection }
  })
  const projectedSource = inputs.find(input => input.id === systemId)
  const index = next.cluster.systems.findIndex(system => system.id === systemId)
  const system = next.cluster.systems[index]
  if (!projectedSource || !system) throw new Error('The destination Zone is no longer available.')

  const projection = projectInWorkspace(next, system, index)
  const root = projection.objects.find(object => object.id === rootObjectId)?.scenePosition
  if (!root) throw new Error('The object is no longer available for placement.')
  const previousRoot = projectedSource.projection.objects.find(object => object.id === rootObjectId)?.scenePosition
  const previousObject = before.cluster.systems.find(system => system.id === systemId)?.objects
    .find(object => object.id === rootObjectId)
  const nextObject = system.objects.find(object => object.id === rootObjectId)
  if (!group && previousRoot?.x === root.x && previousRoot?.y === root.y
    && JSON.stringify(previousObject?.placement) === JSON.stringify(nextObject?.placement)) return { workspace: next }

  let relativeBounds: SvgViewportRect
  if (group) {
    const moving = new Set(group.movedObjectIds)
    const hosted = new Set(system.orbits.filter(orbit => orbit.hostId !== null && moving.has(orbit.hostId)).map(orbit => orbit.id))
    relativeBounds = zoneBranchBounds(root, projection.objects.filter(object => moving.has(object.id)),
      projection.orbits.filter(orbit => hosted.has(orbit.id)))
  } else {
    const branch = projectZoneObjectBranch(system, projection, rootObjectId)
    if (!branch) throw new Error('The object is no longer available for placement.')
    relativeBounds = branch.relativeBounds
  }
  const displayed = continuousSystemFrames(inputs)
  const displayedFrame = displayed.get(systemId)!
  const landing = planBoundedZoneLanding({
    systemId,
    anchor: projectedSource.anchor,
    displayedFrame,
    target: root,
    relativeBounds,
    pixelsPerSceneUnit: group?.pixelsPerSceneUnit,
    authoredFrames: inputs,
    fixedFrames: inputs.filter(input => input.id !== systemId)
      .map(input => ({ ...input, envelope: displayed.get(input.id)! })),
  })
  if (!landing) throw new Error('The object and its hosted branch must fit within the destination Zone and its available frame growth.')

  const workspace = !landing.grew && workspaceSystemFrame(before, systemId)
    ? next
    : setWorkspaceSystemFrame(next, systemId, systemFrameInsetsFromRect(projectedSource.anchor, landing.authoredFrame))
  return { workspace, frame: landing.frame }
}

function projectInWorkspace(workspace: LocalWorkspace, system: StarSystem, index: number): ContinuousWardenSystemProjection {
  const anchor = workspace.layout.systemPositions[system.id] ?? initialClusterSystemPosition(index)
  return projectWardenSystem(system, anchor, workspace.layout, undefined, workspaceSystemFrame(workspace, system.id))
}

/** Includes frame changes in the exact cross-context preview later published by the editor. */
export function prepareFittedCatalogueObjectTransfer(
  workspace: LocalWorkspace,
  request: CatalogueObjectTransferRequest,
): CatalogueObjectTransferReview {
  const proposal = prepareCatalogueObjectTransfer(workspace, request)
  const { source, landing, rootObjectId } = request
  let next = proposal.previewWorkspace
  // Preserve the inferred source frame when removing contents would otherwise shrink it.
  if (source.kind === 'system' && !workspaceSystemFrame(workspace, source.systemId)) {
    const index = workspace.cluster.systems.findIndex(system => system.id === source.systemId)
    const system = workspace.cluster.systems[index]!
    const projection = projectInWorkspace(workspace, system, index)
    next = setWorkspaceSystemFrame(next, system.id,
      systemFrameInsetsFromRect(projection.anchor, projection.preferredFrame ?? projection.envelope))
  }
  if (landing.kind === 'system') next = fitZoneObjectWorkspace(workspace, next, landing.systemId, rootObjectId)
  return { ...proposal, previewWorkspace: next }
}
