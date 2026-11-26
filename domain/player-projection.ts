/** Allowlisted Warden-side player projection with no dependency on editor or persistence state. */
import type {
  CatalogueObject,
  CustomFieldType,
  JumpRoute,
  RouteObject,
  CustomFieldValue,
  LocalWorkspace,
  ObjectFamily,
  OrbitRadii,
  Point,
  PublicationMode,
  StarSystem,
} from './workspace-model'
import { clusterAutomaticExitPosition, clusterRouteGeometry, clusterSystemPosition } from '../utils/cluster-map-geometry'
import { catalogueSubtypeLabel } from '../utils/catalogue-labels'
import {
  objectPositions,
  orbitCenter,
  orbitRadii,
  orbitRotation,
  type SystemMapGeometry,
} from '../utils/system-map-geometry'
import { captureEffectiveObjectAngles } from './workspace-placement'
import { isCustomFieldApplicableToObject } from './workspace-fields'
import { jumpPointsInCluster } from './workspace-cluster'
import { isMarkerColor } from './marker-color'
import { routeContentsFor } from './workspace-route-objects'
import { buildContinuousMapRouteGeometries } from '../utils/continuous-map-route-geometry'
import { pointOnRoute, projectRouteObjects } from '../utils/route-object-geometry'

export type PlayerSystemMarker = {
  id: string
  position: Point
} & (
  | { disclosure: 'unknown'; label: 'Unknown presence' }
  | { disclosure: 'known-type'; type: 'star-system'; label: 'Zone' }
  | { disclosure: 'revealed'; type: 'star-system'; label: string; map: PlayerSystemDocument }
)

/** Scene geometry and the references needed to navigate one published system. */
export interface PlayerSystemDocument {
  objects: PlayerObjectMarker[]
  orbits: PlayerOrbit[]
}

/** A secret-free object marker. Its arm contains only fields allowed by its disclosure. */
export type PlayerObjectMarker = {
  id: string
  position: Point
  placement:
    | { kind: 'system' }
    | { kind: 'branch-root' }
    | { kind: 'orbit'; orbitId: string; angle: number }
} & (
  | { disclosure: 'unknown'; label: 'Unknown presence' }
  | {
      disclosure: 'known-type'
      family: ObjectFamily
      subtype: string
      label: string
      markerColor?: string
    }
  | {
      disclosure: 'revealed'
      family: ObjectFamily
      subtype: string
      label: string
      markerColor?: string
      playerText: string
      fields: PlayerFieldValue[]
      stationId?: string
    }
)

/** Player-visible value of one shared native or custom Field; definition metadata stays private. */
export interface PlayerFieldValue {
  name: string
  type: CustomFieldType
  value: CustomFieldValue
}

/** Public Orbit geometry with only remapped references. Source sibling order is intentionally omitted. */
export interface PlayerOrbit {
  id: string
  hostId: string | null
  center: Point
  radii: OrbitRadii
  rotation: number
}

/** Public Cluster document. Its shape is intentionally independent from the full source workspace. */
export interface PlayerClusterDocument {
  format: 'ttrpg-cluster-control-player'
  version: 3
  title: string
  systems: PlayerSystemMarker[]
  routes: PlayerRoute[]
  routeBranches: PlayerRouteBranch[]
}

/** One allowed branch, with geometry relative to its own anchor and identities local to the branch. */
export interface PlayerRouteBranch {
  id: string
  anchor: { kind: 'detached'; position: Point } | { kind: 'route'; routeId: string; progression: number }
  map: PlayerSystemDocument
}

/** Object maps available for consultation and filter inventory. */
export function playerObjectMaps(document: PlayerClusterDocument): PlayerSystemDocument[] {
  return [
    ...document.systems.flatMap(system => system.disclosure === 'revealed' ? [system.map] : []),
    ...document.routeBranches.map(branch => branch.map),
  ]
}

/** Public route structure; source Jump Point IDs, route names, and exit labels are omitted. */
export interface PlayerRoute {
  id: string
  jumpLevel: number
  fromSystemId: string
  fromPointId?: string
  destination:
    | { kind: 'system'; systemId: string; pointId?: string }
    | { kind: 'unknown'; position: Point; label: 'Unknown destination' }
}

/**
 * Builds the public marker document from committed Cluster data using an explicit field allowlist.
 * Public IDs are assigned after Hidden systems are filtered, and saved normalized positions are
 * converted into scene coordinates without accepting gesture or preview overrides.
 */
export function projectPlayerCluster(workspace: LocalWorkspace): PlayerClusterDocument {
  const systems: PlayerSystemMarker[] = []
  const publicSystemIds = new Map<string, string>()
  const revealedJumpPointIdsBySystem = new Map<string, Map<string, string>>()
  for (const system of workspace.cluster.systems) {
    if (system.publication === 'hidden') continue

    const markerId = `system-${systems.length + 1}`
    publicSystemIds.set(system.id, markerId)
    const sourcePosition = clusterSystemPosition(workspace.layout.systemPositions, system.id)
    const position = { x: sourcePosition.x, y: sourcePosition.y }
    if (system.publication === 'unknown') {
      systems.push({ id: markerId, position, disclosure: 'unknown', label: 'Unknown presence' })
    } else if (system.publication === 'known-type') {
      systems.push({
        id: markerId,
        position,
        disclosure: 'known-type',
        type: 'star-system',
        label: 'Zone',
      })
    } else if (system.publication === 'revealed') {
      const projected = projectPlayerSystem(workspace, system)
      systems.push({
        id: markerId,
        position,
        disclosure: 'revealed',
        type: 'star-system',
        label: system.name,
        map: projected.document,
      })
      revealedJumpPointIdsBySystem.set(system.id, projected.revealedJumpPointIds)
    }
  }

  const publicRoutes = projectPlayerRoutes(workspace, publicSystemIds, revealedJumpPointIdsBySystem)
  return {
    format: 'ttrpg-cluster-control-player',
    version: 3,
    title: workspace.cluster.playerTitle,
    systems,
    routes: [...publicRoutes.values()].map(({ route }) => route),
    routeBranches: projectRouteBranches(workspace, publicRoutes),
  }
}

interface RoutePublication {
  route: PlayerRoute
  reversed: boolean
}

function projectPlayerRoutes(
  workspace: LocalWorkspace,
  publicSystemIds: ReadonlyMap<string, string>,
  revealedJumpPointIdsBySystem: ReadonlyMap<string, ReadonlyMap<string, string>>,
): Map<string, RoutePublication> {
  const jumpPoints = new Map(jumpPointsInCluster(workspace.cluster)
    .map(reference => [reference.point.id, reference]))

  const routes = new Map<string, RoutePublication>()
  function addRoute(source: JumpRoute, route: Omit<PlayerRoute, 'id'>, reversed = false): void {
    routes.set(source.id, { route: { ...route, id: `route-${routes.size + 1}` }, reversed })
  }
  for (const route of workspace.cluster.routes) {
    if (!route.playerShared) continue
    const from = workspace.cluster.systems.find(system => system.id === route.fromSystemId)
    if (!from) throw new Error('A shared Jump Route has a missing origin Zone.')
    const fromSystemId = publicSystemIds.get(from.id)
    const fromPointId = publicRoutePointId(from, route.fromPointId, revealedJumpPointIdsBySystem)

    if (route.toSystemId === null) {
      if (!fromSystemId) continue
      const exitPoint = clusterRouteGeometry(
        route,
        workspace.cluster,
        jumpPoints,
        workspace.layout.systemPositions,
        undefined,
        workspace.layout.unresolvedExitPositions,
      ).exitPoint
      if (!exitPoint) throw new Error('A shared unresolved Jump Route has no applied destination position.')
      addRoute(route, {
        jumpLevel: route.jumpLevel,
        fromSystemId,
        ...(fromPointId === undefined ? {} : { fromPointId }),
        destination: {
          kind: 'unknown',
          position: { x: exitPoint.x, y: exitPoint.y },
          label: 'Unknown destination',
        },
      })
      continue
    }

    const to = workspace.cluster.systems.find(system => system.id === route.toSystemId)
    if (!to) throw new Error('A shared Jump Route has a missing destination Zone.')
    const toSystemId = publicSystemIds.get(to.id)

    if (fromSystemId && toSystemId) {
      const toPointId = publicRoutePointId(to, route.toPointId, revealedJumpPointIdsBySystem)
      addRoute(route, {
        jumpLevel: route.jumpLevel,
        fromSystemId,
        ...(fromPointId === undefined ? {} : { fromPointId }),
        destination: {
          kind: 'system',
          systemId: toSystemId,
          ...(toPointId === undefined ? {} : { pointId: toPointId }),
        },
      })
    } else if (fromSystemId) {
      const position = clusterSystemPosition(workspace.layout.systemPositions, to.id)
      addRoute(route, {
        jumpLevel: route.jumpLevel,
        fromSystemId,
        ...(fromPointId === undefined ? {} : { fromPointId }),
        destination: {
          kind: 'unknown',
          position: { x: position.x, y: position.y },
          label: 'Unknown destination',
        },
      })
    } else if (toSystemId) {
      const position = clusterSystemPosition(workspace.layout.systemPositions, from.id)
      const visibleFromPointId = publicRoutePointId(to, route.toPointId, revealedJumpPointIdsBySystem)
      addRoute(route, {
        jumpLevel: route.jumpLevel,
        fromSystemId: toSystemId,
        ...(visibleFromPointId === undefined ? {} : { fromPointId: visibleFromPointId }),
        destination: {
          kind: 'unknown',
          position: { x: position.x, y: position.y },
          label: 'Unknown destination',
        },
      }, true)
    }
  }

  return routes
}

function publicRoutePointId(
  system: StarSystem,
  sourcePointId: string | null,
  revealedJumpPointIdsBySystem: ReadonlyMap<string, ReadonlyMap<string, string>>,
): string | undefined {
  return sourcePointId === null
    ? undefined
    : revealedJumpPointIdsBySystem.get(system.id)?.get(sourcePointId)
}

/** Projects only non-Hidden objects and the Orbit/host chain required to place them. */
function projectPlayerSystem(
  workspace: LocalWorkspace,
  system: StarSystem,
): { document: PlayerSystemDocument; revealedJumpPointIds: Map<string, string> } {
  const geometry: SystemMapGeometry = {
    objectAngles: workspace.layout.objectAngles,
    orbitRadii: workspace.layout.orbitRadii,
    orbitRotations: workspace.layout.orbitRotations,
  }
  const positions = objectPositions(system, geometry)
  const effectiveAngles = captureEffectiveObjectAngles(
    workspace,
    system,
    system.orbits.map(orbit => orbit.id),
  )
  const objectsById = new Map(system.objects.map(object => [object.id, object]))
  const orbitsById = new Map(system.orbits.map(orbit => [orbit.id, orbit]))
  const disclosureByObjectId = new Map<string, Exclude<PublicationMode, 'hidden'>>()
  const retainedOrbitIds = new Set<string>()

  function retainObject(objectId: string): void {
    const object = objectsById.get(objectId)
    if (!object) throw new Error('A published object has a missing Orbit host.')
    if (!disclosureByObjectId.has(objectId)) {
      disclosureByObjectId.set(
        objectId,
        object.publication === 'hidden' ? 'unknown' : object.publication,
      )
    }
    if (object.placement.kind === 'orbit') retainOrbit(object.placement.orbitId)
  }

  function retainOrbit(orbitId: string): void {
    if (retainedOrbitIds.has(orbitId)) return
    const orbit = orbitsById.get(orbitId)
    if (!orbit) throw new Error('A published object has a missing Orbit placement.')
    retainedOrbitIds.add(orbitId)
    if (orbit.hostId !== null) retainObject(orbit.hostId)
  }

  for (const object of system.objects) {
    if (object.publication !== 'hidden') retainObject(object.id)
  }

  const retainedObjects = system.objects.filter(object => disclosureByObjectId.has(object.id))
  const retainedOrbits = system.orbits.filter(orbit => retainedOrbitIds.has(orbit.id))
  const publicObjectIds = new Map(retainedObjects.map((object, index) => [object.id, `object-${index + 1}`]))
  const publicOrbitIds = new Map(retainedOrbits.map((orbit, index) => [orbit.id, `orbit-${index + 1}`]))

  const objects = retainedObjects.map((object): PlayerObjectMarker => {
    const disclosure = disclosureByObjectId.get(object.id)!
    const sourcePosition = positions.get(object.id)!
    const position = { x: sourcePosition.x, y: sourcePosition.y }
    const placement = object.placement.kind === 'system'
      ? { kind: 'system' as const }
      : {
          kind: 'orbit' as const,
          orbitId: publicOrbitIds.get(object.placement.orbitId)!,
          angle: effectiveAngles[object.id]!,
        }
    const markerId = publicObjectIds.get(object.id)!


    const station = disclosure === 'revealed' && object.family === 'JumpPoint' && object.jumpStationId
      ? objectsById.get(object.jumpStationId)
      : undefined
    const stationId = station && disclosureByObjectId.get(station.id) === 'revealed'
      ? publicObjectIds.get(station.id)
      : undefined

    return projectPlayerObject(workspace, object, { id: markerId, position, placement }, disclosure, stationId)
  })

  const orbits = retainedOrbits.map((orbit): PlayerOrbit => {
    const center = orbitCenter(orbit, positions)
    const radii = orbitRadii(system, orbit, geometry)
    return {
      id: publicOrbitIds.get(orbit.id)!,
      hostId: orbit.hostId === null ? null : publicObjectIds.get(orbit.hostId)!,
      center: { x: center.x, y: center.y },
      radii: { horizontal: radii.horizontal, vertical: radii.vertical },
      rotation: orbitRotation(orbit, geometry),
    }
  })

  return {
    document: { objects, orbits },
    revealedJumpPointIds: new Map(retainedObjects
      .filter(object => object.family === 'JumpPoint' && disclosureByObjectId.get(object.id) === 'revealed')
      .map(object => [object.id, publicObjectIds.get(object.id)!])),
  }
}

function projectPlayerObject(
  workspace: LocalWorkspace,
  object: CatalogueObject,
  geometry: Pick<PlayerObjectMarker, 'id' | 'position' | 'placement'>,
  disclosure: Exclude<PublicationMode, 'hidden'>,
  stationId?: string,
): PlayerObjectMarker {
  if (disclosure === 'unknown') return { ...geometry, disclosure, label: 'Unknown presence' }
  const type = {
    family: object.family,
    subtype: object.subtype,
    ...(isMarkerColor(object.markerColor) ? { markerColor: object.markerColor } : {}),
  }
  if (disclosure === 'known-type') {
    return { ...geometry, ...type, disclosure, label: catalogueSubtypeLabel(object) }
  }
  return {
    ...geometry,
    ...type,
    disclosure,
    label: object.name,
    playerText: object.playerText,
    fields: projectPlayerFields(workspace, object),
    ...(stationId === undefined ? {} : { stationId }),
  }
}

const branchOrigin: Point = { x: 0, y: 0 }
const branchLocalCurve = {
  start: branchOrigin,
  control1: branchOrigin,
  control2: branchOrigin,
  end: branchOrigin,
}

function projectRouteBranches(
  workspace: LocalWorkspace,
  publicRoutes: ReadonlyMap<string, RoutePublication>,
): PlayerRouteBranch[] {
  const result: PlayerRouteBranch[] = []
  for (const route of workspace.cluster.routes) {
    const contents = routeContentsFor(workspace.cluster, route.id)
    if (!contents?.objects.some(object => object.publication !== 'hidden')) continue
    const association = publicRoutes.get(route.id)
    const detachedCurve = association ? undefined : detachedRouteCurve(route, workspace.layout)
    const angles = captureEffectiveObjectAngles(workspace, contents, contents.orbits.map(orbit => orbit.id))
    // Each root is projected at the same local origin. Its branch offset and effective angle
    // are resolved against the complete inventory before Hidden siblings are removed.
    const geometry = projectRouteObjects(contents, branchLocalCurve, workspace.layout)
    const objectById = new Map(contents.objects.map(object => [object.id, object]))
    const hostByOrbitId = new Map(contents.orbits.map(orbit => [orbit.id, orbit.hostId]))
    const rootByObjectId = new Map<string, RouteObject>()
    const retainedOrbits = new Set<string>()

    for (const object of contents.objects) {
      if (object.publication === 'hidden' || rootByObjectId.has(object.id)) continue
      const ancestors: string[] = []
      let current = object
      while (!rootByObjectId.has(current.id) && current.placement.kind === 'orbit') {
        ancestors.push(current.id)
        retainedOrbits.add(current.placement.orbitId)
        current = objectById.get(hostByOrbitId.get(current.placement.orbitId)!)!
      }
      const root = rootByObjectId.get(current.id) ?? current
      rootByObjectId.set(root.id, root)
      for (const id of ancestors) rootByObjectId.set(id, root)
    }

    const membersByRoot = new Map<RouteObject, RouteObject[]>()
    for (const object of contents.objects) {
      const root = rootByObjectId.get(object.id)
      if (!root) continue
      const members = membersByRoot.get(root) ?? []
      members.push(object)
      membersByRoot.set(root, members)
    }
    const orbitsByRoot = new Map<RouteObject, typeof contents.orbits>()
    for (const orbit of contents.orbits) {
      if (!retainedOrbits.has(orbit.id)) continue
      const root = rootByObjectId.get(orbit.hostId)!
      const orbits = orbitsByRoot.get(root) ?? []
      orbits.push(orbit)
      orbitsByRoot.set(root, orbits)
    }
    const geometryByOrbitId = new Map(geometry.orbits.map(orbit => [orbit.id, orbit]))

    for (const [root, members] of membersByRoot) {
      if (root.placement.kind !== 'route') throw new Error('A route branch has no root.')
      const progression = root.placement.progression
      const anchor: PlayerRouteBranch['anchor'] = association
        ? { kind: 'route', routeId: association.route.id, progression: association.reversed ? 1 - progression : progression }
        : { kind: 'detached', position: pointOnRoute(detachedCurve!, progression) }
      const orbits = orbitsByRoot.get(root) ?? []
      const objectIds = new Map(members.map((object, index) => [object.id, `object-${index + 1}`]))
      const orbitIds = new Map(orbits.map((orbit, index) => [orbit.id, `orbit-${index + 1}`]))

      result.push({
        id: `branch-${result.length + 1}`,
        anchor,
        map: {
          objects: members.map((object) => {
            const station = object.family === 'JumpPoint' && object.jumpStationId
              ? objectById.get(object.jumpStationId)
              : undefined
            return projectPlayerObject(workspace, object, {
              id: objectIds.get(object.id)!,
              position: geometry.positions.get(object.id)!,
              placement: object.placement.kind === 'route'
                ? { kind: 'branch-root' }
                : { kind: 'orbit', orbitId: orbitIds.get(object.placement.orbitId)!, angle: angles[object.id]! },
            }, object.publication === 'hidden' ? 'unknown' : object.publication,
            station?.publication === 'revealed' ? objectIds.get(station.id) : undefined)
          }),
          orbits: orbits.map((orbit) => {
            const resolved = geometryByOrbitId.get(orbit.id)!
            return {
              id: orbitIds.get(orbit.id)!,
              hostId: objectIds.get(orbit.hostId)!,
              center: resolved.center,
              radii: { horizontal: resolved.horizontal, vertical: resolved.vertical },
              rotation: resolved.rotation,
            }
          }),
        },
      })
    }
  }
  return result
}

function detachedRouteCurve(route: JumpRoute, layout: LocalWorkspace['layout']) {
  const { id, fromSystemId, toSystemId } = route
  const { systemPositions, unresolvedExitPositions: exits } = layout
  const start = clusterSystemPosition(systemPositions, fromSystemId)
  const end = toSystemId !== null ? clusterSystemPosition(systemPositions, toSystemId)
    : exits && Object.hasOwn(exits, id) ? exits[id]!
      : clusterAutomaticExitPosition(start, 0)
  return buildContinuousMapRouteGeometries([{ id, fromSystemId, toSystemId, start, end }]).get(id)!
}

function projectPlayerFields(
  workspace: LocalWorkspace,
  object: CatalogueObject,
): PlayerFieldValue[] {
  const settings = workspace.objectFieldSettings
  const masks = new Set(object.playerFieldMasks)
  const fields: PlayerFieldValue[] = []

  if (settings.nativePlayerSharing.atmosphere && object.atmosphere !== undefined && !masks.has('native:atmosphere')) {
    fields.push({ name: 'Atmosphere', type: 'single-select', value: object.atmosphere })
  }
  if (settings.nativePlayerSharing.portClass && object.portClass !== undefined && !masks.has('native:port-class')) {
    fields.push({ name: 'Port class', type: 'single-select', value: object.portClass })
  }

  for (const definition of settings.customFields) {
    if (!definition.playerShared || masks.has(definition.id) || !isCustomFieldApplicableToObject(definition, object)) {
      continue
    }
    const value = object.customFieldValues?.[definition.id]
    if (value === undefined) continue
    fields.push({ name: definition.name, type: definition.type, value })
  }

  return fields
}
