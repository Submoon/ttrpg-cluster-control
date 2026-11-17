/** Continuous public scene projection from the detached, allowlisted player document. */
import type { PlayerClusterDocument, PlayerSystemMarker } from '../domain/player-projection'
import type { Point } from '../domain/workspace-model'
import type { SvgViewportRect } from './map-zoom'
import { continuousMapDetailScale, projectContinuousSystemGeometry, type ContinuousWardenSystemProjection } from './continuous-map-projection'
import { playerClusterGeometry, type PlayerRouteGeometry } from './player-cluster-geometry'
import { CLUSTER_ROUTE_PRESENTATION, clusterRoutePresentationLabel, clusterRoutePresentationLabelWidth } from './cluster-route-presentation'

export interface PlayerContinuousSystemProjection {
  id: string
  disclosure: PlayerSystemMarker['disclosure']
  label: string
  anchor: Point
  /** Present only for Revealed systems; generic systems disclose only their public anchor. */
  geometry?: ContinuousWardenSystemProjection
}

export interface PlayerContinuousMapProjection {
  systems: PlayerContinuousSystemProjection[]
  routes: PlayerRouteGeometry[]
  bounds: SvgViewportRect
}

export const PLAYER_DETAIL_REVEAL_PIXELS = 250
export const PLAYER_DETAIL_HIDE_PIXELS = 210

/** Applies each Revealed system's own public envelope threshold with a stable collapse band. */
export function playerContinuousDetailSystemIds(
  systems: readonly PlayerContinuousSystemProjection[],
  cameraScale: number,
  svgPixelScale: number,
  currentlyDetailed: ReadonlySet<string>,
): Set<string> {
  const next = new Set<string>()
  if (!(Number.isFinite(cameraScale) && cameraScale > 0 && Number.isFinite(svgPixelScale) && svgPixelScale > 0)) {
    return next
  }

  for (const system of systems) {
    const envelope = system.geometry?.envelope
    if (!envelope) continue
    const threshold = currentlyDetailed.has(system.id) ? PLAYER_DETAIL_HIDE_PIXELS : PLAYER_DETAIL_REVEAL_PIXELS
    if (cameraScale >= continuousMapDetailScale(envelope, svgPixelScale, threshold)) next.add(system.id)
  }
  return next
}

/**
 * Projects only permitted public anchors and Revealed interiors into the shared Cluster scene.
 * Public IDs remain scoped to their system by consumers; source Location keys are never accepted.
 */
export function projectPlayerContinuousMap(document: PlayerClusterDocument): PlayerContinuousMapProjection {
  const renderableDocument: PlayerClusterDocument = {
    ...document,
    routes: document.routes.filter(route =>
      route.destination.kind !== 'system' || route.destination.systemId !== route.fromSystemId),
  }
  const systems = document.systems.map((system): PlayerContinuousSystemProjection => {
    if (system.disclosure !== 'revealed') {
      return {
        id: system.id,
        disclosure: system.disclosure,
        label: system.label,
        anchor: { ...system.position },
      }
    }

    const geometry = projectContinuousSystemGeometry({
      id: system.id,
      name: system.label,
      anchor: system.position,
      objects: system.map.objects.map(object => ({
        id: object.id,
        name: object.label,
        locationKey: '',
        position: object.position,
      })),
      orbits: system.map.orbits.map(orbit => ({
        id: orbit.id,
        center: orbit.center,
        radii: orbit.radii,
        rotation: orbit.rotation,
      })),
    })
    return {
      id: system.id,
      disclosure: system.disclosure,
      label: system.label,
      anchor: { ...system.position },
      geometry,
    }
  })

  const cluster = playerClusterGeometry(renderableDocument)
  const routes = projectContinuousPublicRoutes(renderableDocument)
  let left = cluster.bounds.minX
  let top = cluster.bounds.minY
  let right = cluster.bounds.minX + cluster.bounds.width
  let bottom = cluster.bounds.minY + cluster.bounds.height
  for (const route of routes) {
    left = Math.min(left, route.labelX - route.labelWidth / 2)
    top = Math.min(top, route.labelY + CLUSTER_ROUTE_PRESENTATION.badge.topOffset)
    right = Math.max(right, route.labelX + route.labelWidth / 2)
    bottom = Math.max(bottom, route.labelY + CLUSTER_ROUTE_PRESENTATION.badge.topOffset + CLUSTER_ROUTE_PRESENTATION.badge.height)
    if (route.destination) {
      left = Math.min(left, route.destination.position.x - CLUSTER_ROUTE_PRESENTATION.endpoint.radius,
        route.destination.labelX - route.destination.labelWidth)
      top = Math.min(top, route.destination.position.y - CLUSTER_ROUTE_PRESENTATION.endpoint.radius,
        route.destination.labelY + CLUSTER_ROUTE_PRESENTATION.endpoint.captionTopOffset)
      right = Math.max(right, route.destination.position.x + CLUSTER_ROUTE_PRESENTATION.endpoint.radius,
        route.destination.labelX)
      bottom = Math.max(bottom, route.destination.position.y + CLUSTER_ROUTE_PRESENTATION.endpoint.radius,
        route.destination.labelY + CLUSTER_ROUTE_PRESENTATION.endpoint.captionBottomOffset)
    }
  }
  for (const system of systems) {
    const envelope = system.geometry?.envelope
    if (!envelope) continue
    left = Math.min(left, envelope.x)
    top = Math.min(top, envelope.y)
    right = Math.max(right, envelope.x + envelope.width)
    bottom = Math.max(bottom, envelope.y + envelope.height)
  }

  if (![left, top, right, bottom].every(Number.isFinite) || right <= left || bottom <= top) {
    throw new Error('The public continuous map could not calculate finite scene bounds.')
  }

  return {
    systems,
    routes,
    bounds: { x: left, y: top, width: right - left, height: bottom - top },
  }
}

/** Continuous player routes meet their public Cluster anchors or anonymous destination points. */
function projectContinuousPublicRoutes(document: PlayerClusterDocument): PlayerRouteGeometry[] {
  const systemsById = new Map(document.systems.map(system => [system.id, system]))
  return document.routes.map((route, index) => {
    const origin = systemsById.get(route.fromSystemId)
    if (!origin) throw new Error('A player route references a missing public origin marker.')
    const destinationSystem = route.destination.kind === 'system'
      ? systemsById.get(route.destination.systemId)
      : undefined
    if (route.destination.kind === 'system' && !destinationSystem) {
      throw new Error('A player route references a missing public destination marker.')
    }

    const destinationPosition = route.destination.kind === 'system'
      ? destinationSystem!.position
      : route.destination.position
    const label = clusterRoutePresentationLabel(route.jumpLevel)
    const labelWidth = clusterRoutePresentationLabelWidth(route.jumpLevel)
    const dx = destinationPosition.x - origin.position.x
    const dy = destinationPosition.y - origin.position.y
    const distance = Math.hypot(dx, dy)
    let path = `M ${origin.position.x} ${origin.position.y} L ${destinationPosition.x} ${destinationPosition.y}`
    let labelX = (origin.position.x + destinationPosition.x) / 2
    let labelY = (origin.position.y + destinationPosition.y) / 2 + (index % 2 === 0 ? -18 : 18)
    if (distance < 40) {
      const angle = distance > 0
        ? Math.atan2(dy, dx) + Math.PI / 2
        : -Math.PI / 2 + index * Math.PI / 4
      const bendDistance = distance === 0 ? 84 : 42
      const bend = index % 2 === 0 ? bendDistance : -bendDistance
      const control = {
        x: (origin.position.x + destinationPosition.x) / 2 + Math.cos(angle) * bend,
        y: (origin.position.y + destinationPosition.y) / 2 + Math.sin(angle) * bend,
      }
      path = `M ${origin.position.x} ${origin.position.y} Q ${control.x} ${control.y} ${destinationPosition.x} ${destinationPosition.y}`
      labelX = (origin.position.x + 2 * control.x + destinationPosition.x) / 4
      labelY = (origin.position.y + 2 * control.y + destinationPosition.y) / 4
        + CLUSTER_ROUTE_PRESENTATION.curve.labelOffsetY
    }
    const accessibleLabel = route.destination.kind === 'unknown'
      ? `Jump Level ${route.jumpLevel} to ${route.destination.label}`
      : `Jump Level ${route.jumpLevel} from ${origin.label} to ${destinationSystem!.label}`
    const foreground = distance === 0 || (route.destination.kind === 'unknown' && document.systems.some(system =>
      Math.hypot(system.position.x - destinationPosition.x, system.position.y - destinationPosition.y)
        <= 18 + CLUSTER_ROUTE_PRESENTATION.endpoint.radius))
    return {
      id: route.id,
      foreground,
      path,
      label,
      accessibleLabel,
      labelX,
      labelY,
      labelWidth,
      ...(route.destination.kind === 'unknown'
        ? {
            destination: {
              position: { ...destinationPosition },
              label: route.destination.label,
              labelX: destinationPosition.x - CLUSTER_ROUTE_PRESENTATION.endpoint.badgeGap
                - CLUSTER_ROUTE_PRESENTATION.endpoint.radius,
              labelY: destinationPosition.y + (destinationPosition.y >= origin.position.y
                ? CLUSTER_ROUTE_PRESENTATION.endpoint.captionVerticalOffset
                : -CLUSTER_ROUTE_PRESENTATION.endpoint.captionVerticalOffset),
              labelWidth: Array.from(route.destination.label).length
                * CLUSTER_ROUTE_PRESENTATION.endpoint.captionCharacterAdvance,
            },
          }
        : {}),
    }
  })
}
