/**
 * Projects system objects and their hosted/unoccupied Orbits into depth-first tree rows.
 * The baseline map hierarchy and its prototype drawer share this ordering.
 */
import type { CatalogueObject, Orbit, StarSystem, SystemObject } from '../domain/workspace'

export type ObjectHierarchyRow<T extends CatalogueObject = SystemObject> = { kind: 'object'; object: T; depth: number }
export type OrbitHierarchyRow<T extends CatalogueObject = SystemObject> = { kind: 'orbit'; orbit: Orbit; host: T | null; childCount: number; depth: number }
export type MapHierarchyRow<T extends CatalogueObject = SystemObject> = ObjectHierarchyRow<T> | OrbitHierarchyRow<T>

/**
 * Lists unoccupied Orbits and system-level objects at the root, nesting hosted Orbits and
 * objects placed on them under their actual host. Orbit siblings follow their stored order.
 */
export function buildMapHierarchy<T extends CatalogueObject>(branch: { objects: T[]; orbits: Orbit[] } | undefined): MapHierarchyRow<T>[] {
  if (!branch) return []

  const rows: MapHierarchyRow<T>[] = []
  const orbitsByHost = new Map<string | null, Orbit[]>()
  const objectsByOrbit = new Map<string, T[]>()
  for (const orbit of branch.orbits) {
    const hosted = orbitsByHost.get(orbit.hostId) ?? []
    hosted.push(orbit)
    orbitsByHost.set(orbit.hostId, hosted)
  }
  for (const object of branch.objects) {
    if (object.placement.kind !== 'orbit') continue
    const children = objectsByOrbit.get(object.placement.orbitId) ?? []
    children.push(object)
    objectsByOrbit.set(object.placement.orbitId, children)
  }

  function addOrbitBranch(orbit: Orbit, host: T | null, depth: number): void {
    const children = objectsByOrbit.get(orbit.id) ?? []
    rows.push({ kind: 'orbit', orbit, host, childCount: children.length, depth })
    for (const child of children) addObjectBranch(child, depth + 1)
  }

  function addObjectBranch(object: T, depth: number): void {
    rows.push({ kind: 'object', object, depth })
    const hostedOrbits = [...(orbitsByHost.get(object.id) ?? [])].sort((left, right) => left.order - right.order)
    for (const orbit of hostedOrbits) addOrbitBranch(orbit, object, depth + 1)
  }

  const unhostedOrbits = [...(orbitsByHost.get(null) ?? [])].sort((left, right) => left.order - right.order)
  for (const orbit of unhostedOrbits) addOrbitBranch(orbit, null, 0)
  for (const object of branch.objects) {
    if (object.placement.kind !== 'orbit') addObjectBranch(object, 0)
  }
  return rows
}

/** The objects whose placement depends on this Orbit, excluding its own host. */
export function orbitBranchObjects(system: StarSystem | undefined, orbitId: string): SystemObject[] {
  const rows = buildMapHierarchy(system)
  const rootIndex = rows.findIndex(row => row.kind === 'orbit' && row.orbit.id === orbitId)
  if (rootIndex < 0) return []
  const depth = rows[rootIndex]!.depth
  const objects: SystemObject[] = []
  for (const row of rows.slice(rootIndex + 1)) {
    if (row.depth <= depth) break
    if (row.kind === 'object') objects.push(row.object)
  }
  return objects
}
