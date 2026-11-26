import { catalogueTypes, type CatalogueObject, type JumpCluster, type SystemObject } from './workspace-model'
import { isRecord } from './workspace-validation'

/** Enumerates all objects sharing the Cluster's Location key namespace. */
export function clusterObjects(cluster: Pick<JumpCluster, 'systems' | 'routeContents'>): CatalogueObject[] {
  return [
    ...cluster.systems.flatMap(system => system.objects),
    ...Object.values(cluster.routeContents).flatMap(contents => contents.objects),
  ]
}

export function locationKeyConflict(
  objects: readonly CatalogueObject[],
  key: string,
  existingKey?: string,
): string | null {
  return key !== existingKey && objects.some(object => object.locationKey === key)
    ? `Location key "${key}" is already used in this Jump Cluster.`
    : null
}

export function nextLocationKey(prefix: string, reserved: ReadonlySet<string>): string {
  let index = 1
  let key = `${prefix}-${String(index).padStart(2, '0')}`
  while (reserved.has(key)) {
    index += 1
    key = `${prefix}-${String(index).padStart(2, '0')}`
  }
  return key
}

export function objectLocationKeyPrefix(object: Pick<SystemObject, 'family' | 'subtype'>): string {
  return catalogueTypes.find(type => type.family === object.family && type.value === object.subtype)?.keyPrefix
    ?? 'OTH'
}

/** Every duplicate participant must carry its own exact retained assignment. */
export function validLocationKeyAssignments(objects: readonly CatalogueObject[]): boolean {
  const firstByKey = new Map<string, CatalogueObject>()
  for (const object of objects) {
    const retained = object.legacyLocationKey
    if (Object.hasOwn(object, 'legacyLocationKey')
      && (!isRecord(retained) || retained.objectId !== object.id || retained.key !== object.locationKey)) return false
    const first = firstByKey.get(object.locationKey)
    if (first === undefined) {
      firstByKey.set(object.locationKey, object)
    } else if (object.legacyLocationKey === undefined || first.legacyLocationKey === undefined) {
      return false
    }
  }
  return true
}

/** Upgrade only pre-v6 complete Cluster data. Earlier formats allowed duplicates across Zones only. */
export function migrateLegacyWorkspaceLocationKeys(value: unknown): unknown {
  if (!isRecord(value) || !isRecord(value.cluster) || !Array.isArray(value.cluster.systems)) return null
  const systems: unknown[] = value.cluster.systems
  const duplicateKeys = new Set<string>()
  const seen = new Set<string>()
  for (const system of systems) {
    if (!isRecord(system) || !Array.isArray(system.objects)) return null
    const systemKeys = new Set<string>()
    for (const object of system.objects) {
      if (!isRecord(object) || typeof object.id !== 'string' || typeof object.locationKey !== 'string'
        || Object.hasOwn(object, 'legacyLocationKey')) return null
      const key = object.locationKey
      if (systemKeys.has(key)) return null
      systemKeys.add(key)
      if (seen.has(key)) duplicateKeys.add(key)
      seen.add(key)
    }
  }

  return {
    ...value,
    version: 6,
    cluster: {
      ...value.cluster,
      systems: systems.map(system => {
        if (!isRecord(system) || !Array.isArray(system.objects)) return system
        return {
          ...system,
          objects: system.objects.map((object: unknown) =>
            isRecord(object) && typeof object.id === 'string' && typeof object.locationKey === 'string'
            && duplicateKeys.has(object.locationKey)
              ? { ...object, legacyLocationKey: { objectId: object.id, key: object.locationKey } }
              : object),
        }
      }),
    },
  }
}
