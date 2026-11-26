/**
 * Validate workspace structure and normalize supported legacy layouts and field formats on restore.
 */
import { defaultObjectFieldSettings, nativePlayerFieldIds } from './workspace-model'
import type { CatalogueObject, RouteContents, Orbit, JumpCluster, JumpRoute, LocalWorkspace, ObjectFieldSettings, Point, StarSystem, SystemFrameInsets } from './workspace-model'
import {
  isArrayOf,
  isJumpRoute,
  isJumpLevel,
  isObjectFieldSettings,
  isOrbit,
  isPoint,
  isPointRecord,
  isPublicationMode,
  isRecord,
  isSystemObject,
  isRouteObject,
  maxNameLength,
  objectFieldValidationError,
} from './workspace-validation'
import { isSystemFrameInsetsRecord } from './workspace-system-frames'
import {
  canPlaceObjectInOrbit,
  minimumOrbitRadius,
  normalizeOrbitRadii,
  normalizeOrbitRotations,
  orbitRadiiMeetMinimum,
} from './workspace-orbits'
import { jumpPointsInCluster } from './workspace-cluster'
import { clusterObjects, migrateLegacyWorkspaceLocationKeys, validLocationKeyAssignments } from './workspace-location-keys'
import { hasValidZonePlacements, retainLegacyZonePlacements } from './workspace-zone-placement-compatibility'
import {
  CLUSTER_SCENE_COORDINATE_LIMIT,
  clusterSystemPosition,
  clusterRouteGeometry,
  hasFiniteClusterRouteGeometry,
  isSafeClusterScenePoint,
  hasSafeClusterSceneBounds,
} from '../utils/cluster-map-geometry'

/**
 * Checks references and cross-entity invariants that cannot be verified by individual object guards.
 * @param system Structurally shaped system candidate.
 * @returns False for duplicate IDs, invalid hosts or station links, bad sibling orders, or cyclic placement.
 */
function isBranchStructureValid(system: { objects: CatalogueObject[]; orbits: Orbit[] }): boolean {
  const objectIds = new Set(system.objects.map(object => object.id))
  if (objectIds.size !== system.objects.length) {
    return false
  }

  const ids = new Set(objectIds)
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
    return placement.kind !== 'orbit'
      || (system.orbits.some(orbit => orbit.id === placement.orbitId)
        && canPlaceObjectInOrbit(system, object.id, placement.orbitId))
  })
}

function hasSafeSystemFrames(
  systemFrames: Record<string, SystemFrameInsets>,
  systemPositions: Record<string, Point>,
): boolean {
  return Object.entries(systemFrames).every(([systemId, insets]) => {
    const anchor = clusterSystemPosition(systemPositions, systemId)
    const left = anchor.x - insets.left
    const top = anchor.y - insets.top
    const right = anchor.x + insets.right
    const bottom = anchor.y + insets.bottom
    const width = insets.left + insets.right
    const height = insets.top + insets.bottom
    return Number.isFinite(width) && Number.isFinite(height)
      && width > 0 && height > 0
      && width <= CLUSTER_SCENE_COORDINATE_LIMIT
      && height <= CLUSTER_SCENE_COORDINATE_LIMIT
      && isSafeClusterScenePoint({ x: left, y: top })
      && isSafeClusterScenePoint({ x: right, y: bottom })
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

  return !Object.hasOwn(value, 'routeContents') && isBranchStructureValid({ objects, orbits })
}

function isRouteContents(value: unknown): value is RouteContents {
  return isRecord(value) && Object.keys(value).length === 2
    && isArrayOf(value.objects, isRouteObject)
    && isArrayOf(value.orbits, (orbit): orbit is RouteContents['orbits'][number] =>
      isOrbit(orbit) && orbit.hostId !== null)
    && isBranchStructureValid({ objects: value.objects, orbits: value.orbits })
}

function isRouteContentsRecord(value: unknown): value is JumpCluster['routeContents'] {
  return isRecord(value)
    && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)
    && Object.values(value).every(isRouteContents)
}

type StoredWorkspaceLayout = Pick<LocalWorkspace['layout'], 'systemPositions'>
  & {
    unresolvedExitPositions?: Record<string, Point>
    systemFrames?: LocalWorkspace['layout']['systemFrames']
    orbitRadii?: Record<string, unknown>
    orbitEllipseRadii?: Record<string, unknown>
    orbitRotations?: Record<string, number>
    objectAngles?: Record<string, number>
  }

type StoredLocalWorkspace = Omit<LocalWorkspace, 'objectFieldSettings' | 'layout'> & {
  objectFieldSettings?: ObjectFieldSettings
  layout: StoredWorkspaceLayout
}

type LegacyJumpRoute = {
  id: string
  name?: string
  jumpLevel: number
  fromPointId: string
  toPointId: string | null
  unresolvedExit?: string
  playerShared: boolean
}

function isLegacyJumpRoute(value: unknown): value is LegacyJumpRoute {
  if (!isRecord(value)
    || typeof value.id !== 'string'
    || !value.id
    || (value.name !== undefined && (
      typeof value.name !== 'string'
      || !value.name.trim()
      || value.name !== value.name.trim()
      || value.name.length > maxNameLength
    ))
    || !isJumpLevel(value.jumpLevel)
    || typeof value.fromPointId !== 'string'
    || !value.fromPointId
    || typeof value.playerShared !== 'boolean') return false

  if (typeof value.toPointId === 'string') {
    return !!value.toPointId
      && value.toPointId !== value.fromPointId
      && value.unresolvedExit === undefined
  }
  return value.toPointId === null
    && typeof value.unresolvedExit === 'string'
    && !!value.unresolvedExit.trim()
    && value.unresolvedExit === value.unresolvedExit.trim()
    && value.unresolvedExit.length <= maxNameLength
}

/**
 * Infers the system endpoints of supported point-based route records and removes only valid resolved loops.
 * Route identities, entity/Field collisions, and every original Jump Point reference are checked before a loop is dropped.
 */
export function migrateLegacyWorkspaceRouteShape(value: unknown): unknown | null {
  if (!isRecord(value) || !isRecord(value.cluster) || !isRecord(value.layout)) return null
  const cluster = value.cluster
  const systems = cluster.systems
  const routes = cluster.routes
  if (!Array.isArray(systems) || !Array.isArray(routes)) return null

  const entityIds = new Set<string>()
  for (const id of [value.id, cluster.id]) {
    if (typeof id === 'string' && id) entityIds.add(id)
  }
  const systemIds = new Set<string>()
  const jumpPointOwners = new Map<string, string>()
  for (const system of systems) {
    if (!isRecord(system)) continue
    if (typeof system.id === 'string' && system.id) {
      entityIds.add(system.id)
      systemIds.add(system.id)
    }
    if (Array.isArray(system.objects)) {
      for (const object of system.objects) {
        if (!isRecord(object)) continue
        if (typeof object.id === 'string' && object.id) {
          entityIds.add(object.id)
          if (object.family === 'JumpPoint' && typeof system.id === 'string') {
            jumpPointOwners.set(object.id, system.id)
          }
        }
      }
    }
    if (Array.isArray(system.orbits)) {
      for (const orbit of system.orbits) {
        if (isRecord(orbit) && typeof orbit.id === 'string' && orbit.id) entityIds.add(orbit.id)
      }
    }
  }
  const settings = value.objectFieldSettings
  if (isRecord(settings) && Array.isArray(settings.customFields)) {
    for (const field of settings.customFields) {
      if (isRecord(field) && typeof field.id === 'string' && field.id) entityIds.add(field.id)
    }
  }

  const routeIds = new Set<string>()
  const routesById = new Map<string, LegacyJumpRoute>()
  for (const route of routes) {
    if (!isLegacyJumpRoute(route)
      || entityIds.has(route.id)
      || routeIds.has(route.id)
      || !jumpPointOwners.has(route.fromPointId)
      || (route.toPointId !== null && !jumpPointOwners.has(route.toPointId))) return null
    routeIds.add(route.id)
    routesById.set(route.id, route)
  }

  const removedLoopIds = new Set<string>()
  const migratedRoutes: JumpRoute[] = []
  for (const route of routes) {
    if (!isLegacyJumpRoute(route)) return null
    const fromSystemId = jumpPointOwners.get(route.fromPointId)
    const toSystemId = route.toPointId === null ? null : jumpPointOwners.get(route.toPointId)
    if (!fromSystemId || !systemIds.has(fromSystemId)
      || (route.toPointId !== null && (!toSystemId || !systemIds.has(toSystemId)))) return null
    if (toSystemId !== null && toSystemId === fromSystemId) {
      removedLoopIds.add(route.id)
      continue
    }
    migratedRoutes.push(route.toPointId === null
      ? {
          id: route.id,
          ...(route.name !== undefined ? { name: route.name } : {}),
          jumpLevel: route.jumpLevel,
          fromSystemId,
          fromPointId: route.fromPointId,
          toSystemId: null,
          toPointId: null,
          unresolvedExit: route.unresolvedExit!,
          playerShared: route.playerShared,
        }
      : {
          id: route.id,
          ...(route.name !== undefined ? { name: route.name } : {}),
          jumpLevel: route.jumpLevel,
          fromSystemId,
          fromPointId: route.fromPointId,
          toSystemId: toSystemId!,
          toPointId: route.toPointId,
          playerShared: route.playerShared,
        })
  }

  const unresolvedExitPositions = value.layout.unresolvedExitPositions
  if (unresolvedExitPositions !== undefined && !isPointRecord(unresolvedExitPositions)) return null
  const sourceExitPositions = (unresolvedExitPositions ?? {}) as Record<string, Point>
  const keptExitPositionEntries: Array<[string, Point]> = []
  for (const [routeId, position] of Object.entries(sourceExitPositions)) {
    const route = routesById.get(routeId)
    if (removedLoopIds.has(routeId)) continue
    if (!route || route.toPointId !== null) return null
    keptExitPositionEntries.push([routeId, position])
  }
  const keptExitPositions = Object.fromEntries(keptExitPositionEntries)

  return {
    ...value,
    version: 5,
    cluster: { ...cluster, routes: migratedRoutes },
    layout: { ...value.layout, unresolvedExitPositions: keptExitPositions },
  }
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
    || value.version !== 7
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
  const routeContents = cluster.routeContents
  const layout = value.layout
  const systemPositionsValue = isRecord(layout) ? layout.systemPositions : undefined
  const unresolvedExitPositionsValue = isRecord(layout) ? layout.unresolvedExitPositions : undefined
  const systemFramesValue = isRecord(layout) ? layout.systemFrames : undefined
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
    || !isRouteContentsRecord(routeContents)
    || !isRecord(layout)
    || (!allowLegacyLayout && !hasCurrentOrbitLayout(layout))
    || !isPointRecord(systemPositionsValue)
    || (unresolvedExitPositionsValue !== undefined && !isPointRecord(unresolvedExitPositionsValue))
    || (systemFramesValue !== undefined && !isSystemFrameInsetsRecord(systemFramesValue))
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
  const jumpPointOwners = new Map<string, { systemId: string }>()
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
      if (object.family === 'JumpPoint') jumpPointOwners.set(object.id, { systemId: system.id })
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
    const originSystem = systemIds.has(route.fromSystemId)
    const originPoint = route.fromPointId === null ? undefined : jumpPointOwners.get(route.fromPointId)
    const destinationSystem = route.toSystemId === null ? undefined : systemIds.has(route.toSystemId)
    const destinationPoint = route.toPointId === null ? undefined : jumpPointOwners.get(route.toPointId)
    if (
      entityIds.has(route.id)
      || routeIds.has(route.id)
      || !originSystem
      || (route.fromPointId !== null && originPoint?.systemId !== route.fromSystemId)
      || (route.toSystemId !== null && (!destinationSystem || route.toSystemId === route.fromSystemId))
      || (route.toPointId !== null && destinationPoint?.systemId !== route.toSystemId)
      || (route.toSystemId === null && route.toPointId !== null)
    ) {
      return false
    }
    entityIds.add(route.id)
    routeIds.add(route.id)
  }

  for (const [routeId, contents] of Object.entries(routeContents)) {
    if (!routeIds.has(routeId)) return false
    for (const entity of [...contents.objects, ...contents.orbits]) {
      if (entityIds.has(entity.id)) return false
      entityIds.add(entity.id)
    }
  }

  const positions = systemPositionsValue
  const unresolvedExitPositions = unresolvedExitPositionsValue ?? {}
  const systemFrames = systemFramesValue ?? {}
  const validatedCluster: JumpCluster = {
    id: clusterId,
    name: clusterName,
    playerTitle,
    systems,
    routes,
    routeContents,
  }
  if (!validLocationKeyAssignments(clusterObjects(validatedCluster))) return false
  const jumpPoints = new Map(jumpPointsInCluster(validatedCluster).map(reference => [reference.point.id, reference]))
  const orbitRadii = normalizeOrbitRadii(
    layout.orbitRadii ?? {},
    layout.orbitEllipseRadii ?? {},
  )
  if (!orbitRadii) return false
  const orbitRotations = normalizeOrbitRotations(layout.orbitRotations ?? {})
  if (!orbitRotations) return false
  const objectAngles = layout.objectAngles ?? {}
  const branches = [...systems, ...Object.values(routeContents)]
  const orbits = branches.flatMap(branch =>
    branch.orbits.map(orbit => ({ orbit, branch })),
  )
  const orbitIds = new Set(orbits.map(({ orbit }) => orbit.id))
  const orbitObjects = new Set(branches.flatMap(system =>
    system.objects
      .filter(object => object.placement.kind === 'orbit')
      .map(object => object.id),
  ))
  return Object.values(positions).every(isPoint)
    && Object.values(unresolvedExitPositions).every(isPoint)
    && Object.entries(systemFrames).every(([systemId]) => systemIds.has(systemId))
    && hasSafeSystemFrames(systemFrames, positions)
    && hasSafeClusterSceneBounds(validatedCluster, positions, unresolvedExitPositions)
    && Object.entries(unresolvedExitPositions).every(([routeId]) =>
      routes.some(route => route.id === routeId && route.toSystemId === null),
    )
    && Object.entries(unresolvedExitPositions).every(([routeId]) => {
      const index = routes.findIndex(route => route.id === routeId)
      const route = routes[index]
      if (!route || route.toSystemId !== null) return false
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
        && orbitRadiiMeetMinimum(radii, minimumOrbitRadius(entry.branch, entry.orbit))
    })
    && Object.keys(orbitRotations).every(orbitId => orbitIds.has(orbitId))
    && Object.values(objectAngles).every(value => typeof value === 'number' && Number.isFinite(value))
    && Object.keys(objectAngles).every(objectId => orbitObjects.has(objectId))
    && systems.every(system => isPoint(positions[system.id]))
    && branches.every(branch => branch.objects.every(object =>
      objectFieldValidationError(object, objectFieldSettings) === null,
    ))
}

/** Checks the complete Orbit layout fields written by current source formats. */
export function hasCurrentOrbitLayout(layout: Record<string, unknown>): boolean {
  return isCurrentOrbitRadii(layout.orbitRadii)
    && layout.orbitEllipseRadii === undefined
    && isCurrentOrbitRotations(layout.orbitRotations)
    && isRecord(layout.objectAngles)
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
  if (!isStoredLocalWorkspace(value) || value.objectFieldSettings === undefined) return false
  const workspace = normalizedWorkspaceLayout(value)
  return workspace !== null && hasValidZonePlacements(workspace)
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
  } else if (!isVersionThree && version !== 4 && version !== 5 && version !== 6 && version !== 7) {
    return null
  }

  if (isUnversionedLegacy || isVersionTwo || isVersionThree) {
    currentValue = withLegacyPlayerSharingDefaults(currentValue)
  }

  const restored = isUnversionedLegacy
    ? withDefaultJumpLevels(withoutLegacyObjectApplicabilityTargets(currentValue))
    : currentValue
  const routeShape = version === 5 || version === 6 || version === 7
    ? restored : migrateLegacyWorkspaceRouteShape(restored)
  const keyShape = version === 6 || version === 7 ? routeShape : migrateLegacyWorkspaceLocationKeys(routeShape)
  const current = version === 7 ? keyShape : addLegacyRouteContents(keyShape)
  if (!current || !isStoredLocalWorkspace(current, isUnversionedLegacy)) {
    return null
  }

  const workspace = normalizedWorkspaceLayout(current)
  if (!workspace) return null
  if (version === 6 || version === 7) return hasValidZonePlacements(workspace) ? workspace : null
  if (clusterObjects(workspace.cluster).some(object => Object.hasOwn(object, 'legacyZonePlacement'))) return null
  const migrated = retainLegacyZonePlacements(workspace)
  return hasValidZonePlacements(migrated) ? migrated : null
}

function addLegacyRouteContents(value: unknown): unknown {
  if (!isRecord(value) || !isRecord(value.cluster)) return null
  const contents = value.cluster.routeContents
  if (contents !== undefined && (!isRecord(contents) || Object.keys(contents).length > 0)) return null
  return { ...value, version: 7, cluster: { ...value.cluster, routeContents: {} } }
}

function normalizedWorkspaceLayout(current: StoredLocalWorkspace): LocalWorkspace | null {
  const orbitRadii = normalizeOrbitRadii(
    current.layout.orbitRadii ?? {},
    current.layout.orbitEllipseRadii ?? {},
  )
  if (!orbitRadii) return null
  const orbitRotations = normalizeOrbitRotations(current.layout.orbitRotations ?? {})
  if (!orbitRotations) return null

  return {
    ...current,
    layout: {
      systemPositions: current.layout.systemPositions,
      unresolvedExitPositions: current.layout.unresolvedExitPositions ?? {},
      ...(current.layout.systemFrames !== undefined ? { systemFrames: current.layout.systemFrames } : {}),
      orbitRadii,
      orbitRotations,
      objectAngles: current.layout.objectAngles ?? {},
    },
    objectFieldSettings: current.objectFieldSettings ?? defaultObjectFieldSettings(),
  }
}
