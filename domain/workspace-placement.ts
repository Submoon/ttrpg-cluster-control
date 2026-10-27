/**
 * Coordinates object membership changes with the durable angles that keep unaffected Orbit occupants in place.
 */
import { replaceWorkspaceSystem } from './workspace-cluster'
import type { LocalWorkspace, StarSystem, SystemObject, SystemObjectChanges } from './workspace-model'
import { updateSystemObject } from './workspace-system-objects'

/** Default Orbit angle for one object in its current sibling ordering. */
export function defaultObjectOrbitAngle(index: number, siblingCount: number): number {
  return -Math.PI / 2 + (index / Math.max(1, siblingCount)) * Math.PI * 2
}

/**
 * Captures every current occupant's effective angle for the listed Orbits.
 * Saved angles win; missing values use the same sibling-order default as map projection.
 */
export function captureEffectiveObjectAngles(
  workspace: LocalWorkspace,
  system: StarSystem,
  orbitIds: Iterable<string>,
): Record<string, number> {
  const requestedOrbits = new Set(orbitIds)
  const occupants = new Map<string, SystemObject[]>()
  for (const object of system.objects) {
    if (object.placement.kind !== 'orbit' || !requestedOrbits.has(object.placement.orbitId)) continue
    const siblings = occupants.get(object.placement.orbitId) ?? []
    siblings.push(object)
    occupants.set(object.placement.orbitId, siblings)
  }

  const angles: Record<string, number> = {}
  for (const siblings of occupants.values()) {
    siblings.forEach((object, index) => {
      angles[object.id] = workspace.layout.objectAngles[object.id]
        ?? defaultObjectOrbitAngle(index, siblings.length)
    })
  }
  return angles
}

/**
 * Validates and applies one object edit, preserving the displayed angle of existing occupants when Orbit membership changes.
 * @param workspace Current committed workspace snapshot.
 * @param systemId System containing the edited object.
 * @param objectId Object whose properties or placement change.
 * @param changes Partial object fields to validate and apply.
 * @param options Optional explicit Orbit parameter angle in radians for the moved object.
 * @returns A new workspace snapshot. Persistence remains the caller's workspace-writer responsibility.
 * @throws If the system, object, proposed fields, or placement is invalid.
 */
export function updateWorkspaceObject(
  workspace: LocalWorkspace,
  systemId: string,
  objectId: string,
  changes: SystemObjectChanges,
  options?: { angle?: number },
): LocalWorkspace {
  if (options?.angle !== undefined && !Number.isFinite(options.angle)) {
    throw new Error('Object Orbit angle must be finite.')
  }
  const system = workspace.cluster.systems.find(candidate => candidate.id === systemId)
  if (!system) throw new Error('The star system for this map object no longer exists.')
  const original = system.objects.find(candidate => candidate.id === objectId)
  if (!original) throw new Error('The selected map object no longer exists.')

  const updatedSystem = updateSystemObject(system, objectId, changes, workspace.objectFieldSettings)
  const updated = updatedSystem.objects.find(candidate => candidate.id === objectId)
  if (!updated) throw new Error('The selected map object could not be updated.')

  const samePlacement = original.placement.kind === updated.placement.kind
    && (original.placement.kind === 'system'
      || (updated.placement.kind === 'orbit' && original.placement.orbitId === updated.placement.orbitId))
  const placementChanged = !samePlacement
  const orbitIds = placementChanged
    ? [original.placement, updated.placement]
      .filter((placement): placement is Extract<SystemObject['placement'], { kind: 'orbit' }> => placement.kind === 'orbit')
      .map(placement => placement.orbitId)
    : []
  const originalAngles = placementChanged
    ? captureEffectiveObjectAngles(workspace, system, orbitIds)
    : {}

  const nextWorkspace = replaceWorkspaceSystem(workspace, updatedSystem)
  if (!placementChanged && options?.angle === undefined) return nextWorkspace

  const objectAngles = { ...nextWorkspace.layout.objectAngles, ...originalAngles }
  if (updated.placement.kind !== 'orbit') delete objectAngles[objectId]
  if (updated.placement.kind === 'orbit' && options?.angle !== undefined) {
    objectAngles[objectId] = options.angle
  }
  return {
    ...nextWorkspace,
    layout: { ...nextWorkspace.layout, objectAngles },
  }
}
