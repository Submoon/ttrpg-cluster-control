/** Allowlisted Warden-side player projection with no dependency on editor or persistence state. */
import type {
  CustomFieldType,
  CustomFieldValue,
  LocalWorkspace,
  ObjectFamily,
  OrbitRadii,
  Point,
  PublicationMode,
  StarSystem,
} from './workspace-model'
import { clusterRouteGeometry, clusterSystemPosition } from '../utils/cluster-map-geometry'
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

export type PlayerSystemMarker = {
  id: string
  position: Point
} & (
  | { disclosure: 'unknown'; label: 'Unknown presence' }
  | { disclosure: 'known-type'; type: 'star-system'; label: 'Star system' }
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
    | { kind: 'orbit'; orbitId: string; angle: number }
} & (
  | { disclosure: 'unknown'; label: 'Unknown presence' }
  | {
      disclosure: 'known-type'
      family: ObjectFamily
      subtype: string
      label: string
    }
  | {
      disclosure: 'revealed'
      family: ObjectFamily
      subtype: string
      label: string
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
  version: 1
  title: string
  systems: PlayerSystemMarker[]
  routes: PlayerRoute[]
}

/** Public route structure; source Jump Point IDs, route names, and exit labels are omitted. */
export type PlayerRoute = {
  id: string
  jumpLevel: number
  fromSystemId: string
} & (
  | { destination: { kind: 'system'; systemId: string } }
  | { destination: { kind: 'unknown'; position: Point; label: 'Unknown destination' } }
)

/**
 * Builds the public marker document from committed Cluster data using an explicit field allowlist.
 * Public IDs are assigned after Hidden systems are filtered, and saved normalized positions are
 * converted into scene coordinates without accepting gesture or preview overrides.
 */
export function projectPlayerCluster(workspace: LocalWorkspace): PlayerClusterDocument {
  const systems: PlayerSystemMarker[] = []
  const publicSystemIds = new Map<string, string>()
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
        label: 'Star system',
      })
    } else if (system.publication === 'revealed') {
      systems.push({
        id: markerId,
        position,
        disclosure: 'revealed',
        type: 'star-system',
        label: system.name,
        map: projectPlayerSystem(workspace, system),
      })
    }
  }

  return {
    format: 'ttrpg-cluster-control-player',
    version: 1,
    title: workspace.cluster.playerTitle,
    systems,
    routes: projectPlayerRoutes(workspace, publicSystemIds),
  }
}

function projectPlayerRoutes(
  workspace: LocalWorkspace,
  publicSystemIds: ReadonlyMap<string, string>,
): PlayerRoute[] {
  const jumpPoints = new Map(jumpPointsInCluster(workspace.cluster)
    .map(reference => [reference.point.id, reference]))

  const routes: PlayerRoute[] = []
  for (const route of workspace.cluster.routes) {
    if (!route.playerShared) continue
    const from = jumpPoints.get(route.fromPointId)
    if (!from) throw new Error('A shared Jump Route has a missing origin Jump Point.')
    const fromSystemId = publicSystemIds.get(from.system.id)

    if (route.toPointId === null) {
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
      routes.push({
        id: `route-${routes.length + 1}`,
        jumpLevel: route.jumpLevel,
        fromSystemId,
        destination: {
          kind: 'unknown',
          position: { x: exitPoint.x, y: exitPoint.y },
          label: 'Unknown destination',
        },
      })
      continue
    }

    const to = jumpPoints.get(route.toPointId)
    if (!to) throw new Error('A shared Jump Route has a missing destination Jump Point.')
    const toSystemId = publicSystemIds.get(to.system.id)

    if (fromSystemId && toSystemId) {
      routes.push({
        id: `route-${routes.length + 1}`,
        jumpLevel: route.jumpLevel,
        fromSystemId,
        destination: { kind: 'system', systemId: toSystemId },
      })
    } else if (fromSystemId) {
      const position = clusterSystemPosition(workspace.layout.systemPositions, to.system.id)
      routes.push({
        id: `route-${routes.length + 1}`,
        jumpLevel: route.jumpLevel,
        fromSystemId,
        destination: {
          kind: 'unknown',
          position: { x: position.x, y: position.y },
          label: 'Unknown destination',
        },
      })
    } else if (toSystemId) {
      const position = clusterSystemPosition(workspace.layout.systemPositions, from.system.id)
      routes.push({
        id: `route-${routes.length + 1}`,
        jumpLevel: route.jumpLevel,
        fromSystemId: toSystemId,
        destination: {
          kind: 'unknown',
          position: { x: position.x, y: position.y },
          label: 'Unknown destination',
        },
      })
    }
  }

  return routes
}

/** Projects only non-Hidden objects and the Orbit/host chain required to place them. */
function projectPlayerSystem(workspace: LocalWorkspace, system: StarSystem): PlayerSystemDocument {
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

    if (disclosure === 'unknown') {
      return { id: markerId, position, placement, disclosure, label: 'Unknown presence' }
    }

    if (disclosure === 'known-type') {
      return {
        id: markerId,
        position,
        placement,
        disclosure,
        family: object.family,
        subtype: object.subtype,
        label: catalogueSubtypeLabel(object),
      }
    }

    const station = disclosure === 'revealed' && object.family === 'JumpPoint' && object.jumpStationId
      ? objectsById.get(object.jumpStationId)
      : undefined
    const stationId = station && disclosureByObjectId.get(station.id) === 'revealed'
      ? publicObjectIds.get(station.id)
      : undefined

    return {
      id: markerId,
      position,
      placement,
      disclosure: 'revealed',
      family: object.family,
      subtype: object.subtype,
      label: object.name,
      playerText: object.playerText,
      fields: projectPlayerFields(workspace, object),
      ...(stationId === undefined ? {} : { stationId }),
    }
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

  return { objects, orbits }
}

function projectPlayerFields(
  workspace: LocalWorkspace,
  object: StarSystem['objects'][number],
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
