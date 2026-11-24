import { clusterRoutePresentationLabel } from './cluster-route-presentation'
import type { ContinuousMapRouteGeometry } from './continuous-map-route-geometry'
import type { MapViewport, SvgViewportRect } from './map-zoom'

interface LabelCandidate {
  id: string
  jumpLevel: number
  geometry: ContinuousMapRouteGeometry
}

interface RouteLabelOptions {
  routes: readonly LabelCandidate[]
  selectedRouteId: string | null
  viewport: MapViewport
  viewportRect: SvgViewportRect
  svgPixelScale: number
  /** Occupied rectangles in the SVG viewport's coordinate system. */
  obstacles?: readonly SvgViewportRect[]
}

interface RouteLabel {
  text: string
  widthPixels: number
}

export const CONTINUOUS_ROUTE_LABEL_HEIGHT_PIXELS = 19
const LABEL_CLEARANCE_PIXELS = 4

/** Gives the selected route first claim on any in-view space available for its badge. */
export function placeContinuousMapRouteLabels({
  routes,
  selectedRouteId,
  viewport,
  viewportRect,
  svgPixelScale,
  obstacles = [],
}: RouteLabelOptions): ReadonlyMap<string, RouteLabel> {
  const labels = new Map<string, RouteLabel>()
  const occupied = [...obstacles]
  const selectedRoute = routes.find(route => route.id === selectedRouteId)
  const ordered = selectedRoute ? [selectedRoute, ...routes.filter(route => route !== selectedRoute)] : routes
  const clearance = LABEL_CLEARANCE_PIXELS / svgPixelScale
  for (const { id, jumpLevel, geometry } of ordered) {
    const text = clusterRoutePresentationLabel(jumpLevel)
    const widthPixels = Math.max(54, text.length * 6.5 + 14)
    const pathSize = Math.max(geometry.bounds.width, geometry.bounds.height) * viewport.k * svgPixelScale
    if (pathSize < widthPixels + LABEL_CLEARANCE_PIXELS * 2) continue

    const width = widthPixels / svgPixelScale
    const height = CONTINUOUS_ROUTE_LABEL_HEIGHT_PIXELS / svgPixelScale
    const x = viewport.x + geometry.midpoint.x * viewport.k - width / 2
    const y = viewport.y + geometry.midpoint.y * viewport.k - height / 2
    if (x < viewportRect.x + clearance || x + width > viewportRect.x + viewportRect.width - clearance
      || y < viewportRect.y + clearance || y + height > viewportRect.y + viewportRect.height - clearance) continue
    if (occupied.some(rect => x < rect.x + rect.width + clearance && x + width + clearance > rect.x
      && y < rect.y + rect.height + clearance && y + height + clearance > rect.y)) continue

    occupied.push({ x, y, width, height })
    labels.set(id, { text, widthPixels })
  }
  return labels
}
