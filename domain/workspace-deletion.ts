import { catalogueTypes } from './workspace-model'
import type {
  LocalWorkspace,
  MapDeletionPlan,
  MapDeletionTarget,
  Orbit,
  StarSystem,
  SystemObject,
} from './workspace-model'

function mapObjectLabel(object: SystemObject): string {
  const label = catalogueTypes.find(type => type.value === object.subtype && type.family === object.family)?.label
    ?? object.subtype
  return `${object.name} (${label}, ${object.locationKey})`
}

function orbitLabel(system: StarSystem, orbit: Orbit): string {
  const hostName = orbit.hostId === null
    ? 'unoccupied center'
    : system.objects.find(object => object.id === orbit.hostId)?.name ?? 'unknown object'
  return `Orbit ${orbit.order} around ${hostName}`
}

function normalizeOrbitOrders(orbits: Orbit[]): Orbit[] {
  const byHost = new Map<string | null, Orbit[]>()
  for (const orbit of orbits) {
    const hosted = byHost.get(orbit.hostId) ?? []
    hosted.push(orbit)
    byHost.set(orbit.hostId, hosted)
  }

  const orders = new Map<string, number>()
  for (const hosted of byHost.values()) {
    hosted.sort((left, right) => left.order - right.order)
    hosted.forEach((orbit, index) => orders.set(orbit.id, index + 1))
  }
  return orbits.map(orbit => {
    const order = orders.get(orbit.id)!
    return order === orbit.order ? orbit : { ...orbit, order }
  })
}

export function planMapEntityDeletion(
  workspace: LocalWorkspace,
  target: MapDeletionTarget,
): MapDeletionPlan {
  const system = target.kind === 'route'
    ? undefined
    : workspace.cluster.systems.find(candidate => candidate.id === target.systemId)
  if (target.kind !== 'route' && !system) {
    throw new Error('The selected star system no longer exists.')
  }

  const removedSystemIds = new Set<string>()
  const removedObjectIds = new Set<string>()
  const removedOrbitIds = new Set<string>()
  const removedRouteIds = new Set<string>()
  const affectedEntities: string[] = []
  const addedEffects = new Set<string>()
  const addEffect = (effect: string) => {
    if (!addedEffects.has(effect)) {
      addedEffects.add(effect)
      affectedEntities.push(effect)
    }
  }

  const requireSystem = (): StarSystem => {
    if (!system) throw new Error('The selected star system no longer exists.')
    return system
  }
  const objectsById = new Map<string, SystemObject>()
  const orbitsByHost = new Map<string, Orbit[]>()
  const objectsByOrbit = new Map<string, SystemObject[]>()
  for (const object of system?.objects ?? []) {
    objectsById.set(object.id, object)
    if (object.placement.kind !== 'orbit') continue
    const children = objectsByOrbit.get(object.placement.orbitId) ?? []
    children.push(object)
    objectsByOrbit.set(object.placement.orbitId, children)
  }
  for (const orbit of system?.orbits ?? []) {
    if (orbit.hostId === null) continue
    const hosted = orbitsByHost.get(orbit.hostId) ?? []
    hosted.push(orbit)
    orbitsByHost.set(orbit.hostId, hosted)
  }

  function collectObjectBranch(objectId: string, includeObject: boolean): void {
    if (removedObjectIds.has(objectId)) return
    const candidate = objectsById.get(objectId)
    if (!candidate) return
    removedObjectIds.add(objectId)
    if (includeObject) addEffect(mapObjectLabel(candidate))

    for (const orbit of orbitsByHost.get(objectId) ?? []) {
      collectOrbitBranch(orbit, true)
    }
  }

  function collectOrbitBranch(orbit: Orbit, includeOrbit: boolean): void {
    if (removedOrbitIds.has(orbit.id)) return
    removedOrbitIds.add(orbit.id)
    if (includeOrbit) addEffect(orbitLabel(requireSystem(), orbit))
    for (const child of objectsByOrbit.get(orbit.id) ?? []) {
      collectObjectBranch(child.id, true)
    }
  }

  let entityLabel: string
  if (target.kind === 'system') {
    if (workspace.cluster.systems.length === 1) {
      throw new Error('At least one star system must remain in the Jump Cluster.')
    }
    const selectedSystem = requireSystem()
    entityLabel = `${selectedSystem.name} star system`
    removedSystemIds.add(selectedSystem.id)
    for (const object of selectedSystem.objects) {
      removedObjectIds.add(object.id)
      addEffect(mapObjectLabel(object))
    }
    for (const orbit of selectedSystem.orbits) {
      removedOrbitIds.add(orbit.id)
      addEffect(orbitLabel(selectedSystem, orbit))
    }
  } else if (target.kind === 'route') {
    const route = workspace.cluster.routes.find(candidate => candidate.id === target.routeId)
    if (!route) throw new Error('The selected Jump Route no longer exists.')
    entityLabel = `Jump Route (Level ${route.jumpLevel})`
    removedRouteIds.add(route.id)
  } else if (target.kind === 'object') {
    const selectedSystem = requireSystem()
    const object = selectedSystem.objects.find(candidate => candidate.id === target.objectId)
    if (!object) throw new Error('The selected map object no longer exists.')
    entityLabel = mapObjectLabel(object)
    collectObjectBranch(object.id, false)
  } else {
    const selectedSystem = requireSystem()
    const orbit = selectedSystem.orbits.find(candidate => candidate.id === target.orbitId)
    if (!orbit) throw new Error('The selected Orbit no longer exists.')
    entityLabel = orbitLabel(selectedSystem, orbit)
    collectOrbitBranch(orbit, false)
  }

  if (target.kind !== 'route') {
    const selectedSystem = requireSystem()
    const removedStations = new Set(selectedSystem.objects
      .filter(object => removedObjectIds.has(object.id)
        && object.family === 'Installation'
        && object.subtype === 'station')
      .map(object => object.id))
    for (const object of selectedSystem.objects) {
      if (
        !removedObjectIds.has(object.id)
        && object.jumpStationId
        && removedStations.has(object.jumpStationId)
      ) {
        const station = selectedSystem.objects.find(candidate => candidate.id === object.jumpStationId)
        addEffect(`Clear physical Station link from ${mapObjectLabel(object)}${station ? ` to ${mapObjectLabel(station)}` : ''}`)
      }
    }
  }

  for (const route of workspace.cluster.routes) {
    if (removedRouteIds.has(route.id)) continue
    if (removedObjectIds.has(route.fromPointId) || (route.toPointId && removedObjectIds.has(route.toPointId))) {
      removedRouteIds.add(route.id)
      addEffect(`Jump Route (Level ${route.jumpLevel})`)
    }
  }

  const systems = workspace.cluster.systems
    .filter(candidate => !removedSystemIds.has(candidate.id))
    .map(candidate => {
      if (candidate.id !== system?.id) return candidate
      const objects = candidate.objects
        .filter(object => !removedObjectIds.has(object.id))
        .map(object => object.jumpStationId && removedObjectIds.has(object.jumpStationId)
          ? { ...object, jumpStationId: null }
          : object)
      const orbits = normalizeOrbitOrders(candidate.orbits
        .filter(orbit => !removedOrbitIds.has(orbit.id)))
      return { ...candidate, objects, orbits }
    })

  return {
    entityLabel,
    affectedEntities,
    workspace: {
      ...workspace,
      cluster: {
        ...workspace.cluster,
        systems,
        routes: workspace.cluster.routes.filter(route => !removedRouteIds.has(route.id)),
      },
      layout: {
        ...workspace.layout,
        systemPositions: Object.fromEntries(Object.entries(workspace.layout.systemPositions)
          .filter(([systemId]) => !removedSystemIds.has(systemId))),
        orbitRadii: Object.fromEntries(Object.entries(workspace.layout.orbitRadii)
          .filter(([orbitId]) => !removedOrbitIds.has(orbitId))),
        orbitRotations: Object.fromEntries(Object.entries(workspace.layout.orbitRotations)
          .filter(([orbitId]) => !removedOrbitIds.has(orbitId))),
        objectAngles: Object.fromEntries(Object.entries(workspace.layout.objectAngles)
          .filter(([objectId]) => !removedObjectIds.has(objectId))),
      },
    },
  }
}
