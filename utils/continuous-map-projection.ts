/** Pure conversion from legacy Cluster anchors and local system geometry into one Warden scene. */
import type { OrbitRadii, Point, StarSystem } from '../domain/workspace'
import { clusterSystemPosition } from './cluster-map-geometry'
import {
  objectPositions,
  orbitCenter,
  orbitRadii,
  orbitRotation,
  toNormalizedMapPoint,
  type SystemMapGeometry,
} from './system-map-geometry'
import type { SvgViewportRect } from './map-zoom'

/** Converts a semantic detail threshold in CSS pixels to a camera scale. */
export function continuousMapDetailScale(
  envelope: Pick<SvgViewportRect, 'width' | 'height'>,
  svgPixelScale: number,
  threshold: number,
): number {
  return threshold / (Math.max(envelope.width, envelope.height) * svgPixelScale)
}

/** Fixed local coordinate that is aligned to each system's legacy Cluster anchor. */
export const CONTINUOUS_MAP_LOCAL_ORIGIN: Point = Object.freeze({ x: 480, y: 280 })
/** A single conversion shared by every local system geometry value. */
export const CONTINUOUS_MAP_SYSTEM_SCALE = 0.2
export const CONTINUOUS_MAP_ENVELOPE_MARGIN = 20
export const CONTINUOUS_MAP_MINIMUM_FRAME = Object.freeze({ width: 120, height: 88 })

export interface ResolvedContinuousObjectGeometry {
  id: string
  name: string
  locationKey: string
  position: Point
}

export interface ResolvedContinuousOrbitGeometry {
  id: string
  center: Point
  radii: OrbitRadii
  rotation: number
}

/** Renderer-neutral resolved input; player adapters can provide detached public geometry here. */
export interface ResolvedContinuousSystemGeometry {
  id: string
  name: string
  anchor: Point
  objects: readonly ResolvedContinuousObjectGeometry[]
  orbits: readonly ResolvedContinuousOrbitGeometry[]
}

/** Geometry needed to draw one system and reveal its interior independently. */
export interface ContinuousWardenSystemProjection {
  id: string
  name: string
  anchor: Point
  scale: number
  localOrigin: Point
  objects: readonly (ResolvedContinuousObjectGeometry & { scenePosition: Point })[]
  orbits: readonly (ResolvedContinuousOrbitGeometry & { sceneCenter: Point; sceneRadii: OrbitRadii })[]
  envelope: SvgViewportRect
  projectLocalPoint(point: Point): Point
  unprojectLocalPoint(point: Point): Point
}

interface Bounds {
  left: number
  top: number
  right: number
  bottom: number
}

function createBounds(): Bounds {
  return { left: Number.POSITIVE_INFINITY, top: Number.POSITIVE_INFINITY, right: Number.NEGATIVE_INFINITY, bottom: Number.NEGATIVE_INFINITY }
}

function includePoint(bounds: Bounds, point: Point): void {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return
  bounds.left = Math.min(bounds.left, point.x)
  bounds.top = Math.min(bounds.top, point.y)
  bounds.right = Math.max(bounds.right, point.x)
  bounds.bottom = Math.max(bounds.bottom, point.y)
}

function includeRect(bounds: Bounds, rect: SvgViewportRect): void {
  includePoint(bounds, { x: rect.x, y: rect.y })
  includePoint(bounds, { x: rect.x + rect.width, y: rect.y + rect.height })
}

function rotatedEllipseExtents(radii: OrbitRadii, degrees: number): Point {
  const angle = degrees * Math.PI / 180
  const cosine = Math.cos(angle)
  const sine = Math.sin(angle)
  return {
    x: Math.hypot(radii.horizontal * cosine, radii.vertical * sine),
    y: Math.hypot(radii.horizontal * sine, radii.vertical * cosine),
  }
}

function safeBounds(bounds: Bounds): Bounds {
  if (![bounds.left, bounds.top, bounds.right, bounds.bottom].every(Number.isFinite)) {
    throw new Error('The continuous map could not calculate finite system bounds.')
  }
  return bounds
}

/**
 * Resolves a legacy normalized anchor and the complete local Orbit scene into shared Cluster coordinates.
 * Object and Orbit geometry stays in one local scene and receives the same uniform conversion.
 */
export function projectWardenSystem(
  system: StarSystem,
  legacyAnchor: Point,
  geometry: SystemMapGeometry,
  scale = CONTINUOUS_MAP_SYSTEM_SCALE,
): ContinuousWardenSystemProjection {
  if (![legacyAnchor.x, legacyAnchor.y, scale].every(Number.isFinite) || scale <= 0) {
    throw new Error('A continuous system projection needs a finite anchor and positive scale.')
  }
  const anchor = clusterSystemPosition({ [system.id]: legacyAnchor }, system.id)
  const systemObjectPositions = objectPositions(system, geometry)
  const localObjects = system.objects.map(object => {
    const position = systemObjectPositions.get(object.id)
    if (!position) throw new Error(`No local position exists for object "${object.id}".`)
    return { id: object.id, name: object.name, locationKey: object.locationKey, position }
  })
  const localOrbits = system.orbits.map(orbit => ({
    id: orbit.id,
    center: orbitCenter(orbit, systemObjectPositions),
    radii: orbitRadii(system, orbit, geometry),
    rotation: orbitRotation(orbit, geometry),
  }))
  return projectContinuousSystemGeometry({
    id: system.id,
    name: system.name,
    anchor,
    objects: localObjects,
    orbits: localOrbits,
  }, scale)
}

/** Projects resolved object and Orbit inputs without needing a source StarSystem record. */
export function projectContinuousSystemGeometry(
  resolved: ResolvedContinuousSystemGeometry,
  scale = CONTINUOUS_MAP_SYSTEM_SCALE,
): ContinuousWardenSystemProjection {
  if (![resolved.anchor.x, resolved.anchor.y, scale].every(Number.isFinite) || scale <= 0) {
    throw new Error('A continuous system projection needs a finite anchor and positive scale.')
  }
  if (resolved.objects.some(object => !Number.isFinite(object.position.x) || !Number.isFinite(object.position.y))
    || resolved.orbits.some(orbit => ![
      orbit.center.x,
      orbit.center.y,
      orbit.radii.horizontal,
      orbit.radii.vertical,
      orbit.rotation,
    ].every(Number.isFinite) || orbit.radii.horizontal < 0 || orbit.radii.vertical < 0)) {
    throw new Error('A continuous system projection needs finite object and Orbit geometry.')
  }
  const { anchor } = resolved
  const projectLocalPoint = (point: Point): Point => ({
    x: anchor.x + (point.x - CONTINUOUS_MAP_LOCAL_ORIGIN.x) * scale,
    y: anchor.y + (point.y - CONTINUOUS_MAP_LOCAL_ORIGIN.y) * scale,
  })
  const unprojectLocalPoint = (point: Point): Point => ({
    x: CONTINUOUS_MAP_LOCAL_ORIGIN.x + (point.x - anchor.x) / scale,
    y: CONTINUOUS_MAP_LOCAL_ORIGIN.y + (point.y - anchor.y) / scale,
  })

  const orbits = resolved.orbits.map(orbit => ({
      ...orbit,
      sceneCenter: projectLocalPoint(orbit.center),
      sceneRadii: {
        horizontal: orbit.radii.horizontal * scale,
        vertical: orbit.radii.vertical * scale,
      },
    }))

  const bounds = createBounds()
  includePoint(bounds, anchor)
  // The system anchor has a visible overview target with a fixed world footprint.
  includeRect(bounds, { x: anchor.x - 18, y: anchor.y - 18, width: 36, height: 36 })

  const objects = resolved.objects.map(object => ({ ...object, scenePosition: projectLocalPoint(object.position) }))
  for (const object of objects) {
    const worldPosition = object.scenePosition
    const labelHalfWidth = Math.max(14, object.name.length * 3.6, object.locationKey.length * 2.8)
    includeRect(bounds, {
      x: worldPosition.x - labelHalfWidth,
      y: worldPosition.y - 4,
      width: labelHalfWidth * 2,
      height: 15,
    })
    includeRect(bounds, {
      x: worldPosition.x - 4,
      y: worldPosition.y - 12,
      width: 8,
      height: 12,
    })
  }

  for (const orbit of orbits) {
    const extent = rotatedEllipseExtents(orbit.sceneRadii, orbit.rotation)
    const strokeMargin = 2
    includeRect(bounds, {
      x: orbit.sceneCenter.x - extent.x - strokeMargin,
      y: orbit.sceneCenter.y - extent.y - strokeMargin,
      width: (extent.x + strokeMargin) * 2,
      height: (extent.y + strokeMargin) * 2,
    })
  }

  const finiteBounds = safeBounds(bounds)
  const emptySystem = resolved.objects.length === 0 && resolved.orbits.length === 0
  const minimumWidth = emptySystem ? CONTINUOUS_MAP_MINIMUM_FRAME.width : 0
  const minimumHeight = emptySystem ? CONTINUOUS_MAP_MINIMUM_FRAME.height : 0
  const margin = CONTINUOUS_MAP_ENVELOPE_MARGIN
  const width = Math.max(minimumWidth, finiteBounds.right - finiteBounds.left + margin * 2)
  const height = Math.max(minimumHeight, finiteBounds.bottom - finiteBounds.top + margin * 2)
  const centerX = (finiteBounds.left + finiteBounds.right) / 2
  const centerY = (finiteBounds.top + finiteBounds.bottom) / 2
  const envelope = {
    x: centerX - width / 2,
    y: centerY - height / 2,
    width,
    height,
  }

  return {
    id: resolved.id,
    name: resolved.name,
    anchor,
    scale,
    localOrigin: CONTINUOUS_MAP_LOCAL_ORIGIN,
    objects,
    orbits,
    envelope,
    projectLocalPoint,
    unprojectLocalPoint,
  }
}

/** Inverts the common Cluster camera-space conversion back to this system's local scene coordinates. */
export function unprojectWardenLocalPoint(projection: ContinuousWardenSystemProjection, point: Point): Point {
  return projection.unprojectLocalPoint(point)
}

/** Converts a continuous Cluster scene point into the owning system's normalized placement coordinates. */
export function unprojectWardenSystemMapPoint(
  projection: ContinuousWardenSystemProjection,
  point: Point,
): Point {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
    throw new Error('A continuous map position must contain finite coordinates.')
  }
  return toNormalizedMapPoint(unprojectWardenLocalPoint(projection, point))
}

/** Converts a Cluster-space scene point to the legacy normalized anchor coordinates used by workspace data. */
export function unprojectWardenClusterAnchor(point: Point): Point {
  return { x: (point.x - 112) / 736, y: (point.y - 96) / 368 }
}

/** Applies a Cluster-scene drag delta to a legacy normalized anchor. */
export function moveWardenClusterAnchorBySceneDelta(startingAnchor: Point, sceneDelta: Point): Point {
  const startingScenePoint = clusterSystemPosition({ system: startingAnchor }, 'system')
  const destination = {
    x: startingScenePoint.x + sceneDelta.x,
    y: startingScenePoint.y + sceneDelta.y,
  }
  return clampWardenClusterAnchor(unprojectWardenClusterAnchor(destination))
}

/** Applies the same legacy [0,1] authored range to a drag preview and its eventual workspace commit. */
export function clampWardenClusterAnchor(position: Point): Point {
  if (!Number.isFinite(position.x) || !Number.isFinite(position.y)) {
    throw new Error('A Cluster anchor must contain finite coordinates.')
  }
  return {
    x: Math.max(0, Math.min(1, position.x)),
    y: Math.max(0, Math.min(1, position.y)),
  }
}
