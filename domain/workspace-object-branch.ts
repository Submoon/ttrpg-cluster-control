import type { StarSystem } from './workspace-model'

export interface SystemObjectBranch {
  objectIds: string[]
  orbitIds: string[]
}

/**
 * Resolves one object's complete hosted Orbit branch, including empty hosted Orbits.
 * Parent placements, siblings, Station links, and Jump Route references are outside this branch.
 *
 * @param system System containing the target object and hosted relationships.
 * @param targetObjectId Root object whose hosted branch is resolved.
 * @returns IDs in traversal order, or undefined when the target is absent.
 */
export function resolveSystemObjectBranch(
  system: StarSystem,
  targetObjectId: string,
): SystemObjectBranch | undefined {
  const objectsById = new Map(system.objects.map(object => [object.id, object]))
  if (!objectsById.has(targetObjectId)) return undefined

  const hostedOrbits = new Map<string, string[]>()
  for (const orbit of system.orbits) {
    if (orbit.hostId === null) continue
    const orbitIds = hostedOrbits.get(orbit.hostId) ?? []
    orbitIds.push(orbit.id)
    hostedOrbits.set(orbit.hostId, orbitIds)
  }

  const objectsByOrbit = new Map<string, string[]>()
  for (const object of system.objects) {
    if (object.placement.kind !== 'orbit') continue
    const objectIds = objectsByOrbit.get(object.placement.orbitId) ?? []
    objectIds.push(object.id)
    objectsByOrbit.set(object.placement.orbitId, objectIds)
  }

  const objectIds = new Set<string>()
  const orbitIds = new Set<string>()
  function visit(objectId: string): void {
    if (objectIds.has(objectId)) return
    objectIds.add(objectId)

    for (const orbitId of hostedOrbits.get(objectId) ?? []) {
      if (orbitIds.has(orbitId)) continue
      orbitIds.add(orbitId)
      for (const childId of objectsByOrbit.get(orbitId) ?? []) visit(childId)
    }
  }

  visit(targetObjectId)
  return { objectIds: [...objectIds], orbitIds: [...orbitIds] }
}
