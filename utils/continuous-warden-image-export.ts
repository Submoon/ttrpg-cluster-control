import type { JumpCluster, StarSystem } from '../domain/workspace'
import {
  continuousMapTextScale,
  wardenStarHaloRadius,
  type ContinuousWardenSystemProjection,
} from './continuous-map-projection'
import type { MapViewport, SvgViewportRect } from './map-zoom'
import { CONTINUOUS_ROUTE_LABEL_HEIGHT_PIXELS } from './continuous-map-route-labels'
import { continuousMapSystemNameWidthPixels } from './continuous-map-name-labels'
import {
  exportMapImageScene,
  type MapImagePalette,
} from './map-image-export'
import type { MapImageScope } from './map-image-scope'
import { clusterRoutePresentationLabel } from './cluster-route-presentation'
import type { ContinuousSystemRouteCaptionLayout } from './continuous-system-route-caption'
import { catalogueObjectLabel } from './catalogue-labels'
import { objectMark } from './catalogue-marks'
import { routeObjectMarkerRadiusPixels } from './route-object-geometry'
import {
  prepareContinuousWardenImageScene,
  type ContinuousWardenImageSceneLabel,
  type ContinuousWardenImageSceneRoute,
  type ContinuousWardenImageSceneRequest,
} from './continuous-warden-image-scene'

const routeLabelFontPixels = 11
const svgNamespace = 'http://www.w3.org/2000/svg'
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

export interface ContinuousWardenImageRequest extends ContinuousWardenImageSceneRequest {
  source: SVGSVGElement
  palette: MapImagePalette
  isCurrent?: () => boolean
  compactLabels?: boolean
  selectedObjectIds?: readonly string[]
}

type ExportRouteGeometry = NonNullable<ContinuousWardenImageSceneRoute['renderGeometry']>

/** Builds the requested image from committed map projections and never reads live placement previews. */
export async function exportContinuousWardenMapImage(
  request: ContinuousWardenImageRequest,
): Promise<Blob | null> {
  const { source, palette, isCurrent: isCurrentRequest, ...sceneRequest } = request
  const isCurrent = isCurrentRequest ?? (() => true)
  if (!isCurrent()) return null
  const scene = prepareContinuousWardenImageScene(sceneRequest, {
    systemNameWidthPixels: continuousMapSystemNameWidthPixels,
    textWidth: estimateTextWidth,
  })
  const imageLabels = scene.labels
  const captionIds = request.scope === 'viewport' && request.compactLabels
    ? new Set([...(request.selectedObjectIds ?? []), request.selectedRouteObjectId])
    : undefined

  return exportMapImageScene(
    source,
    request.format,
    palette,
    scene.frame,
    clone => {
      const title = clone.ownerDocument.createElementNS(clone.namespaceURI, 'title')
      title.textContent = scene.title
      const routeStyleSource = clone.querySelector<SVGPathElement>('.continuous-warden-route-layer .cluster-route-line')
      const content = createScopedElement(clone, 'g', 'cluster-map-content')
      if (scene.scope === 'viewport') {
        content.setAttribute('transform', `translate(${scene.sceneViewport.x} ${scene.sceneViewport.y}) scale(${scene.sceneViewport.k})`)
      }

      const background = createScopedElement(clone, 'rect', 'continuous-warden-export-background')
      background.setAttribute('x', String(scene.frame.x))
      background.setAttribute('y', String(scene.frame.y))
      background.setAttribute('width', String(scene.frame.width))
      background.setAttribute('height', String(scene.frame.height))
      background.setAttribute('fill', 'var(--map-bg)')
      background.setAttribute('aria-hidden', 'true')
      // Only static paint resources survive the clone. Rebuild every visible layer from the applied scene.
      clone.replaceChildren(title, ...clone.querySelectorAll(':scope > defs'), background, content)

      const routeLayer = createScopedElement(routeStyleSource ?? clone, 'g', 'continuous-warden-route-layer')
      for (const attribute of Array.from(clone.attributes)) {
        if (attribute.name.startsWith('data-v-')) routeLayer.setAttribute(attribute.name, '')
      }
      for (const preparedRoute of scene.routes) {
        if (!preparedRoute.renderGeometry) continue
        appendRoute(
          routeLayer,
          preparedRoute.route,
          preparedRoute.renderGeometry,
          preparedRoute.incident,
          preparedRoute.routeLabelWidthPixels,
          preparedRoute.routeLabelPosition,
          scene.sceneViewport,
          scene.routeSvgPixelScale,
          scene.includeUnresolvedCaption,
          preparedRoute.systemCaption,
        )
      }
      content.append(routeLayer)

      const items = createScopedElement(clone, 'g', 'cluster-map-items')
      for (const system of scene.systems) {
        if (!system.visible) continue
        appendSystem(
          items,
          system.projection,
          system.displayFrame,
          system.source,
          system.detailed,
          scene.scope,
          scene.sceneViewport,
          scene.systemSvgPixelScale,
          scene.dimmedObjectIds,
          captionIds,
        )
      }
      content.append(items)

      const routeObjects = createScopedElement(clone, 'g', 'continuous-warden-route-objects')
      const routeMarkerScale = 1 / Math.max(Number.EPSILON, scene.sceneViewport.k * scene.routeSvgPixelScale)
      for (const route of scene.routes) {
        if (route.branch) appendRouteBranch(routeObjects, route.route.id, route.branch, routeMarkerScale, scene.dimmedObjectIds, captionIds)
      }
      content.append(routeObjects)

      const nameLayer = createScopedElement(clone, 'g', 'continuous-warden-name-layer')
      for (const label of imageLabels) appendSystemName(nameLayer, label)
      clone.append(nameLayer)
    },
    isCurrent,
  )
}

function appendRouteBranch(
  parent: SVGElement,
  routeId: string,
  branch: NonNullable<ContinuousWardenImageSceneRoute['branch']>,
  markerScale: number,
  dimmedObjectIds: ReadonlySet<string>,
  captionIds?: ReadonlySet<string | undefined>,
): void {
  for (const orbit of branch.orbits) {
    const ring = createScopedElement(parent, 'ellipse', 'warden-route-object-orbit')
    ring.setAttribute('cx', String(orbit.center.x))
    ring.setAttribute('cy', String(orbit.center.y))
    ring.setAttribute('rx', String(orbit.horizontal))
    ring.setAttribute('ry', String(orbit.vertical))
    ring.setAttribute('transform', `rotate(${orbit.rotation} ${orbit.center.x} ${orbit.center.y})`)
    parent.append(ring)
  }
  for (const { object, point, nameBounds } of branch.objects) {
    const mark = createScopedElement(parent, 'g', 'warden-route-object')
    mark.setAttribute('data-owner-route-id', routeId)
    mark.setAttribute('data-route-object-id', object.id)
    mark.setAttribute('transform', `translate(${point.x} ${point.y}) scale(${markerScale})`)
    if (dimmedObjectIds.has(object.id)) mark.setAttribute('opacity', '0.35')
    const marker = createScopedElement(parent, 'circle', 'warden-route-object-marker')
    marker.setAttribute('r', String(routeObjectMarkerRadiusPixels))
    const glyph = createScopedElement(parent, 'text', 'warden-route-object-glyph')
    glyph.setAttribute('fill', object.markerColor ?? 'var(--map-text)')
    glyph.setAttribute('text-anchor', 'middle')
    glyph.setAttribute('y', '5')
    glyph.textContent = objectMark(object)
    mark.append(marker, glyph)
    const showDetail = branch.detailed && (!captionIds || captionIds.has(object.id))
    if (showDetail || nameBounds) {
      const title = mark.ownerDocument.createElementNS(svgNamespace, 'title')
      title.textContent = catalogueObjectLabel(object)
      mark.prepend(title)
    }
    if (nameBounds) {
      const y = (nameBounds.y - point.y) / markerScale
      const height = nameBounds.height / markerScale
      const width = nameBounds.width / markerScale
      const leader = createScopedElement(parent, 'line', 'continuous-warden-name-leader')
      const below = y > 0
      leader.setAttribute('x1', '0')
      leader.setAttribute('x2', '0')
      leader.setAttribute('y1', String(below ? routeObjectMarkerRadiusPixels : -routeObjectMarkerRadiusPixels))
      leader.setAttribute('y2', String(below ? y : y + height))
      const background = createScopedElement(parent, 'rect', 'continuous-warden-name-background')
      background.setAttribute('x', String(-width / 2))
      background.setAttribute('y', String(y))
      background.setAttribute('width', String(width))
      background.setAttribute('height', String(height))
      background.setAttribute('rx', '4')
      const name = createScopedElement(parent, 'text', 'warden-route-object-name')
      name.setAttribute('text-anchor', 'middle')
      name.setAttribute('y', String(y + height * .7))
      name.textContent = object.name
      mark.append(leader, background, name)
    } else if (showDetail) {
      const key = createScopedElement(parent, 'text', 'warden-route-object-key')
      key.setAttribute('text-anchor', 'middle')
      key.setAttribute('y', '27')
      key.textContent = object.locationKey
      const name = createScopedElement(parent, 'text', 'warden-route-object-name')
      name.setAttribute('text-anchor', 'middle')
      name.setAttribute('y', '41')
      name.textContent = object.name
      mark.append(key, name)
    }
    parent.append(mark)
  }
}

function appendSystem(
  parent: SVGElement,
  projection: ContinuousWardenSystemProjection,
  displayFrame: SvgViewportRect,
  system: StarSystem | undefined,
  detailed: boolean,
  scope: MapImageScope,
  viewport: MapViewport,
  svgPixelScale: number,
  dimmedObjectIds: ReadonlySet<string>,
  captionIds?: ReadonlySet<string | undefined>,
): void {
  const group = createScopedElement(parent, 'g', 'continuous-warden-system')
  group.setAttribute('data-system-id', projection.id)
  if (scope !== 'system' && displayFrame.width > 0 && displayFrame.height > 0) {
    const envelope = createScopedElement(parent, 'rect', `continuous-warden-system-envelope${detailed ? ' is-detailed' : ''}`)
    envelope.setAttribute('x', String(displayFrame.x))
    envelope.setAttribute('y', String(displayFrame.y))
    envelope.setAttribute('width', String(displayFrame.width))
    envelope.setAttribute('height', String(displayFrame.height))
    envelope.setAttribute('rx', '18')
    group.append(envelope)
  }

  const pixelsPerSceneUnit = scope === 'viewport'
    ? viewport.k * svgPixelScale
    : scope === 'system' ? svgPixelScale : 1
  if (detailed && system) {
    appendSystemDetail(group, projection, system, dimmedObjectIds, pixelsPerSceneUnit, scope === 'system', captionIds)
  }

  parent.append(group)
}

function appendSystemDetail(
  parent: SVGElement,
  projection: ContinuousWardenSystemProjection,
  system: StarSystem,
  dimmedObjectIds: ReadonlySet<string>,
  pixelsPerSceneUnit: number,
  readableExportText: boolean,
  captionIds?: ReadonlySet<string | undefined>,
): void {
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
  const screenScale = projection.scale * pixelsPerSceneUnit
  const textScale = readableExportText
    ? 1 / Math.max(0.0001, screenScale)
    : continuousMapTextScale(screenScale, 20, 28)
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
      halo.setAttribute('r', String(wardenStarHaloRadius(screenScale)))
      mark.append(halo)
    }
    const glyph = createScopedElement(parent, 'text', 'continuous-warden-object-glyph')
    glyph.setAttribute('y', '8')
    glyph.setAttribute('text-anchor', 'middle')
    if (sourceObject.markerColor !== undefined) glyph.style.fill = sourceObject.markerColor
    glyph.textContent = objectGlyphs[sourceObject.subtype] ?? '◇'
    const text = createScopedElement(mark, 'g', 'continuous-warden-object-text')
    text.setAttribute('transform', `scale(${textScale})`)
    text.append(glyph)
    if (!captionIds || captionIds.has(object.id)) {
      const key = createScopedElement(parent, 'text', 'continuous-warden-object-key')
      key.setAttribute('y', '31')
      key.setAttribute('text-anchor', 'middle')
      key.textContent = object.locationKey
      const name = createScopedElement(parent, 'text', 'continuous-warden-object-name')
      name.setAttribute('y', '46')
      name.setAttribute('text-anchor', 'middle')
      name.textContent = object.name
      text.append(key, name)
    }
    mark.append(text)
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
  routeLabelPosition: { x: number; y: number } | undefined,
  viewport: MapViewport,
  svgPixelScale: number,
  includeUnresolvedCaption: boolean,
  systemRouteCaption?: ContinuousSystemRouteCaptionLayout,
): void {
  const routeMark = createScopedElement(parent, 'g', `cluster-route${route.toSystemId === null ? ' is-unresolved' : ''}`)
  routeMark.setAttribute('data-route-id', route.id)
  const path = createScopedElement(parent, 'path', 'cluster-route-line')
  path.setAttribute('d', geometry.path)
  path.setAttribute('aria-hidden', 'true')
  if (incident) path.setAttribute('stroke-dasharray', '8 7')
  routeMark.append(path)

  if (routeLabelWidthPixels !== null && routeLabelPosition) {
    const sceneScale = viewport.k * svgPixelScale
    const badge = createScopedElement(parent, 'g', 'continuous-warden-route-badge')
    badge.setAttribute('transform', `translate(${routeLabelPosition.x} ${routeLabelPosition.y}) scale(${1 / Math.max(0.0001, sceneScale)})`)
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
  if (systemRouteCaption) appendSystemRouteCaption(routeMark, systemRouteCaption, viewport.k * svgPixelScale)

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

function appendSystemRouteCaption(
  parent: SVGElement,
  caption: ContinuousSystemRouteCaptionLayout,
  scenePixelScale: number,
): void {
  const scale = Math.max(0.0001, scenePixelScale)
  const badge = createScopedElement(parent, 'g', 'continuous-warden-route-badge continuous-warden-system-route-caption')
  badge.setAttribute('transform', `translate(${caption.x} ${caption.y}) scale(${1 / scale})`)
  const background = createScopedElement(parent, 'rect', 'cluster-route-label-bg')
  background.setAttribute('x', String(-caption.width * scale / 2))
  background.setAttribute('y', String(-caption.height * scale / 2))
  background.setAttribute('width', String(caption.width * scale))
  background.setAttribute('height', String(caption.height * scale))
  background.setAttribute('rx', '5')
  const jumpLabel = createScopedElement(parent, 'text', 'cluster-route-label')
  jumpLabel.setAttribute('font-size', String(caption.fontPixels))
  jumpLabel.setAttribute('y', caption.destinationLabel ? '-2' : '4')
  jumpLabel.textContent = caption.jumpLabel
  badge.append(background, jumpLabel)
  if (caption.destinationLabel) {
    const destinationLabel = createScopedElement(parent, 'text', 'cluster-route-label')
    destinationLabel.setAttribute('font-size', String(caption.fontPixels))
    destinationLabel.setAttribute('y', String(caption.fontPixels + 2))
    destinationLabel.textContent = caption.destinationLabel
    badge.append(destinationLabel)
  }
  parent.append(badge)
}

function appendSystemName(parent: SVGElement, label: ContinuousWardenImageSceneLabel): void {
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
