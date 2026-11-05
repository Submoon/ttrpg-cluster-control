/** Shared, source-neutral presentation geometry for a Cluster Star System card. */
export const CLUSTER_SYSTEM_CARD = Object.freeze({
  x: -78,
  y: -38,
  width: 156,
  height: 76,
  cornerRadius: 4,
})

export const CLUSTER_SYSTEM_SEAL = Object.freeze({
  x: -57,
  y: -17,
  radius: 4,
})

/** Unknown systems keep the neutral marker and footprint used before card publication. */
export const PLAYER_CLUSTER_UNKNOWN_MARKER_RADIUS = 18

export const CLUSTER_SYSTEM_PRESENTATION_CLASSES = Object.freeze({
  card: 'cluster-system-card',
  seal: 'cluster-system-seal',
  name: 'cluster-system-name',
  meta: 'cluster-system-meta',
})

export const PLAYER_SYSTEM_CARD_DISCLOSURE_COPY = Object.freeze({
  unknown: 'IDENTITY UNKNOWN',
  'known-type': 'MAP NOT SHARED',
  revealed: 'MAP SHARED',
})

export const PLAYER_CLUSTER_HIERARCHY_DISCLOSURE_COPY = Object.freeze({
  unknown: 'No further information shared',
  'known-type': 'Star system · internal map not shared',
  revealed: 'Open shared system map',
})

export interface ClusterSystemPoint {
  x: number
  y: number
}

/** Returns the scene-space bounds occupied by a card centered at a system position. */
export function clusterSystemCardBounds(position: ClusterSystemPoint) {
  return {
    left: position.x + CLUSTER_SYSTEM_CARD.x,
    top: position.y + CLUSTER_SYSTEM_CARD.y,
    right: position.x + CLUSTER_SYSTEM_CARD.x + CLUSTER_SYSTEM_CARD.width,
    bottom: position.y + CLUSTER_SYSTEM_CARD.y + CLUSTER_SYSTEM_CARD.height,
  }
}

/** Returns the scene-space bounds for the public marker form allowed by its disclosure. */
export function playerClusterSystemMarkerBounds(position: ClusterSystemPoint, useCard: boolean) {
  if (useCard) return clusterSystemCardBounds(position)
  const radius = PLAYER_CLUSTER_UNKNOWN_MARKER_RADIUS
  return {
    left: position.x - radius,
    top: position.y - radius,
    right: position.x + radius,
    bottom: position.y + radius,
  }
}

/** Adds safe public-title ink bounds to a card without expanding a neutral Unknown marker. */
export function playerClusterSystemMarkerVisibleBounds(
  position: ClusterSystemPoint,
  useCard: boolean,
  publicLabel?: string,
) {
  const marker = playerClusterSystemMarkerBounds(position, useCard)
  if (!useCard || publicLabel === undefined) return marker

  // At 14px Georgia, 14 scene units per Unicode character is a conservative label estimate.
  const labelWidth = Array.from(publicLabel).length * 14
  const labelCenterX = position.x + 4
  return {
    left: Math.min(marker.left, labelCenterX - labelWidth / 2),
    top: Math.min(marker.top, position.y - 22),
    right: Math.max(marker.right, labelCenterX + labelWidth / 2),
    bottom: Math.max(marker.bottom, position.y + 2),
  }
}

/** Intersects a ray from a card center with its rectangular edge. */
export function clusterSystemCardEdgePoint(
  center: ClusterSystemPoint,
  toward: ClusterSystemPoint,
): ClusterSystemPoint {
  const dx = toward.x - center.x
  const dy = toward.y - center.y
  const length = Math.hypot(dx, dy)
  if (!Number.isFinite(length) || length === 0) return { ...center }

  const unitX = dx / length
  const unitY = dy / length
  const halfWidth = CLUSTER_SYSTEM_CARD.width / 2
  const halfHeight = CLUSTER_SYSTEM_CARD.height / 2
  const horizontalScale = unitX === 0 ? Number.POSITIVE_INFINITY : halfWidth / Math.abs(unitX)
  const verticalScale = unitY === 0 ? Number.POSITIVE_INFINITY : halfHeight / Math.abs(unitY)
  const distance = Math.min(horizontalScale, verticalScale)
  return {
    x: center.x + unitX * distance,
    y: center.y + unitY * distance,
  }
}

/** Intersects a ray with the published card edge or a neutral circular marker. */
export function playerClusterSystemMarkerEdgePoint(
  center: ClusterSystemPoint,
  toward: ClusterSystemPoint,
  useCard: boolean,
): ClusterSystemPoint {
  if (useCard) return clusterSystemCardEdgePoint(center, toward)
  const dx = toward.x - center.x
  const dy = toward.y - center.y
  const length = Math.hypot(dx, dy)
  if (!Number.isFinite(length) || length === 0) return { ...center }
  return {
    x: center.x + dx / length * PLAYER_CLUSTER_UNKNOWN_MARKER_RADIUS,
    y: center.y + dy / length * PLAYER_CLUSTER_UNKNOWN_MARKER_RADIUS,
  }
}
