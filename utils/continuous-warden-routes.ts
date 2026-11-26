import type { JumpRoute, Point } from '../domain/workspace'
import { clusterAutomaticExitPosition } from './cluster-map-geometry'
import type { ContinuousWardenSystemProjection } from './continuous-map-projection'
import { continuousSystemFrames } from './continuous-system-frames'
import {
  buildContinuousMapRouteGeometries,
  continuousMapRoundedRectBoundaryPoint,
  separateCoincidentRoundedFrameRouteEndpoints,
  type ContinuousMapRouteDisplayScale,
  type ContinuousMapRouteEndpoints,
  type ContinuousMapRouteGeometry,
} from './continuous-map-route-geometry'
import type { SvgViewportRect } from './map-zoom'

interface WardenRouteOptions {
  routes: readonly JumpRoute[]
  projections: readonly ContinuousWardenSystemProjection[]
  detailSystemIds: ReadonlySet<string>
  anchorOverrides?: ReadonlyMap<string, Point>
  /** Optional exact frames from the displayed system projections used by the Warden renderer. */
  frames?: ReadonlyMap<string, SvgViewportRect>
  unresolvedExitPositions?: Readonly<Record<string, Point>>
  exitPositionOverrides?: ReadonlyMap<string, Point>
  display?: ContinuousMapRouteDisplayScale
  /** Place each route on its own canonical curve for detached publication. */
  independentCurves?: boolean
}

/** Resolves each route end against the independently displayed state of its owning system. */
export function buildContinuousWardenRouteGeometries(
  {
    routes,
    projections,
    detailSystemIds,
    anchorOverrides,
    frames: displayedFrames,
    unresolvedExitPositions,
    exitPositionOverrides,
    display,
    independentCurves = false,
  }: WardenRouteOptions,
): ReadonlyMap<string, ContinuousMapRouteGeometry> {
  const projectionsById = new Map(projections.map(projection => [projection.id, projection]))
  const frames = displayedFrames ?? continuousSystemFrames(projections.map((projection) => {
    const anchor = anchorOverrides?.get(projection.id) ?? projection.anchor
    const delta = { x: anchor.x - projection.anchor.x, y: anchor.y - projection.anchor.y }
    return {
      id: projection.id,
      anchor,
      envelope: {
        ...(projection.preferredFrame ?? projection.envelope),
        x: (projection.preferredFrame ?? projection.envelope).x + delta.x,
        y: (projection.preferredFrame ?? projection.envelope).y + delta.y,
      },
    }
  }))
  const exitOrdinals = new Map<string, number>()
  const endpoints: ContinuousMapRouteEndpoints[] = []
  function anchorFor(projection: ContinuousWardenSystemProjection): Point {
    return anchorOverrides?.get(projection.id) ?? projection.anchor
  }

  function attachedEnd(projection: ContinuousWardenSystemProjection, pointId: string | null): Point | undefined {
    if (pointId === null) return undefined
    const object = projection.objects.find(candidate => candidate.id === pointId)
    if (!object) return undefined
    const anchor = anchorFor(projection)
    if (!detailSystemIds.has(projection.id)) return undefined
    return {
      x: object.scenePosition.x + (anchor.x - projection.anchor.x),
      y: object.scenePosition.y + (anchor.y - projection.anchor.y),
    }
  }

  function fallbackEnd(
    projection: ContinuousWardenSystemProjection,
    toward: Point,
    coincidentDirection?: Point,
  ): Point {
    const anchor = anchorFor(projection)
    const frame = frames.get(projection.id)
    return frame
      ? continuousMapRoundedRectBoundaryPoint(anchor, frame, toward, coincidentDirection)
      : anchor
  }

  function coincidentDirection(systemId: string, otherSystemId: string): Point {
    return systemId < otherSystemId ? { x: 1, y: 0 } : { x: -1, y: 0 }
  }

  for (const { id, fromSystemId, fromPointId, toSystemId, toPointId } of routes) {
    const source = projectionsById.get(fromSystemId)
    if (!source) continue
    const sourceEnd = attachedEnd(source, fromPointId)
    if (toSystemId === null) {
      const ordinal = independentCurves ? 0 : exitOrdinals.get(fromSystemId) ?? 0
      exitOrdinals.set(fromSystemId, ordinal + 1)
      const end = exitPositionOverrides?.get(id)
        ?? unresolvedExitPositions?.[id]
        ?? clusterAutomaticExitPosition(anchorFor(source), ordinal)
      const start = sourceEnd ?? fallbackEnd(source, end)
      endpoints.push({ id, fromSystemId, toSystemId, start, end })
      continue
    }
    const destination = projectionsById.get(toSystemId)
    if (!destination) continue
    const destinationEnd = attachedEnd(destination, toPointId)
    let start = sourceEnd ?? fallbackEnd(
      source,
      destinationEnd ?? anchorFor(destination),
      coincidentDirection(fromSystemId, toSystemId),
    )
    let end = destinationEnd ?? fallbackEnd(
      destination,
      sourceEnd ?? anchorFor(source),
      coincidentDirection(toSystemId, fromSystemId),
    )
    const sourceFrame = frames.get(fromSystemId)
    const destinationFrame = frames.get(toSystemId)
    if (!sourceEnd && !destinationEnd && sourceFrame && destinationFrame) {
      const separated = separateCoincidentRoundedFrameRouteEndpoints(
        anchorFor(source),
        sourceFrame,
        start,
        anchorFor(destination),
        destinationFrame,
        end,
        display?.pixelsPerSceneUnit,
      )
      start = separated.start
      end = separated.end
    }
    endpoints.push({ id, fromSystemId, toSystemId, start, end })
  }
  if (independentCurves) {
    return new Map(endpoints.flatMap(endpoint => [...buildContinuousMapRouteGeometries([endpoint], display)]))
  }
  return buildContinuousMapRouteGeometries(endpoints, display)
}
