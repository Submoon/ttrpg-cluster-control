import type { JumpRoute, Point } from '../domain/workspace'
import { clusterAutomaticExitPosition } from './cluster-map-geometry'
import type { ContinuousWardenSystemProjection } from './continuous-map-projection'
import {
  buildContinuousMapRouteGeometries,
  type ContinuousMapRouteDisplayScale,
  type ContinuousMapRouteEndpoints,
  type ContinuousMapRouteGeometry,
} from './continuous-map-route-geometry'

interface WardenRouteOptions {
  routes: readonly JumpRoute[]
  projections: readonly ContinuousWardenSystemProjection[]
  detailSystemIds: ReadonlySet<string>
  anchorOverrides?: ReadonlyMap<string, Point>
  unresolvedExitPositions?: Readonly<Record<string, Point>>
  exitPositionOverrides?: ReadonlyMap<string, Point>
  display?: ContinuousMapRouteDisplayScale
}

/** Resolves each route end against the independently displayed state of its owning system. */
export function buildContinuousWardenRouteGeometries(
  { routes, projections, detailSystemIds, anchorOverrides, unresolvedExitPositions, exitPositionOverrides, display }: WardenRouteOptions,
): ReadonlyMap<string, ContinuousMapRouteGeometry> {
  const projectionsById = new Map(projections.map(projection => [projection.id, projection]))
  const exitOrdinals = new Map<string, number>()
  const endpoints: ContinuousMapRouteEndpoints[] = []
  function anchorFor(projection: ContinuousWardenSystemProjection): Point {
    return anchorOverrides?.get(projection.id) ?? projection.anchor
  }

  function resolveEnd(projection: ContinuousWardenSystemProjection, pointId: string | null): Point {
    const anchor = anchorFor(projection)
    const object = pointId !== null && detailSystemIds.has(projection.id)
      ? projection.objects.find(candidate => candidate.id === pointId)
      : undefined
    if (!object) return anchor
    return {
      x: object.scenePosition.x + (anchor.x - projection.anchor.x),
      y: object.scenePosition.y + (anchor.y - projection.anchor.y),
    }
  }

  for (const { id, fromSystemId, fromPointId, toSystemId, toPointId } of routes) {
    const source = projectionsById.get(fromSystemId)
    if (!source) continue
    const start = resolveEnd(source, fromPointId)
    if (toSystemId === null) {
      const ordinal = exitOrdinals.get(fromSystemId) ?? 0
      exitOrdinals.set(fromSystemId, ordinal + 1)
      const end = exitPositionOverrides?.get(id)
        ?? unresolvedExitPositions?.[id]
        ?? clusterAutomaticExitPosition(anchorFor(source), ordinal)
      endpoints.push({ id, fromSystemId, toSystemId, start, end })
      continue
    }
    const destination = projectionsById.get(toSystemId)
    if (!destination) continue
    endpoints.push({ id, fromSystemId, toSystemId, start, end: resolveEnd(destination, toPointId) })
  }
  return buildContinuousMapRouteGeometries(endpoints, display)
}
