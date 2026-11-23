/** Serializes continuous map images exclusively from a detached player document and public view state. */
import type { PlayerClusterDocument, PlayerObjectMarker, PlayerSystemMarker } from '../domain/player-projection'
import type { MapImagePalette } from './map-image-export'
import type { MapViewport, SvgViewportRect } from './map-zoom'
import {
  incidentRoutesForMapImage,
  mapImageBounds,
  mapImageScopeFrame,
  trimMapImageRoute,
  type MapImageBounds,
  type MapImageRoutePrefix,
} from './map-image-scope'
import { rotatedEllipseBounds } from './continuous-map-history-reveal'
import { playerMapPaint, type PlayerMapPaint } from './player-map-image-export'
import {
  layoutPlayerContinuousNameLabels,
  playerContinuousTargetBounds,
  type PlayerContinuousNameLabel,
} from './player-continuous-map-layout'
import {
  CONTINUOUS_SYSTEM_NAME_FONT_PIXELS as fontPixels,
  continuousMapNameLabelFramePosition,
} from './continuous-map-name-labels'
import { projectPlayerContinuousMap, type PlayerContinuousSystemProjection } from './player-continuous-map-projection'
import { projectPlayerContinuousRouteEndpoints, type PlayerContinuousRouteDescriptor } from './player-continuous-route-projection'
import { buildContinuousMapRouteGeometries, type ContinuousMapRouteGeometry } from './continuous-map-route-geometry'
import { continuousSystemFrames } from './continuous-system-frames'
import { CONTINUOUS_ROUTE_LABEL_HEIGHT_PIXELS, placeContinuousMapRouteLabels } from './continuous-map-route-labels'
import { CLUSTER_ROUTE_PRESENTATION } from './cluster-route-presentation'
import { PLAYER_CLUSTER_UNKNOWN_MARKER_RADIUS } from './cluster-system-presentation'
import { playerObjectPresentation } from './player-object-presentation'

const exportPadding = 24
const routeStubLength = 60
const identityCamera = { x: 0, y: 0, k: 1 }
const fallbackBounds = { x: 0, y: 0, width: 960, height: 560 }
const anonymousCaption = 'Unknown destination'
const anonymousBounds = { x: -9, y: -10, width: 151, height: 22 }
const fixedStroke = { 'vector-effect': 'non-scaling-stroke' }

interface ImageRoute extends PlayerContinuousRouteDescriptor {
  geometry: ContinuousMapRouteGeometry
  stub?: MapImageRoutePrefix
}

/** Applied public paint inputs captured from a single mounted map. */
export interface PlayerImageViewportSnapshot {
  camera: MapViewport
  drawable: SvgViewportRect
  nameViewport: SvgViewportRect
  svgPixelScale: number
  detailSystemIds: readonly string[]
  dimmedObjects: { systemId: string; ids: readonly string[] } | null
  selectedRouteId: string | null
}

export type ContinuousPlayerImageScope =
  | { scope: 'cluster' }
  | { scope: 'system'; systemId: string }
  | { scope: 'viewport'; snapshot: PlayerImageViewportSnapshot }

export function serializeContinuousPlayerMapImage(
  document: PlayerClusterDocument,
  image: ContinuousPlayerImageScope,
  palette: MapImagePalette,
): { svg: string; width: number; height: number } {
  const paint = playerMapPaint(palette)
  const { systems } = projectPlayerContinuousMap(document)
  const selected = image.scope === 'system' ? systems.find(system => system.id === image.systemId) : undefined
  if (image.scope === 'system' && (selected?.disclosure !== 'revealed' || !selected.geometry)) {
    throw new Error('Select a Revealed public system before exporting that image scope.')
  }
  const snapshot = image.scope === 'viewport' ? image.snapshot : undefined
  const camera = snapshot?.camera ?? identityCamera
  const svgPixelScale = snapshot?.svgPixelScale ?? 1
  const scenePixelScale = camera.k * svgPixelScale
  const displayedSystems = selected ? [selected] : systems
  const publicMarkers = new Map(document.systems.map(marker => [marker.id, marker]))
  const selectedContentBounds = selected
    ? systemInteriorBounds(selected, publicMarkers.get(selected.id))
    : null
  const displayFrames = continuousSystemFrames(systems.flatMap(system => system.geometry ? [{
    id: system.id,
    anchor: system.anchor,
    envelope: system.geometry.envelope,
  }] : []))
  const detailIds = new Set(snapshot?.detailSystemIds ?? (selected?.geometry ? [selected.id] : []))
  const descriptors = projectPlayerContinuousRouteEndpoints(document, systems, detailIds, scenePixelScale)
  const geometries = buildContinuousMapRouteGeometries(descriptors, snapshot ? {
    pixelsPerSceneUnit: scenePixelScale,
    fanOutLimitPixels: Math.min(96, Math.min(snapshot.nameViewport.width, snapshot.nameViewport.height) * svgPixelScale / 4),
  } : undefined)
  const displayedRoutes = selected ? incidentRoutesForMapImage(descriptors, selected.id) : descriptors
  const routes = displayedRoutes.flatMap((route): ImageRoute[] => {
    const geometry = geometries.get(route.id)
    if (!geometry) return []
    const stub = selected
      ? trimMapImageRoute(geometry, route.fromSystemId === selected.id ? 'start' : 'end', routeStubLength)
      : undefined
    return [{ ...route, geometry, ...(stub ? { stub } : {}) }]
  })
  const geometryBounds = snapshot?.drawable ?? mapImageBounds([
    ...(selected
      ? [selectedContentBounds, ...routes.map(route => routeStubBounds(route.stub!))]
      : displayedSystems.map(systemImageBounds)),
    ...(selected ? [] : routes.flatMap(route => [
      route.geometry.bounds,
      route.unresolved ? {
        ...anonymousBounds,
        x: route.geometry.end.x + anonymousBounds.x,
        y: route.geometry.end.y + anonymousBounds.y,
      } : null,
    ])),
  ]) ?? (selected ? pointBounds(selected.anchor) : fallbackBounds)
  const nameViewport = snapshot?.nameViewport ?? automaticNameViewport(displayedSystems, geometryBounds)
  const nameSystems = snapshot
    ? displayedSystems.map((system) => {
        if (!system.geometry) return system
        const frame = displayFrames.get(system.id)
        return {
          ...system,
          geometry: {
            ...system.geometry,
            envelope: positiveFrame(frame) ? frame : system.geometry.envelope,
          },
        }
      })
    : displayedSystems
  const nameSystemsById = new Map(nameSystems.map(system => [system.id, system]))
  const names = layoutPlayerContinuousNameLabels(
    nameSystems, camera, svgPixelScale, nameViewport,
  ).map((label) => {
    if (selected) {
      const centerX = selectedContentBounds
        ? selectedContentBounds.x + selectedContentBounds.width / 2
        : selected.anchor.x
      const contentTop = selectedContentBounds?.y ?? selected.anchor.y
      return {
        ...label,
        x: centerX,
        y: contentTop - label.height - 8,
        hasLeader: false,
      }
    }
    const frame = snapshot ? nameSystemsById.get(label.systemId)?.geometry?.envelope : undefined
    if (!frame) return label
    const progress = Number(detailIds.has(label.systemId))
    return {
      ...label,
      ...continuousMapNameLabelFramePosition(label, frame, camera, svgPixelScale, progress, nameViewport),
      hasLeader: label.hasLeader && progress < .12,
    }
  })
  const overviewCandidates = selected && !selectedContentBounds && routes.length === 0
    ? names.map(nameBounds)
    : [geometryBounds, ...names.map(nameBounds)]
  const overview = mapImageBounds(overviewCandidates) ?? geometryBounds
  const frame = mapImageScopeFrame(image.scope, {
    overview,
    selectedSystem: selected ? overview : null,
    viewport: snapshot?.drawable ?? null,
    selectedSystemRouteGutter: 0,
    padding: exportPadding,
  })
  const routeLabels = selected ? null : placeContinuousMapRouteLabels({
    routes,
    selectedRouteId: snapshot?.selectedRouteId ?? null,
    viewport: camera,
    viewportRect: snapshot?.nameViewport ?? frame,
    svgPixelScale,
    obstacles: names.map(nameBounds),
  })
  const dimmed = new Set(snapshot?.dimmedObjects?.ids)
  const scene = [
    ...routes.map(route => selected
      ? routeStubSvg(route, paint)
      : routeSvg(route, routeLabels?.get(route.id), scenePixelScale, paint)),
    ...displayedSystems.map(system => systemSvg(
      system,
      selected ? undefined : displayFrames.get(system.id),
      detailIds.has(system.id),
      publicMarkers.get(system.id),
      scenePixelScale,
      paint,
      snapshot?.dimmedObjects?.systemId === system.id ? dimmed : undefined,
      !selected,
    )),
  ].join('')
  const destinations = selected ? '' : routes.filter(route => route.unresolved)
    .map(route => anonymousExitSvg(route.geometry.end, scenePixelScale, paint)).join('')
  const body = [
    worldLayer(scene, snapshot?.camera),
    ...names.map(name => nameSvg(name, svgPixelScale, paint)),
    // Keep anonymous exits in front of opaque system marks even when their published coordinates coincide.
    worldLayer(destinations, snapshot?.camera),
  ].join('')
  const title = selected
    ? `${selected.label} player map`
    : `${document.title} player map — ${snapshot ? 'Current viewport' : 'Entire Cluster'}`
  return rootSvg(frame, svgPixelScale, title, body, paint)
}

function worldLayer(content: string, camera: MapViewport | undefined): string {
  return content && camera
    ? svgElement('g', { transform: `translate(${camera.x} ${camera.y}) scale(${camera.k})` }, content)
    : content
}

function automaticNameViewport(systems: readonly PlayerContinuousSystemProjection[], bounds: MapImageBounds): MapImageBounds {
  const widest = Math.max(72, ...systems.map(system => Array.from(system.label).length * fontPixels * .65 + 24))
  const margin = widest / 2 + 160
  return { x: bounds.x - margin, y: bounds.y - margin, width: bounds.width + 2 * margin, height: bounds.height + 2 * margin }
}

function nameBounds(name: PlayerContinuousNameLabel): MapImageBounds {
  return { x: name.x - name.width / 2, y: name.y, width: name.width, height: name.height }
}

function markerRadius(system: PlayerContinuousSystemProjection): number {
  if (system.disclosure === 'unknown') return PLAYER_CLUSTER_UNKNOWN_MARKER_RADIUS
  return system.disclosure === 'known-type' ? 12 : 9
}

function systemImageBounds(system: PlayerContinuousSystemProjection): MapImageBounds {
  if (system.geometry) return system.geometry.envelope
  const radius = markerRadius(system)
  return { x: system.anchor.x - radius, y: system.anchor.y - radius, width: radius * 2, height: radius * 2 }
}

function systemInteriorBounds(
  system: PlayerContinuousSystemProjection,
  marker: PlayerSystemMarker | undefined,
): MapImageBounds | null {
  if (!system.geometry || marker?.disclosure !== 'revealed') return null
  const positions = new Map(system.geometry.objects.map(object => [object.id, object.scenePosition]))
  const objects = marker.map.objects.flatMap(object => {
    const position = positions.get(object.id)
    const targetBounds = playerContinuousTargetBounds(system.geometry!, { kind: 'object', id: object.id })
    if (!position || !targetBounds) return []
    // The focused-map helper is intentionally compact; exports preserve the older conservative
    // allowance for the larger Georgia labels painted into the SVG.
    const labelWidth = Array.from(playerObjectPresentation(object).label).length * 12
    const renderedLabelBounds = {
      x: position.x - 10,
      y: position.y - 16,
      width: labelWidth + 19,
      height: 26,
    }
    const bounds = mapImageBounds([targetBounds, renderedLabelBounds])
    return bounds ? [bounds] : []
  })
  const orbits = system.geometry.orbits.map(orbit => {
    return rotatedEllipseBounds(orbit.sceneCenter, orbit.sceneRadii, orbit.rotation, 2)
  })
  return mapImageBounds([...objects, ...orbits])
}

function routeStubBounds(prefix: MapImageRoutePrefix): MapImageBounds {
  return mapImageBounds([
    prefix.start,
    prefix.control1,
    prefix.control2,
    prefix.end,
  ].map(point => ({ ...point, width: 0, height: 0 })))!
}

function pointBounds(point: { x: number; y: number }): MapImageBounds {
  return { x: point.x, y: point.y, width: 1, height: 1 }
}

function systemSvg(
  system: PlayerContinuousSystemProjection,
  displayFrame: SvgViewportRect | undefined,
  detailed: boolean,
  marker: PlayerSystemMarker | undefined,
  pixelScale: number,
  paint: PlayerMapPaint,
  dimmedObjectIds?: ReadonlySet<string>,
  showSystemAnchor = true,
): string {
  const color = detailed ? paint.mapSelected : paint.mapOrbit
  const frame = displayFrame && displayFrame.width > 0 && displayFrame.height > 0 ? svgElement('rect', {
    ...displayFrame,
    class: 'player-continuous-system-envelope',
    rx: 18,
    fill: color,
    'fill-opacity': .05,
    stroke: color,
    'stroke-opacity': detailed ? .7 : .48,
    'stroke-width': 1.25,
    'stroke-dasharray': detailed ? undefined : '5 5',
    ...fixedStroke,
  }) : ''
  const unknown = system.disclosure === 'unknown'
  const fill = unknown ? paint.mapBackground : paint.mapCard
  const stroke = unknown ? paint.textMuted : system.disclosure === 'known-type' ? paint.mapLabelBorder : paint.mapInstallation
  const core = unknown ? '' : svgElement('circle', { r: 3, fill: paint.mapInstallation })
  const anchor = showSystemAnchor
    ? svgElement('g', {
        transform: `translate(${system.anchor.x} ${system.anchor.y}) scale(${1 / pixelScale})`,
      }, svgElement('circle', {
        r: markerRadius(system), fill, stroke, 'stroke-width': unknown ? 3 : 2, ...fixedStroke,
      }) + core)
    : ''
  const detail = detailed ? systemDetailSvg(system, marker, paint, dimmedObjectIds) : ''
  return svgElement('g', { class: 'player-continuous-system' }, frame + detail + anchor)
}

function positiveFrame(frame: SvgViewportRect | undefined): frame is SvgViewportRect {
  return !!frame && Number.isFinite(frame.width) && Number.isFinite(frame.height)
    && frame.width > 0 && frame.height > 0
}

function systemDetailSvg(
  system: PlayerContinuousSystemProjection,
  marker: PlayerSystemMarker | undefined,
  paint: PlayerMapPaint,
  dimmedObjectIds: ReadonlySet<string> | undefined,
): string {
  if (!system.geometry || marker?.disclosure !== 'revealed') return ''
  const objects = new Map(marker.map.objects.map(object => [object.id, object]))
  const unoccupiedIds = new Set(marker.map.orbits.filter(orbit => orbit.hostId === null).map(orbit => orbit.id))
  const orbits = system.geometry.orbits.map(orbit => svgElement('ellipse', {
    cx: orbit.sceneCenter.x,
    cy: orbit.sceneCenter.y,
    rx: orbit.sceneRadii.horizontal,
    ry: orbit.sceneRadii.vertical,
    transform: `rotate(${orbit.rotation} ${orbit.sceneCenter.x} ${orbit.sceneCenter.y})`,
    fill: 'none',
    stroke: paint.mapOrbit,
    'stroke-width': 2,
    'stroke-dasharray': '3 6',
    ...fixedStroke,
  }))
  const objectMarks = system.geometry.objects.flatMap(object => {
    const publicObject = objects.get(object.id)
    return publicObject ? [objectSvg(publicObject, object.scenePosition, paint, dimmedObjectIds?.has(object.id))] : []
  })
  const centers = system.geometry.orbits.filter(orbit => unoccupiedIds.has(orbit.id)).map(orbit =>
    svgElement('circle', { cx: orbit.sceneCenter.x, cy: orbit.sceneCenter.y, r: 2, fill: paint.textMuted }))
  return svgElement('g', { class: 'player-continuous-system-detail' }, [...orbits, ...objectMarks, ...centers].join(''))
}

function objectSvg(
  object: PlayerObjectMarker, position: { x: number; y: number }, paint: PlayerMapPaint, dimmed?: boolean,
): string {
  const { label, glyph } = playerObjectPresentation(object)
  const mark = object.disclosure === 'unknown'
    ? svgElement('circle', { r: 4, fill: paint.mapBackground, stroke: paint.textMuted, 'stroke-width': 2, ...fixedStroke })
    : glyph ? svgElement('text', {
        y: 5, 'text-anchor': 'middle', fill: object.markerColor ?? paint.textSecondary, 'font-family': 'Consolas, monospace', 'font-size': 16,
      }, xml(glyph)) : ''
  const text = svgElement('text', {
    x: 9, y: 4, fill: paint.textPrimary, 'font-family': 'Georgia, serif', 'font-size': 12,
  }, xml(label))
  return svgElement('g', {
    class: 'player-continuous-object',
    transform: `translate(${position.x} ${position.y})`,
    opacity: dimmed ? '.14' : undefined,
  }, mark + text)
}

function routeStubSvg(route: ImageRoute, paint: PlayerMapPaint): string {
  const prefix = route.stub!
  const stroke = route.unresolved ? paint.mapUnresolved : paint.mapRoute
  return svgElement('path', {
    class: 'cluster-route-line player-image-route-stub',
    d: prefix.path,
    fill: 'none',
    stroke,
    'stroke-width': CLUSTER_ROUTE_PRESENTATION.line.width,
    'stroke-dasharray': '6 5',
    ...fixedStroke,
  })
}

function nameSvg(name: PlayerContinuousNameLabel, svgPixelScale: number, paint: PlayerMapPaint): string {
  const leader = name.hasLeader
    ? svgElement('line', {
        x1: name.anchorX - name.x, y1: name.anchorY - name.y, x2: 0, y2: name.height / 2,
        stroke: paint.mapLabelBorder, ...fixedStroke,
      })
    : ''
  const badge = svgElement('rect', {
    x: -name.width / 2, width: name.width, height: name.height, rx: 5, fill: paint.mapCard,
    stroke: paint.mapLabelBorder, 'stroke-width': 1.5, ...fixedStroke,
  })
  const text = svgElement('text', {
    y: name.height * .68,
    textLength: name.textWidth,
    lengthAdjust: 'spacingAndGlyphs',
    'text-anchor': 'middle',
    fill: paint.textPrimary,
    'font-family': 'Georgia, serif',
    'font-size': fontPixels / svgPixelScale,
    'font-weight': 600,
  }, xml(name.displayName))
  return svgElement('g', { transform: `translate(${name.x} ${name.y})` }, leader + badge + text)
}

function routeSvg(
  route: ImageRoute,
  label: { text: string; widthPixels: number } | undefined,
  scale: number,
  paint: PlayerMapPaint,
): string {
  const { geometry, unresolved } = route
  const line = svgElement('path', {
    class: 'cluster-route-line',
    d: geometry.path,
    fill: 'none',
    stroke: unresolved ? paint.mapUnresolved : paint.mapRoute,
    'stroke-width': CLUSTER_ROUTE_PRESENTATION.line.width,
    'stroke-dasharray': unresolved ? CLUSTER_ROUTE_PRESENTATION.line.unresolvedDashArray : undefined,
    ...fixedStroke,
  })
  const badge = label ? routeBadgeSvg(geometry.midpoint, label, scale, paint) : ''
  return svgElement('g', { class: 'cluster-route' }, line + badge)
}

function routeBadgeSvg(
  point: { x: number; y: number },
  label: { text: string; widthPixels: number },
  scale: number,
  paint: PlayerMapPaint,
): string {
  const background = svgElement('rect', {
    x: -label.widthPixels / 2,
    y: -CONTINUOUS_ROUTE_LABEL_HEIGHT_PIXELS / 2,
    width: label.widthPixels,
    height: CONTINUOUS_ROUTE_LABEL_HEIGHT_PIXELS,
    rx: 6,
    fill: paint.mapLabelBackground,
    stroke: paint.mapLabelBorder,
  })
  const text = svgElement('text', {
    dy: '.34em', 'font-family': 'Consolas, monospace', 'font-size': 11, 'text-anchor': 'middle', fill: paint.mapText,
  }, xml(label.text))
  return svgElement('g', { transform: `translate(${point.x} ${point.y}) scale(${1 / scale})` }, background + text)
}

function anonymousExitSvg(point: { x: number; y: number }, scale: number, paint: PlayerMapPaint): string {
  const mark = svgElement('circle', {
    r: CLUSTER_ROUTE_PRESENTATION.endpoint.radius,
    fill: paint.mapCard,
    stroke: paint.mapUnresolved,
    'stroke-width': CLUSTER_ROUTE_PRESENTATION.endpoint.strokeWidth,
    ...fixedStroke,
  })
  const text = svgElement('text', {
    x: 8, y: 4, fill: paint.textSecondary, 'font-family': 'Georgia, serif', 'font-size': 11,
    'paint-order': 'stroke', stroke: paint.mapBackground, 'stroke-width': 4,
  }, anonymousCaption)
  return svgElement('g', { transform: `translate(${point.x} ${point.y}) scale(${1 / scale})` }, text + mark)
}

function rootSvg(frame: MapImageBounds, scale: number, title: string, body: string, paint: PlayerMapPaint) {
  const width = Math.max(1, Math.ceil(frame.width * scale))
  const height = Math.max(1, Math.ceil(frame.height * scale))
  const svg = svgElement('svg', {
    xmlns: 'http://www.w3.org/2000/svg',
    viewBox: `${frame.x} ${frame.y} ${frame.width} ${frame.height}`,
    width,
    height,
    overflow: 'hidden',
    role: 'img',
    'aria-label': title,
  }, svgElement('rect', { ...frame, fill: paint.mapBackground }) + body)
  return { svg, width, height }
}

function svgElement(tag: string, attributes: Record<string, string | number | undefined>, content?: string): string {
  const serializedAttributes = Object.entries(attributes).map(([name, value]) =>
    value === undefined ? '' : ` ${name}="${xml(String(value))}"`).join('')
  const opening = `<${tag}${serializedAttributes}`
  return content === undefined ? `${opening}/>` : `${opening}>${content}</${tag}>`
}

function xml(value: string): string {
  // eslint-disable-next-line no-control-regex -- XML 1.0 cannot include these characters, even as character references.
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uD800-\uDFFF\uFFFE\uFFFF]/gu, '\uFFFD')
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
}
