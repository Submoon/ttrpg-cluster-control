import type { PlayerRouteBranch } from '../domain/player-projection'
import type { Point } from '../domain/workspace-model'
import type { ContinuousMapRouteGeometry } from './continuous-map-route-geometry'
import { rotatedEllipseBounds } from './continuous-map-history-reveal'
import { mapImageBounds } from './map-image-scope'
import { pointOnRoute } from './route-object-geometry'

export function playerRouteBranchRoot(branch: PlayerRouteBranch) {
  return branch.map.objects.find(object => object.placement.kind === 'branch-root')!
}

/** Reads only public document geometry and the actual (possibly animated) public route curves. */
export function projectPlayerRouteBranch(
  branch: PlayerRouteBranch,
  routes: ReadonlyMap<string, ContinuousMapRouteGeometry>,
) {
  let anchor: Point
  if (branch.anchor.kind === 'detached') {
    anchor = branch.anchor.position
  } else {
    const curve = routes.get(branch.anchor.routeId)
    if (!curve) return null
    anchor = pointOnRoute(curve, branch.anchor.progression)
  }
  const scenePoint = ({ x, y }: Point): Point => ({ x: x + anchor.x, y: y + anchor.y })
  const objects = branch.map.objects.map(object => ({ object, point: scenePoint(object.position) }))
  const orbits = branch.map.orbits.map(orbit => ({ ...orbit, center: scenePoint(orbit.center) }))
  return { anchor, objects, orbits }
}

/** Includes only retained public geometry; padding leaves room for screen-fixed object marks. */
export function playerRouteBranchBounds(projected: NonNullable<ReturnType<typeof projectPlayerRouteBranch>>) {
  const markerMargin = 22
  return mapImageBounds([
    ...projected.objects.map(({ point }) => ({
      x: point.x - markerMargin,
      y: point.y - markerMargin,
      width: markerMargin * 2,
      height: markerMargin * 2,
    })),
    ...projected.orbits.map(orbit => rotatedEllipseBounds(orbit.center, orbit.radii, orbit.rotation)),
  ])!
}
