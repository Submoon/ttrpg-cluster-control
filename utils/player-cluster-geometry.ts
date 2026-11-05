/** Public map geometry derived only from the allowlisted player Cluster document. */
import type { PlayerClusterDocument, PlayerRoute, PlayerSystemMarker, Point } from '../domain/workspace'
import {
  CLUSTER_SYSTEM_CARD,
  PLAYER_CLUSTER_UNKNOWN_MARKER_RADIUS,
  clusterSystemCardBounds,
  playerClusterSystemMarkerVisibleBounds,
  playerClusterSystemMarkerEdgePoint,
} from './cluster-system-presentation'

const UNKNOWN_DESTINATION_RADIUS = 8
const ROUTE_BEND = 28
const ROUTE_LABEL_HEIGHT = 15
const LABEL_CHARACTER_ADVANCE = 9
const LABEL_COLLISION_GAP = 20
const MAX_ROUTE_LABEL_RINGS = 8

interface SceneRect {
  left: number
  top: number
  right: number
  bottom: number
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
  destination?: { position: Point; label: 'Unknown destination' }
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
    top: y - ROUTE_LABEL_HEIGHT,
    right: x + width / 2,
    bottom: y + 5,
  }
}

function rectanglesOverlap(left: SceneRect, right: SceneRect, gap: number): boolean {
  return left.left < right.right + gap && left.right + gap > right.left
    && left.top < right.bottom + gap && left.bottom + gap > right.top
}

function labelObstacles(systems: readonly PlayerSystemMarker[], routes: readonly PlayerRoute[]): SceneRect[] {
  const obstacles: SceneRect[] = []
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
    obstacles.push({
      left: position.x - UNKNOWN_DESTINATION_RADIUS,
      top: position.y - UNKNOWN_DESTINATION_RADIUS,
      right: position.x + UNKNOWN_DESTINATION_RADIUS,
      bottom: position.y + UNKNOWN_DESTINATION_RADIUS,
    })
    obstacles.push({
      left: position.x + 16,
      top: position.y - 10,
      right: position.x + 16 + route.destination.label.length * LABEL_CHARACTER_ADVANCE,
      bottom: position.y + 7,
    })
  }
  return obstacles
}

function systemMarkersOverlap(first: PlayerSystemMarker, second: PlayerSystemMarker): boolean {
  const firstIsCard = first.disclosure !== 'unknown'
  const secondIsCard = second.disclosure !== 'unknown'
  if (firstIsCard && secondIsCard) {
    const a = clusterSystemCardBounds(first.position)
    const b = clusterSystemCardBounds(second.position)
    return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top
  }

  if (!firstIsCard && !secondIsCard) {
    return Math.hypot(first.position.x - second.position.x, first.position.y - second.position.y)
      < PLAYER_CLUSTER_UNKNOWN_MARKER_RADIUS * 2
  }

  const circle = firstIsCard ? second : first
  const card = firstIsCard ? first : second
  const bounds = clusterSystemCardBounds(card.position)
  const closestX = Math.max(bounds.left, Math.min(bounds.right, circle.position.x))
  const closestY = Math.max(bounds.top, Math.min(bounds.bottom, circle.position.y))
  return Math.hypot(circle.position.x - closestX, circle.position.y - closestY)
    < PLAYER_CLUSTER_UNKNOWN_MARKER_RADIUS
}

function unresolvedDestinationCoveredByCard(
  position: Point,
  systems: readonly PlayerSystemMarker[],
): boolean {
  return systems.some((system) => {
    if (system.disclosure === 'unknown') return false
    const bounds = clusterSystemCardBounds(system.position)
    return position.x >= bounds.left && position.x <= bounds.right
      && position.y >= bounds.top && position.y <= bounds.bottom
  })
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
      if (obstacles.some(obstacle => rectanglesOverlap(rect, obstacle, LABEL_COLLISION_GAP))) continue
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
  const dx = destinationPosition.x - origin.position.x
  const dy = destinationPosition.y - origin.position.y
  const distance = Math.hypot(dx, dy)
  const foreground = route.destination.kind === 'unknown'
    ? unresolvedDestinationCoveredByCard(route.destination.position, systems)
    : distance >= 1 && systemMarkersOverlap(origin, destinationSystem!)

  let path: string
  let labelX: number
  let labelY: number
  if (distance < 1) {
    const originUsesCard = origin.disclosure !== 'unknown'
    const halfWidth = originUsesCard ? 46 : PLAYER_CLUSTER_UNKNOWN_MARKER_RADIUS
    const edgeY = originUsesCard ? origin.position.y + CLUSTER_SYSTEM_CARD.y : origin.position.y
    path = `M ${origin.position.x - halfWidth} ${edgeY} Q ${origin.position.x} ${origin.position.y - 82 - (index % 2) * 14} ${origin.position.x + halfWidth} ${edgeY}`
    labelX = origin.position.x
    labelY = origin.position.y - 46 - (index % 2) * 7
  } else {
    const ux = dx / distance
    const uy = dy / distance
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
    const bend = index % 2 === 0 ? ROUTE_BEND : -ROUTE_BEND
    const control = {
      x: (start.x + end.x) / 2 - uy * bend,
      y: (start.y + end.y) / 2 + ux * bend,
    }
    path = `M ${start.x} ${start.y} Q ${control.x} ${control.y} ${end.x} ${end.y}`
    labelX = (start.x + 2 * control.x + end.x) / 4
    labelY = (start.y + 2 * control.y + end.y) / 4 - 8
  }

  const label = `Jump Level ${route.jumpLevel}`
  const destinationLabel = route.destination.kind === 'unknown'
    ? route.destination.label
    : destinationSystem!.label
  const accessibleLabel = route.destination.kind === 'unknown'
    ? `${label} to ${destinationLabel}`
    : `${label} from ${origin.label} to ${destinationLabel}`
  const labelWidth = Math.max(92, label.length * LABEL_CHARACTER_ADVANCE + 18)
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
      ? { destination: { position: { ...route.destination.position }, label: route.destination.label } }
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
      route.labelY - ROUTE_LABEL_HEIGHT,
      route.labelX + route.labelWidth / 2,
      route.labelY + 4,
    )
    if (route.destination) {
      const position = route.destination.position
      includeRect(
        bounds,
        position.x - UNKNOWN_DESTINATION_RADIUS,
        position.y - UNKNOWN_DESTINATION_RADIUS,
        position.x + UNKNOWN_DESTINATION_RADIUS + 16
          + route.destination.label.length * LABEL_CHARACTER_ADVANCE,
        position.y + UNKNOWN_DESTINATION_RADIUS + 5,
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
