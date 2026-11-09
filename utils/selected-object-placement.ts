/** Pure collective translation for selected system-map objects and their hosted branches. */
import type { LocalWorkspace, ObjectPlacement, Point, StarSystem } from '../domain/workspace-model'
import { canPlaceObjectInOrbit } from '../domain/workspace'
import { captureEffectiveObjectAngles, updateWorkspaceObject } from '../domain/workspace-placement'
import {
  objectPositions,
  orbitCenter,
  orbitPlacementHitsAtPoint,
  orbitPointAtAngle,
  orbitRadii,
  orbitRotation,
  requiredPosition,
  toNormalizedMapPoint,
} from './system-map-geometry'

const ORBIT_POINT_TOLERANCE = 1e-7
const ORBIT_ANGLE_TOLERANCE = 1e-12

export interface SelectedObjectPlacementChange {
  objectId: string
  previousPlacement: ObjectPlacement
  nextPlacement: ObjectPlacement
  previousAngle?: number
  nextAngle?: number
  placementChanged: boolean
  angleChanged: boolean
}

export interface SelectedObjectTranslationPlan {
  movedObjectIds: readonly string[]
  positions: ReadonlyMap<string, Point>
  departingObjectIds: ReadonlySet<string>
  arrivingObjectIds: ReadonlySet<string>
  /** Every object affected by placement or inherited movement, used for draft guards. */
  changes: readonly SelectedObjectPlacementChange[]
  /** Objects whose committed placement or explicit angle needs rebasing after publication. */
  updates: readonly SelectedObjectPlacementChange[]
}

function geometryOf(workspace: LocalWorkspace) {
  return {
    objectAngles: workspace.layout.objectAngles,
    orbitRadii: workspace.layout.orbitRadii,
    orbitRotations: workspace.layout.orbitRotations,
  }
}

function clonePlacement(placement: ObjectPlacement): ObjectPlacement {
  return placement.kind === 'system'
    ? { kind: 'system', x: placement.x, y: placement.y }
    : { kind: 'orbit', orbitId: placement.orbitId }
}

function samePlacement(left: ObjectPlacement, right: ObjectPlacement): boolean {
  if (left.kind !== right.kind) return false
  return left.kind === 'system' && right.kind === 'system'
    ? left.x === right.x && left.y === right.y
    : left.kind === 'orbit' && right.kind === 'orbit' && left.orbitId === right.orbitId
}

function orbitIdOf(placement: ObjectPlacement): string | null {
  return placement.kind === 'orbit' ? placement.orbitId : null
}

function equivalentAngles(left: number, right: number): boolean {
  return Math.abs(Math.atan2(Math.sin(left - right), Math.cos(left - right))) <= ORBIT_ANGLE_TOLERANCE
}

/** Inverts an ellipse's rotation analytically and admits only a round-tripping target. */
function exactOrbitAngle(
  target: Point,
  center: Point,
  horizontalRadius: number,
  verticalRadius: number,
  rotationDegrees: number,
): number | null {
  const rotation = rotationDegrees * Math.PI / 180
  const cosine = Math.cos(rotation)
  const sine = Math.sin(rotation)
  const dx = target.x - center.x
  const dy = target.y - center.y
  const localX = cosine * dx + sine * dy
  const localY = -sine * dx + cosine * dy
  const angle = Math.atan2(localY / verticalRadius, localX / horizontalRadius)
  const roundTrip = orbitPointAtAngle(
    center,
    { horizontal: horizontalRadius, vertical: verticalRadius },
    angle,
    rotationDegrees,
  )
  return Math.hypot(roundTrip.x - target.x, roundTrip.y - target.y) <= ORBIT_POINT_TOLERANCE
    ? angle
    : null
}

function collectMovedObjects(system: StarSystem, selectedObjectIds: readonly string[]): string[] {
  const orbitsByHost = new Map<string, string[]>()
  for (const orbit of system.orbits) {
    if (orbit.hostId === null) continue
    const hostOrbits = orbitsByHost.get(orbit.hostId) ?? []
    hostOrbits.push(orbit.id)
    orbitsByHost.set(orbit.hostId, hostOrbits)
  }
  const occupantsByOrbit = new Map<string, string[]>()
  for (const object of system.objects) {
    if (object.placement.kind !== 'orbit') continue
    const occupants = occupantsByOrbit.get(object.placement.orbitId) ?? []
    occupants.push(object.id)
    occupantsByOrbit.set(object.placement.orbitId, occupants)
  }

  const moved = new Set<string>()
  const pending = [...selectedObjectIds]
  for (let index = 0; index < pending.length; index += 1) {
    const objectId = pending[index]!
    if (moved.has(objectId)) continue
    moved.add(objectId)
    for (const orbitId of orbitsByHost.get(objectId) ?? []) {
      pending.push(...occupantsByOrbit.get(orbitId) ?? [])
    }
  }
  return [...moved]
}

function independentlyMovingSelectionIds(
  system: StarSystem,
  selectedObjectIds: readonly string[],
  movedObjectIds: ReadonlySet<string>,
): string[] {
  const selected = new Set(selectedObjectIds)
  return system.objects
    .filter(object => {
      if (!selected.has(object.id)) return false
      if (object.placement.kind !== 'orbit') return true
      const orbitId = object.placement.orbitId
      const orbit = system.orbits.find(candidate => candidate.id === orbitId)
      return !!orbit && (orbit.hostId === null || !movedObjectIds.has(orbit.hostId))
    })
    .map(object => object.id)
}

interface GroupOrbitSnap {
  objectId: string
  orbitId: string
  angle: number
  delta: Point
  distance: number
}

function eligibleDestinationOrbit(
  orbitId: string,
  currentOrbitId: string | null,
  orbitHostId: string | null,
  movedObjectIds: ReadonlySet<string>,
): boolean {
  return orbitId !== currentOrbitId
    && !(orbitHostId !== null && movedObjectIds.has(orbitHostId))
}

function chooseGroupOrbitSnap(
  system: StarSystem,
  geometry: ReturnType<typeof geometryOf>,
  selectedRootIds: readonly string[],
  movedObjectIds: ReadonlySet<string>,
  beforePositions: ReadonlyMap<string, Point>,
  delta: Point,
): GroupOrbitSnap | null {
  let best: GroupOrbitSnap | null = null

  for (const objectId of selectedRootIds) {
    const object = system.objects.find(candidate => candidate.id === objectId)
    const origin = beforePositions.get(objectId)
    if (!object || !origin) continue
    const rawTarget = { x: origin.x + delta.x, y: origin.y + delta.y }
    const currentOrbitId = orbitIdOf(object.placement)
    const currentOrbit = currentOrbitId
      ? system.orbits.find(orbit => orbit.id === currentOrbitId)
      : undefined

    // An exact point on the current fixed Orbit is already a valid destination and should not be pulled to a nearby ring.
    if (currentOrbit && (currentOrbit.hostId === null || !movedObjectIds.has(currentOrbit.hostId))) {
      const center = orbitCenter(currentOrbit, beforePositions)
      const radii = orbitRadii(system, currentOrbit, geometry)
      if (exactOrbitAngle(rawTarget, center, radii.horizontal, radii.vertical, orbitRotation(currentOrbit, geometry)) !== null) {
        continue
      }
    }

    const exactDestination = exactDestinationOrbit(
      system,
      geometry,
      objectId,
      currentOrbitId,
      movedObjectIds,
      rawTarget,
      beforePositions,
    )
    if (exactDestination) {
      const candidate: GroupOrbitSnap = {
        objectId,
        orbitId: exactDestination.orbitId,
        angle: exactDestination.angle,
        delta,
        distance: 0,
      }
      if (!best || candidate.distance < best.distance) {
        best = candidate
      }
      continue
    }

    const hits = orbitPlacementHitsAtPoint(system, rawTarget, beforePositions, geometry, objectId)
    for (const hit of hits) {
      if (!hit.valid || !eligibleDestinationOrbit(hit.orbit.id, currentOrbitId, hit.orbit.hostId, movedObjectIds)) continue
      const candidate: GroupOrbitSnap = {
        objectId,
        orbitId: hit.orbit.id,
        angle: hit.angle,
        delta: { x: hit.point.x - origin.x, y: hit.point.y - origin.y },
        distance: hit.distance,
      }
      if (!best || candidate.distance < best.distance) {
        best = candidate
      }
    }
  }
  return best
}

function exactDestinationOrbit(
  system: StarSystem,
  geometry: ReturnType<typeof geometryOf>,
  objectId: string,
  currentOrbitId: string | null,
  movedObjectIds: ReadonlySet<string>,
  target: Point,
  positions: ReadonlyMap<string, Point>,
): { orbitId: string; angle: number } | null {
  for (const orbit of system.orbits) {
    if (!eligibleDestinationOrbit(orbit.id, currentOrbitId, orbit.hostId, movedObjectIds)
      || !canPlaceObjectInOrbit(system, objectId, orbit.id)) continue
    const center = orbitCenter(orbit, positions)
    const radii = orbitRadii(system, orbit, geometry)
    const angle = exactOrbitAngle(target, center, radii.horizontal, radii.vertical, orbitRotation(orbit, geometry))
    if (angle !== null) return { orbitId: orbit.id, angle }
  }
  return null
}

/**
 * Resolves one common map-space translation and eligible group Orbit snap from the captured workspace.
 * A fixed current Orbit is retained only at an exact point; Orbit descendants inherit movement with their host.
 */
export function planSelectedObjectTranslation(
  workspace: LocalWorkspace,
  systemId: string,
  selectedObjectIds: readonly string[],
  delta: Point,
): SelectedObjectTranslationPlan | null {
  if (!Number.isFinite(delta.x) || !Number.isFinite(delta.y) || selectedObjectIds.length === 0) return null
  const system = workspace.cluster.systems.find(candidate => candidate.id === systemId)
  if (!system) return null
  const uniqueSelection = [...new Set(selectedObjectIds)]
  if (uniqueSelection.some(id => !system.objects.some(object => object.id === id))) return null

  const movedObjectIds = collectMovedObjects(system, uniqueSelection)
  const movedObjectIdSet = new Set(movedObjectIds)
  const geometry = geometryOf(workspace)
  const beforePositions = objectPositions(system, geometry)
  const effectiveAngles = captureEffectiveObjectAngles(workspace, system, system.orbits.map(orbit => orbit.id))
  const selectedRootIds = independentlyMovingSelectionIds(system, uniqueSelection, movedObjectIdSet)
  const positions = new Map<string, Point>()
  const departingObjectIds = new Set<string>()
  const arrivingObjectIds = new Set<string>()
  const changes: SelectedObjectPlacementChange[] = []

  // Pointer movement commonly returns to its starting point. Keep that path as an exact no-op,
  // avoiding normalized-coordinate round trips and any workspace construction during preview.
  if (delta.x === 0 && delta.y === 0) {
    for (const objectId of movedObjectIds) {
      const object = system.objects.find(candidate => candidate.id === objectId)
      if (!object) return null
      const position = requiredPosition(beforePositions, objectId)
      positions.set(objectId, position)
      const placement = clonePlacement(object.placement)
      const angle = object.placement.kind === 'orbit' ? effectiveAngles[objectId] : undefined
      changes.push({
        objectId,
        previousPlacement: placement,
        nextPlacement: placement,
        ...(angle !== undefined ? { previousAngle: angle, nextAngle: angle } : {}),
        placementChanged: false,
        angleChanged: false,
      })
    }
    return { movedObjectIds, positions, departingObjectIds, arrivingObjectIds, changes, updates: [] }
  }

  const snap = chooseGroupOrbitSnap(system, geometry, selectedRootIds, movedObjectIdSet, beforePositions, delta)
  const translationDelta = snap?.delta ?? delta

  for (const objectId of movedObjectIds) {
    const object = system.objects.find(candidate => candidate.id === objectId)
    if (!object) return null
    const origin = requiredPosition(beforePositions, objectId)
    const target = { x: origin.x + translationDelta.x, y: origin.y + translationDelta.y }
    positions.set(objectId, target)

    const previousPlacement = clonePlacement(object.placement)
    let nextPlacement: ObjectPlacement = previousPlacement
    const previousAngle = object.placement.kind === 'orbit' ? effectiveAngles[objectId] : undefined
    let nextAngle = previousAngle

    if (object.placement.kind === 'system') {
      const snapWinner = snap?.objectId === objectId ? snap : null
      const destination = snapWinner
        ? { orbitId: snapWinner.orbitId, angle: snapWinner.angle }
        : exactDestinationOrbit(system, geometry, objectId, null, movedObjectIdSet, target, beforePositions)
      if (destination) {
        nextPlacement = { kind: 'orbit', orbitId: destination.orbitId }
        nextAngle = destination.angle
      } else if (translationDelta.x === 0 && translationDelta.y === 0) {
        nextPlacement = previousPlacement
      } else {
        nextPlacement = { kind: 'system', ...toNormalizedMapPoint(target) }
      }
    } else {
      const orbitId = object.placement.orbitId
      const orbit = system.orbits.find(candidate => candidate.id === orbitId)
      if (!orbit) return null
      const centerFollowsTranslation = orbit.hostId !== null && movedObjectIdSet.has(orbit.hostId)
      if (!centerFollowsTranslation) {
        const center = orbitCenter(orbit, beforePositions)
        const radii = orbitRadii(system, orbit, geometry)
        const currentAngle = exactOrbitAngle(target, center, radii.horizontal, radii.vertical, orbitRotation(orbit, geometry))
        const snapWinner = snap?.objectId === objectId ? snap : null
        if (currentAngle !== null) {
          nextAngle = currentAngle
        } else if (snapWinner) {
          nextPlacement = { kind: 'orbit', orbitId: snapWinner.orbitId }
          nextAngle = snapWinner.angle
        } else {
          const destination = exactDestinationOrbit(system, geometry, objectId, orbit.id, movedObjectIdSet, target, beforePositions)
          if (destination) {
            nextPlacement = { kind: 'orbit', orbitId: destination.orbitId }
            nextAngle = destination.angle
          } else {
            nextPlacement = { kind: 'system', ...toNormalizedMapPoint(target) }
            nextAngle = undefined
          }
        }
      }
    }

    const placementChanged = !samePlacement(previousPlacement, nextPlacement)
    const previousOrbitId = orbitIdOf(previousPlacement)
    const nextOrbitId = orbitIdOf(nextPlacement)
    if (previousOrbitId !== nextOrbitId) {
      if (previousOrbitId !== null) departingObjectIds.add(objectId)
      if (nextOrbitId !== null) arrivingObjectIds.add(objectId)
    }
    const angleChanged = previousPlacement.kind === 'orbit'
      && nextPlacement.kind === 'orbit'
      && nextAngle !== undefined
      && previousAngle !== undefined
      && !equivalentAngles(previousAngle, nextAngle)
    changes.push({
      objectId,
      previousPlacement,
      nextPlacement,
      ...(previousAngle !== undefined ? { previousAngle } : {}),
      ...(nextAngle !== undefined ? { nextAngle } : {}),
      placementChanged,
      angleChanged,
    })
  }

  const updates = changes.filter(change => change.placementChanged || change.angleChanged)
  return {
    movedObjectIds,
    positions,
    departingObjectIds,
    arrivingObjectIds,
    changes,
    updates,
  }
}

/** Applies a previously validated translation once, when the gesture is committed. */
export function applySelectedObjectTranslation(
  workspace: LocalWorkspace,
  systemId: string,
  plan: SelectedObjectTranslationPlan,
): LocalWorkspace {
  if (plan.updates.length === 0) return workspace
  const system = workspace.cluster.systems.find(candidate => candidate.id === systemId)
  if (!system) throw new Error('The star system for this map object no longer exists.')

  const changedOrbitIds = new Set<string>()
  for (const change of plan.updates) {
    const fromOrbitId = orbitIdOf(change.previousPlacement)
    const toOrbitId = orbitIdOf(change.nextPlacement)
    if (fromOrbitId !== toOrbitId) {
      if (fromOrbitId) changedOrbitIds.add(fromOrbitId)
      if (toOrbitId) changedOrbitIds.add(toOrbitId)
    }
  }

  let nextWorkspace = workspace
  if (changedOrbitIds.size) {
    const preservedAngles = captureEffectiveObjectAngles(workspace, system, changedOrbitIds)
    nextWorkspace = {
      ...workspace,
      layout: {
        ...workspace.layout,
        objectAngles: { ...workspace.layout.objectAngles, ...preservedAngles },
      },
    }
  }
  for (const change of plan.updates) {
    nextWorkspace = updateWorkspaceObject(
      nextWorkspace,
      systemId,
      change.objectId,
      { placement: change.nextPlacement },
      (change.placementChanged || change.angleChanged)
        && change.nextPlacement.kind === 'orbit'
        && change.nextAngle !== undefined
        ? { angle: change.nextAngle }
        : undefined,
    )
  }
  return nextWorkspace
}
