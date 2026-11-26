import type { Point } from '../domain/workspace'
import type { MapViewport, SvgViewportRect } from './map-zoom'

export type MapImageScope = 'cluster' | 'system' | 'viewport'

export interface MapImageContextSnapshot {
  clusterId: string
  viewport: MapViewport
  viewportRect: SvgViewportRect
  svgPixelScale: number
  detailSystemIds: readonly string[]
  dimmedObjectIds: readonly string[]
  selectedRouteId: string | null
  selectedRouteObjectId?: string
}

/** Falls back to the Cluster when a selected-system image no longer has an inspected owner. */
export function effectiveWardenMapImageScope(
  requestedScope: MapImageScope,
  selectedSystemId: string | null | undefined,
  continuousMap = true,
): MapImageScope {
  return continuousMap && requestedScope === 'system' && !selectedSystemId ? 'cluster' : requestedScope
}

/** Captures only context that can affect the requested Warden image scene. */
export function mapImageContextKey(
  scope: MapImageScope | null,
  snapshot: MapImageContextSnapshot,
): string {
  if (scope !== 'viewport') return JSON.stringify({ clusterId: snapshot.clusterId })
  return JSON.stringify({
    clusterId: snapshot.clusterId,
    viewport: snapshot.viewport,
    viewportRect: snapshot.viewportRect,
    svgPixelScale: snapshot.svgPixelScale,
    detailSystemIds: [...snapshot.detailSystemIds].sort(),
    dimmedObjectIds: [...snapshot.dimmedObjectIds].sort(),
    selectedRouteId: snapshot.selectedRouteId,
    selectedRouteObjectId: snapshot.selectedRouteObjectId,
  })
}

export interface MapImageBounds {
  x: number
  y: number
  width: number
  height: number
}

export interface MapImageScopeFrames {
  overview: MapImageBounds | null
  selectedSystem: MapImageBounds | null
  viewport: MapImageBounds | null
  /** Fixed room on every side for selected-system incident route prefixes. */
  selectedSystemRouteGutter: number
  /** Applied to the automatically framed Cluster or system scope, never the current viewport. */
  padding: number
}

export interface MapImageRouteGeometry {
  start: Point
  control1: Point
  control2: Point
  end: Point
}

export interface MapImageRoutePrefix extends MapImageRouteGeometry {
  path: string
  length: number
}

/** Returns routes that touch a selected system, retaining both incoming and outgoing directions. */
export function incidentRoutesForMapImage<Route extends { fromSystemId: string; toSystemId: string | null }>(
  routes: readonly Route[],
  systemId: string,
): Route[] {
  return routes.filter(route => route.fromSystemId === systemId || route.toSystemId === systemId)
}

/** Combines finite non-negative rectangles; null means that no input contributes geometry. */
export function mapImageBounds(bounds: readonly (MapImageBounds | null | undefined)[]): MapImageBounds | null {
  const valid = bounds.filter((bound): bound is MapImageBounds => Boolean(bound)
    && [bound!.x, bound!.y, bound!.width, bound!.height].every(Number.isFinite)
    && bound!.width >= 0 && bound!.height >= 0)
  if (!valid.length) return null

  const left = Math.min(...valid.map(bound => bound.x))
  const top = Math.min(...valid.map(bound => bound.y))
  const right = Math.max(...valid.map(bound => bound.x + bound.width))
  const bottom = Math.max(...valid.map(bound => bound.y + bound.height))
  if (![left, top, right, bottom].every(Number.isFinite)) return null
  return { x: left, y: top, width: right - left, height: bottom - top }
}

/** Picks the audience-neutral frame for one image scope. */
export function mapImageScopeFrame(scope: MapImageScope, frames: MapImageScopeFrames): MapImageBounds {
  const selected = scope === 'cluster'
    ? frames.overview
    : scope === 'system'
      ? frames.selectedSystem
      : frames.viewport
  if (!selected) throw new Error(`The ${scope} map image scope is unavailable.`)
  if (![selected.x, selected.y, selected.width, selected.height].every(Number.isFinite)
    || selected.width <= 0 || selected.height <= 0) {
    throw new Error('The map image scope has invalid bounds.')
  }

  if (scope === 'viewport') return { ...selected }
  const gutter = scope === 'system' ? frames.selectedSystemRouteGutter : 0
  const padding = frames.padding
  if (![gutter, padding].every(Number.isFinite) || gutter < 0 || padding < 0) {
    throw new Error('The map image scope has invalid padding.')
  }
  const inset = gutter + padding
  return {
    x: selected.x - inset,
    y: selected.y - inset,
    width: selected.width + inset * 2,
    height: selected.height + inset * 2,
  }
}

/**
 * Trims a cubic route to a bounded prefix from the selected endpoint. Incoming routes are reversed first,
 * so remote endpoint coordinates never contribute to the selected-system image frame.
 */
export function trimMapImageRoute(
  geometry: MapImageRouteGeometry,
  selectedEnd: 'start' | 'end',
  maximumLength: number,
): MapImageRoutePrefix {
  const points = [geometry.start, geometry.control1, geometry.control2, geometry.end]
  if (points.some(point => !Number.isFinite(point.x) || !Number.isFinite(point.y))
    || !Number.isFinite(maximumLength) || maximumLength <= 0) {
    throw new Error('The map image route has invalid geometry.')
  }

  const oriented = selectedEnd === 'start'
    ? { start: geometry.start, control1: geometry.control1, control2: geometry.control2, end: geometry.end }
    : { start: geometry.end, control1: geometry.control2, control2: geometry.control1, end: geometry.start }
  const totalLength = cubicLength(oriented, 1)
  let t = 1
  if (totalLength > maximumLength) {
    let low = 0
    let high = 1
    for (let iteration = 0; iteration < 28; iteration += 1) {
      const middle = (low + high) / 2
      if (cubicLength(oriented, middle) > maximumLength) high = middle
      else low = middle
    }
    t = low
  }

  const prefix = leftCubic(oriented, t)
  const length = cubicLength(prefix, 1)
  return {
    ...prefix,
    path: `M ${prefix.start.x} ${prefix.start.y} C ${prefix.control1.x} ${prefix.control1.y} ${prefix.control2.x} ${prefix.control2.y} ${prefix.end.x} ${prefix.end.y}`,
    length,
  }
}

function leftCubic(geometry: MapImageRouteGeometry, t: number): MapImageRouteGeometry {
  const first = interpolate(geometry.start, geometry.control1, t)
  const second = interpolate(geometry.control1, geometry.control2, t)
  const third = interpolate(geometry.control2, geometry.end, t)
  const firstMiddle = interpolate(first, second, t)
  const secondMiddle = interpolate(second, third, t)
  const end = interpolate(firstMiddle, secondMiddle, t)
  return {
    start: geometry.start,
    control1: first,
    control2: firstMiddle,
    end,
  }
}

function cubicLength(geometry: MapImageRouteGeometry, endT: number): number {
  const samples = 64
  let length = 0
  let previous = geometry.start
  for (let index = 1; index <= samples; index += 1) {
    const point = cubicPoint(geometry, endT * index / samples)
    length += Math.hypot(point.x - previous.x, point.y - previous.y)
    previous = point
  }
  return length
}

function cubicPoint(geometry: MapImageRouteGeometry, t: number): Point {
  const inverse = 1 - t
  return {
    x: inverse ** 3 * geometry.start.x
      + 3 * inverse ** 2 * t * geometry.control1.x
      + 3 * inverse * t ** 2 * geometry.control2.x
      + t ** 3 * geometry.end.x,
    y: inverse ** 3 * geometry.start.y
      + 3 * inverse ** 2 * t * geometry.control1.y
      + 3 * inverse * t ** 2 * geometry.control2.y
      + t ** 3 * geometry.end.y,
  }
}

function interpolate(start: Point, end: Point, progress: number): Point {
  return {
    x: start.x + (end.x - start.x) * progress,
    y: start.y + (end.y - start.y) * progress,
  }
}
