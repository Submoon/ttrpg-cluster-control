import { clusterRoutePresentationLabel } from './cluster-route-presentation'
import type { ContinuousMapRouteGeometry } from './continuous-map-route-geometry'
import type { MapViewport, SvgViewportRect } from './map-zoom'
import type { Point } from '../domain/workspace'
import { continuousMapLabelSpace } from './continuous-map-caption-layout'
import { pointOnRoute } from './route-object-geometry'

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

export interface ContinuousMapRouteLabel {
  text: string
  widthPixels: number
  position: Point
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
}: RouteLabelOptions): ReadonlyMap<string, ContinuousMapRouteLabel> {
  const labels = new Map<string, ContinuousMapRouteLabel>()
  const space = continuousMapLabelSpace(viewportRect, svgPixelScale)
  for (const obstacle of obstacles) space.reserve(obstacle)
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
    for (const progress of [.5, .32, .68, .18, .82]) {
      const position = progress === .5 ? geometry.midpoint : pointOnRoute(geometry, progress)
      const bounds = {
        x: viewport.x + position.x * viewport.k - width / 2 - clearance,
        y: viewport.y + position.y * viewport.k - height / 2 - clearance,
        width: width + 2 * clearance,
        height: height + 2 * clearance,
      }
      if (!space.fits(bounds)) continue
      space.reserve(bounds)
      labels.set(id, { text, widthPixels, position })
      break
    }
  }
  return labels
}
