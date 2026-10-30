/** Allowlisted Warden-side player projection with no dependency on editor or persistence state. */
import type { LocalWorkspace, ObjectFamily, OrbitRadii, Point, PublicationMode, StarSystem } from './workspace-model'
import { clusterSystemPosition } from '../utils/cluster-map-geometry'
import { catalogueSubtypeLabel } from '../utils/catalogue-labels'
import {
  objectPositions,
  orbitCenter,
  orbitRadii,
  orbitRotation,
  type SystemMapGeometry,
} from '../utils/system-map-geometry'
import { captureEffectiveObjectAngles } from './workspace-placement'

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
    }
)

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
}

/**
 * Builds the public marker document from committed Cluster data using an explicit field allowlist.
 * Public IDs are assigned after Hidden systems are filtered, and saved normalized positions are
 * converted into scene coordinates without accepting gesture or preview overrides.
 */
export function projectPlayerCluster(workspace: LocalWorkspace): PlayerClusterDocument {
  const systems: PlayerSystemMarker[] = []
  for (const system of workspace.cluster.systems) {
    if (system.publication === 'hidden') continue

    const markerId = `system-${systems.length + 1}`
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
  }
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

    return {
      id: markerId,
      position,
      placement,
      disclosure,
      family: object.family,
      subtype: object.subtype,
      label: disclosure === 'revealed' ? object.name : catalogueSubtypeLabel(object),
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
