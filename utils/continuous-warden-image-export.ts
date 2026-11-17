import type { JumpCluster, Point, StarSystem } from '../domain/workspace'
import { buildContinuousWardenRouteGeometries } from './continuous-warden-routes'
import type { ContinuousWardenSystemProjection } from './continuous-map-projection'
import type { ContinuousMapRouteGeometry } from './continuous-map-route-geometry'
import type { MapViewport, SvgViewportRect } from './map-zoom'
import { CONTINUOUS_ROUTE_LABEL_HEIGHT_PIXELS, placeContinuousMapRouteLabels } from './continuous-map-route-labels'
import {
  CONTINUOUS_SYSTEM_NAME_FONT_PIXELS,
  CONTINUOUS_SYSTEM_NAME_LAYOUT_RING_COUNT,
  CONTINUOUS_SYSTEM_NAME_LAYOUT_RING_SPACING_PIXELS,
  CONTINUOUS_SYSTEM_NAME_VIEWPORT_MARGIN_PIXELS,
  continuousMapNameLabels,
} from './continuous-map-name-labels'
import {
  exportMapImageScene,
  type MapImageFormat,
  type MapImagePalette,
  type MapImageSceneFrame,
} from './map-image-export'
import {
  incidentRoutesForMapImage,
  mapImageBounds,
  mapImageScopeFrame,
  trimMapImageRoute,
  type MapImageScope,
} from './map-image-scope'
import { clusterRoutePresentationLabel } from './cluster-route-presentation'

const exportPadding = 24
const selectedRoutePrefixLength = 60
const selectedRouteGutter = selectedRoutePrefixLength + 8
const systemNameFontPixels = CONTINUOUS_SYSTEM_NAME_FONT_PIXELS
const routeLabelFontPixels = 11
const svgNamespace = 'http://www.w3.org/2000/svg'
const overviewDetailSystemIds: ReadonlySet<string> = new Set()
const objectGlyphs: Readonly<Record<string, string>> = Object.freeze({
  star: '✦',
  planet: '◉',
  moon: '☾',
  asteroid: '◆',
  belt: '⋯',
  station: '⌂',
  base: '▤',
  colony: '⚑',
  vessel: '△',
  derelict: '▽',
  'jump-point': '⊕',
  anomaly: '✧',
  nebula: '◌',
  hazard: '⚠',
  other: '◇',
})

interface ExportLabel {
  projection: ContinuousWardenSystemProjection
  anchor: Point
  centerX: number
  top: number
  width: number
  height: number
  fontSize: number
  hasLeader?: boolean
  leaderY?: number
}

export interface ContinuousWardenImageRequest {
  source: SVGSVGElement
  cluster: JumpCluster
  projections: readonly ContinuousWardenSystemProjection[]
  unresolvedExitPositions?: Readonly<Record<string, Point>>
  dimmedObjectIds?: readonly string[]
  scope: MapImageScope
  selectedSystemId?: string | null
  selectedRouteId?: string | null
  format: MapImageFormat
  palette: MapImagePalette
  viewport: MapViewport
  viewportRect: SvgViewportRect
  svgPixelScale: number
  detailSystemIds: ReadonlySet<string>
  isCurrent?: () => boolean
}

type ExportRouteGeometry = Pick<ContinuousMapRouteGeometry, 'start' | 'control1' | 'control2' | 'end' | 'path'>
  & Partial<Pick<ContinuousMapRouteGeometry, 'midpoint'>>

/** Builds the requested image from committed map projections and never reads live placement previews. */
export async function exportContinuousWardenMapImage(
  request: ContinuousWardenImageRequest,
): Promise<Blob | null> {
  const isCurrent = request.isCurrent ?? (() => true)
  if (!isCurrent()) return null
  const selected = request.scope === 'system'
    ? request.projections.find(projection => projection.id === request.selectedSystemId)
    : undefined
  if (request.scope === 'system' && !selected) {
    throw new Error('Choose a selected Star System before exporting that image scope.')
  }

  const detailSystemIds = request.scope === 'cluster'
    ? overviewDetailSystemIds
    : request.scope === 'system'
      ? new Set([selected!.id])
      : request.detailSystemIds
  const useViewportRouteScale = request.scope === 'viewport'
  const routes = buildContinuousWardenRouteGeometries({
    routes: request.cluster.routes,
    projections: request.projections,
    detailSystemIds,
    unresolvedExitPositions: request.unresolvedExitPositions,
    ...(useViewportRouteScale ? {
        display: {
          pixelsPerSceneUnit: request.viewport.k * request.svgPixelScale,
          fanOutLimitPixels: Math.min(
            96,
            Math.min(request.viewportRect.width, request.viewportRect.height) * request.svgPixelScale / 4,
          ),
        },
      } : {}),
  })
  const routeRecords = request.scope === 'system'
    ? incidentRoutesForMapImage(request.cluster.routes, selected!.id)
    : request.cluster.routes
  const routeGeometries = new Map([...routes].filter(([routeId]) => routeRecords.some(route => route.id === routeId)))
  const labels = layoutSystemNames(
    request.projections.filter(projection => request.scope !== 'system' || projection.id === selected!.id),
    request.scope === 'viewport' ? request.viewport : null,
    request.scope === 'viewport' ? request.svgPixelScale : 1,
    request.scope === 'viewport' ? request.viewportRect : null,
  )
  const viewportRouteLabels = request.scope === 'viewport'
    ? placeContinuousMapRouteLabels({
        routes: routeRecords.flatMap(route => {
          const geometry = routeGeometries.get(route.id)
          return geometry ? [{ id: route.id, jumpLevel: route.jumpLevel, geometry }] : []
        }),
        selectedRouteId: request.selectedRouteId ?? null,
        viewport: request.viewport,
        viewportRect: request.viewportRect,
        svgPixelScale: request.svgPixelScale,
        obstacles: labels.map(label => ({
          x: label.centerX - label.width / 2,
          y: label.top,
          width: label.width,
          height: label.height,
        })),
      })
    : null
  const frames = sceneFrames(request, selected, labels, routeRecords, routeGeometries)
  const frame = mapImageScopeFrame(request.scope, frames)
  const scale = request.scope === 'viewport' ? request.svgPixelScale : 1
  const outputWidth = request.scope === 'viewport'
    ? Math.max(1, Math.ceil(frame.width * scale))
    : Math.ceil(frame.width)
  const outputHeight = request.scope === 'viewport'
    ? Math.max(1, Math.ceil(frame.height * scale))
    : Math.ceil(frame.height)
  const exportFrame: MapImageSceneFrame = {
    ...frame,
    outputWidth,
    outputHeight,
    ariaLabel: imageAccessibleName(request, selected),
  }
  const dimmedObjectIds = new Set(request.dimmedObjectIds ?? [])
  const incidentRoutes = request.scope === 'system' ? new Set(routeRecords.map(route => route.id)) : new Set<string>()
  const sceneViewport = request.scope === 'viewport'
    ? request.viewport
    : { x: 0, y: 0, k: 1 }

  return exportMapImageScene(
    request.source,
    request.format,
    request.palette,
    exportFrame,
    clone => {
      const content = clone.querySelector<SVGGElement>('.cluster-map-content')
      if (!content) throw new Error('The continuous map is not ready to export.')
      const routeStyleSource = clone.querySelector<SVGPathElement>('.continuous-warden-route-layer .cluster-route-line')
      content.replaceChildren()
      if (request.scope === 'viewport') {
        content.setAttribute('transform', `translate(${request.viewport.x} ${request.viewport.y}) scale(${request.viewport.k})`)
      } else {
        content.removeAttribute('transform')
      }

      const background = createScopedElement(clone, 'rect', 'continuous-warden-export-background')
      background.setAttribute('x', String(frame.x))
      background.setAttribute('y', String(frame.y))
      background.setAttribute('width', String(frame.width))
      background.setAttribute('height', String(frame.height))
      background.setAttribute('fill', 'var(--map-bg)')
      background.setAttribute('aria-hidden', 'true')
      clone.insertBefore(background, content)

      const routeLayer = createScopedElement(routeStyleSource ?? clone, 'g', 'continuous-warden-route-layer')
      for (const attribute of Array.from(clone.attributes)) {
        if (attribute.name.startsWith('data-v-')) routeLayer.setAttribute(attribute.name, '')
      }
      for (const route of routeRecords) {
        const geometry = routeGeometries.get(route.id)
        if (!geometry) continue
        const incident = incidentRoutes.has(route.id)
        const path = incident
          ? trimMapImageRoute(geometry, route.fromSystemId === selected!.id ? 'start' : 'end', selectedRoutePrefixLength)
          : geometry
        const routeLabel = incident
          ? null
          : request.scope === 'viewport'
            ? viewportRouteLabels?.get(route.id)?.widthPixels ?? null
            : continuousRouteLabelWidth(route.jumpLevel)
        appendRoute(
          routeLayer,
          route,
          path,
          incident,
          routeLabel,
          sceneViewport,
          request.scope === 'viewport' ? request.svgPixelScale : 1,
          request.scope === 'cluster',
        )
      }
      content.append(routeLayer)

      const items = createScopedElement(clone, 'g', 'cluster-map-items')
      const systemIds = request.scope === 'system' ? new Set([selected!.id]) : null
      for (const projection of request.projections) {
        if (systemIds && !systemIds.has(projection.id)) continue
        const detailed = detailSystemIds.has(projection.id)
        appendSystem(items, projection, request.cluster.systems, detailed, request.scope, sceneViewport, request.svgPixelScale, dimmedObjectIds)
      }
      content.append(items)

      const nameLayer = createScopedElement(clone, 'g', 'continuous-warden-name-layer')
      if (request.scope === 'viewport') {
        nameLayer.setAttribute(
          'transform',
          `translate(${-request.viewport.x / request.viewport.k} ${-request.viewport.y / request.viewport.k}) scale(${1 / request.viewport.k})`,
        )
      }
      for (const label of labels) appendSystemName(nameLayer, label)
      content.append(nameLayer)
    },
    isCurrent,
  )
}

function sceneFrames(
  request: ContinuousWardenImageRequest,
  selected: ContinuousWardenSystemProjection | undefined,
  labels: readonly ExportLabel[],
  routes: readonly JumpCluster['routes'][number][],
  geometries: ReadonlyMap<string, ContinuousMapRouteGeometry>,
) {
  const routeBounds = routes.flatMap(route => {
    const geometry = geometries.get(route.id)
    if (!geometry || request.scope === 'system') return []
    const bounds = [geometry.bounds]
    bounds.push({
      x: geometry.midpoint.x - continuousRouteLabelWidth(route.jumpLevel) / 2,
      y: geometry.midpoint.y - CONTINUOUS_ROUTE_LABEL_HEIGHT_PIXELS / 2,
      width: continuousRouteLabelWidth(route.jumpLevel),
      height: CONTINUOUS_ROUTE_LABEL_HEIGHT_PIXELS,
    })
    if (route.toSystemId === null && request.scope === 'cluster') {
      const exitText = `Unknown: ${route.unresolvedExit}`
      const width = estimateTextWidth(exitText, routeLabelFontPixels, 'Consolas, monospace')
      bounds.push({ x: geometry.end.x - width - 12, y: geometry.end.y - 20, width: width + 12, height: 26 })
    }
    return bounds
  })
  const labelBounds = labels.map(label => ({
    x: label.centerX - label.width / 2,
    y: label.top,
    width: label.width,
    height: label.height,
  }))
  const overview = mapImageBounds([
    ...request.projections.map(projection => projection.envelope),
    ...labelBounds,
    ...routeBounds,
  ]) ?? { x: 0, y: 0, width: 960, height: 560 }
  const selectedLabel = labels.find(label => label.projection.id === selected?.id)
  const selectedSystem = selected
    ? mapImageBounds([
        selected.envelope,
        selectedLabel ? {
          x: selectedLabel.centerX - selectedLabel.width / 2,
          y: selectedLabel.top,
          width: selectedLabel.width,
          height: selectedLabel.height,
        } : null,
      ])
    : null

  return {
    overview,
    selectedSystem,
    viewport: request.viewportRect,
    selectedSystemRouteGutter: selectedRouteGutter,
    padding: exportPadding,
  }
}

function layoutSystemNames(
  projections: readonly ContinuousWardenSystemProjection[],
  viewport: MapViewport | null,
  pixelScale: number,
  viewportRect: SvgViewportRect | null,
): ExportLabel[] {
  const placementViewport = viewport ?? { x: 0, y: 0, k: 1 }
  const placementRect = viewportRect ?? automaticNamePlacementViewportRect(projections)
  const scale = pixelScale > 0 ? pixelScale : 1
  const projectionsById = new Map(projections.map(projection => [projection.id, projection]))
  return continuousMapNameLabels({
    projections,
    viewport: placementViewport,
    viewportRect: placementRect,
    svgPixelScale: scale,
  }).flatMap(label => {
    const projection = projectionsById.get(label.id)
    return projection ? [{
      projection,
      anchor: { x: label.anchorX, y: label.anchorY },
      centerX: label.x,
      top: label.y,
      width: label.width,
      height: label.height,
      fontSize: systemNameFontPixels / scale,
      hasLeader: label.hasLeader,
      leaderY: label.y + label.height / 2,
    }] : []
  })
}

function automaticNamePlacementViewportRect(
  projections: readonly ContinuousWardenSystemProjection[],
): SvgViewportRect {
  const bounds = mapImageBounds(projections.map(projection => projection.envelope))
    ?? { x: 0, y: 0, width: 960, height: 560 }
  const widestLabel = Math.max(0, ...projections.map(projection =>
    estimateTextWidth(projection.name, systemNameFontPixels) + 24,
  ))
  const margin = widestLabel / 2
    + CONTINUOUS_SYSTEM_NAME_LAYOUT_RING_COUNT * CONTINUOUS_SYSTEM_NAME_LAYOUT_RING_SPACING_PIXELS
    + CONTINUOUS_SYSTEM_NAME_VIEWPORT_MARGIN_PIXELS + 32
  return {
    x: bounds.x - margin,
    y: bounds.y - margin,
    width: bounds.width + margin * 2,
    height: bounds.height + margin * 2,
  }
}

function appendSystem(
  parent: SVGElement,
  projection: ContinuousWardenSystemProjection,
  systems: readonly StarSystem[],
  detailed: boolean,
  scope: MapImageScope,
  viewport: MapViewport,
  svgPixelScale: number,
  dimmedObjectIds: ReadonlySet<string>,
): void {
  const group = createScopedElement(parent, 'g', 'continuous-warden-system')
  group.setAttribute('data-system-id', projection.id)
  const envelope = createScopedElement(parent, 'rect', `continuous-warden-system-envelope${detailed ? ' is-detailed' : ''}`)
  envelope.setAttribute('x', String(projection.envelope.x))
  envelope.setAttribute('y', String(projection.envelope.y))
  envelope.setAttribute('width', String(projection.envelope.width))
  envelope.setAttribute('height', String(projection.envelope.height))
  envelope.setAttribute('rx', '18')
  group.append(envelope)

  if (detailed) appendSystemDetail(group, projection, systems, dimmedObjectIds)

  const anchor = createScopedElement(parent, 'g', 'cluster-system-node continuous-warden-system-anchor')
  anchor.setAttribute('data-system-id', projection.id)
  const scale = scope === 'viewport' ? 1 / Math.max(0.0001, viewport.k * svgPixelScale) : 1
  anchor.setAttribute('transform', `translate(${projection.anchor.x} ${projection.anchor.y}) scale(${scale})`)
  const hitTarget = createScopedElement(parent, 'circle', 'continuous-warden-anchor-hit-target')
  hitTarget.setAttribute('r', '16')
  hitTarget.setAttribute('aria-hidden', 'true')
  const mark = createScopedElement(parent, 'circle', 'continuous-warden-anchor-mark')
  mark.setAttribute('r', '7')
  const core = createScopedElement(parent, 'circle', 'continuous-warden-anchor-core')
  core.setAttribute('r', '2')
  anchor.append(hitTarget, mark, core)
  group.append(anchor)
  parent.append(group)
}

function appendSystemDetail(
  parent: SVGElement,
  projection: ContinuousWardenSystemProjection,
  systems: readonly StarSystem[],
  dimmedObjectIds: ReadonlySet<string>,
): void {
  const system = systems.find(candidate => candidate.id === projection.id)
  if (!system) return
  const detail = createScopedElement(parent, 'g', 'continuous-warden-system-detail')
  detail.setAttribute(
    'transform',
    `translate(${projection.anchor.x - projection.localOrigin.x * projection.scale} ${projection.anchor.y - projection.localOrigin.y * projection.scale}) scale(${projection.scale})`,
  )
  const orbits = createScopedElement(parent, 'g', 'system-orbits')
  for (const orbit of projection.orbits) {
    const mark = createScopedElement(parent, 'ellipse', 'orbit-ring continuous-warden-orbit-target')
    mark.setAttribute('data-system-id', projection.id)
    mark.setAttribute('data-orbit-id', orbit.id)
    mark.setAttribute('cx', String(orbit.center.x))
    mark.setAttribute('cy', String(orbit.center.y))
    mark.setAttribute('rx', String(orbit.radii.horizontal))
    mark.setAttribute('ry', String(orbit.radii.vertical))
    mark.setAttribute('transform', `rotate(${orbit.rotation} ${orbit.center.x} ${orbit.center.y})`)
    mark.setAttribute('aria-hidden', 'true')
    orbits.append(mark)
  }
  detail.append(orbits)

  const items = createScopedElement(parent, 'g', 'system-map-items')
  for (const object of projection.objects) {
    const sourceObject = system.objects.find(candidate => candidate.id === object.id)
    if (!sourceObject) continue
    const mark = createScopedElement(parent, 'g', `continuous-warden-object${dimmedObjectIds.has(object.id) ? ' is-dimmed' : ''}`)
    mark.setAttribute('data-system-id', projection.id)
    mark.setAttribute('data-object-id', object.id)
    mark.setAttribute('transform', `translate(${object.position.x} ${object.position.y})`)
    mark.setAttribute('aria-hidden', 'true')
    if (sourceObject.subtype === 'star') {
      const halo = createScopedElement(parent, 'circle', 'continuous-warden-star-halo')
      halo.setAttribute('r', '18')
      mark.append(halo)
    }
    const glyph = createScopedElement(parent, 'text', 'continuous-warden-object-glyph')
    glyph.setAttribute('y', '8')
    glyph.setAttribute('text-anchor', 'middle')
    glyph.textContent = objectGlyphs[sourceObject.subtype] ?? '◇'
    const key = createScopedElement(parent, 'text', 'continuous-warden-object-key')
    key.setAttribute('y', '31')
    key.setAttribute('text-anchor', 'middle')
    key.textContent = object.locationKey
    const name = createScopedElement(parent, 'text', 'continuous-warden-object-name')
    name.setAttribute('y', '46')
    name.setAttribute('text-anchor', 'middle')
    name.textContent = object.name
    mark.append(glyph, key, name)
    items.append(mark)
  }
  detail.append(items)
  parent.append(detail)
}

function appendRoute(
  parent: SVGElement,
  route: JumpCluster['routes'][number],
  geometry: ExportRouteGeometry,
  incident: boolean,
  routeLabelWidthPixels: number | null,
  viewport: MapViewport,
  svgPixelScale: number,
  includeUnresolvedCaption: boolean,
): void {
  const routeMark = createScopedElement(parent, 'g', `cluster-route${route.toSystemId === null ? ' is-unresolved' : ''}`)
  routeMark.setAttribute('data-route-id', route.id)
  const path = createScopedElement(parent, 'path', 'cluster-route-line')
  path.setAttribute('d', geometry.path)
  path.setAttribute('aria-hidden', 'true')
  if (incident) path.setAttribute('stroke-dasharray', '8 7')
  routeMark.append(path)

  const midpoint = geometry.midpoint
    ? geometry.midpoint
    : { x: (geometry.start.x + geometry.end.x) / 2, y: (geometry.start.y + geometry.end.y) / 2 }
  if (routeLabelWidthPixels !== null) {
    const sceneScale = viewport.k * svgPixelScale
    const badge = createScopedElement(parent, 'g', 'continuous-warden-route-badge')
    badge.setAttribute('transform', `translate(${midpoint.x} ${midpoint.y}) scale(${1 / Math.max(0.0001, sceneScale)})`)
    const background = createScopedElement(parent, 'rect', 'cluster-route-label-bg')
    background.setAttribute('x', String(-routeLabelWidthPixels / 2))
    background.setAttribute('y', String(-CONTINUOUS_ROUTE_LABEL_HEIGHT_PIXELS / 2))
    background.setAttribute('width', String(routeLabelWidthPixels))
    background.setAttribute('height', String(CONTINUOUS_ROUTE_LABEL_HEIGHT_PIXELS))
    background.setAttribute('rx', '6')
    const label = createScopedElement(parent, 'text', 'cluster-route-label')
    label.setAttribute('dy', '0.34em')
    label.textContent = clusterRoutePresentationLabel(route.jumpLevel)
    badge.append(background, label)
    routeMark.append(badge)
  }

  if (route.toSystemId === null && !incident) {
    const marker = createScopedElement(parent, 'circle', 'cluster-exit-mark')
    marker.setAttribute('cx', String(geometry.end.x))
    marker.setAttribute('cy', String(geometry.end.y))
    marker.setAttribute('r', viewport.k !== 1 || svgPixelScale !== 1
      ? String(7 / Math.max(0.0001, viewport.k * svgPixelScale))
      : '7')
    marker.setAttribute('aria-hidden', 'true')
    routeMark.append(marker)
    if (includeUnresolvedCaption) {
      const exitLabel = createScopedElement(parent, 'text', 'cluster-exit-label')
      const scenePixelScale = Math.max(0.0001, viewport.k * svgPixelScale)
      const labelOffset = 12 / scenePixelScale
      exitLabel.setAttribute('x', String(geometry.end.x - labelOffset))
      exitLabel.setAttribute('y', String(geometry.end.y - labelOffset))
      exitLabel.setAttribute('font-family', 'Consolas, monospace')
      exitLabel.setAttribute('font-size', String(routeLabelFontPixels / scenePixelScale))
      exitLabel.setAttribute('text-anchor', 'end')
      exitLabel.textContent = `Unknown: ${route.unresolvedExit}`
      routeMark.append(exitLabel)
    }
  }
  parent.append(routeMark)
}

function continuousRouteLabelWidth(jumpLevel: number): number {
  const label = clusterRoutePresentationLabel(jumpLevel)
  return Math.max(54, label.length * 6.5 + 14)
}

function appendSystemName(parent: SVGElement, label: ExportLabel): void {
  const leader = createScopedElement(parent, 'line', 'continuous-warden-name-leader')
  leader.setAttribute('x1', String(label.anchor.x))
  leader.setAttribute('y1', String(label.anchor.y))
  leader.setAttribute('x2', String(label.centerX))
  const leaderY = label.leaderY ?? label.top + label.height
  leader.setAttribute('y2', String(leaderY))
  if (label.hasLeader ?? Math.hypot(label.centerX - label.anchor.x, leaderY - label.anchor.y) > 8) parent.append(leader)

  const target = createScopedElement(parent, 'g', 'cluster-system-node continuous-warden-name-target')
  target.setAttribute('data-system-id', label.projection.id)
  target.setAttribute('transform', `translate(${label.centerX} ${label.top})`)
  const background = createScopedElement(parent, 'rect', 'continuous-warden-name-background')
  background.setAttribute('x', String(-label.width / 2))
  background.setAttribute('width', String(label.width))
  background.setAttribute('height', String(label.height))
  background.setAttribute('rx', '5')
  const text = createScopedElement(parent, 'text', 'continuous-warden-system-name')
  text.setAttribute('font-size', String(label.fontSize))
  text.setAttribute('y', String(label.height * 0.68))
  text.setAttribute('text-anchor', 'middle')
  text.textContent = label.projection.name
  target.append(background, text)
  parent.append(target)
}

function imageAccessibleName(
  request: ContinuousWardenImageRequest,
  selected: ContinuousWardenSystemProjection | undefined,
): string {
  if (request.scope === 'system') return `${selected?.name ?? 'Star System'} map image`
  if (request.scope === 'viewport') return `${request.cluster.name} current viewport image`
  return `${request.cluster.name} Jump Cluster image`
}

function createScopedElement<Tag extends keyof SVGElementTagNameMap>(
  scopeSource: SVGElement,
  tag: Tag,
  className: string,
): SVGElementTagNameMap[Tag] {
  const element = scopeSource.ownerDocument.createElementNS(svgNamespace, tag) as SVGElementTagNameMap[Tag]
  for (const attribute of Array.from(scopeSource.attributes)) {
    if (attribute.name.startsWith('data-v-')) element.setAttribute(attribute.name, '')
  }
  element.setAttribute('class', className)
  return element
}

function estimateTextWidth(text: string, size: number, family = 'Georgia, serif'): number {
  const context = document.createElement('canvas').getContext('2d')
  if (!context) return Array.from(text).length * size * 0.62
  context.font = `600 ${size}px ${family}`
  return context.measureText(text).width
}
