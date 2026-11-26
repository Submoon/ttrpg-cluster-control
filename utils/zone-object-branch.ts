import { setWorkspaceSystemFrame, workspaceSystemFrame, type LocalWorkspace, type Point, type StarSystem } from '../domain/workspace'
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
  const inputs = before.cluster.systems.map((system, index) => {
    const projection = projectInWorkspace(before, system, index)
    return { id: system.id, anchor: projection.anchor, envelope: projection.preferredFrame ?? projection.envelope, projection }
  })
  const projectedSource = inputs.find(input => input.id === systemId)
  const index = next.cluster.systems.findIndex(system => system.id === systemId)
  const system = next.cluster.systems[index]
  if (!projectedSource || !system) throw new Error('The destination Zone is no longer available.')

  const projection = projectInWorkspace(next, system, index)
  const branch = projectZoneObjectBranch(system, projection, rootObjectId)
  if (!branch) throw new Error('The object is no longer available for placement.')
  const previousRoot = projectedSource.projection.objects.find(object => object.id === rootObjectId)?.scenePosition
  const previousObject = before.cluster.systems.find(system => system.id === systemId)?.objects
    .find(object => object.id === rootObjectId)
  const nextObject = system.objects.find(object => object.id === rootObjectId)
  if (previousRoot?.x === branch.root.x && previousRoot?.y === branch.root.y
    && JSON.stringify(previousObject?.placement) === JSON.stringify(nextObject?.placement)) return next

  const displayed = continuousSystemFrames(inputs)
  const displayedFrame = displayed.get(systemId)!
  const landing = planBoundedZoneLanding({
    systemId,
    anchor: projectedSource.anchor,
    displayedFrame,
    target: branch.root,
    relativeBounds: branch.relativeBounds,
    authoredFrames: inputs,
    fixedFrames: inputs.filter(input => input.id !== systemId)
      .map(input => ({ ...input, envelope: displayed.get(input.id)! })),
  })
  if (!landing) throw new Error('The object and its hosted branch must fit within the destination Zone and its available frame growth.')

  if (!landing.grew && workspaceSystemFrame(before, systemId)) return next
  return setWorkspaceSystemFrame(next, systemId, systemFrameInsetsFromRect(projectedSource.anchor, landing.authoredFrame))
}

function projectInWorkspace(workspace: LocalWorkspace, system: StarSystem, index: number): ContinuousWardenSystemProjection {
  const anchor = workspace.layout.systemPositions[system.id] ?? initialClusterSystemPosition(index)
  return projectWardenSystem(system, anchor, workspace.layout, undefined, workspaceSystemFrame(workspace, system.id))
}
