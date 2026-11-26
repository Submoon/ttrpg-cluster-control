import type { JumpCluster, Point, StarSystem } from '../domain/workspace'
import { buildContinuousWardenRouteGeometries } from './continuous-warden-routes'
import type { ContinuousWardenSystemProjection } from './continuous-map-projection'
import { continuousMapRouteCurve, type ContinuousMapRouteGeometry } from './continuous-map-route-geometry'
import { continuousSystemFrames } from './continuous-system-frames'
import type { MapViewport, SvgViewportRect } from './map-zoom'
import { CONTINUOUS_ROUTE_LABEL_HEIGHT_PIXELS, placeContinuousMapRouteLabels } from './continuous-map-route-labels'
import {
  CONTINUOUS_SYSTEM_NAME_FONT_PIXELS,
  CONTINUOUS_SYSTEM_NAME_LAYOUT_RING_COUNT,
  CONTINUOUS_SYSTEM_NAME_LAYOUT_RING_SPACING_PIXELS,
  CONTINUOUS_SYSTEM_NAME_VIEWPORT_MARGIN_PIXELS,
  continuousMapNameLabelFramePosition,
  continuousMapNameLabels,
} from './continuous-map-name-labels'
import type { MapImageFormat, MapImageSceneFrame } from './map-image-export'
import {
  incidentRoutesForMapImage,
  mapImageBounds,
  mapImageScopeFrame,
  trimMapImageRoute,
  type MapImageScope,
  type MapImageScopeFrames,
} from './map-image-scope'
import { clusterRoutePresentationLabel } from './cluster-route-presentation'
import { continuousSystemRouteCaptionLayouts, type ContinuousSystemRouteCaptionLayout } from './continuous-system-route-caption'

const exportPadding = 24
const systemExportPadding = 12
const systemExportSvgMaximumEdge = 1400
const systemExportPngMinimumScale = 6
const systemExportMaximumEdge = 4096
const selectedRoutePrefixLength = 60
const systemNameFontPixels = CONTINUOUS_SYSTEM_NAME_FONT_PIXELS
const routeLabelFontPixels = 11
const overviewDetailSystemIds: ReadonlySet<string> = new Set()

export interface ContinuousWardenImageSceneRequest {
  cluster: JumpCluster
  projections: readonly ContinuousWardenSystemProjection[]
  unresolvedExitPositions?: Readonly<Record<string, Point>>
  dimmedObjectIds?: readonly string[]
  scope: MapImageScope
  selectedSystemId?: string | null
  selectedRouteId?: string | null
  format: MapImageFormat
  viewport: MapViewport
  viewportRect: SvgViewportRect
  svgPixelScale: number
  detailSystemIds: ReadonlySet<string>
}

/** Browser text measurement is supplied by the serializer so this calculation stays synchronous and DOM-free. */
export interface ContinuousWardenImageSceneMeasurements {
  systemNameWidthPixels: (name: string) => number
  textWidth: (text: string, size: number, family?: string) => number
}

export interface ContinuousWardenImageSceneLabel {
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

export interface ContinuousWardenImageSceneSystem {
  projection: ContinuousWardenSystemProjection
  source?: StarSystem
  displayFrame: SvgViewportRect
  detailed: boolean
  visible: boolean
}

export interface ContinuousWardenImageSceneRoute {
  route: JumpCluster['routes'][number]
  /** Selected-system routes carry the pre-trimmed 60-unit prefix used for drawing and bounds. */
  renderGeometry?: Pick<ContinuousMapRouteGeometry, 'start' | 'control1' | 'control2' | 'end' | 'path'>
    & Partial<Pick<ContinuousMapRouteGeometry, 'midpoint'>>
  incident: boolean
  routeLabelWidthPixels: number | null
  systemCaption?: ContinuousSystemRouteCaptionLayout
}

interface PreparedImageSceneRoute extends ContinuousWardenImageSceneRoute {
  geometry?: ContinuousMapRouteGeometry
  fixedBounds: readonly SvgViewportRect[]
}

export interface ContinuousWardenImageScene {
  scope: MapImageScope
  selected?: ContinuousWardenSystemProjection
  systems: readonly ContinuousWardenImageSceneSystem[]
  routes: readonly ContinuousWardenImageSceneRoute[]
  labels: readonly ContinuousWardenImageSceneLabel[]
  frame: MapImageSceneFrame
  scale: number
  sceneViewport: MapViewport
  routeSvgPixelScale: number
  systemSvgPixelScale: number
  includeUnresolvedCaption: boolean
  dimmedObjectIds: ReadonlySet<string>
  title: string
}

type ExportRouteGeometry = NonNullable<ContinuousWardenImageSceneRoute['renderGeometry']>

interface SceneFrameCalculation {
  frame: MapImageScopeFrames
  captions: ReadonlyMap<string, ContinuousSystemRouteCaptionLayout>
}

/** Prepares the deterministic, Warden-only geometry and typography inputs used by image serialization. */
export function prepareContinuousWardenImageScene(
  request: ContinuousWardenImageSceneRequest,
  measurements: ContinuousWardenImageSceneMeasurements,
): ContinuousWardenImageScene {
  const selected = request.scope === 'system'
    ? request.projections.find(projection => projection.id === request.selectedSystemId)
    : undefined
  if (request.scope === 'system' && !selected) {
    throw new Error('Choose a selected Zone before exporting that image scope.')
  }

  const detailSystemIds = request.scope === 'cluster'
    ? overviewDetailSystemIds
    : request.scope === 'system'
      ? new Set([selected!.id])
      : request.detailSystemIds
  const displayFrames = continuousSystemFrames(request.projections.map(projection => ({
    id: projection.id,
    anchor: projection.anchor,
    envelope: projection.preferredFrame ?? projection.envelope,
  })))
  const exportFrames = new Map(displayFrames)
  if (request.scope === 'system' && selected) {
    // Detail exports use the actual content bounds instead of the editor's preferred frame.
    exportFrames.set(selected.id, selected.envelope)
  }

  // Route geometry is built from the complete graph before applying the selected-system filter.
  const allRouteGeometries = buildContinuousWardenRouteGeometries({
    routes: request.cluster.routes,
    projections: request.projections,
    detailSystemIds,
    frames: exportFrames,
    unresolvedExitPositions: request.unresolvedExitPositions,
    ...(request.scope === 'viewport' ? {
        display: {
          pixelsPerSceneUnit: request.viewport.k * request.svgPixelScale,
          fanOutLimitPixels: Math.min(
            96,
            Math.min(request.viewportRect.width, request.viewportRect.height) * request.svgPixelScale / 4,
          ),
        },
      } : {}),
  })
  const sourceRoutes = request.scope === 'system'
    ? incidentRoutesForMapImage(request.cluster.routes, selected!.id)
    : request.cluster.routes
  const routes = sourceRoutes.map((route): PreparedImageSceneRoute => {
    const geometry = allRouteGeometries.get(route.id)
    const incident = request.scope === 'system'
    const renderGeometry = geometry
      ? incident
        ? trimMapImageRoute(geometry, route.fromSystemId === selected!.id ? 'start' : 'end', selectedRoutePrefixLength)
        : geometry
      : undefined
    const fixedBounds: SvgViewportRect[] = []
    if (geometry && renderGeometry) {
      if (request.scope === 'system') {
        fixedBounds.push(cubicBounds(renderGeometry))
      } else {
        fixedBounds.push(geometry.bounds)
        const width = continuousRouteLabelWidth(route.jumpLevel)
        fixedBounds.push({
          x: geometry.midpoint.x - width / 2,
          y: geometry.midpoint.y - CONTINUOUS_ROUTE_LABEL_HEIGHT_PIXELS / 2,
          width,
          height: CONTINUOUS_ROUTE_LABEL_HEIGHT_PIXELS,
        })
        if (route.toSystemId === null && request.scope === 'cluster') {
          const exitText = `Unknown: ${route.unresolvedExit}`
          const exitWidth = measurements.textWidth(exitText, routeLabelFontPixels, 'Consolas, monospace')
          fixedBounds.push({ x: geometry.end.x - exitWidth - 12, y: geometry.end.y - 20, width: exitWidth + 12, height: 26 })
        }
      }
    }
    return {
      route,
      geometry,
      renderGeometry,
      incident,
      routeLabelWidthPixels: incident
        ? null
        : request.scope === 'viewport'
          ? null
          : continuousRouteLabelWidth(route.jumpLevel),
      fixedBounds,
    }
  })

  const labels = layoutSystemNames(
    request.projections.filter(projection => request.scope !== 'system' || projection.id === selected!.id),
    request.scope === 'viewport' ? request.viewport : null,
    request.scope === 'viewport' ? request.svgPixelScale : 1,
    request.scope === 'viewport' ? request.viewportRect : null,
    request.scope === 'system' ? exportFrames : displayFrames,
    detailSystemIds,
    request.scope === 'system',
    measurements,
  )

  const initialCalculation = calculateSceneFrames(
    request,
    selected,
    request.scope === 'system' ? [] : labels,
    routes,
    displayFrames,
    request.scope === 'system' ? null : 1,
    measurements,
  )
  const initialFrame = mapImageScopeFrame(request.scope, initialCalculation.frame!)
  let scale = request.scope === 'system'
    ? systemSvgOutputScale(initialFrame)
    : request.scope === 'viewport' ? request.svgPixelScale : 1
  let imageLabels = request.scope === 'system'
    ? labels.map(label => scaleSystemNameForExport(label, selected!, scale))
    : [...labels]
  const viewportRouteLabels = request.scope === 'viewport'
    ? placeContinuousMapRouteLabels({
        routes: routes.flatMap(route => route.geometry
          ? [{ id: route.route.id, jumpLevel: route.route.jumpLevel, geometry: route.geometry }]
          : []),
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

  let finalCalculation = request.scope === 'system'
    ? calculateSceneFrames(request, selected, imageLabels, routes, displayFrames, scale, measurements)
    : initialCalculation
  let frame = mapImageScopeFrame(request.scope, finalCalculation.frame!)
  if (request.scope === 'system') {
    // Text bounds and camera-independent SVG scale depend on each other; keep the legacy bounded fit.
    for (let iteration = 0; iteration < 24; iteration += 1) {
      const nextScale = systemSvgOutputScale(frame)
      if (Math.abs(nextScale - scale) < 0.001) break
      scale = nextScale
      imageLabels = labels.map(label => scaleSystemNameForExport(label, selected!, scale))
      finalCalculation = calculateSceneFrames(request, selected, imageLabels, routes, displayFrames, scale, measurements)
      frame = mapImageScopeFrame(request.scope, finalCalculation.frame!)
    }
  }

  const outputScale = request.scope === 'system' && request.format === 'png'
    ? systemPngOutputScale(frame, scale)
    : scale
  const title = imageAccessibleName(request, selected)
  const exportFrame: MapImageSceneFrame = {
    ...frame,
    outputWidth: Math.max(1, Math.ceil(frame.width * outputScale)),
    outputHeight: Math.max(1, Math.ceil(frame.height * outputScale)),
    ariaLabel: title,
  }
  const preparedRoutes = routes.map(route => ({
    route: route.route,
    renderGeometry: route.renderGeometry,
    incident: route.incident,
    routeLabelWidthPixels: route.routeLabelWidthPixels,
    ...(finalCalculation.captions.get(route.route.id)
      ? { systemCaption: finalCalculation.captions.get(route.route.id)! }
      : {}),
    ...(request.scope === 'viewport'
      ? { routeLabelWidthPixels: viewportRouteLabels?.get(route.route.id)?.widthPixels ?? null }
      : {}),
  }))
  const systemsById = new Map(request.cluster.systems.map(system => [system.id, system]))
  const systems = request.projections.map(projection => ({
    projection,
    source: systemsById.get(projection.id),
    displayFrame: displayFrames.get(projection.id) ?? projection.envelope,
    detailed: detailSystemIds.has(projection.id),
    visible: request.scope !== 'system' || projection.id === selected!.id,
  }))

  return {
    scope: request.scope,
    selected,
    systems,
    routes: preparedRoutes,
    labels: imageLabels,
    frame: exportFrame,
    scale,
    sceneViewport: request.scope === 'viewport' ? request.viewport : { x: 0, y: 0, k: 1 },
    routeSvgPixelScale: request.scope === 'viewport' ? request.svgPixelScale : request.scope === 'system' ? scale : 1,
    systemSvgPixelScale: request.scope === 'system' ? scale : request.svgPixelScale,
    includeUnresolvedCaption: request.scope === 'cluster',
    dimmedObjectIds: new Set(request.scope === 'viewport' ? request.dimmedObjectIds : undefined),
    title,
  }
}

function scaleSystemNameForExport(
  label: ContinuousWardenImageSceneLabel,
  selected: ContinuousWardenSystemProjection,
  outputScale: number,
): ContinuousWardenImageSceneLabel {
  const scale = Number.isFinite(outputScale) && outputScale > 0 ? outputScale : 1
  const titleScale = Math.min(1, (systemExportSvgMaximumEdge * 0.82) / label.width)
  const height = label.height * titleScale / scale
  const width = label.width * titleScale / scale
  return {
    ...label,
    centerX: selected.envelope.x + width / 2 + 8 / scale,
    top: selected.envelope.y - height - 12 / scale,
    width,
    height,
    fontSize: label.fontSize * titleScale / scale,
    hasLeader: false,
    leaderY: selected.envelope.y - 6 / scale,
  }
}

function systemSvgOutputScale(frame: SvgViewportRect): number {
  const longestEdge = Math.max(frame.width, frame.height)
  return Number.isFinite(longestEdge) && longestEdge > 0
    ? systemExportSvgMaximumEdge / longestEdge
    : 1
}

function systemPngOutputScale(frame: SvgViewportRect, svgScale: number): number {
  const longestEdge = Math.max(frame.width, frame.height)
  if (!Number.isFinite(longestEdge) || longestEdge <= 0) return svgScale
  return Math.min(
    Math.max(systemExportPngMinimumScale, svgScale * 2),
    systemExportMaximumEdge / longestEdge,
  )
}

function calculateSceneFrames(
  request: ContinuousWardenImageSceneRequest,
  selected: ContinuousWardenSystemProjection | undefined,
  labels: readonly ContinuousWardenImageSceneLabel[],
  routes: readonly PreparedImageSceneRoute[],
  displayFrames: ReadonlyMap<string, SvgViewportRect>,
  systemTextScale: number | null,
  measurements: ContinuousWardenImageSceneMeasurements,
): SceneFrameCalculation {
  const selectedLabel = labels.find(label => label.projection.id === selected?.id)
  const titleObstacles = selectedLabel ? [systemNameBounds(selectedLabel)] : []
  const captions = selected && request.scope === 'system' && systemTextScale !== null
    ? selectedSystemRouteCaptions(request, selected, routes, systemTextScale, titleObstacles)
    : new Map<string, ContinuousSystemRouteCaptionLayout>()
  const routeBounds = request.scope === 'viewport' ? [] : routes.flatMap(route => [
    ...route.fixedBounds,
    ...(captions.has(route.route.id) ? [captions.get(route.route.id)!.bounds] : []),
  ])
  const overview = request.scope === 'cluster'
    ? mapImageBounds([
        ...request.projections.map(projection => projection.envelope),
        ...[...displayFrames.values()],
        ...labels.map(label => ({
          x: label.centerX - label.width / 2,
          y: label.top,
          width: label.width,
          height: label.height,
        })),
        ...routeBounds,
      ]) ?? { x: 0, y: 0, width: 960, height: 560 }
    : null
  const selectedSystem = request.scope === 'system' && selected
    ? mapImageBounds([
        selected.envelope,
        ...(systemTextScale !== null
          ? systemDetailTextBounds(selected, systemTextScale, measurements)
          : []),
        ...routeBounds,
        selectedLabel ? {
          x: selectedLabel.centerX - selectedLabel.width / 2,
          y: selectedLabel.top,
          width: selectedLabel.width,
          height: selectedLabel.height,
        } : null,
      ])
    : null

  return {
    frame: {
      overview,
      selectedSystem,
      viewport: request.scope === 'viewport' ? request.viewportRect : null,
      selectedSystemRouteGutter: 0,
      padding: request.scope === 'system' ? systemExportPadding : exportPadding,
    },
    captions,
  }
}

function systemDetailTextBounds(
  projection: ContinuousWardenSystemProjection,
  outputScale: number,
  measurements: ContinuousWardenImageSceneMeasurements,
): SvgViewportRect[] {
  const scale = Number.isFinite(outputScale) && outputScale > 0 ? outputScale : 1
  return projection.objects.flatMap(object => {
    const outputBaseline = (localY: number) => object.scenePosition.y + localY / scale
    const textBounds = (
      text: string,
      fontSize: number,
      family: string,
      baseline: number,
    ): SvgViewportRect => {
      const width = Math.max(fontSize, measurements.textWidth(text, fontSize, family)) / scale
      const height = fontSize * 1.55 / scale
      return {
        x: object.scenePosition.x - width / 2,
        y: baseline - fontSize * 1.2 / scale,
        width,
        height,
      }
    }
    return [
      textBounds('⚠', 20, 'Consolas, monospace', outputBaseline(8)),
      textBounds(object.locationKey, 9, 'Consolas, monospace', outputBaseline(31)),
      textBounds(object.name, 12, 'Georgia, serif', outputBaseline(46)),
    ]
  })
}

function cubicBounds(geometry: ExportRouteGeometry): SvgViewportRect {
  return continuousMapRouteCurve(
    geometry.start,
    geometry.control1,
    geometry.control2,
    geometry.end,
  ).bounds
}

function layoutSystemNames(
  projections: readonly ContinuousWardenSystemProjection[],
  viewport: MapViewport | null,
  pixelScale: number,
  viewportRect: SvgViewportRect | null,
  displayFrames: ReadonlyMap<string, SvgViewportRect>,
  detailSystemIds: ReadonlySet<string>,
  placeSelectedDetailName: boolean,
  measurements: ContinuousWardenImageSceneMeasurements,
): ContinuousWardenImageSceneLabel[] {
  const placementViewport = viewport ?? { x: 0, y: 0, k: 1 }
  const scale = pixelScale > 0 ? pixelScale : 1
  const projectionsById = new Map(projections.map(projection => [projection.id, projection]))
  const labelProjections = projections.map(projection => ({
    ...projection,
    envelope: positiveFrame(displayFrames.get(projection.id))
      ? displayFrames.get(projection.id)!
      : projection.envelope,
  }))
  const placementRect = viewportRect ?? automaticNamePlacementViewportRect(labelProjections, measurements)
  return continuousMapNameLabels({
    projections: labelProjections,
    viewport: placementViewport,
    viewportRect: placementRect,
    svgPixelScale: scale,
    getNameWidthPixels: measurements.systemNameWidthPixels,
  }).flatMap(label => {
    const projection = projectionsById.get(label.id)
    if (!projection) return []
    const frame = displayFrames.get(projection.id)
    const resolvedFrame = positiveFrame(frame) ? frame : projection.envelope
    const progress = Number(!!viewport && detailSystemIds.has(projection.id))
    const position = placeSelectedDetailName
      ? { x: projection.envelope.x + projection.envelope.width / 2, y: projection.envelope.y - label.height - 12 }
      : viewport
        ? continuousMapNameLabelFramePosition(label, resolvedFrame, viewport, scale, progress, placementRect)
        : { x: label.x, y: label.y }
    return [{
      projection,
      anchor: { x: label.anchorX, y: label.anchorY },
      centerX: position.x,
      top: position.y,
      width: label.width,
      height: label.height,
      fontSize: systemNameFontPixels / scale,
      hasLeader: !placeSelectedDetailName && label.hasLeader && progress < .12,
      leaderY: position.y + label.height / 2,
    }]
  })
}

function positiveFrame(frame: SvgViewportRect | undefined): frame is SvgViewportRect {
  return !!frame && Number.isFinite(frame.width) && Number.isFinite(frame.height)
    && frame.width > 0 && frame.height > 0
}

function automaticNamePlacementViewportRect(
  projections: readonly ContinuousWardenSystemProjection[],
  measurements: ContinuousWardenImageSceneMeasurements,
): SvgViewportRect {
  const bounds = mapImageBounds(projections.map(projection => projection.envelope))
    ?? { x: 0, y: 0, width: 960, height: 560 }
  const widestLabel = Math.max(0, ...projections.map(projection =>
    measurements.textWidth(projection.name, systemNameFontPixels) + 24,
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

function selectedSystemRouteCaptions(
  request: ContinuousWardenImageSceneRequest,
  selected: ContinuousWardenSystemProjection,
  routes: readonly PreparedImageSceneRoute[],
  pixelsPerSceneUnit: number,
  obstacles: readonly SvgViewportRect[] = [],
): Map<string, ContinuousSystemRouteCaptionLayout> {
  const inputs = routes.flatMap((prepared) => {
    const geometry = prepared.geometry
    const prefix = prepared.renderGeometry
    if (!geometry || !prefix) return []
    return [{
      id: prepared.route.id,
      request: {
        jumpLevel: prepared.route.jumpLevel,
        destinationLabel: systemRouteDestination(request, prepared.route, selected),
        selectedAnchor: selected.anchor,
        remoteEndpoint: prefix.end,
      },
    }]
  })
  const captions = continuousSystemRouteCaptionLayouts(inputs.map(input => input.request), pixelsPerSceneUnit, obstacles)
  return new Map(inputs.map((input, index) => [input.id, captions[index]!]))
}

function systemRouteDestination(
  request: ContinuousWardenImageSceneRequest,
  route: JumpCluster['routes'][number],
  selected: ContinuousWardenSystemProjection,
): string {
  if (route.toSystemId === null) return `Unknown: ${route.unresolvedExit}`
  const remoteSystemId = route.toSystemId === selected.id ? route.fromSystemId : route.toSystemId
  return request.cluster.systems.find(system => system.id === remoteSystemId)?.name ?? 'Zone'
}

function systemNameBounds(label: ContinuousWardenImageSceneLabel): SvgViewportRect {
  return {
    x: label.centerX - label.width / 2,
    y: label.top,
    width: label.width,
    height: label.height,
  }
}

function continuousRouteLabelWidth(jumpLevel: number): number {
  const label = clusterRoutePresentationLabel(jumpLevel)
  return Math.max(54, label.length * 6.5 + 14)
}

function imageAccessibleName(
  request: ContinuousWardenImageSceneRequest,
  selected: ContinuousWardenSystemProjection | undefined,
): string {
  if (request.scope === 'system') return `${selected?.name ?? 'Zone'} map image`
  if (request.scope === 'viewport') return `${request.cluster.name} current viewport image`
  return `${request.cluster.name} Jump Cluster image`
}
