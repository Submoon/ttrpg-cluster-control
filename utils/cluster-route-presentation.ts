/** Source-neutral paint and geometry contract shared by Cluster route renderers. */
export const CLUSTER_ROUTE_PRESENTATION = Object.freeze({
  labelFontSize: 10,
  curve: Object.freeze({
    resolvedBend: 32,
    unresolvedBend: 18,
    labelOffsetY: -8,
  }),
  badge: Object.freeze({
    minimumWidth: 78,
    characterAdvance: 7,
    horizontalPadding: 18,
    height: 21,
    cornerRadius: 10,
    topOffset: -12,
    textBaselineOffset: 2,
  }),
  line: Object.freeze({
    width: 2.4,
    unresolvedDashArray: '8 7',
  }),
  endpoint: Object.freeze({
    radius: 7,
    strokeWidth: 2,
    badgeGap: 14,
    captionOffsetX: -10,
    captionVerticalOffset: 54,
    captionCharacterAdvance: 7,
    captionTopOffset: -10,
    captionBottomOffset: 2,
  }),
})

/** CSS variables used by the live Warden/player maps and standalone player images. */
export const CLUSTER_ROUTE_PAINT_VARIABLES = Object.freeze({
  route: '--map-route',
  unresolved: '--map-unresolved',
  labelBackground: '--map-label-bg',
  labelBorder: '--map-label-border',
  text: '--map-text',
  endpointFill: '--map-card',
})

export interface ClusterRouteCurveGeometry {
  path: string
  labelX: number
  labelY: number
}

export interface ClusterEndpointCaptionGeometry {
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

/** Formats the visible label shared by live and exported Cluster maps. */
export function clusterRoutePresentationLabel(jumpLevel: number): string {
  return `Jump-${jumpLevel}`
}

/** Returns the shared minimum-width monospace Jump badge. */
export function clusterRoutePresentationLabelWidth(jumpLevel: number): number {
  const text = clusterRoutePresentationLabel(jumpLevel)
  return Math.max(
    CLUSTER_ROUTE_PRESENTATION.badge.minimumWidth,
    text.length * CLUSTER_ROUTE_PRESENTATION.badge.characterAdvance
      + CLUSTER_ROUTE_PRESENTATION.badge.horizontalPadding,
  )
}

/** Builds a quadratic route using caller-provided marker anchors and the shared curve math. */
export function clusterRouteCurve(
  start: { x: number; y: number },
  end: { x: number; y: number },
  bend: number,
  direction: { x: number; y: number } = { x: end.x - start.x, y: end.y - start.y },
): ClusterRouteCurveGeometry {
  const length = Math.max(1, Math.hypot(direction.x, direction.y))
  const ux = direction.x / length
  const uy = direction.y / length
  const controlX = (start.x + end.x) / 2 - uy * bend
  const controlY = (start.y + end.y) / 2 + ux * bend
  return {
    path: `M ${start.x} ${start.y} Q ${controlX} ${controlY} ${end.x} ${end.y}`,
    labelX: (start.x + 2 * controlX + end.x) / 4,
    labelY: (start.y + 2 * controlY + end.y) / 4 + CLUSTER_ROUTE_PRESENTATION.curve.labelOffsetY,
  }
}

/** Positions an unresolved public caption with the same endpoint-side layout as the Warden map. */
export function clusterEndpointCaptionGeometry(
  text: string,
  endpoint: { x: number; y: number },
  source: { x: number; y: number },
): ClusterEndpointCaptionGeometry {
  const { endpoint: metrics } = CLUSTER_ROUTE_PRESENTATION
  const width = text.length * metrics.captionCharacterAdvance
  const x = endpoint.x + metrics.captionOffsetX
  const y = endpoint.y + (endpoint.y >= source.y ? metrics.captionVerticalOffset : -metrics.captionVerticalOffset)
  return {
    text,
    x,
    y,
    width,
    left: x - width,
    right: x,
    top: y + metrics.captionTopOffset,
    bottom: y + metrics.captionBottomOffset,
    anchor: 'end',
  }
}
