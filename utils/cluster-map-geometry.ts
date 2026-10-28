/**
 * Pure Cluster-map scene geometry; drag overrides preview moved endpoints without changing saved positions.
 */
import { jumpPointsInCluster } from '../domain/workspace-cluster'
import type { JumpCluster, JumpPointReference, JumpRoute, Point } from '../domain/workspace'

/** SVG path and label geometry for one logical Cluster route. */
export interface ClusterRouteGeometry {
  path: string
  labelX: number
  labelY: number
  exitPoint?: Point
}

/** Platform-derived SVG coordinate envelope below observed renderer saturation, independent of canvas size. */
export const CLUSTER_SCENE_COORDINATE_LIMIT = 2 ** 24 - 4096
/** Scene-space margin reserved for route labels, endpoint markers, card geometry, and export padding. */
const CLUSTER_SCENE_GEOMETRY_PADDING = 256

function isRendererCoordinate(value: number): boolean {
  return Number.isFinite(value) && Math.abs(value) <= CLUSTER_SCENE_COORDINATE_LIMIT
}

/** Checks whether one scene-space point leaves enough renderer headroom for its map geometry. */
export function isSafeClusterScenePoint(point: Point): boolean {
  const left = point.x - CLUSTER_SCENE_GEOMETRY_PADDING
  const top = point.y - CLUSTER_SCENE_GEOMETRY_PADDING
  const right = point.x + CLUSTER_SCENE_GEOMETRY_PADDING
  const bottom = point.y + CLUSTER_SCENE_GEOMETRY_PADDING
  return [left, top, right, bottom].every(isRendererCoordinate)
    && left < point.x && top < point.y && right > point.x && bottom > point.y
}

/** Checks the numeric SVG geometry produced for one route before it enters durable layout. */
export function hasFiniteClusterRouteGeometry(geometry: ClusterRouteGeometry): boolean {
  return Number.isFinite(geometry.labelX)
    && Number.isFinite(geometry.labelY)
    && (geometry.exitPoint === undefined
      || (Number.isFinite(geometry.exitPoint.x) && Number.isFinite(geometry.exitPoint.y)))
    && !/(?:NaN|Infinity)/i.test(geometry.path)
}

/**
 * Checks that applied features and their padded scene rectangle fit the renderer's numeric envelope.
 * This rejects coordinates outside the renderer's safe range, regardless of the initial canvas dimensions.
 */
export function hasSafeClusterSceneBounds(
  cluster: JumpCluster,
  systemPositions: Readonly<Record<string, Point>>,
  unresolvedExitPositions: Readonly<Record<string, Point>> = {},
): boolean {
  const jumpPoints = new Map(jumpPointsInCluster(cluster).map(reference => [reference.point.id, reference]))
  let left = Number.POSITIVE_INFINITY
  let top = Number.POSITIVE_INFINITY
  let right = Number.NEGATIVE_INFINITY
  let bottom = Number.NEGATIVE_INFINITY

  const include = (x: number, y: number): boolean => {
    if (!isRendererCoordinate(x) || !isRendererCoordinate(y)) return false
    left = Math.min(left, x)
    top = Math.min(top, y)
    right = Math.max(right, x)
    bottom = Math.max(bottom, y)
    return true
  }

  for (const system of cluster.systems) {
    const position = systemPositions[system.id]
    if (!position) return false
    const scenePosition = clusterSystemPosition(systemPositions, system.id)
    if (!include(scenePosition.x, scenePosition.y)) return false
  }

  for (const position of Object.values(unresolvedExitPositions)) {
    if (!include(position.x, position.y)) return false
  }

  const pathNumbers = /[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[-+]?\d+)?/gi
  for (const [index, route] of cluster.routes.entries()) {
    let geometry: ClusterRouteGeometry
    try {
      geometry = clusterRouteGeometry(
        route,
        index,
        jumpPoints,
        systemPositions,
        undefined,
        unresolvedExitPositions,
      )
    } catch {
      return false
    }
    if (!hasFiniteClusterRouteGeometry(geometry)
      || !include(geometry.labelX, geometry.labelY)
      || (geometry.exitPoint && !include(geometry.exitPoint.x, geometry.exitPoint.y))) return false

    const coordinates = Array.from(geometry.path.matchAll(pathNumbers), match => Number(match[0]))
    if (coordinates.length === 0 || coordinates.length % 2 !== 0) return false
    for (let coordinate = 0; coordinate < coordinates.length; coordinate += 2) {
      if (!include(coordinates[coordinate]!, coordinates[coordinate + 1]!)) return false
    }
  }

  if (!Number.isFinite(left) || !Number.isFinite(top)
    || !Number.isFinite(right) || !Number.isFinite(bottom)) return false

  const paddedLeft = left - CLUSTER_SCENE_GEOMETRY_PADDING
  const paddedTop = top - CLUSTER_SCENE_GEOMETRY_PADDING
  const paddedRight = right + CLUSTER_SCENE_GEOMETRY_PADDING
  const paddedBottom = bottom + CLUSTER_SCENE_GEOMETRY_PADDING
  const width = paddedRight - paddedLeft
  const height = paddedBottom - paddedTop
  return [paddedLeft, paddedTop, paddedRight, paddedBottom, width, height].every(Number.isFinite)
    && [paddedLeft, paddedTop, paddedRight, paddedBottom].every(isRendererCoordinate)
    && isRendererCoordinate(width) && isRendererCoordinate(height)
    && paddedLeft < left && paddedTop < top
    && paddedRight > right && paddedBottom > bottom
    && width > 0 && height > 0
}

/**
 * Resolves a saved normalized Cluster position to scene coordinates, unless a drag preview overrides it.
 * @param systemPositions Durable normalized map positions keyed by system ID.
 * @param systemId System whose location is requested.
 * @param overrides Optional temporary positions already in SVG scene coordinates.
 * @returns System center in Cluster-map scene coordinates.
 * @throws If no saved position exists and there is no drag override.
 */
export function clusterSystemPosition(
  systemPositions: Readonly<Record<string, Point>>,
  systemId: string,
  overrides?: ReadonlyMap<string, Point>,
): Point {
  const override = overrides?.get(systemId)
  if (override) return override
  const position = systemPositions[systemId]
  if (!position) {
    throw new Error(`No cluster-map position exists for star system "${systemId}".`)
  }

  return { x: 112 + position.x * 736, y: 96 + position.y * 368 }
}

/**
 * Resolves a route endpoint reference or reports the broken logical Jump Point link.
 * @param jumpPoints Current Cluster Jump Points keyed by object ID.
 * @param pointId Route endpoint ID.
 * @returns Jump Point and owning system.
 * @throws If pointId does not resolve in the current Cluster.
 */
export function requiredJumpPoint(
  jumpPoints: ReadonlyMap<string, JumpPointReference>,
  pointId: string,
): JumpPointReference {
  const reference = jumpPoints.get(pointId)
  if (!reference) {
    throw new Error(`Jump Route references missing Jump Point "${pointId}".`)
  }
  return reference
}

/**
 * Builds a scene-space quadratic route path, label point, and optional unresolved-exit marker.
 * @param route Logical Jump Route to draw.
 * @param index Stable list index used to separate parallel route bends.
 * @param jumpPoints Current logical endpoints.
 * @param systemPositions Durable normalized positions for endpoint systems.
 * @param positionOverrides Optional temporary scene-space positions while systems are dragged.
 * @param unresolvedExitPositions Optional durable scene-space targets keyed by unresolved route ID.
 * @param exitPositionOverrides Optional temporary scene-space targets keyed by unresolved route ID.
 * @returns SVG path data and label coordinates in Cluster-map scene units.
 * @throws If a referenced Jump Point or required system position is missing.
 */
export function clusterRouteGeometry(
  route: JumpRoute,
  index: number,
  jumpPoints: ReadonlyMap<string, JumpPointReference>,
  systemPositions: Readonly<Record<string, Point>>,
  positionOverrides?: ReadonlyMap<string, Point>,
  unresolvedExitPositions?: Readonly<Record<string, Point>>,
  exitPositionOverrides?: ReadonlyMap<string, Point>,
): ClusterRouteGeometry {
  const from = requiredJumpPoint(jumpPoints, route.fromPointId)
  const start = clusterSystemPosition(systemPositions, from.system.id, positionOverrides)
  const to = route.toPointId === null
    ? undefined
    : requiredJumpPoint(jumpPoints, route.toPointId)

  if (to?.system.id === from.system.id) {
    const controlY = start.y - 126 - (index % 2) * 20
    return {
      path: `M ${start.x - 46} ${start.y - 38} Q ${start.x} ${controlY} ${start.x + 46} ${start.y - 38}`,
      labelX: start.x,
      labelY: controlY + 20,
    }
  }

  const savedExitPoint = route.toPointId === null
    ? unresolvedExitPositions?.[route.id]
    : undefined
  const exitPoint = to
    ? undefined
    : exitPositionOverrides?.get(route.id)
      ?? savedExitPoint
      ?? { x: 860, y: Math.min(500, Math.max(88, start.y + 128 + (index % 3) * 24)) }
  const end = to
    ? clusterSystemPosition(systemPositions, to.system.id, positionOverrides)
    : exitPoint!
  const dx = end.x - start.x
  const dy = end.y - start.y
  const length = Math.max(1, Math.hypot(dx, dy))
  const ux = dx / length
  const uy = dy / length
  const x1 = start.x + ux * 84
  const y1 = start.y + uy * 40
  const x2 = to ? end.x - ux * 84 : end.x
  const y2 = to ? end.y - uy * 40 : end.y
  const bend = to ? (index % 2 === 0 ? 32 : -32) : 18
  const controlX = (x1 + x2) / 2 - uy * bend
  const controlY = (y1 + y2) / 2 + ux * bend

  return {
    path: `M ${x1} ${y1} Q ${controlX} ${controlY} ${x2} ${y2}`,
    labelX: (x1 + 2 * controlX + x2) / 4,
    labelY: (y1 + 2 * controlY + y2) / 4 - 8,
    exitPoint,
  }
}

/**
 * Creates an accessible selection label from route endpoints or its unresolved external-exit name.
 * @param route Route represented by the rendered control.
 * @param jumpPoints Current logical endpoint references.
 * @returns Human-readable label for assistive technology.
 * @throws If a referenced logical Jump Point no longer exists.
 */
export function clusterRouteLabel(
  route: JumpRoute,
  jumpPoints: ReadonlyMap<string, JumpPointReference>,
): string {
  const from = requiredJumpPoint(jumpPoints, route.fromPointId)
  const origin = `${from.point.name} (${from.system.name})`
  if (route.toPointId !== null) {
    const to = requiredJumpPoint(jumpPoints, route.toPointId)
    return `Select Jump Level ${route.jumpLevel} route from ${origin} to ${to.point.name} (${to.system.name})`
  }
  return `Select Jump Level ${route.jumpLevel} route from ${origin} to unknown destination: ${route.unresolvedExit}`
}
