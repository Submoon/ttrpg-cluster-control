/** Public map geometry derived only from the allowlisted player Cluster document. */
import type { PlayerClusterDocument, PlayerRoute, PlayerSystemMarker, Point } from '../domain/workspace'
import {
  CLUSTER_ROUTE_PRESENTATION,
  type ClusterEndpointCaptionGeometry,
  clusterEndpointCaptionGeometry,
  clusterRouteCurve,
  clusterRoutePresentationLabel,
  clusterRoutePresentationLabelWidth,
} from './cluster-route-presentation'
import {
  PLAYER_CLUSTER_SYSTEM_CARD,
  PLAYER_CLUSTER_UNKNOWN_MARKER_RADIUS,
  playerClusterSystemCardBounds,
  playerClusterSystemMarkerVisibleBounds,
  playerClusterSystemMarkerEdgePoint,
} from './cluster-system-presentation'

const UNKNOWN_DESTINATION_RADIUS = CLUSTER_ROUTE_PRESENTATION.endpoint.radius
const ROUTE_LABEL_HEIGHT = CLUSTER_ROUTE_PRESENTATION.badge.height
const LABEL_COLLISION_GAP = 20
const MAX_ROUTE_LABEL_RINGS = 8

interface SceneRect {
  left: number
  top: number
  right: number
  bottom: number
  gap?: number
}

export interface PlayerRouteGeometry {
  id: string
  foreground: boolean
  path: string
  label: string
  accessibleLabel: string
  labelX: number
  labelY: number
  labelWidth: number
  destination?: {
    position: Point
    label: 'Unknown destination'
    labelX: number
    labelY: number
    labelWidth: number
  }
}

export interface PlayerClusterGeometry {
  routes: PlayerRouteGeometry[]
  bounds: { minX: number; minY: number; width: number; height: number }
}

interface MutableBounds {
  left: number
  top: number
  right: number
  bottom: number
}

function includePoint(bounds: MutableBounds, point: Point): void {
  bounds.left = Math.min(bounds.left, point.x)
  bounds.top = Math.min(bounds.top, point.y)
  bounds.right = Math.max(bounds.right, point.x)
  bounds.bottom = Math.max(bounds.bottom, point.y)
}

function includeRect(bounds: MutableBounds, left: number, top: number, right: number, bottom: number): void {
  includePoint(bounds, { x: left, y: top })
  includePoint(bounds, { x: right, y: bottom })
}

function routeLabelRect(x: number, y: number, width: number): SceneRect {
  return {
    left: x - width / 2,
    top: y + CLUSTER_ROUTE_PRESENTATION.badge.topOffset,
    right: x + width / 2,
    bottom: y + CLUSTER_ROUTE_PRESENTATION.badge.topOffset + ROUTE_LABEL_HEIGHT,
  }
}

function rectanglesOverlap(left: SceneRect, right: SceneRect, gap: number): boolean {
  return left.left < right.right + gap && left.right + gap > right.left
    && left.top < right.bottom + gap && left.bottom + gap > right.top
}

function circleIntersectsCard(center: Point, radius: number, cardCenter: Point): boolean {
  const bounds = playerClusterSystemCardBounds(cardCenter)
  const closestX = Math.max(bounds.left, Math.min(bounds.right, center.x))
  const closestY = Math.max(bounds.top, Math.min(bounds.bottom, center.y))
  return Math.hypot(center.x - closestX, center.y - closestY) < radius
}

function labelObstacles(systems: readonly PlayerSystemMarker[], routes: readonly PlayerRoute[]): SceneRect[] {
  const obstacles: SceneRect[] = []
  const systemsById = new Map(systems.map(system => [system.id, system]))
  for (const system of systems) {
    const marker = playerClusterSystemMarkerVisibleBounds(
      system.position,
      system.disclosure !== 'unknown',
      system.label,
    )
    obstacles.push({
      left: marker.left,
      top: marker.top,
      right: marker.right,
      bottom: marker.bottom,
    })
  }
  for (const route of routes) {
    if (route.destination.kind !== 'unknown') continue
    const position = route.destination.position
    const origin = systemsById.get(route.fromSystemId)
    if (!origin) throw new Error('A player route references a missing public origin marker.')
    const caption = unresolvedDestinationCaptionGeometry(
      route.destination.label,
      position,
      origin.position,
      systems,
    )
    obstacles.push({
      left: position.x - UNKNOWN_DESTINATION_RADIUS,
      top: position.y - UNKNOWN_DESTINATION_RADIUS,
      right: position.x + UNKNOWN_DESTINATION_RADIUS,
      bottom: position.y + UNKNOWN_DESTINATION_RADIUS,
      gap: 0,
    })
    obstacles.push({
      left: caption.left,
      top: caption.top,
      right: caption.right,
      bottom: caption.bottom,
    })
  }
  return obstacles
}

function systemMarkersOverlap(first: PlayerSystemMarker, second: PlayerSystemMarker): boolean {
  const firstIsCard = first.disclosure !== 'unknown'
  const secondIsCard = second.disclosure !== 'unknown'
  if (firstIsCard && secondIsCard) {
    const a = playerClusterSystemCardBounds(first.position)
    const b = playerClusterSystemCardBounds(second.position)
    return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top
  }

  if (!firstIsCard && !secondIsCard) {
    return Math.hypot(first.position.x - second.position.x, first.position.y - second.position.y)
      < PLAYER_CLUSTER_UNKNOWN_MARKER_RADIUS * 2
  }

  const circle = firstIsCard ? second : first
  const card = firstIsCard ? first : second
  return circleIntersectsCard(circle.position, PLAYER_CLUSTER_UNKNOWN_MARKER_RADIUS, card.position)
}

function unresolvedDestinationCoveredByCard(
  position: Point,
  systems: readonly PlayerSystemMarker[],
  caption?: ClusterEndpointCaptionGeometry,
): boolean {
  return systems.some((system) => {
    if (system.disclosure === 'unknown') return false
    const bounds = playerClusterSystemCardBounds(system.position)
    const destinationCovered = circleIntersectsCard(position, UNKNOWN_DESTINATION_RADIUS, system.position)
    const captionCovered = caption !== undefined
      && rectanglesOverlap(caption, bounds, 0)
    return destinationCovered || captionCovered
  })
}

/** Keeps an unresolved caption on the Warden side when clear, then tries the mirrored vertical side. */
function unresolvedDestinationCaptionGeometry(
  label: string,
  position: Point,
  source: Point,
  systems: readonly PlayerSystemMarker[],
): ClusterEndpointCaptionGeometry {
  const preferred = clusterEndpointCaptionGeometry(label, position, source)
  const captionCovered = (caption: ClusterEndpointCaptionGeometry) =>
    systems.some((system) => {
      if (system.disclosure === 'unknown') return false
      return rectanglesOverlap(caption, playerClusterSystemCardBounds(system.position), 0)
    })
  if (!captionCovered(preferred)) return preferred

  const mirroredY = position.y - (preferred.y - position.y)
  const mirrored: ClusterEndpointCaptionGeometry = {
    ...preferred,
    y: mirroredY,
    top: mirroredY + CLUSTER_ROUTE_PRESENTATION.endpoint.captionTopOffset,
    bottom: mirroredY + CLUSTER_ROUTE_PRESENTATION.endpoint.captionBottomOffset,
  }
  return captionCovered(mirrored) ? preferred : mirrored
}

function placeRouteLabel(
  routeIndex: number,
  origin: Point,
  destination: Point,
  preferredX: number,
  preferredY: number,
  width: number,
  obstacles: SceneRect[],
): { x: number; y: number } {
  const distance = Math.hypot(destination.x - origin.x, destination.y - origin.y)
  const tangent = distance < 1
    ? { x: 1, y: 0 }
    : { x: (destination.x - origin.x) / distance, y: (destination.y - origin.y) / distance }
  const normal = { x: -tangent.y, y: tangent.x }
  const preferredSide = routeIndex % 2 === 0 ? 1 : -1

  for (let ring = 0; ring < MAX_ROUTE_LABEL_RINGS; ring += 1) {
    const distance = ring * (ROUTE_LABEL_HEIGHT * 3 + LABEL_COLLISION_GAP)
    const along = ring * (width + LABEL_COLLISION_GAP)
    const candidates = ring === 0
      ? [{ along: 0, normal: 0 }]
      : [
          { along: 0, normal: preferredSide * distance },
          { along: 0, normal: -preferredSide * distance },
          { along: preferredSide * along, normal: 0 },
          { along: -preferredSide * along, normal: 0 },
        ]

    for (const candidate of candidates) {
      const x = preferredX + tangent.x * candidate.along + normal.x * candidate.normal
      const y = preferredY + tangent.y * candidate.along + normal.y * candidate.normal
      const rect = routeLabelRect(x, y, width)
      if (obstacles.some(obstacle => rectanglesOverlap(rect, obstacle, obstacle.gap ?? LABEL_COLLISION_GAP))) continue
      obstacles.push(rect)
      return { x, y }
    }
  }

  let rightmostObstacle = Number.NEGATIVE_INFINITY
  for (const obstacle of obstacles) rightmostObstacle = Math.max(rightmostObstacle, obstacle.right)
  const fallbackX = rightmostObstacle + LABEL_COLLISION_GAP + width / 2
  const fallbackRect = routeLabelRect(fallbackX, preferredY, width)
  if (![rightmostObstacle, fallbackX, preferredY, fallbackRect.left, fallbackRect.top,
    fallbackRect.right, fallbackRect.bottom].every(Number.isFinite)) {
    throw new Error('A public Jump Route has invalid rendered geometry.')
  }
  obstacles.push(fallbackRect)
  return { x: fallbackX, y: preferredY }
}

function routeGeometry(
  route: PlayerRoute,
  index: number,
  systemsById: ReadonlyMap<string, PlayerSystemMarker>,
  systems: readonly PlayerSystemMarker[],
  obstacles: SceneRect[],
): PlayerRouteGeometry {
  const origin = systemsById.get(route.fromSystemId)
  if (!origin) throw new Error('A player route references a missing public origin marker.')

  const destinationSystem = route.destination.kind === 'system'
    ? systemsById.get(route.destination.systemId)
    : undefined
  if (route.destination.kind === 'system' && !destinationSystem) {
    throw new Error('A player route references a missing public destination marker.')
  }
  const destinationPosition = route.destination.kind === 'system'
    ? destinationSystem!.position
    : route.destination.position
  const destinationCaption = route.destination.kind === 'unknown'
    ? unresolvedDestinationCaptionGeometry(
        route.destination.label,
        route.destination.position,
        origin.position,
        systems,
      )
    : undefined
  const dx = destinationPosition.x - origin.position.x
  const dy = destinationPosition.y - origin.position.y
  const distance = Math.hypot(dx, dy)
  const foreground = route.destination.kind === 'unknown'
    ? unresolvedDestinationCoveredByCard(route.destination.position, systems, destinationCaption)
    : distance >= 1 && systemMarkersOverlap(origin, destinationSystem!)

  let path: string
  let labelX: number
  let labelY: number
  if (distance < 1) {
    const originUsesCard = origin.disclosure !== 'unknown'
    const halfWidth = originUsesCard
      ? PLAYER_CLUSTER_SYSTEM_CARD.width / 2 - 14
      : PLAYER_CLUSTER_UNKNOWN_MARKER_RADIUS
    const edgeY = originUsesCard
      ? origin.position.y + PLAYER_CLUSTER_SYSTEM_CARD.y
      : origin.position.y
    path = `M ${origin.position.x - halfWidth} ${edgeY} Q ${origin.position.x} ${origin.position.y - 82 - (index % 2) * 14} ${origin.position.x + halfWidth} ${edgeY}`
    labelX = origin.position.x
    labelY = origin.position.y - 46 - (index % 2) * 7
  } else {
    const start = playerClusterSystemMarkerEdgePoint(
      origin.position,
      destinationPosition,
      origin.disclosure !== 'unknown',
    )
    const end = destinationSystem
      ? playerClusterSystemMarkerEdgePoint(
          destinationSystem.position,
          origin.position,
          destinationSystem.disclosure !== 'unknown',
        )
      : destinationPosition
    const bend = route.destination.kind === 'unknown'
      ? CLUSTER_ROUTE_PRESENTATION.curve.unresolvedBend
      : (index % 2 === 0
          ? CLUSTER_ROUTE_PRESENTATION.curve.resolvedBend
          : -CLUSTER_ROUTE_PRESENTATION.curve.resolvedBend)
    const curve = clusterRouteCurve(start, end, bend, { x: dx, y: dy })
    path = curve.path
    labelX = curve.labelX
    labelY = curve.labelY
  }

  const label = clusterRoutePresentationLabel(route.jumpLevel)
  const accessibleLevel = `Jump Level ${route.jumpLevel}`
  const destinationLabel = route.destination.kind === 'unknown'
    ? route.destination.label
    : destinationSystem!.label
  const accessibleLabel = route.destination.kind === 'unknown'
    ? `${accessibleLevel} to ${destinationLabel}`
    : `${accessibleLevel} from ${origin.label} to ${destinationLabel}`
  const labelWidth = clusterRoutePresentationLabelWidth(route.jumpLevel)
  if (route.destination.kind === 'unknown') {
    labelX = route.destination.position.x
      + CLUSTER_ROUTE_PRESENTATION.endpoint.badgeGap + labelWidth / 2
    labelY = route.destination.position.y + CLUSTER_ROUTE_PRESENTATION.curve.labelOffsetY
  }
  const positionedLabel = placeRouteLabel(
    index,
    origin.position,
    destinationPosition,
    labelX,
    labelY,
    labelWidth,
    obstacles,
  )

  return {
    id: route.id,
    foreground,
    path,
    label,
    accessibleLabel,
    labelX: positionedLabel.x,
    labelY: positionedLabel.y,
    labelWidth,
    ...(route.destination.kind === 'unknown'
      ? {
          destination: {
            position: { ...route.destination.position },
            label: route.destination.label,
            labelX: destinationCaption!.x,
            labelY: destinationCaption!.y,
            labelWidth: destinationCaption!.width,
          },
        }
      : {}),
  }
}

/** Builds route strokes, labels and fit bounds without accepting any source workspace records. */
export function playerClusterGeometry(document: PlayerClusterDocument): PlayerClusterGeometry {
  const bounds: MutableBounds = {
    left: Number.POSITIVE_INFINITY,
    top: Number.POSITIVE_INFINITY,
    right: Number.NEGATIVE_INFINITY,
    bottom: Number.NEGATIVE_INFINITY,
  }
  const systemsById = new Map(document.systems.map(system => [system.id, system]))

  for (const system of document.systems) {
    const marker = playerClusterSystemMarkerVisibleBounds(
      system.position,
      system.disclosure !== 'unknown',
      system.label,
    )
    includeRect(
      bounds,
      marker.left,
      marker.top,
      marker.right,
      marker.bottom,
    )
  }

  const obstacles = labelObstacles(document.systems, document.routes)
  const routes = document.routes.map((route, index) => routeGeometry(
    route,
    index,
    systemsById,
    document.systems,
    obstacles,
  ))
  for (const route of routes) {
    const routeCoordinates = Array.from(route.path.matchAll(/[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[-+]?\d+)?/gi), match => Number(match[0]))
    if (routeCoordinates.length < 4 || routeCoordinates.length % 2 !== 0
      || routeCoordinates.some(value => !Number.isFinite(value))) {
      throw new Error('A public Jump Route has invalid rendered geometry.')
    }
    for (let coordinate = 0; coordinate < routeCoordinates.length; coordinate += 2) {
      includePoint(bounds, { x: routeCoordinates[coordinate]!, y: routeCoordinates[coordinate + 1]! })
    }
    includeRect(
      bounds,
      route.labelX - route.labelWidth / 2,
      route.labelY + CLUSTER_ROUTE_PRESENTATION.badge.topOffset,
      route.labelX + route.labelWidth / 2,
      route.labelY + CLUSTER_ROUTE_PRESENTATION.badge.topOffset + ROUTE_LABEL_HEIGHT,
    )
    if (route.destination) {
      const position = route.destination.position
      includeRect(
        bounds,
        Math.min(position.x - UNKNOWN_DESTINATION_RADIUS, route.destination.labelX - route.destination.labelWidth),
        Math.min(position.y - UNKNOWN_DESTINATION_RADIUS, route.destination.labelY
          + CLUSTER_ROUTE_PRESENTATION.endpoint.captionTopOffset),
        Math.max(position.x + UNKNOWN_DESTINATION_RADIUS, route.destination.labelX),
        Math.max(position.y + UNKNOWN_DESTINATION_RADIUS, route.destination.labelY
          + CLUSTER_ROUTE_PRESENTATION.endpoint.captionBottomOffset),
      )
    }
  }

  if (!document.systems.length) {
    return { routes, bounds: { minX: 0, minY: 0, width: 1, height: 1 } }
  }

  const padding = Math.max((bounds.right - bounds.left) * 0.12, (bounds.bottom - bounds.top) * 0.18, 56)
  return {
    routes,
    bounds: {
      minX: bounds.left - padding,
      minY: bounds.top - padding,
      width: bounds.right - bounds.left + padding * 2,
      height: bounds.bottom - bounds.top + padding * 2,
    },
  }
}
