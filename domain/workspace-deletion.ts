/**
 * Builds a previewable cascade without mutating the current workspace; callers commit only after confirmation.
 */
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

function routeEndpoint(workspace: LocalWorkspace, systemId: string, pointId: string | null) {
  const system = workspace.cluster.systems.find(candidate => candidate.id === systemId)
  const point = pointId === null
    ? undefined
    : system?.objects.find(object => object.id === pointId && object.family === 'JumpPoint')
  return { system, point }
}

function routeLabel(workspace: LocalWorkspace, route: LocalWorkspace['cluster']['routes'][number]): string {
  const origin = routeEndpoint(workspace, route.fromSystemId, route.fromPointId)
  const originLabel = origin.system
    ? origin.point ? `${origin.point.name} (${origin.system.name})` : origin.system.name
    : `Missing system (${route.fromSystemId})`
  const destination = route.toSystemId === null
    ? undefined
    : routeEndpoint(workspace, route.toSystemId, route.toPointId)
  const destinationLabel = route.toSystemId === null
    ? `Unknown destination: ${route.unresolvedExit}`
    : destination?.system
      ? destination.point ? `${destination.point.name} (${destination.system.name})` : destination.system.name
      : `Missing system (${route.toSystemId})`
  const name = route.name ? `, ${route.name}` : ''
  return `Jump Route (Level ${route.jumpLevel}${name}): ${originLabel} -> ${destinationLabel}`
}

function routeReviewLabels(workspace: LocalWorkspace): Map<string, string> {
  const descriptions = new Map<string, string[]>()
  for (const route of workspace.cluster.routes) {
    const description = routeLabel(workspace, route)
    const routeIds = descriptions.get(description) ?? []
    routeIds.push(route.id)
    descriptions.set(description, routeIds)
  }

  const labels = new Map<string, string>()
  for (const [description, routeIds] of descriptions) {
    const orderedRouteIds = [...routeIds].sort((left, right) => left.localeCompare(right))
    orderedRouteIds.forEach((routeId, index) => {
      labels.set(routeId, routeIds.length > 1
        ? `${description} (identical route ${index + 1} of ${routeIds.length})`
        : description)
    })
  }
  return labels
}

function routeEffectSignature(workspace: LocalWorkspace, route: LocalWorkspace['cluster']['routes'][number]) {
  const origin = routeEndpoint(workspace, route.fromSystemId, route.fromPointId)
  const destination = route.toSystemId === null
    ? undefined
    : routeEndpoint(workspace, route.toSystemId, route.toPointId)
  return {
    id: route.id,
    name: route.name ?? null,
    jumpLevel: route.jumpLevel,
    fromSystemId: route.fromSystemId,
    fromPointId: route.fromPointId,
    fromEndpoint: origin.system
      ? {
          systemId: origin.system.id,
          systemName: origin.system.name,
          pointId: origin.point?.id ?? null,
          pointName: origin.point?.name ?? null,
        }
      : null,
    toSystemId: route.toSystemId,
    toPointId: route.toPointId,
    toEndpoint: destination?.system
      ? {
          systemId: destination.system.id,
          systemName: destination.system.name,
          pointId: destination.point?.id ?? null,
          pointName: destination.point?.name ?? null,
        }
      : null,
    unresolvedExit: route.toSystemId === null ? route.unresolvedExit : null,
  }
}

/** Reindexes surviving Orbits independently within each host group while preserving their relative order. */
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

/**
 * Plans the dependent cleanup for deleting a system, object, Orbit, or route without mutating the input.
 * Nested object/Orbit branches cascade; surviving sibling orders and durable layout are updated.
 * Routes detach removed Jump Points and are removed when either endpoint system is deleted.
 * @param workspace Current workspace snapshot.
 * @param target Entity selected for removal.
 * @returns Confirmation labels and a proposed next workspace; persistence remains the caller's responsibility.
 * @throws If the target is stale or deletion would remove the Cluster's last system.
 */
export function planMapEntityDeletion(
  workspace: LocalWorkspace,
  target: MapDeletionTarget,
): MapDeletionPlan {
  const system = target.kind === 'route'
    ? undefined
    : workspace.cluster.systems.find(candidate => candidate.id === target.systemId)
  if (target.kind !== 'route' && !system) {
    throw new Error('The selected Zone no longer exists.')
  }

  const removedSystemIds = new Set<string>()
  const removedObjectIds = new Set<string>()
  const removedOrbitIds = new Set<string>()
  const removedRouteIds = new Set<string>()
  const routeUpdates = new Map<string, LocalWorkspace['cluster']['routes'][number]>()
  const detachedRouteAttachments: MapDeletionPlan['detachedRouteAttachments'] = []
  const affectedEntities: string[] = []
  const addedEffects = new Set<string>()
  const reviewLabels = routeReviewLabels(workspace)
  const routeReviewLabel = (route: LocalWorkspace['cluster']['routes'][number]) =>
    reviewLabels.get(route.id) ?? routeLabel(workspace, route)
  const clearedStationLinks: Array<{ objectId: string; stationId: string }> = []
  const addEffect = (effect: string) => {
    if (!addedEffects.has(effect)) {
      addedEffects.add(effect)
      affectedEntities.push(effect)
    }
  }

  const requireSystem = (): StarSystem => {
    if (!system) throw new Error('The selected Zone no longer exists.')
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

  /**
   * Marks an object and every Orbit branch it hosts, adding labels only for included objects.
   * Removed-ID sets prevent duplicate traversal/effects when dependencies converge.
   */
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

  /** Marks an Orbit and all objects placed in it, recursively following Orbits hosted by those objects. */
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
      throw new Error('At least one Zone must remain in the Jump Cluster.')
    }
    const selectedSystem = requireSystem()
    entityLabel = `${selectedSystem.name} Zone`
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
    entityLabel = routeReviewLabel(route)
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
        clearedStationLinks.push({ objectId: object.id, stationId: object.jumpStationId })
        addEffect(`Clear physical Station link from ${mapObjectLabel(object)}${station ? ` to ${mapObjectLabel(station)}` : ''}`)
      }
    }
  }

  for (const route of workspace.cluster.routes) {
    if (removedRouteIds.has(route.id)) continue
    if (removedSystemIds.has(route.fromSystemId)
      || (route.toSystemId !== null && removedSystemIds.has(route.toSystemId))) {
      removedRouteIds.add(route.id)
      addEffect(routeReviewLabel(route))
      continue
    }
    let nextRoute = route
    if (route.fromPointId !== null && removedObjectIds.has(route.fromPointId)) {
      detachedRouteAttachments.push({ routeId: route.id, end: 'from', pointId: route.fromPointId, systemId: route.fromSystemId })
      addEffect(`Detach origin Jump Point from ${routeReviewLabel(route)}`)
      nextRoute = { ...nextRoute, fromPointId: null }
    }
    if (route.toSystemId !== null && route.toPointId !== null && removedObjectIds.has(route.toPointId)) {
      detachedRouteAttachments.push({ routeId: route.id, end: 'to', pointId: route.toPointId, systemId: route.toSystemId })
      addEffect(`Detach destination Jump Point from ${routeReviewLabel(route)}`)
      nextRoute = { ...nextRoute, toPointId: null }
    }
    if (nextRoute !== route) routeUpdates.set(route.id, nextRoute)
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

  const reorderedOrbits = workspace.cluster.systems
    .flatMap(candidate => candidate.orbits.flatMap(orbit => {
      const nextOrbit = systems.find(systemCandidate => systemCandidate.id === candidate.id)
        ?.orbits.find(remaining => remaining.id === orbit.id)
      return nextOrbit && nextOrbit.order !== orbit.order
        ? [{ orbitId: orbit.id, label: orbitLabel(candidate, orbit), fromOrder: orbit.order, toOrder: nextOrbit.order }]
        : []
    }))
  for (const change of reorderedOrbits) {
    addEffect(`${change.label} changes order from ${change.fromOrder} to ${change.toOrder}`)
  }

  const removedIds = {
    systems: [...removedSystemIds].sort(),
    objects: [...removedObjectIds].sort(),
    orbits: [...removedOrbitIds].sort(),
    routes: [...removedRouteIds].sort(),
  }
  const normalizedStationLinks = [...clearedStationLinks].sort((left, right) =>
    left.objectId.localeCompare(right.objectId) || left.stationId.localeCompare(right.stationId))
  const normalizedOrbitOrders = [...reorderedOrbits].sort((left, right) =>
    left.orbitId.localeCompare(right.orbitId))
  const removedRouteEffects = workspace.cluster.routes
    .filter(route => removedRouteIds.has(route.id))
    .map(route => routeEffectSignature(workspace, route))
    .sort((left, right) => left.id.localeCompare(right.id))
  const effectSignature = JSON.stringify({
    entityLabel,
    affectedEntities,
    removedIds,
    removedRouteEffects,
    detachedRouteAttachments: [...detachedRouteAttachments].sort((left, right) =>
      left.routeId.localeCompare(right.routeId) || left.end.localeCompare(right.end)),
    clearedStationLinks: normalizedStationLinks,
    reorderedOrbits: normalizedOrbitOrders,
  })

  return {
    entityLabel,
    affectedEntities,
    removedSystemIds: [...removedSystemIds],
    removedObjectIds: [...removedObjectIds],
    removedOrbitIds: [...removedOrbitIds],
    removedRouteIds: [...removedRouteIds],
    detachedRouteAttachments,
    clearedStationLinks,
    reorderedOrbits,
    effectSignature,
    workspace: {
      ...workspace,
      cluster: {
        ...workspace.cluster,
        systems,
        routes: workspace.cluster.routes
          .filter(route => !removedRouteIds.has(route.id))
          .map(route => routeUpdates.get(route.id) ?? route),
      },
      layout: {
        ...workspace.layout,
        systemPositions: Object.fromEntries(Object.entries(workspace.layout.systemPositions)
          .filter(([systemId]) => !removedSystemIds.has(systemId))),
        ...(workspace.layout.systemFrames !== undefined
          ? {
              systemFrames: Object.fromEntries(Object.entries(workspace.layout.systemFrames)
                .filter(([systemId]) => !removedSystemIds.has(systemId))),
            }
          : {}),
        unresolvedExitPositions: Object.fromEntries(Object.entries(workspace.layout.unresolvedExitPositions ?? {})
          .filter(([routeId]) => !removedRouteIds.has(routeId))),
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
