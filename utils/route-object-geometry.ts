import type { Point, RouteContents, RouteObjectPlacement } from '../domain/workspace'
import type { ContinuousMapRouteGeometry } from './continuous-map-route-geometry'
import { catalogueObjectPositions, orbitCenter, orbitRadii, orbitRotation, type SystemMapGeometry } from './system-map-geometry'
import { CONTINUOUS_MAP_SYSTEM_SCALE } from './continuous-map-projection'

type RouteCurve = Pick<ContinuousMapRouteGeometry, 'start' | 'control1' | 'control2' | 'end'>

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
  const orbits = contents.orbits.map(orbit => {
    const radii = orbitRadii(contents, orbit, layout)
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
