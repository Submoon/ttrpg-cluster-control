/**
 * Validate workspace structure and normalize supported legacy layouts and field formats on restore.
 */
import { defaultObjectFieldSettings, nativePlayerFieldIds } from './workspace-model'
import type { JumpCluster, LocalWorkspace, ObjectFieldSettings, Point, StarSystem } from './workspace-model'
import {
  isArrayOf,
  isJumpRoute,
  isObjectFieldSettings,
  isOrbit,
  isPoint,
  isPointRecord,
  isPublicationMode,
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
import { jumpPointsInCluster } from './workspace-cluster'
import {
  clusterRouteGeometry,
  hasFiniteClusterRouteGeometry,
  hasSafeClusterSceneBounds,
} from '../utils/cluster-map-geometry'

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
  const publication = value.publication
  const objects = value.objects
  const orbits = value.orbits
  if (
    typeof name !== 'string'
    || !name.trim()
    || name !== name.trim()
    || name.length > maxNameLength
    || !isPublicationMode(publication)
    || !isArrayOf(objects, isSystemObject)
    || !isArrayOf(orbits, isOrbit)
  ) {
    return false
  }

  return isSystemStructureValid({ id: value.id, name, publication, objects, orbits })
}

type StoredWorkspaceLayout = Pick<LocalWorkspace['layout'], 'systemPositions'>
  & {
    unresolvedExitPositions?: Record<string, Point>
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
function isStoredLocalWorkspace(
  value: unknown,
  allowLegacyLayout = false,
): value is StoredLocalWorkspace {
  if (
    !isRecord(value)
    || value.version !== 4
    || typeof value.id !== 'string'
    || !value.id
    || (!allowLegacyLayout && value.objectFieldSettings === undefined)
    || !isRecord(value.cluster)
  ) {
    return false
  }

  const cluster = value.cluster
  const clusterId = cluster.id
  const clusterName = cluster.name
  const playerTitle = cluster.playerTitle
  const systems = cluster.systems
  const routes = cluster.routes
  const layout = value.layout
  const systemPositionsValue = isRecord(layout) ? layout.systemPositions : undefined
  const unresolvedExitPositionsValue = isRecord(layout) ? layout.unresolvedExitPositions : undefined
  if (
    typeof clusterId !== 'string'
    || !clusterId
    || typeof clusterName !== 'string'
    || !clusterName.trim()
    || clusterName !== clusterName.trim()
    || clusterName.length > maxNameLength
    || typeof playerTitle !== 'string'
    || !playerTitle.trim()
    || playerTitle !== playerTitle.trim()
    || playerTitle.length > maxNameLength
    || !isArrayOf(systems, isStarSystem)
    || systems.length === 0
    || !isArrayOf(routes, isJumpRoute)
    || !isRecord(layout)
    || (!allowLegacyLayout && (
      !isCurrentOrbitRadii(layout.orbitRadii)
      || layout.orbitEllipseRadii !== undefined
      || !isCurrentOrbitRotations(layout.orbitRotations)
      || !isRecord(layout.objectAngles)
    ))
    || !isPointRecord(systemPositionsValue)
    || (unresolvedExitPositionsValue !== undefined && !isPointRecord(unresolvedExitPositionsValue))
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

  const entityIds = new Set<string>([value.id, clusterId])
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
  for (const route of routes) {
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

  const positions = systemPositionsValue
  const unresolvedExitPositions = unresolvedExitPositionsValue ?? {}
  const validatedCluster: JumpCluster = {
    id: clusterId,
    name: clusterName,
    playerTitle,
    systems,
    routes,
  }
  const jumpPoints = new Map(jumpPointsInCluster(validatedCluster).map(reference => [reference.point.id, reference]))
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
    && Object.values(unresolvedExitPositions).every(isPoint)
    && hasSafeClusterSceneBounds(validatedCluster, positions, unresolvedExitPositions)
    && Object.entries(unresolvedExitPositions).every(([routeId]) =>
      routes.some(route => route.id === routeId && route.toPointId === null),
    )
    && Object.entries(unresolvedExitPositions).every(([routeId]) => {
      const index = routes.findIndex(route => route.id === routeId)
      const route = routes[index]
      if (!route || route.toPointId !== null) return false
      try {
        return hasFiniteClusterRouteGeometry(clusterRouteGeometry(
          route,
          validatedCluster,
          jumpPoints,
          positions,
          undefined,
          unresolvedExitPositions,
        ))
      } catch {
        return false
      }
    })
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

function isCurrentOrbitRadii(value: unknown): boolean {
  return isRecord(value)
    && Object.values(value).every(radii => isRecord(radii)
      && typeof radii.horizontal === 'number'
      && Number.isFinite(radii.horizontal)
      && typeof radii.vertical === 'number'
      && Number.isFinite(radii.vertical))
}

function isCurrentOrbitRotations(value: unknown): boolean {
  return isRecord(value)
    && Object.values(value).every(rotation => typeof rotation === 'number'
      && Number.isFinite(rotation)
      && rotation >= 0
      && rotation < 360)
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

type LegacyCustomFieldIdContext = 'local-workspace' | 'cluster-export' | 'system-export'

/**
 * Remaps pre-v4 custom definition IDs that alias native Field IDs, preserving their assignment keys.
 * Candidate IDs avoid the authoritative payload's entity IDs, definitions, and assignment keys.
 * Invalid or duplicate original definition IDs are left untouched so strict validation rejects them.
 */
export function remapLegacyReservedCustomFieldIds(
  value: unknown,
  context: LegacyCustomFieldIdContext,
): unknown {
  if (!isRecord(value) || !isRecord(value.objectFieldSettings)) return value
  const settings = value.objectFieldSettings
  type LegacyCustomFieldRecord = Record<string, unknown> & { id: string }
  const hasValidFieldId = (field: unknown): field is LegacyCustomFieldRecord =>
    isRecord(field) && typeof field.id === 'string' && field.id.length > 0
  const isLegacyCustomFieldArray = (fields: unknown): fields is LegacyCustomFieldRecord[] =>
    Array.isArray(fields) && fields.every(hasValidFieldId)
  if (!isLegacyCustomFieldArray(settings.customFields)) {
    return value
  }
  const fields = settings.customFields
  const definitionIds = fields.map(field => field.id)
  if (new Set(definitionIds).size !== definitionIds.length) return value

  const reservedNativeIds = new Set<string>(Object.values(nativePlayerFieldIds))
  if (!definitionIds.some(id => reservedNativeIds.has(id))) {
    return value
  }

  const cluster = isRecord(value.cluster) ? value.cluster : undefined
  const system = isRecord(value.system) ? value.system : undefined
  if (context !== 'system-export' && !cluster) return value
  if (context === 'system-export' && !system) return value

  const conflictIds = new Set<string>()
  const usedIds = new Set<string>(definitionIds)
  const reserveEntityIds = (record: Record<string, unknown>): void => {
    if (typeof record.id === 'string' && record.id.length > 0) {
      usedIds.add(record.id)
      if (context !== 'system-export') conflictIds.add(record.id)
    }
  }
  const reserveSystemIds = (system: unknown): void => {
    if (!isRecord(system)) return
    reserveEntityIds(system)
    if (Array.isArray(system.objects)) {
      for (const object of system.objects) if (isRecord(object)) reserveEntityIds(object)
    }
    if (Array.isArray(system.orbits)) {
      for (const orbit of system.orbits) if (isRecord(orbit)) reserveEntityIds(orbit)
    }
  }

  const sourceSystems: unknown[] = []
  if (context === 'system-export') {
    sourceSystems.push(system)
  } else if (cluster) {
    if (context === 'local-workspace') reserveEntityIds(value)
    reserveEntityIds(cluster)
    if (Array.isArray(cluster.systems)) {
      sourceSystems.push(...cluster.systems)
    }
    if (Array.isArray(cluster.routes)) {
      for (const route of cluster.routes) if (isRecord(route)) reserveEntityIds(route)
    }
  }
  for (const sourceSystem of sourceSystems) reserveSystemIds(sourceSystem)

  if (definitionIds.some(id => reservedNativeIds.has(id) && conflictIds.has(id))) {
    return value
  }

  for (const system of sourceSystems) {
    if (!isRecord(system) || !Array.isArray(system.objects)) continue
    for (const object of system.objects) {
      if (!isRecord(object) || !isRecord(object.customFieldValues)) continue
      for (const fieldId of Object.keys(object.customFieldValues)) usedIds.add(fieldId)
    }
  }

  const fieldIds = new Map<string, string>()
  let suffix = 1
  for (const fieldId of definitionIds) {
    if (!reservedNativeIds.has(fieldId)) continue
    let replacementId = `legacy-custom-field-${suffix++}`
    while (usedIds.has(replacementId)) replacementId = `legacy-custom-field-${suffix++}`
    usedIds.add(replacementId)
    fieldIds.set(fieldId, replacementId)
  }

  const remapSystem = (system: unknown): unknown => {
    if (!isRecord(system) || !Array.isArray(system.objects)) return system
    return {
      ...system,
      objects: system.objects.map(object => {
        if (!isRecord(object) || !isRecord(object.customFieldValues)) return object
        return {
          ...object,
          customFieldValues: Object.fromEntries(Object.entries(object.customFieldValues).map(([fieldId, fieldValue]) => [
            fieldIds.get(fieldId) ?? fieldId,
            fieldValue,
          ])),
        }
      }),
    }
  }

  const objectFieldSettings = {
    ...settings,
    customFields: fields.map(field => {
      const id = fieldIds.get(field.id)
      return id === undefined ? field : { ...field, id }
    }),
  }
  if (context === 'system-export') {
    return {
      ...value,
      objectFieldSettings,
      system: remapSystem(system),
    }
  }
  if (!cluster) return value

  return {
    ...value,
    objectFieldSettings,
    cluster: {
      ...cluster,
      ...(Array.isArray(cluster.systems)
        ? { systems: cluster.systems.map(remapSystem) }
        : {}),
    },
  }
}

/**
 * Converts supported pre-v4 source records to their explicit private player-sharing defaults.
 * These fields did not exist in earlier formats, so their values are always initialized safely.
 */
function withLegacyPlayerSharingDefaults(value: unknown): unknown {
  if (!isRecord(value) || !isRecord(value.cluster)) return value

  const cluster = value.cluster
  const settings = value.objectFieldSettings
  const migrated = {
    ...value,
    version: 4,
    cluster: {
      ...cluster,
      systems: Array.isArray(cluster.systems)
        ? cluster.systems.map(system => isRecord(system)
          ? {
              ...system,
              objects: Array.isArray(system.objects)
                ? system.objects.map(object => isRecord(object)
                  ? { ...object, playerText: '', playerFieldMasks: [] }
                  : object)
                : system.objects,
            }
          : system)
        : cluster.systems,
      routes: Array.isArray(cluster.routes)
        ? cluster.routes.map(route => isRecord(route) ? { ...route, playerShared: false } : route)
        : cluster.routes,
    },
    ...(isRecord(settings) ? {
      objectFieldSettings: {
        ...settings,
        nativePlayerSharing: { atmosphere: false, portClass: false },
        customFields: Array.isArray(settings.customFields)
          ? settings.customFields.map(field => isRecord(field) ? { ...field, playerShared: false } : field)
          : settings.customFields,
      },
    } : {}),
  }
  return remapLegacyReservedCustomFieldIds(migrated, 'local-workspace')
}

/**
 * Restores a persisted candidate by applying supported legacy shims, validation, and normalized layout defaults.
 * Malformed or unsupported data is rejected rather than partially repaired.
 * @param value Unknown workspace record read from storage, including supported legacy workspace shapes.
 * @returns Current workspace shape, or null when validation or layout normalization fails.
 */
export function restoreLocalWorkspace(value: unknown): LocalWorkspace | null {
  if (!isRecord(value)) return null

  const version = value.version
  const isUnversionedLegacy = version === undefined
  const isVersionTwo = version === 2
  const isVersionThree = version === 3
  let currentValue: unknown = value
  if (isUnversionedLegacy) {
    const cluster = value.cluster
    if (!isRecord(cluster) || !Array.isArray(cluster.systems)) return null
    currentValue = {
      ...value,
      version: 4,
      cluster: {
        ...cluster,
        playerTitle: 'Player Jump Cluster',
        systems: cluster.systems.map(system => isRecord(system)
          ? {
              ...system,
              publication: 'hidden',
              objects: Array.isArray(system.objects)
                ? system.objects.map(object => isRecord(object)
                  ? { ...object, publication: 'hidden' }
                  : object)
                : system.objects,
            }
          : system),
      },
    }
  } else if (isVersionTwo) {
    const cluster = value.cluster
    if (!isRecord(cluster) || !Array.isArray(cluster.systems)) return null
    currentValue = {
      ...value,
      version: 4,
      cluster: {
        ...cluster,
        systems: cluster.systems.map(system => isRecord(system)
          ? {
              ...system,
              objects: Array.isArray(system.objects)
                ? system.objects.map(object => isRecord(object)
                  ? { ...object, publication: 'hidden' }
                  : object)
                : system.objects,
            }
          : system),
      },
    }
  } else if (!isVersionThree && version !== 4) {
    return null
  }

  if (isUnversionedLegacy || isVersionTwo || isVersionThree) {
    currentValue = withLegacyPlayerSharingDefaults(currentValue)
  }

  const restored = isUnversionedLegacy
    ? withDefaultJumpLevels(withoutLegacyObjectApplicabilityTargets(currentValue))
    : currentValue
  if (!isStoredLocalWorkspace(restored, isUnversionedLegacy)) {
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
      unresolvedExitPositions: restored.layout.unresolvedExitPositions ?? {},
      orbitRadii,
      orbitRotations,
      objectAngles: restored.layout.objectAngles ?? {},
    },
    objectFieldSettings: restored.objectFieldSettings ?? defaultObjectFieldSettings(),
  }
}
