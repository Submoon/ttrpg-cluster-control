/** Projects public route descriptors from one detached player document for the continuous map. */
import type { PlayerClusterDocument, PlayerObjectMarker, PlayerRoute, PlayerSystemMarker } from '../domain/player-projection'
import type { Point } from '../domain/workspace-model'
import type { ContinuousMapRouteEndpoints } from './continuous-map-route-geometry'
import type { PlayerContinuousSystemProjection } from './player-continuous-map-projection'

export interface PlayerContinuousRouteDescriptor extends ContinuousMapRouteEndpoints {
  jumpLevel: number
  originLabel: string
  destinationLabel: string
  accessibleLabel: string
  unresolved: boolean
  destinationCaption?: string
}

/**
 * Resolves only the public anchors and optional, independently Revealed Jump Point attachments.
 * Each attached endpoint follows its own system's semantic detail state; anonymous destination
 * coordinates remain the exact authorized coordinates from the public document.
 */
export function projectPlayerContinuousRouteEndpoints(
  document: PlayerClusterDocument,
  systems: readonly PlayerContinuousSystemProjection[],
  detailSystemIds: ReadonlySet<string>,
): PlayerContinuousRouteDescriptor[] {
  const publicSystems = new Map(document.systems.map(system => [system.id, system]))
  const projectedSystems = new Map(systems.map(system => [system.id, system]))

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
      return [descriptor(route, originPoint?.position ?? originProjection.anchor, destination.position, null, originLabel,
        'Unknown destination', true)]
    }

    const destination = publicSystems.get(route.destination.systemId)
    const destinationProjection = projectedSystems.get(route.destination.systemId)
    if (!destination || !destinationProjection || destination.id === origin.id) return []
    const destinationPoint = attachedPoint(destination, route.destination.pointId, destinationProjection, detailSystemIds)
    const destinationLabel = destinationPoint?.label
      ? `${destinationPoint.label} (${destination.label})`
      : destination.label

    return [descriptor(
      route,
      originPoint?.position ?? originProjection.anchor,
      destinationPoint?.position ?? destinationProjection.anchor,
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
): { label: string; position: Point } | undefined {
  if (!publicPointId || system.disclosure !== 'revealed') return undefined
  const marker = system.map.objects.find(object => object.id === publicPointId)
  if (!isPublicJumpPoint(marker)) return undefined
  const geometry = projection.geometry?.objects.find(object => object.id === publicPointId)
  return {
    label: marker.label,
    position: detailSystemIds.has(system.id) && geometry ? geometry.scenePosition : projection.anchor,
  }
}

function isPublicJumpPoint(
  object: PlayerObjectMarker | undefined,
): object is Extract<PlayerObjectMarker, { disclosure: 'revealed' }> {
  return object?.disclosure === 'revealed' && object.family === 'JumpPoint'
}
