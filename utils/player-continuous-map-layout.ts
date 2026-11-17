/** Screen-space naming and selection framing for the public continuous map. */
import type { PlayerInspectionTarget } from './player-inspection'
import type { SvgViewportRect } from './map-zoom'
import type { PlayerContinuousSystemProjection } from './player-continuous-map-projection'
import { MAP_ZOOM_MAX_SCALE } from './map-zoom'
import { PLAYER_DETAIL_HIDE_PIXELS, PLAYER_DETAIL_REVEAL_PIXELS } from './player-continuous-map-projection'

export interface PlayerContinuousNameLabel {
  systemId: string
  name: string
  x: number
  y: number
  width: number
  height: number
  anchorX: number
  anchorY: number
  hasLeader: boolean
}

interface ScreenPoint {
  id: string
  name: string
  x: number
  y: number
}

interface LabelRect {
  left: number
  top: number
  right: number
  bottom: number
}

const SYSTEM_NAME_FONT_PIXELS = 18
const SYSTEM_NAME_HEIGHT_PIXELS = 28
const SYSTEM_NAME_VIEWPORT_MARGIN_PIXELS = 8
const SYSTEM_NAME_CULL_MARGIN_PIXELS = 96

/** Places each permitted name in the screen-space viewport, independently of map zoom. */
export function layoutPlayerContinuousNameLabels(
  systems: readonly PlayerContinuousSystemProjection[],
  camera: { x: number; y: number; k: number },
  pixelScale: number,
  viewport: SvgViewportRect,
): PlayerContinuousNameLabel[] {
  const scale = Number.isFinite(pixelScale) && pixelScale > 0 ? pixelScale : 1
  const expanded = {
    left: viewport.x - SYSTEM_NAME_CULL_MARGIN_PIXELS / scale,
    top: viewport.y - SYSTEM_NAME_CULL_MARGIN_PIXELS / scale,
    right: viewport.x + viewport.width + SYSTEM_NAME_CULL_MARGIN_PIXELS / scale,
    bottom: viewport.y + viewport.height + SYSTEM_NAME_CULL_MARGIN_PIXELS / scale,
  }
  const points = systems.flatMap((system): ScreenPoint[] => {
    if (system.disclosure === 'unknown') return []
    const x = camera.x + system.anchor.x * camera.k
    const y = camera.y + system.anchor.y * camera.k
    const envelope = system.geometry?.envelope
    const anchorNear = x >= expanded.left && x <= expanded.right && y >= expanded.top && y <= expanded.bottom
    const envelopeNear = envelope !== undefined
      && camera.x + (envelope.x + envelope.width) * camera.k >= expanded.left
      && camera.x + envelope.x * camera.k <= expanded.right
      && camera.y + (envelope.y + envelope.height) * camera.k >= expanded.top
      && camera.y + envelope.y * camera.k <= expanded.bottom
    return anchorNear || envelopeNear ? [{ id: system.id, name: system.label, x, y }] : []
  })

  const occupied: LabelRect[] = []
  const labels: PlayerContinuousNameLabel[] = []
  const height = SYSTEM_NAME_HEIGHT_PIXELS / scale
  const margin = SYSTEM_NAME_VIEWPORT_MARGIN_PIXELS / scale

  for (const point of points) {
    const widthPixels = Math.max(72, Math.ceil(Array.from(point.name).length * SYSTEM_NAME_FONT_PIXELS * .52 + 24))
    const width = widthPixels / scale
    const candidates = namePlacementOffsets(widthPixels).map(offset => ({ x: offset.x / scale, y: offset.y / scale }))
    let chosen = candidates[0]!
    let chosenScore = Number.POSITIVE_INFINITY
    for (const offset of candidates) {
      const centerX = clampToViewport(
        point.x + offset.x,
        viewport.x + margin + width / 2,
        viewport.x + viewport.width - margin - width / 2,
      )
      const top = clampToViewport(
        point.y + offset.y,
        viewport.y + margin,
        viewport.y + viewport.height - margin - height,
      )
      const bounds = { left: centerX - width / 2, right: centerX + width / 2, top, bottom: top + height }
      const outsideWidth = Math.max(0, viewport.x + margin - bounds.left)
        + Math.max(0, bounds.right - (viewport.x + viewport.width - margin))
      const outsideHeight = Math.max(0, viewport.y + margin - bounds.top)
        + Math.max(0, bounds.bottom - (viewport.y + viewport.height - margin))
      const outsideArea = outsideWidth * height + outsideHeight * width
      const labelOverlapArea = occupied.reduce((total, prior) => total
        + Math.max(0, Math.min(bounds.right + 6 / scale, prior.right) - Math.max(bounds.left - 6 / scale, prior.left))
          * Math.max(0, Math.min(bounds.bottom + 4 / scale, prior.bottom) - Math.max(bounds.top - 4 / scale, prior.top)), 0)
      const anchorOverlapArea = points.reduce((total, other) => {
        if (other.id === point.id) return total
        const radius = 18 / scale
        const overlapWidth = Math.max(0, Math.min(bounds.right, other.x + radius) - Math.max(bounds.left, other.x - radius))
        const overlapHeight = Math.max(0, Math.min(bounds.bottom, other.y + radius) - Math.max(bounds.top, other.y - radius))
        return total + overlapWidth * overlapHeight
      }, 0)
      const duplicatePosition = labels.some(label => label.x === centerX && label.y === top)
      const score = labelOverlapArea * 100 + anchorOverlapArea * 30 + outsideArea * 10
        + (duplicatePosition ? 1_000_000_000 : 0) + Math.hypot(centerX - point.x, top - point.y) * .01
      if (score < chosenScore) {
        chosen = { x: centerX - point.x, y: top - point.y }
        chosenScore = score
      }
      if (labelOverlapArea === 0 && anchorOverlapArea === 0 && outsideArea === 0 && !duplicatePosition) break
    }

    const x = point.x + chosen.x
    const y = point.y + chosen.y
    const centerDeltaY = chosen.y + height / 2
    occupied.push({ left: x - width / 2, top: y, right: x + width / 2, bottom: y + height })
    labels.push({
      systemId: point.id,
      name: point.name,
      x,
      y,
      width,
      height,
      anchorX: point.x,
      anchorY: point.y,
      hasLeader: Math.hypot(chosen.x * scale, centerDeltaY * scale) > 24,
    })
  }

  return labels
}

/** Includes the rendered object label in the framing bounds, including long public names. */
export function playerContinuousTargetBounds(
  geometry: NonNullable<PlayerContinuousSystemProjection['geometry']>,
  target: PlayerInspectionTarget,
): SvgViewportRect | undefined {
  if (target.kind === 'object') {
    const object = geometry.objects.find(candidate => candidate.id === target.id)
    if (!object) return undefined
    const width = Math.max(44, Array.from(object.name).length * 7 + 22)
    return { x: object.scenePosition.x - 10, y: object.scenePosition.y - 18, width, height: 36 }
  }

  const orbit = geometry.orbits.find(candidate => candidate.id === target.id)
  if (!orbit) return undefined
  const radians = orbit.rotation * Math.PI / 180
  const extentX = Math.hypot(orbit.sceneRadii.horizontal * Math.cos(radians), orbit.sceneRadii.vertical * Math.sin(radians))
  const extentY = Math.hypot(orbit.sceneRadii.horizontal * Math.sin(radians), orbit.sceneRadii.vertical * Math.cos(radians))
  return {
    x: orbit.sceneCenter.x - extentX - 14,
    y: orbit.sceneCenter.y - extentY - 14,
    width: Math.max(28, extentX * 2 + 28),
    height: Math.max(28, extentY * 2 + 28),
  }
}

/** Keeps current detail visible, or reaches its reveal threshold before explicit framing. */
export function playerContinuousTargetMinimumScale(
  system: PlayerContinuousSystemProjection,
  currentScale: number,
  pixelScale: number,
  isDetailed: boolean,
): number {
  const envelope = system.geometry?.envelope
  if (!envelope || !Number.isFinite(currentScale) || currentScale <= 0
    || !Number.isFinite(pixelScale) || pixelScale <= 0) return currentScale
  const threshold = isDetailed ? PLAYER_DETAIL_HIDE_PIXELS : PLAYER_DETAIL_REVEAL_PIXELS
  const extent = Math.max(envelope.width, envelope.height)
  if (!Number.isFinite(extent) || extent <= 0) return currentScale
  return Math.min(MAP_ZOOM_MAX_SCALE, Math.max(currentScale, threshold / (extent * pixelScale)))
}

function namePlacementOffsets(widthPixels: number): Array<{ x: number; y: number }> {
  const side = widthPixels / 2 + 10
  const offsets: Array<{ x: number; y: number }> = []
  for (let ring = 0; ring <= 12; ring += 1) {
    const distance = ring * 38
    offsets.push(
      { x: 0, y: -SYSTEM_NAME_HEIGHT_PIXELS - 8 - distance },
      { x: 0, y: 8 + distance },
      { x: -side - distance, y: -SYSTEM_NAME_HEIGHT_PIXELS / 2 },
      { x: side + distance, y: -SYSTEM_NAME_HEIGHT_PIXELS / 2 },
      { x: -side - distance, y: -SYSTEM_NAME_HEIGHT_PIXELS - 8 },
      { x: side + distance, y: -SYSTEM_NAME_HEIGHT_PIXELS - 8 },
      { x: -side - distance, y: 8 },
      { x: side + distance, y: 8 },
    )
  }
  return offsets
}

function clampToViewport(value: number, minimum: number, maximum: number): number {
  return maximum < minimum ? (minimum + maximum) / 2 : Math.max(minimum, Math.min(maximum, value))
}
