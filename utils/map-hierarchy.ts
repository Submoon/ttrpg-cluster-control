/**
 * Projects system objects and their hosted/unoccupied Orbits into depth-first tree rows.
 * The baseline map hierarchy and its prototype drawer share this ordering.
 */
import type { Orbit, StarSystem, SystemObject } from '../domain/workspace'

export type ObjectHierarchyRow = { kind: 'object'; object: SystemObject; depth: number }
export type OrbitHierarchyRow = { kind: 'orbit'; orbit: Orbit; host: SystemObject | null; childCount: number; depth: number }
export type MapHierarchyRow = ObjectHierarchyRow | OrbitHierarchyRow

/**
 * Lists unoccupied Orbits and system-level objects at the root, nesting hosted Orbits and
 * objects placed on them under their actual host. Orbit siblings follow their stored order.
 */
export function buildMapHierarchy(system: StarSystem | undefined): MapHierarchyRow[] {
  if (!system) return []

  const rows: MapHierarchyRow[] = []
  const orbitsByHost = new Map<string | null, Orbit[]>()
  const objectsByOrbit = new Map<string, SystemObject[]>()
  for (const orbit of system.orbits) {
    const hosted = orbitsByHost.get(orbit.hostId) ?? []
    hosted.push(orbit)
    orbitsByHost.set(orbit.hostId, hosted)
  }
  for (const object of system.objects) {
    if (object.placement.kind !== 'orbit') continue
    const children = objectsByOrbit.get(object.placement.orbitId) ?? []
    children.push(object)
    objectsByOrbit.set(object.placement.orbitId, children)
  }

  function addOrbitBranch(orbit: Orbit, host: SystemObject | null, depth: number): void {
    const children = objectsByOrbit.get(orbit.id) ?? []
    rows.push({ kind: 'orbit', orbit, host, childCount: children.length, depth })
    for (const child of children) addObjectBranch(child, depth + 1)
  }

  function addObjectBranch(object: SystemObject, depth: number): void {
    rows.push({ kind: 'object', object, depth })
    const hostedOrbits = [...(orbitsByHost.get(object.id) ?? [])].sort((left, right) => left.order - right.order)
    for (const orbit of hostedOrbits) addOrbitBranch(orbit, object, depth + 1)
  }

  const unhostedOrbits = [...(orbitsByHost.get(null) ?? [])].sort((left, right) => left.order - right.order)
  for (const orbit of unhostedOrbits) addOrbitBranch(orbit, null, 0)
  for (const object of system.objects) {
    if (object.placement.kind === 'system') addObjectBranch(object, 0)
  }
  return rows
}
