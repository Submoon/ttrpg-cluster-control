/**
 * Validate workspace structure and normalize supported legacy layouts and field formats on restore.
 */
import { defaultObjectFieldSettings } from './workspace-model'
import type { LocalWorkspace, ObjectFieldSettings, StarSystem } from './workspace-model'
import {
  isArrayOf,
  isJumpRoute,
  isObjectFieldSettings,
  isOrbit,
  isPoint,
  isRecord,
  isSystemObject,
  maxNameLength,
  objectFieldValidationError,
} from './workspace-validation'
import {
  canPlaceObjectInOrbit,
  minimumOrbitRadius,
  normalizeOrbitRadii,
  normalizeOrbitRotations,
  orbitRadiiMeetMinimum,
} from './workspace-orbits'

/**
 * Checks references and cross-entity invariants that cannot be verified by individual object guards.
 * @param system Structurally shaped system candidate.
 * @returns False for duplicate IDs/keys, invalid hosts or station links, bad sibling orders, or cyclic placement.
 */
function isSystemStructureValid(system: StarSystem): boolean {
  const objectIds = new Set(system.objects.map(object => object.id))
  if (objectIds.size !== system.objects.length) {
    return false
  }

  const ids = new Set(objectIds)
  const locationKeys = new Set(system.objects.map(object => object.locationKey))
  if (locationKeys.size !== system.objects.length) {
    return false
  }

  const ordersByHost = new Map<string | null, number[]>()
  for (const orbit of system.orbits) {
    if (
      (orbit.hostId !== null && !objectIds.has(orbit.hostId))
      || ids.has(orbit.id)
    ) {
      return false
    }
    ids.add(orbit.id)
    const orders = ordersByHost.get(orbit.hostId) ?? []
    orders.push(orbit.order)
    ordersByHost.set(orbit.hostId, orders)
    if (orbit.hostId === null && !isPoint(orbit.center)) {
      return false
    }
  }

  for (const orders of ordersByHost.values()) {
    if (orders.sort((left, right) => left - right).some((order, index) => order !== index + 1)) {
      return false
    }
  }

  return system.objects.every(object => {
    if (object.jumpStationId !== undefined && object.jumpStationId !== null) {
      const station = system.objects.find(candidate => candidate.id === object.jumpStationId)
      if (
        object.family !== 'JumpPoint'
        || !station
        || station.family !== 'Installation'
        || station.subtype !== 'station'
      ) {
        return false
      }
    }

    const placement = object.placement
    return placement.kind === 'system'
      || (system.orbits.some(orbit => orbit.id === placement.orbitId)
        && canPlaceObjectInOrbit(system, object.id, placement.orbitId))
  })
}

/**
 * Validates a star system and its internal object, Orbit, station-link, and placement relationships.
 * @param value Unknown imported or restored data.
 * @returns True only when both field shapes and system-wide references are valid.
 */
export function isStarSystem(value: unknown): value is StarSystem {
  if (!isRecord(value) || typeof value.id !== 'string' || !value.id) {
    return false
  }

  const name = value.name
  const objects = value.objects
  const orbits = value.orbits
  if (
    typeof name !== 'string'
    || !name.trim()
    || name !== name.trim()
    || name.length > maxNameLength
    || !isArrayOf(objects, isSystemObject)
    || !isArrayOf(orbits, isOrbit)
  ) {
    return false
  }

  return isSystemStructureValid({ id: value.id, name, objects, orbits })
}

type StoredWorkspaceLayout = Pick<LocalWorkspace['layout'], 'systemPositions'>
  & {
    orbitRadii?: Record<string, unknown>
    orbitEllipseRadii?: Record<string, unknown>
    orbitRotations?: Record<string, number>
    objectAngles?: Record<string, number>
  }

type StoredLocalWorkspace = Omit<LocalWorkspace, 'objectFieldSettings' | 'layout'> & {
  objectFieldSettings?: ObjectFieldSettings
  layout: StoredWorkspaceLayout
}

/**
 * Validates stored workspace data, accepting only the explicitly supported older optional fields/layout forms.
 * @param value Unknown persisted or imported workspace candidate.
 * @returns False if structure, entity IDs/references, layout values, or saved field values are invalid.
 */
function isStoredLocalWorkspace(value: unknown): value is StoredLocalWorkspace {
  if (!isRecord(value) || typeof value.id !== 'string' || !value.id || !isRecord(value.cluster)) {
    return false
  }

  const cluster = value.cluster
  const systems = cluster.systems
  const layout = value.layout
  if (
    typeof cluster.id !== 'string'
    || !cluster.id
    || typeof cluster.name !== 'string'
    || !cluster.name.trim()
    || cluster.name !== cluster.name.trim()
    || cluster.name.length > maxNameLength
    || !isArrayOf(systems, isStarSystem)
    || systems.length === 0
    || !isArrayOf(cluster.routes, isJumpRoute)
    || !isRecord(layout)
    || !isRecord(layout.systemPositions)
    || (layout.orbitRadii !== undefined && !isRecord(layout.orbitRadii))
    || (layout.orbitEllipseRadii !== undefined && !isRecord(layout.orbitEllipseRadii))
    || (layout.orbitRotations !== undefined && !isRecord(layout.orbitRotations))
    || (layout.objectAngles !== undefined && !isRecord(layout.objectAngles))
  ) {
    return false
  }

  const objectFieldSettings = value.objectFieldSettings === undefined
    ? defaultObjectFieldSettings()
    : value.objectFieldSettings
  if (!isObjectFieldSettings(objectFieldSettings)) {
    return false
  }

  const entityIds = new Set<string>([value.id, cluster.id])
  const systemIds = new Set<string>()
  const jumpPointIds = new Set<string>()
  for (const system of systems) {
    if (entityIds.has(system.id) || systemIds.has(system.id)) {
      return false
    }
    entityIds.add(system.id)
    systemIds.add(system.id)

    for (const object of system.objects) {
      if (entityIds.has(object.id)) {
        return false
      }
      entityIds.add(object.id)
      if (object.family === 'JumpPoint') jumpPointIds.add(object.id)
    }
    for (const orbit of system.orbits) {
      if (entityIds.has(orbit.id)) {
        return false
      }
      entityIds.add(orbit.id)
    }
  }

  for (const field of objectFieldSettings.customFields) {
    if (entityIds.has(field.id)) {
      return false
    }
    entityIds.add(field.id)
  }

  const routeIds = new Set<string>()
  for (const route of cluster.routes) {
    if (
      entityIds.has(route.id)
      || routeIds.has(route.id)
      || !jumpPointIds.has(route.fromPointId)
      || (route.toPointId !== null && !jumpPointIds.has(route.toPointId))
    ) {
      return false
    }
    entityIds.add(route.id)
    routeIds.add(route.id)
  }

  const positions = layout.systemPositions
  const orbitRadii = normalizeOrbitRadii(
    layout.orbitRadii ?? {},
    layout.orbitEllipseRadii ?? {},
  )
  if (!orbitRadii) return false
  const orbitRotations = normalizeOrbitRotations(layout.orbitRotations ?? {})
  if (!orbitRotations) return false
  const objectAngles = layout.objectAngles ?? {}
  const orbits = systems.flatMap(system =>
    system.orbits.map(orbit => ({ orbit, system })),
  )
  const orbitIds = new Set(orbits.map(({ orbit }) => orbit.id))
  const orbitObjects = new Set(systems.flatMap(system =>
    system.objects
      .filter(object => object.placement.kind === 'orbit')
      .map(object => object.id),
  ))
  return Object.values(positions).every(isPoint)
    && Object.entries(orbitRadii).every(([orbitId, radii]) => {
      const entry = orbits.find(candidate => candidate.orbit.id === orbitId)
      return entry !== undefined
        && orbitRadiiMeetMinimum(radii, minimumOrbitRadius(entry.system, entry.orbit))
    })
    && Object.keys(orbitRotations).every(orbitId => orbitIds.has(orbitId))
    && Object.values(objectAngles).every(value => typeof value === 'number' && Number.isFinite(value))
    && Object.keys(objectAngles).every(objectId => orbitObjects.has(objectId))
    && systems.every(system =>
      isPoint(positions[system.id])
      && system.objects.every(object => objectFieldValidationError(object, objectFieldSettings) === null),
    )
}

/**
 * Type guard for the current workspace shape; unlike restoreLocalWorkspace, it does not normalize legacy data.
 * @param value Unknown candidate.
 * @returns True only when objectFieldSettings is present and the stored workspace validation succeeds.
 */
export function isLocalWorkspace(value: unknown): value is LocalWorkspace {
  return isStoredLocalWorkspace(value) && value.objectFieldSettings !== undefined
}

/**
 * Removes legacy per-object applicability entries before the stricter category/subtype validator runs.
 * Other malformed targets remain for validation to reject.
 * @param value Arbitrary stored/imported data.
 * @returns A shallow copy when workspace settings contain a customFields array; otherwise the input value.
 */
export function withoutLegacyObjectApplicabilityTargets(value: unknown): unknown {
  if (!isRecord(value) || !isRecord(value.objectFieldSettings)) return value

  const settings = value.objectFieldSettings
  const customFields = settings.customFields
  if (!Array.isArray(customFields)) return value

  return {
    ...value,
    objectFieldSettings: {
      ...settings,
      customFields: customFields.map((field: unknown) => {
        if (!isRecord(field) || !Array.isArray(field.applicability)) return field
        return {
          ...field,
          applicability: field.applicability.filter(target =>
            !isRecord(target)
            || target.kind !== 'object'
            || typeof target.objectId !== 'string'
            || target.objectId.length === 0,
          ),
        }
      }),
    },
  }
}

/**
 * Adds the legacy default Level 1 only to route records that predate the required jumpLevel field.
 * @param value Arbitrary stored/imported data.
 * @returns A shallowly copied value with route defaults, or the original value when no route array is present.
 */
export function withDefaultJumpLevels(value: unknown): unknown {
  if (!isRecord(value) || !isRecord(value.cluster) || !Array.isArray(value.cluster.routes)) {
    return value
  }

  return {
    ...value,
    cluster: {
      ...value.cluster,
      routes: value.cluster.routes.map(route =>
        isRecord(route) && route.jumpLevel === undefined ? { ...route, jumpLevel: 1 } : route,
      ),
    },
  }
}

/**
 * Restores a persisted candidate by applying supported legacy shims, validation, and normalized layout defaults.
 * Malformed or unsupported data is rejected rather than partially repaired.
 * @param value Unknown workspace record read from storage, including supported legacy workspace shapes.
 * @returns Current workspace shape, or null when validation or layout normalization fails.
 */
export function restoreLocalWorkspace(value: unknown): LocalWorkspace | null {
  const restored = withDefaultJumpLevels(withoutLegacyObjectApplicabilityTargets(value))
  if (!isStoredLocalWorkspace(restored)) {
    return null
  }

  const orbitRadii = normalizeOrbitRadii(
    restored.layout.orbitRadii ?? {},
    restored.layout.orbitEllipseRadii ?? {},
  )
  if (!orbitRadii) return null
  const orbitRotations = normalizeOrbitRotations(restored.layout.orbitRotations ?? {})
  if (!orbitRotations) return null

  return {
    ...restored,
    layout: {
      systemPositions: restored.layout.systemPositions,
      orbitRadii,
      orbitRotations,
      objectAngles: restored.layout.objectAngles ?? {},
    },
    objectFieldSettings: restored.objectFieldSettings ?? defaultObjectFieldSettings(),
  }
}
