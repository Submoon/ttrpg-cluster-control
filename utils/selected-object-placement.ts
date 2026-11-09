/** Pure collective translation for selected system-map objects and their hosted branches. */
import type { LocalWorkspace, ObjectPlacement, Orbit, OrbitRadii, Point, StarSystem } from '../domain/workspace-model'
import { canPlaceObjectInOrbit } from '../domain/workspace'
import { captureEffectiveObjectAngles, updateWorkspaceObject } from '../domain/workspace-placement'
import {
  objectPositions,
  orbitCenter,
  orbitPointAtAngle,
  orbitRadii,
  orbitRotation,
  projectPointToOrbit,
  requiredPosition,
  toNormalizedMapPoint,
  ORBIT_PLACEMENT_HIT_TOLERANCE,
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

interface PreparedOrbitGeometry {
  orbit: Orbit
  center: Point
  radii: OrbitRadii
  rotation: number
  cosine: number
  sine: number
  minimumRadius: number
  halfWidth: number
  halfHeight: number
  slack: number
}

function prepareStationaryOrbitGeometry(
  system: StarSystem,
  geometry: ReturnType<typeof geometryOf>,
  positions: ReadonlyMap<string, Point>,
  movedObjectIds: ReadonlySet<string>,
): PreparedOrbitGeometry[] {
  return system.orbits.flatMap(orbit => {
    if (orbit.hostId !== null && movedObjectIds.has(orbit.hostId)) return []
    const center = orbitCenter(orbit, positions)
    const radii = orbitRadii(system, orbit, geometry)
    const rotation = orbitRotation(orbit, geometry)
    const radians = rotation * Math.PI / 180
    const cosine = Math.cos(radians)
    const sine = Math.sin(radians)
    const halfWidth = Math.hypot(radii.horizontal * cosine, radii.vertical * sine)
    const halfHeight = Math.hypot(radii.horizontal * sine, radii.vertical * cosine)
    const slack = Number.EPSILON * Math.max(
      1,
      Math.abs(center.x),
      Math.abs(center.y),
      halfWidth,
      halfHeight,
      radii.horizontal,
      radii.vertical,
    ) * 16
    const minimumRadius = Math.min(radii.horizontal, radii.vertical)
    return [{ orbit, center, radii, rotation, cosine, sine, minimumRadius, halfWidth, halfHeight, slack }]
  })
}

function targetMayReachOrbit(
  point: Point,
  geometry: PreparedOrbitGeometry,
  tolerance: number,
): boolean {
  const dx = point.x - geometry.center.x
  const dy = point.y - geometry.center.y
  const reach = tolerance + geometry.slack
  if (Math.abs(dx) > geometry.halfWidth + reach || Math.abs(dy) > geometry.halfHeight + reach) return false

  const localX = geometry.cosine * dx + geometry.sine * dy
  const localY = -geometry.sine * dx + geometry.cosine * dy
  const unitDistance = Math.hypot(localX / geometry.radii.horizontal, localY / geometry.radii.vertical)
  // The ellipse becomes a unit circle. Scaling its radial gap back by the smaller radius bounds the true gap from below.
  return Math.abs(unitDistance - 1) * geometry.minimumRadius <= reach
}

/** Inverts an ellipse's rotation analytically and admits only a round-tripping target. */
function exactOrbitAngle(target: Point, geometry: PreparedOrbitGeometry): number | null {
  if (!targetMayReachOrbit(target, geometry, ORBIT_POINT_TOLERANCE)) return null
  const { center, radii, rotation, cosine, sine } = geometry
  const dx = target.x - center.x
  const dy = target.y - center.y
  const localX = cosine * dx + sine * dy
  const localY = -sine * dx + cosine * dy
  const angle = Math.atan2(localY / radii.vertical, localX / radii.horizontal)
  const roundTrip = orbitPointAtAngle(center, radii, angle, rotation)
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

function chooseGroupOrbitSnap(
  system: StarSystem,
  objectsById: ReadonlyMap<string, StarSystem['objects'][number]>,
  stationaryOrbits: readonly PreparedOrbitGeometry[],
  stationaryOrbitsById: ReadonlyMap<string, PreparedOrbitGeometry>,
  selectedRootIds: readonly string[],
  beforePositions: ReadonlyMap<string, Point>,
  delta: Point,
): GroupOrbitSnap | null {
  let best: GroupOrbitSnap | null = null

  for (const objectId of selectedRootIds) {
    const object = objectsById.get(objectId)
    const origin = beforePositions.get(objectId)
    if (!object || !origin) continue
    const rawTarget = { x: origin.x + delta.x, y: origin.y + delta.y }
    const currentOrbitId = orbitIdOf(object.placement)
    const currentOrbit = currentOrbitId
      ? stationaryOrbitsById.get(currentOrbitId)
      : undefined

    // An exact point on the current fixed Orbit is already a valid destination and should not be pulled to a nearby ring.
    if (currentOrbit && exactOrbitAngle(rawTarget, currentOrbit) !== null) continue

    const exactDestination = exactDestinationOrbit(
      system,
      stationaryOrbits,
      objectId,
      currentOrbitId,
      rawTarget,
    )
    if (exactDestination) {
      return best?.distance === 0 ? best : {
        objectId,
        orbitId: exactDestination.orbitId,
        angle: exactDestination.angle,
        delta,
        distance: 0,
      }
    }

    for (const orbitGeometry of stationaryOrbits) {
      const orbit = orbitGeometry.orbit
      const reach = best?.distance ?? ORBIT_PLACEMENT_HIT_TOLERANCE
      if (orbit.id === currentOrbitId
        || !targetMayReachOrbit(rawTarget, orbitGeometry, reach)) continue
      const projected = projectPointToOrbit(rawTarget, orbitGeometry.center, orbitGeometry.radii, orbitGeometry.rotation)
      const distance = Math.hypot(rawTarget.x - projected.point.x, rawTarget.y - projected.point.y)
      if (!(distance <= ORBIT_PLACEMENT_HIT_TOLERANCE) || (best && distance >= best.distance)
        || !canPlaceObjectInOrbit(system, objectId, orbit.id)) continue
      best = {
        objectId,
        orbitId: orbit.id,
        angle: projected.angle,
        delta: { x: projected.point.x - origin.x, y: projected.point.y - origin.y },
        distance,
      }
    }
  }
  return best
}

function exactDestinationOrbit(
  system: StarSystem,
  stationaryOrbits: readonly PreparedOrbitGeometry[],
  objectId: string,
  currentOrbitId: string | null,
  target: Point,
): { orbitId: string; angle: number } | null {
  for (const orbitGeometry of stationaryOrbits) {
    const orbit = orbitGeometry.orbit
    if (orbit.id === currentOrbitId) continue
    const angle = exactOrbitAngle(target, orbitGeometry)
    if (angle === null || !canPlaceObjectInOrbit(system, objectId, orbit.id)) continue
    return { orbitId: orbit.id, angle }
  }
  return null
}

/**
 * Resolves one common map-space translation and eligible group Orbit snap from the captured workspace.
 * A fixed current Orbit is retained only at an exact point; Orbit descendants inherit movement with their host.
 */
export function prepareSelectedObjectTranslation(
  workspace: LocalWorkspace,
  systemId: string,
  selectedObjectIds: readonly string[],
): ((delta: Point) => SelectedObjectTranslationPlan | null) | null {
  if (selectedObjectIds.length === 0) return null
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
  const objectsById = new Map(system.objects.map(object => [object.id, object]))
  const orbitsById = new Map(system.orbits.map(orbit => [orbit.id, orbit]))
  const stationaryOrbits = prepareStationaryOrbitGeometry(system, geometry, beforePositions, movedObjectIdSet)
  const stationaryOrbitsById = new Map(stationaryOrbits.map(orbit => [orbit.orbit.id, orbit]))

  return (delta: Point): SelectedObjectTranslationPlan | null => {
    if (!Number.isFinite(delta.x) || !Number.isFinite(delta.y)) return null
    const positions = new Map<string, Point>()
    const departingObjectIds = new Set<string>()
    const arrivingObjectIds = new Set<string>()
    const changes: SelectedObjectPlacementChange[] = []

    // Pointer movement commonly returns to its starting point. Keep that path as an exact no-op,
    // avoiding normalized-coordinate round trips and any workspace construction during preview.
    if (delta.x === 0 && delta.y === 0) {
      for (const objectId of movedObjectIds) {
        const object = objectsById.get(objectId)
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

    const snap = chooseGroupOrbitSnap(
      system,
      objectsById,
      stationaryOrbits,
      stationaryOrbitsById,
      selectedRootIds,
      beforePositions,
      delta,
    )
    const translationDelta = snap?.delta ?? delta

    for (const objectId of movedObjectIds) {
      const object = objectsById.get(objectId)
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
          : exactDestinationOrbit(system, stationaryOrbits, objectId, null, target)
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
        const orbit = orbitsById.get(orbitId)
        if (!orbit) return null
        const centerFollowsTranslation = orbit.hostId !== null && movedObjectIdSet.has(orbit.hostId)
        if (!centerFollowsTranslation) {
          const currentOrbitGeometry = stationaryOrbitsById.get(orbitId)
          if (!currentOrbitGeometry) return null
          const currentAngle = exactOrbitAngle(target, currentOrbitGeometry)
          const snapWinner = snap?.objectId === objectId ? snap : null
          if (currentAngle !== null) {
            nextAngle = currentAngle
          } else if (snapWinner) {
            nextPlacement = { kind: 'orbit', orbitId: snapWinner.orbitId }
            nextAngle = snapWinner.angle
          } else {
            const destination = exactDestinationOrbit(system, stationaryOrbits, objectId, orbit.id, target)
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
}

/** One-shot compatibility entry point for callers that do not retain a drag gesture. */
export function planSelectedObjectTranslation(
  workspace: LocalWorkspace,
  systemId: string,
  selectedObjectIds: readonly string[],
  delta: Point,
): SelectedObjectTranslationPlan | null {
  const prepared = prepareSelectedObjectTranslation(workspace, systemId, selectedObjectIds)
  return prepared ? prepared(delta) : null
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
