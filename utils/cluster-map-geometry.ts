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
  exitLabel?: ClusterUnresolvedExitLabelGeometry
}

export interface ClusterUnresolvedExitLabelGeometry {
  text: string
  x: number
  y: number
  width: number
  left: number
  right: number
  top: number
  bottom: number
  anchor: 'end'
}

/** Platform-derived SVG coordinate envelope below observed renderer saturation, independent of canvas size. */
export const CLUSTER_SCENE_COORDINATE_LIMIT = 2 ** 24 - 4096
/** Scene-space margin around system and exit anchors. */
const CLUSTER_SCENE_ANCHOR_PADDING = 256
/** PNG export padding around rendered feature bounds. */
const CLUSTER_SCENE_FEATURE_PADDING = 24
const CLUSTER_EXIT_LABEL_CHARACTER_ADVANCE = 7
const AUTOMATIC_EXIT_ROWS = [0, 64, -64, 128, -128] as const

/** Returns endpoint-caption bounds using the rendered monospace text length. */
export function clusterUnresolvedExitLabelGeometry(
  unresolvedExit: string,
  exitPoint: Point,
  sourcePoint: Point,
): ClusterUnresolvedExitLabelGeometry {
  const text = `Unknown: ${unresolvedExit}`
  const width = text.length * CLUSTER_EXIT_LABEL_CHARACTER_ADVANCE
  const x = exitPoint.x - 10
  const y = exitPoint.y + (exitPoint.y >= sourcePoint.y ? 54 : -54)
  return {
    text,
    x,
    y,
    width,
    left: x - width,
    right: x,
    top: y - 10,
    bottom: y + 2,
    anchor: 'end',
  }
}

/** Returns the shared minimum-width SVG badge size for one Jump Route label. */
export function clusterRouteLabelWidth(route: JumpRoute): number {
  const text = `Jump-${route.jumpLevel}`
  return Math.max(78, text.length * 7 + 18)
}

function automaticExitPosition(start: Point, ordinal: number): Point {
  return {
    x: start.x + 135 + Math.floor(ordinal / AUTOMATIC_EXIT_ROWS.length) * 180,
    y: start.y + AUTOMATIC_EXIT_ROWS[ordinal % AUTOMATIC_EXIT_ROWS.length]!,
  }
}

function isRendererCoordinate(value: number): boolean {
  return Number.isFinite(value) && Math.abs(value) <= CLUSTER_SCENE_COORDINATE_LIMIT
}

/** Checks whether one scene-space point leaves enough renderer headroom for its map geometry. */
export function isSafeClusterScenePoint(point: Point): boolean {
  const left = point.x - CLUSTER_SCENE_ANCHOR_PADDING
  const top = point.y - CLUSTER_SCENE_ANCHOR_PADDING
  const right = point.x + CLUSTER_SCENE_ANCHOR_PADDING
  const bottom = point.y + CLUSTER_SCENE_ANCHOR_PADDING
  return [left, top, right, bottom].every(isRendererCoordinate)
    && left < point.x && top < point.y && right > point.x && bottom > point.y
}

/** Checks the numeric SVG geometry produced for one route before it enters durable layout. */
export function hasFiniteClusterRouteGeometry(geometry: ClusterRouteGeometry): boolean {
  return Number.isFinite(geometry.labelX)
    && Number.isFinite(geometry.labelY)
    && (geometry.exitPoint === undefined
      || (Number.isFinite(geometry.exitPoint.x) && Number.isFinite(geometry.exitPoint.y)))
    && (geometry.exitLabel === undefined
      || [
        geometry.exitLabel.x,
        geometry.exitLabel.y,
        geometry.exitLabel.width,
        geometry.exitLabel.left,
        geometry.exitLabel.right,
        geometry.exitLabel.top,
        geometry.exitLabel.bottom,
      ].every(Number.isFinite))
    && !/(?:NaN|Infinity)/i.test(geometry.path)
}

interface ClusterSceneBounds {
  left: number
  top: number
  right: number
  bottom: number
}

function createClusterSceneBounds(): ClusterSceneBounds {
  return {
    left: Number.POSITIVE_INFINITY,
    top: Number.POSITIVE_INFINITY,
    right: Number.NEGATIVE_INFINITY,
    bottom: Number.NEGATIVE_INFINITY,
  }
}

function includeClusterScenePoint(bounds: ClusterSceneBounds, x: number, y: number): boolean {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false
  bounds.left = Math.min(bounds.left, x)
  bounds.top = Math.min(bounds.top, y)
  bounds.right = Math.max(bounds.right, x)
  bounds.bottom = Math.max(bounds.bottom, y)
  return true
}

function hasSafePaddedClusterSceneBounds(bounds: ClusterSceneBounds, padding: number): boolean {
  if (![bounds.left, bounds.top, bounds.right, bounds.bottom].every(Number.isFinite)) return false

  const paddedLeft = bounds.left - padding
  const paddedTop = bounds.top - padding
  const paddedRight = bounds.right + padding
  const paddedBottom = bounds.bottom + padding
  const width = paddedRight - paddedLeft
  const height = paddedBottom - paddedTop
  return [paddedLeft, paddedTop, paddedRight, paddedBottom, width, height].every(Number.isFinite)
    && [paddedLeft, paddedTop, paddedRight, paddedBottom].every(isRendererCoordinate)
    && isRendererCoordinate(width) && isRendererCoordinate(height)
    && paddedLeft < bounds.left && paddedTop < bounds.top
    && paddedRight > bounds.right && paddedBottom > bounds.bottom
    && width > 0 && height > 0
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
  const anchors = createClusterSceneBounds()
  const features = createClusterSceneBounds()

  for (const system of cluster.systems) {
    if (!systemPositions[system.id]) return false
    const scenePosition = clusterSystemPosition(systemPositions, system.id)
    if (!includeClusterScenePoint(anchors, scenePosition.x, scenePosition.y)) return false
    if (!includeClusterScenePoint(features, scenePosition.x - 80, scenePosition.y - 40)
      || !includeClusterScenePoint(features, scenePosition.x + 80, scenePosition.y + 40)) return false
    const systemNameWidth = system.name.length * 14
    if (!includeClusterScenePoint(features, scenePosition.x + 4 - systemNameWidth / 2, scenePosition.y - 20)
      || !includeClusterScenePoint(features, scenePosition.x + 4 + systemNameWidth / 2, scenePosition.y + 1)) return false
    const stars = system.objects.filter(object => object.subtype === 'star').length
    const metadata = `${stars} STAR${stars === 1 ? '' : 'S'} / ${system.objects.length} OBJECTS`
    const metadataWidth = metadata.length * 5.5
    if (!includeClusterScenePoint(features, scenePosition.x - metadataWidth / 2, scenePosition.y + 8)
      || !includeClusterScenePoint(features, scenePosition.x + metadataWidth / 2, scenePosition.y + 20)) return false
  }

  for (const position of Object.values(unresolvedExitPositions)) {
    if (!includeClusterScenePoint(anchors, position.x, position.y)) return false
  }

  const pathNumbers = /[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[-+]?\d+)?/gi
  for (const route of cluster.routes) {
    let geometry: ClusterRouteGeometry
    try {
      geometry = clusterRouteGeometry(
        route,
        cluster,
        jumpPoints,
        systemPositions,
        undefined,
        unresolvedExitPositions,
      )
    } catch {
      return false
    }
    if (!hasFiniteClusterRouteGeometry(geometry)) return false
    const routeLabelWidth = clusterRouteLabelWidth(route)
    if (!includeClusterScenePoint(features, geometry.labelX - routeLabelWidth / 2, geometry.labelY - 13)
      || !includeClusterScenePoint(features, geometry.labelX + routeLabelWidth / 2, geometry.labelY + 10)) return false
    if (geometry.exitPoint) {
      if (!includeClusterScenePoint(anchors, geometry.exitPoint.x, geometry.exitPoint.y)
        || !includeClusterScenePoint(features, geometry.exitPoint.x - 8, geometry.exitPoint.y - 8)
        || !includeClusterScenePoint(features, geometry.exitPoint.x + 8, geometry.exitPoint.y + 8)) return false
    }
    const exitLabel = geometry.exitLabel
    if (exitLabel
      && (!includeClusterScenePoint(features, exitLabel.left, exitLabel.top)
        || !includeClusterScenePoint(features, exitLabel.right, exitLabel.bottom))) return false

    const coordinates = Array.from(geometry.path.matchAll(pathNumbers), match => Number(match[0]))
    if (coordinates.length === 0 || coordinates.length % 2 !== 0) return false
    for (let coordinate = 0; coordinate < coordinates.length; coordinate += 2) {
      if (!includeClusterScenePoint(features, coordinates[coordinate]!, coordinates[coordinate + 1]!)) return false
    }
  }

  return hasSafePaddedClusterSceneBounds(anchors, CLUSTER_SCENE_ANCHOR_PADDING)
    && hasSafePaddedClusterSceneBounds(features, CLUSTER_SCENE_FEATURE_PADDING)
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
 * Builds a scene-space route path, labels, and optional unresolved-exit marker.
 * @param route Logical Jump Route to draw.
 * @param cluster Owning Cluster, used to preserve route bends and space automatic exits per origin system.
 * @param jumpPoints Current logical endpoints.
 * @param systemPositions Durable normalized positions for endpoint systems.
 * @param positionOverrides Optional temporary scene-space positions while systems are dragged.
 * @param unresolvedExitPositions Optional durable scene-space targets keyed by unresolved route ID.
 * @param exitPositionOverrides Optional temporary scene-space targets keyed by unresolved route ID.
 * @returns SVG path data and label coordinates in Cluster-map scene units.
 * @throws If the route is absent from the Cluster, a Jump Point is missing, or a required system position is missing.
 */
export function clusterRouteGeometry(
  route: JumpRoute,
  cluster: JumpCluster,
  jumpPoints: ReadonlyMap<string, JumpPointReference>,
  systemPositions: Readonly<Record<string, Point>>,
  positionOverrides?: ReadonlyMap<string, Point>,
  unresolvedExitPositions?: Readonly<Record<string, Point>>,
  exitPositionOverrides?: ReadonlyMap<string, Point>,
): ClusterRouteGeometry {
  const routes = cluster.routes
  const index = routes.findIndex(candidate => candidate.id === route.id)
  if (index < 0) {
    throw new Error(`Jump Route "${route.id}" does not belong to the supplied Cluster routes.`)
  }

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
  let unresolvedExitOrdinal = 0
  for (const sibling of routes.slice(0, index)) {
    if (sibling.toPointId !== null) continue
    const siblingFrom = requiredJumpPoint(jumpPoints, sibling.fromPointId)
    if (siblingFrom.system.id === from.system.id) unresolvedExitOrdinal += 1
  }
  const exitPoint = to
    ? undefined
    : exitPositionOverrides?.get(route.id)
      ?? savedExitPoint
      ?? automaticExitPosition(start, unresolvedExitOrdinal)
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

  const routeLabelWidth = clusterRouteLabelWidth(route)
  const routeLabelX = to
    ? (x1 + 2 * controlX + x2) / 4
    : exitPoint!.x + 14 + routeLabelWidth / 2
  const routeLabelY = to
    ? (y1 + 2 * controlY + y2) / 4 - 8
    : exitPoint!.y - 8
  const exitLabel = exitPoint && route.toPointId === null
    ? clusterUnresolvedExitLabelGeometry(route.unresolvedExit, exitPoint, start)
    : undefined
  return {
    path: `M ${x1} ${y1} Q ${controlX} ${controlY} ${x2} ${y2}`,
    labelX: routeLabelX,
    labelY: routeLabelY,
    exitPoint,
    exitLabel,
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
