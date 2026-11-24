/** Projects public route descriptors from one detached player document for the continuous map. */
import type { PlayerClusterDocument, PlayerObjectMarker, PlayerRoute, PlayerSystemMarker } from '../domain/player-projection'
import type { Point } from '../domain/workspace-model'
import type { ContinuousMapRouteEndpoints } from './continuous-map-route-geometry'
import {
  continuousMapRoundedRectBoundaryPoint,
  separateCoincidentRoundedFrameRouteEndpoints,
} from './continuous-map-route-geometry'
import { continuousSystemFrames } from './continuous-system-frames'
import { PLAYER_CLUSTER_UNKNOWN_MARKER_RADIUS } from './cluster-system-presentation'
import type { PlayerContinuousSystemProjection } from './player-continuous-map-projection'

export interface PlayerContinuousRouteDescriptor extends ContinuousMapRouteEndpoints {
  jumpLevel: number
  originLabel: string
  destinationLabel: string
  accessibleLabel: string
  unresolved: boolean
  destinationCaption?: string
}

const playerKnownSystemMarkerRadius = 12
const playerRevealedSystemMarkerRadius = 9

/**
 * Resolves only public frame or marker edges and independently Revealed Jump Point attachments.
 * Anonymous destinations retain their exact public coordinates. Each attached Jump Point follows
 * its own system's detail state.
 */
export function projectPlayerContinuousRouteEndpoints(
  document: PlayerClusterDocument,
  systems: readonly PlayerContinuousSystemProjection[],
  detailSystemIds: ReadonlySet<string>,
  pixelsPerSceneUnit = 1,
): PlayerContinuousRouteDescriptor[] {
  const safePixelsPerSceneUnit = Number.isFinite(pixelsPerSceneUnit) && pixelsPerSceneUnit > 0
    ? pixelsPerSceneUnit
    : 1
  const publicSystems = new Map(document.systems.map(system => [system.id, system]))
  const projectedSystems = new Map(systems.map(system => [system.id, system]))
  const frames = continuousSystemFrames(systems.flatMap(system => system.geometry ? [{
    id: system.id,
    anchor: system.anchor,
    envelope: system.geometry.envelope,
  }] : []))

  function fallbackEnd(
    system: PlayerContinuousSystemProjection,
    toward: Point,
    coincidentDirection?: Point,
  ): Point {
    const frame = frames.get(system.id)
    return frame
      ? continuousMapRoundedRectBoundaryPoint(system.anchor, frame, toward, coincidentDirection)
      : { ...system.anchor }
  }

  function routeSystemEnd(
    system: PlayerContinuousSystemProjection,
    attachment: { position?: Point } | undefined,
    toward: Point,
    coincidentDirection?: Point,
  ): Point {
    if (attachment?.position) return attachment.position
    const frameEdge = fallbackEnd(system, toward, coincidentDirection)
    if (system.geometry) return frameEdge
    return circleBoundaryPoint(system, toward, safePixelsPerSceneUnit)
  }

  function circleBoundaryPoint(
    system: PlayerContinuousSystemProjection,
    toward: Point,
    sceneToScreenScale: number,
  ): Point {
    const radius = (system.disclosure === 'unknown'
      ? PLAYER_CLUSTER_UNKNOWN_MARKER_RADIUS
      : system.disclosure === 'known-type'
        ? playerKnownSystemMarkerRadius
        : playerRevealedSystemMarkerRadius) / sceneToScreenScale
    const dx = toward.x - system.anchor.x
    const dy = toward.y - system.anchor.y
    const distance = Math.hypot(dx, dy)
    if (!Number.isFinite(distance) || distance === 0) {
      return { x: system.anchor.x + radius, y: system.anchor.y }
    }
    return {
      x: system.anchor.x + dx / distance * radius,
      y: system.anchor.y + dy / distance * radius,
    }
  }

  function coincidentDirection(systemId: string, otherSystemId: string): Point {
    return systemId < otherSystemId ? { x: 1, y: 0 } : { x: -1, y: 0 }
  }

  return document.routes.flatMap((route): PlayerContinuousRouteDescriptor[] => {
    const origin = publicSystems.get(route.fromSystemId)
    const originProjection = projectedSystems.get(route.fromSystemId)
    if (!origin || !originProjection) return []
    const originPoint = attachedPoint(origin, route.fromPointId, originProjection, detailSystemIds)
    const originLabel = originPoint?.label
      ? `${originPoint.label} (${origin.label})`
      : origin.label

    if (route.destination.kind === 'unknown') {
      const destination = route.destination
      const start = routeSystemEnd(originProjection, originPoint, destination.position)
      return [descriptor(route, start, destination.position, null, originLabel,
        'Unknown destination', true)]
    }

    const destination = publicSystems.get(route.destination.systemId)
    const destinationProjection = projectedSystems.get(route.destination.systemId)
    if (!destination || !destinationProjection || destination.id === origin.id) return []
    const destinationPoint = attachedPoint(destination, route.destination.pointId, destinationProjection, detailSystemIds)
    const destinationLabel = destinationPoint?.label
      ? `${destinationPoint.label} (${destination.label})`
      : destination.label
    let start = routeSystemEnd(
      originProjection,
      originPoint,
      destinationPoint?.position ?? destinationProjection.anchor,
      coincidentDirection(origin.id, destination.id),
    )
    let end = routeSystemEnd(
      destinationProjection,
      destinationPoint,
      originPoint?.position ?? originProjection.anchor,
      coincidentDirection(destination.id, origin.id),
    )
    const originFrame = frames.get(origin.id)
    const destinationFrame = frames.get(destination.id)
    if (!originPoint?.position && !destinationPoint?.position
      && originProjection.geometry && destinationProjection.geometry
      && originFrame && destinationFrame) {
      const separated = separateCoincidentRoundedFrameRouteEndpoints(
        originProjection.anchor,
        originFrame,
        start,
        destinationProjection.anchor,
        destinationFrame,
        end,
        safePixelsPerSceneUnit,
      )
      start = separated.start
      end = separated.end
    }

    return [descriptor(
      route,
      start,
      end,
      destination.id,
      originLabel,
      destinationLabel,
      false,
    )]
  })
}

function descriptor(
  route: PlayerRoute,
  start: Point,
  end: Point,
  toSystemId: string | null,
  originLabel: string,
  destinationLabel: string,
  unresolved: boolean,
): PlayerContinuousRouteDescriptor {
  const destinationCaption = unresolved ? 'Unknown destination' : undefined
  return {
    id: route.id,
    fromSystemId: route.fromSystemId,
    toSystemId,
    start: { ...start },
    end: { ...end },
    jumpLevel: route.jumpLevel,
    originLabel,
    destinationLabel,
    accessibleLabel: `Jump Level ${route.jumpLevel} from ${originLabel} to ${destinationLabel}`,
    unresolved,
    ...(destinationCaption ? { destinationCaption } : {}),
  }
}

function attachedPoint(
  system: PlayerSystemMarker,
  publicPointId: string | undefined,
  projection: PlayerContinuousSystemProjection,
  detailSystemIds: ReadonlySet<string>,
): { label: string; position?: Point } | undefined {
  if (!publicPointId || system.disclosure !== 'revealed') return undefined
  const marker = system.map.objects.find(object => object.id === publicPointId)
  if (!isPublicJumpPoint(marker)) return undefined
  const geometry = projection.geometry?.objects.find(object => object.id === publicPointId)
  return {
    label: marker.label,
    ...(detailSystemIds.has(system.id) && geometry ? { position: geometry.scenePosition } : {}),
  }
}

function isPublicJumpPoint(
  object: PlayerObjectMarker | undefined,
): object is Extract<PlayerObjectMarker, { disclosure: 'revealed' }> {
  return object?.disclosure === 'revealed' && object.family === 'JumpPoint'
}
