/** Builds standalone map images from detached player documents, never from Warden map DOM or source records. */
import type { CurrentPlayerMapScene } from '../domain/player-scene'
import type { PlayerClusterDocument, PlayerObjectMarker, PlayerSystemDocument, PlayerSystemMarker } from '../domain/player-projection'
import { playerClusterGeometry } from './player-cluster-geometry'
import { rasterizeMapSvg, type MapImageFormat, type MapImagePalette } from './map-image-export'
import { playerSystemGeometry } from './player-system-geometry'

const svgNamespace = 'http://www.w3.org/2000/svg'
const scenePadding = 24
const titleBandHeight = 48
const titleFontSize = 20

interface PlayerMapPaint {
  mapBackground: string
  panelBackground: string
  line: string
  lineSoft: string
  textPrimary: string
  textSecondary: string
  textMuted: string
  accent: string
}

interface SceneBounds {
  left: number
  top: number
  width: number
  height: number
}

export interface PlayerMapImageRequest {
  scene: CurrentPlayerMapScene
  format: MapImageFormat
  palette: MapImagePalette
  isCurrent: () => boolean
}

const lightPrintPaint: PlayerMapPaint = {
  mapBackground: '#f5f4ee',
  panelBackground: '#fffefa',
  line: '#796e5d',
  lineSoft: '#ded8ca',
  textPrimary: '#26302c',
  textSecondary: '#45504a',
  textMuted: '#59645d',
  accent: '#9c4a16',
}

const darkFallbackPaint: PlayerMapPaint = {
  mapBackground: '#0c1719',
  panelBackground: '#121c1e',
  line: '#65787a',
  lineSoft: '#293a3d',
  textPrimary: '#e8eee7',
  textSecondary: '#c0cbc4',
  textMuted: '#9caaa2',
  accent: '#efa16f',
}

/** Serializes a safe public SVG scene and optionally rasterizes that same SVG within the GM PNG budget. */
export async function exportPlayerMapImage(request: PlayerMapImageRequest): Promise<Blob | null> {
  if (!request.isCurrent()) return null
  if (isFeatureless(request.scene)) {
    throw new Error('There are no player-visible map features to export.')
  }

  try {
    const paint = playerMapPaint(request.palette)
    const { svg, width, height } = request.scene.kind === 'jump-cluster'
      ? createClusterImage(request.scene.document, paint)
      : createSystemImage(request.scene.document, request.scene.label, paint)
    if (!request.isCurrent()) return null

    const image = request.format === 'svg'
      ? svg
      : await rasterizeMapSvg(svg, width, height)
    return request.isCurrent() ? image : null
  } catch {
    if (!request.isCurrent()) return null
    throw new Error('The player map image could not be created.')
  }
}

function isFeatureless(scene: CurrentPlayerMapScene): boolean {
  return scene.kind === 'jump-cluster'
    ? scene.document.systems.length === 0
    : scene.document.objects.length === 0 && scene.document.orbits.length === 0
}

function playerMapPaint(palette: MapImagePalette): PlayerMapPaint {
  if (palette === 'print-light') return lightPrintPaint
  if (typeof document === 'undefined') return lightPrintPaint

  const root = document.documentElement
  const computed = getComputedStyle(root)
  const fallback = root.classList.contains('dark') ? darkFallbackPaint : lightPrintPaint
  const read = (name: string, fallbackValue: string): string =>
    computed.getPropertyValue(name).trim() || fallbackValue

  return {
    mapBackground: read('--map-bg', fallback.mapBackground),
    panelBackground: read('--panel-bg', fallback.panelBackground),
    line: read('--line', fallback.line),
    lineSoft: read('--line-soft', fallback.lineSoft),
    textPrimary: read('--text-primary', fallback.textPrimary),
    textSecondary: read('--text-secondary', fallback.textSecondary),
    textMuted: read('--text-muted', fallback.textMuted),
    accent: read('--accent', fallback.accent),
  }
}

function createClusterImage(
  documentScene: PlayerClusterDocument,
  paint: PlayerMapPaint,
): { svg: Blob; width: number; height: number } {
  const geometry = playerClusterGeometry(documentScene)
  const bounds = withTitleBand({
    left: geometry.bounds.minX,
    top: geometry.bounds.minY,
    width: geometry.bounds.width,
    height: geometry.bounds.height,
  }, documentScene.title)
  const svg = createRootSvg(
    bounds,
    `${documentScene.title} player Jump Cluster map`,
    documentScene.title,
    paint,
  )

  const routesGroup = appendSvg(svg, 'g', { 'aria-label': 'Player-visible Jump Routes', role: 'group' })
  for (const route of geometry.routes) {
    const routeGroup = appendSvg(routesGroup, 'g', {
      class: 'player-cluster-route',
      role: 'group',
      'aria-label': route.accessibleLabel,
    })
    appendSvg(routeGroup, 'path', {
      class: 'player-cluster-route-path',
      d: route.path,
      fill: 'none',
      stroke: paint.textSecondary,
      'stroke-width': 3,
      'aria-hidden': true,
    })

    const badge = appendSvg(routeGroup, 'g', { class: 'player-cluster-route-level' })
    appendSvg(badge, 'rect', {
      x: route.labelX - route.labelWidth / 2,
      y: route.labelY - 15,
      width: route.labelWidth,
      height: 20,
      rx: 2,
      fill: paint.panelBackground,
      stroke: paint.line,
      'stroke-width': 1,
    })
    appendText(badge, route.label, {
      x: route.labelX,
      y: route.labelY,
      fill: paint.textPrimary,
      'font-family': 'system-ui, sans-serif',
      'font-size': 12,
      'text-anchor': 'middle',
    })

    if (route.destination) {
      appendSvg(routeGroup, 'circle', {
        class: 'player-cluster-route-unknown-destination',
        cx: route.destination.position.x,
        cy: route.destination.position.y,
        r: 8,
        fill: paint.mapBackground,
        stroke: paint.textMuted,
        'stroke-width': 3,
      })
      appendText(routeGroup, route.destination.label, {
        class: 'player-cluster-route-unknown-label',
        x: route.destination.position.x + 16,
        y: route.destination.position.y + 5,
        fill: paint.textSecondary,
        'font-family': 'system-ui, sans-serif',
        'font-size': 14,
      })
    }
  }

  const systemsGroup = appendSvg(svg, 'g', { 'aria-label': 'Player-visible Star Systems', role: 'group' })
  for (const system of documentScene.systems) appendClusterSystem(systemsGroup, system, paint)
  return finishSvg(svg, bounds)
}

function appendClusterSystem(parent: SVGElement, system: PlayerSystemMarker, paint: PlayerMapPaint): void {
  const marker = appendSvg(parent, 'g', {
    class: `player-cluster-map-marker player-cluster-map-marker--${system.disclosure}`,
    role: 'group',
    'aria-label': system.label,
  })
  const fill = system.disclosure === 'unknown'
    ? paint.mapBackground
    : system.disclosure === 'known-type' ? paint.textSecondary : paint.accent
  const stroke = system.disclosure === 'unknown' ? paint.textMuted : paint.textPrimary
  appendSvg(marker, 'circle', {
    cx: system.position.x,
    cy: system.position.y,
    r: 18,
    fill,
    stroke,
    'stroke-width': 3,
  })
  if (system.disclosure !== 'unknown') {
    appendText(marker, system.label, {
      x: system.position.x + 28,
      y: system.position.y + 7,
      fill: paint.textPrimary,
      'font-family': 'Georgia, serif',
      'font-size': 20,
    })
  }
}

function createSystemImage(
  documentScene: PlayerSystemDocument,
  label: string,
  paint: PlayerMapPaint,
): { svg: Blob; width: number; height: number } {
  const geometry = playerSystemGeometry(documentScene)
  const bounds = withTitleBand(geometry.bounds, label)
  const svg = createRootSvg(bounds, `${label} player system map`, label, paint)

  const orbitsGroup = appendSvg(svg, 'g', {
    class: 'player-system-orbits',
    'aria-label': 'Visible Orbit geometry',
    role: 'group',
  })
  for (const orbit of documentScene.orbits) {
    appendSvg(orbitsGroup, 'ellipse', {
      cx: orbit.center.x,
      cy: orbit.center.y,
      rx: orbit.radii.horizontal,
      ry: orbit.radii.vertical,
      transform: `rotate(${orbit.rotation} ${orbit.center.x} ${orbit.center.y})`,
      fill: 'none',
      stroke: paint.lineSoft,
      'stroke-width': 2,
    })
  }

  const objectsGroup = appendSvg(svg, 'g', { 'aria-label': 'Player-visible objects', role: 'group' })
  for (const object of documentScene.objects) appendSystemObject(objectsGroup, object, paint)
  for (const orbit of documentScene.orbits) {
    if (orbit.hostId !== null) continue
    appendSvg(svg, 'circle', {
      class: 'player-system-unoccupied-center',
      cx: orbit.center.x,
      cy: orbit.center.y,
      r: 3,
      fill: paint.textMuted,
      'aria-hidden': true,
    })
  }
  return finishSvg(svg, bounds)
}

function appendSystemObject(parent: SVGElement, object: PlayerObjectMarker, paint: PlayerMapPaint): void {
  const marker = appendSvg(parent, 'g', {
    class: object.disclosure === 'unknown'
      ? 'player-system-object-marker'
      : `player-system-object-marker player-system-object-marker--${object.disclosure}`,
    role: 'group',
    'aria-label': object.label,
    transform: `translate(${object.position.x} ${object.position.y})`,
  })
  const fill = object.disclosure === 'unknown'
    ? paint.mapBackground
    : object.disclosure === 'known-type' ? paint.textSecondary : paint.accent
  const stroke = object.disclosure === 'unknown' ? paint.textMuted : paint.textPrimary
  appendSvg(marker, 'circle', {
    r: 10,
    fill,
    stroke,
    'stroke-width': 3,
  })
  if (object.disclosure !== 'unknown') {
    appendText(marker, object.label, {
      x: 16,
      y: 6,
      fill: paint.textPrimary,
      'font-family': 'Georgia, serif',
      'font-size': 16,
    })
  }
}

function withTitleBand(bounds: SceneBounds, title: string): SceneBounds {
  const left = Math.floor(bounds.left - scenePadding)
  const top = Math.floor(bounds.top - scenePadding - titleBandHeight)
  const right = Math.ceil(Math.max(
    bounds.left + bounds.width + scenePadding,
    left + scenePadding * 2 + estimatedTitleWidth(title),
  ))
  const bottom = Math.ceil(bounds.top + bounds.height + scenePadding)
  const width = right - left
  const height = bottom - top
  if (![left, top, right, bottom, width, height].every(Number.isFinite) || width <= 0 || height <= 0) {
    throw new Error('A public map has invalid rendered bounds.')
  }
  return { left, top, width, height }
}

function estimatedTitleWidth(title: string): number {
  return Array.from(title).length * titleFontSize
}

function createRootSvg(
  bounds: SceneBounds,
  accessibleName: string,
  title: string,
  paint: PlayerMapPaint,
): SVGSVGElement {
  const svg = document.createElementNS(svgNamespace, 'svg')
  setAttributes(svg, {
    xmlns: svgNamespace,
    version: '1.1',
    role: 'img',
    'aria-label': accessibleName,
    viewBox: `${bounds.left} ${bounds.top} ${bounds.width} ${bounds.height}`,
    width: bounds.width,
    height: bounds.height,
    preserveAspectRatio: 'xMidYMid meet',
  })
  appendText(svg, title, {}, 'title')
  appendSvg(svg, 'rect', {
    x: bounds.left,
    y: bounds.top,
    width: bounds.width,
    height: bounds.height,
    fill: paint.mapBackground,
    'aria-hidden': true,
  })
  appendText(svg, title, {
    x: bounds.left + scenePadding,
    y: bounds.top + scenePadding + titleBandHeight / 2 + titleFontSize / 2,
    fill: paint.textPrimary,
    'font-family': 'Georgia, serif',
    'font-size': titleFontSize,
    'font-weight': 600,
  })
  return svg
}

function appendSvg(
  parent: SVGElement,
  tagName: string,
  attributes: Record<string, string | number | boolean>,
): SVGElement {
  const element = document.createElementNS(svgNamespace, tagName)
  setAttributes(element, attributes)
  parent.append(element)
  return element
}

function appendText(
  parent: SVGElement,
  value: string,
  attributes: Record<string, string | number | boolean>,
  tagName = 'text',
): SVGElement {
  const element = document.createElementNS(svgNamespace, tagName)
  setAttributes(element, attributes)
  element.textContent = value
  parent.append(element)
  return element
}

function setAttributes(element: SVGElement, attributes: Record<string, string | number | boolean>): void {
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, String(value))
}

function finishSvg(svg: SVGSVGElement, bounds: SceneBounds): { svg: Blob; width: number; height: number } {
  const serialized = new XMLSerializer().serializeToString(svg)
  return {
    svg: new Blob([serialized], { type: 'image/svg+xml;charset=utf-8' }),
    width: bounds.width,
    height: bounds.height,
  }
}
