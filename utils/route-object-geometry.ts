import type { Point, RouteContents, RouteObjectPlacement } from '../domain/workspace'
import type { ContinuousMapRouteGeometry } from './continuous-map-route-geometry'
import { catalogueObjectPositions, orbitCenter, orbitRadii, orbitRotation, type SystemMapGeometry } from './system-map-geometry'
import { CONTINUOUS_MAP_SYSTEM_SCALE } from './continuous-map-projection'
import { MAP_ZOOM_MAX_SCALE } from './map-zoom'

type RouteCurve = Pick<ContinuousMapRouteGeometry, 'start' | 'control1' | 'control2' | 'end'>

export const routeObjectMarkerRadiusPixels = 14

export function routeBranchShowsDetail(cameraScale: number, svgPixelScale: number): boolean {
  const detailScale = 0.65 / (svgPixelScale * CONTINUOUS_MAP_SYSTEM_SCALE)
  return cameraScale >= Math.min(MAP_ZOOM_MAX_SCALE, detailScale)
}

export function routeObjectIsVisible(
  object: RouteContents['objects'][number],
  showDetail: boolean,
  selectedObjectId?: string,
): boolean {
  return showDetail || object.placement.kind === 'route' || object.id === selectedObjectId
}

/** Logical progression follows the cubic parameter of the displayed path. */
export function pointOnRoute(curve: RouteCurve, progression: number): Point {
  const t = progression
  const remaining = 1 - t
  const start = remaining ** 3
  const control1 = 3 * remaining ** 2 * t
  const control2 = 3 * remaining * t ** 2
  const end = t ** 3
  return {
    x: start * curve.start.x + control1 * curve.control1.x + control2 * curve.control2.x + end * curve.end.x,
    y: start * curve.start.y + control1 * curve.control1.y + control2 * curve.control2.y + end * curve.end.y,
  }
}

/** Projects route anchors and hosted branches into the shared continuous map scene. */
export function projectRouteObjects(contents: RouteContents, curve: RouteCurve, layout: SystemMapGeometry) {
  const scale = CONTINUOUS_MAP_SYSTEM_SCALE
  const localPositions = catalogueObjectPositions<RouteObjectPlacement>(contents, layout, placement => {
    const root = pointOnRoute(curve, placement.progression)
    return { x: root.x / scale, y: root.y / scale }
  })
  const toScene = ({ x, y }: Point): Point => ({ x: x * scale, y: y * scale })
  const positions = new Map([...localPositions].map(([id, point]) => [id, toScene(point)]))
  const objectsById = new Map(contents.objects.map(object => [object.id, object]))
  const orbits = contents.orbits.map(orbit => {
    const host = objectsById.get(orbit.hostId)
    const radii = orbitRadii({ objects: host ? [host] : [] }, orbit, layout)
    return {
      id: orbit.id,
      center: orbitCenter(orbit, positions),
      horizontal: radii.horizontal * scale,
      vertical: radii.vertical * scale,
      rotation: orbitRotation(orbit, layout),
    }
  })
  return { positions, orbits }
}
