import type { Point } from '../domain/workspace'
import type { MapViewport, SvgViewportRect } from './map-zoom'

export const CONTINUOUS_SYSTEM_NAME_FONT_PIXELS = 18
export const CONTINUOUS_SYSTEM_NAME_HEIGHT_PIXELS = 28
export const CONTINUOUS_SYSTEM_NAME_VIEWPORT_MARGIN_PIXELS = 8
export const CONTINUOUS_SYSTEM_NAME_LAYOUT_RING_COUNT = 12
export const CONTINUOUS_SYSTEM_NAME_LAYOUT_RING_SPACING_PIXELS = 38

export interface ContinuousMapNameLabel {
  id: string
  name: string
  x: number
  y: number
  width: number
  height: number
  anchorX: number
  anchorY: number
  hasLeader: boolean
}

export interface ContinuousMapNameProjection {
  id: string
  name: string
  anchor: Point
  envelope: SvgViewportRect
}

export interface ContinuousMapNameLabelsOptions<T extends ContinuousMapNameProjection = ContinuousMapNameProjection> {
  projections: readonly T[]
  viewport: MapViewport
  viewportRect: SvgViewportRect
  svgPixelScale: number
  getAnchor?: (projection: T) => Point
}

let textMeasureContext: CanvasRenderingContext2D | null | undefined

/** Places Warden system names around applied anchors inside the drawable SVG rectangle. */
export function continuousMapNameLabels<T extends ContinuousMapNameProjection>({
  projections,
  viewport,
  viewportRect,
  svgPixelScale,
  getAnchor = projection => projection.anchor,
}: ContinuousMapNameLabelsOptions<T>): ContinuousMapNameLabel[] {
  const scale = svgPixelScale > 0 ? svgPixelScale : 1
  const margin = CONTINUOUS_SYSTEM_NAME_VIEWPORT_MARGIN_PIXELS / scale
  const labels: ContinuousMapNameLabel[] = []
  const occupied: Array<{ left: number; top: number; right: number; bottom: number }> = []
  const expandedViewport = {
    left: viewportRect.x - 96 / scale,
    top: viewportRect.y - 96 / scale,
    right: viewportRect.x + viewportRect.width + 96 / scale,
    bottom: viewportRect.y + viewportRect.height + 96 / scale,
  }
  const anchorPoints = projections.flatMap(projection => {
    const anchor = getAnchor(projection)
    const point = {
      id: projection.id,
      name: projection.name,
      x: viewport.x + anchor.x * viewport.k,
      y: viewport.y + anchor.y * viewport.k,
    }
    const delta = { x: anchor.x - projection.anchor.x, y: anchor.y - projection.anchor.y }
    const envelope = projection.envelope
    const envelopeBounds = {
      left: viewport.x + (envelope.x + delta.x) * viewport.k,
      top: viewport.y + (envelope.y + delta.y) * viewport.k,
      right: viewport.x + (envelope.x + delta.x + envelope.width) * viewport.k,
      bottom: viewport.y + (envelope.y + delta.y + envelope.height) * viewport.k,
    }
    const anchorNearViewport = point.x >= expandedViewport.left && point.x <= expandedViewport.right
      && point.y >= expandedViewport.top && point.y <= expandedViewport.bottom
    const envelopeNearViewport = envelopeBounds.right >= expandedViewport.left
      && envelopeBounds.left <= expandedViewport.right
      && envelopeBounds.bottom >= expandedViewport.top
      && envelopeBounds.top <= expandedViewport.bottom
    return anchorNearViewport || envelopeNearViewport ? [point] : []
  })

  for (const anchor of anchorPoints) {
    const widthPixels = systemNameWidthPixels(anchor.name)
    const width = widthPixels / scale
    const height = CONTINUOUS_SYSTEM_NAME_HEIGHT_PIXELS / scale
    const candidates = namePlacementOffsets(widthPixels).map(offset => ({ x: offset.x / scale, y: offset.y / scale }))
    let chosen = candidates[0]!
    let chosenScore = Number.POSITIVE_INFINITY
    for (const offset of candidates) {
      const centerX = clampToViewport(
        anchor.x + offset.x,
        viewportRect.x + margin + width / 2,
        viewportRect.x + viewportRect.width - margin - width / 2,
      )
      const top = clampToViewport(
        anchor.y + offset.y,
        viewportRect.y + margin,
        viewportRect.y + viewportRect.height - margin - height,
      )
      const candidateOffset = { x: centerX - anchor.x, y: top - anchor.y }
      const bounds = {
        left: centerX - width / 2,
        right: centerX + width / 2,
        top,
        bottom: top + height,
      }
      const outsideWidth = Math.max(0, viewportRect.x + margin - bounds.left)
        + Math.max(0, bounds.right - (viewportRect.x + viewportRect.width - margin))
      const outsideHeight = Math.max(0, viewportRect.y + margin - bounds.top)
        + Math.max(0, bounds.bottom - (viewportRect.y + viewportRect.height - margin))
      const outsideArea = outsideWidth * height + outsideHeight * width
      const labelOverlapArea = occupied.reduce((total, prior) => {
        const overlapWidth = Math.max(0, Math.min(bounds.right + 6 / scale, prior.right)
          - Math.max(bounds.left - 6 / scale, prior.left))
        const overlapHeight = Math.max(0, Math.min(bounds.bottom + 4 / scale, prior.bottom)
          - Math.max(bounds.top - 4 / scale, prior.top))
        return total + overlapWidth * overlapHeight
      }, 0)
      const anchorOverlapArea = anchorPoints.reduce((total, other) => {
        if (other.id === anchor.id) return total
        const radius = 18 / scale
        const overlapWidth = Math.max(0, Math.min(bounds.right, other.x + radius) - Math.max(bounds.left, other.x - radius))
        const overlapHeight = Math.max(0, Math.min(bounds.bottom, other.y + radius) - Math.max(bounds.top, other.y - radius))
        return total + overlapWidth * overlapHeight
      }, 0)
      const duplicatePosition = labels.some(label => label.x === centerX && label.y === top)
      const score = labelOverlapArea * 100 + anchorOverlapArea * 30 + outsideArea * 10
        + (duplicatePosition ? 1_000_000_000 : 0) + Math.hypot(candidateOffset.x, candidateOffset.y) * 0.01
      if (score < chosenScore) {
        chosen = candidateOffset
        chosenScore = score
      }
      if (labelOverlapArea === 0 && anchorOverlapArea === 0 && outsideArea === 0 && !duplicatePosition) break
    }
    const x = anchor.x + chosen.x
    const y = anchor.y + chosen.y
    occupied.push({ left: x - width / 2, top: y, right: x + width / 2, bottom: y + height })
    labels.push({
      id: anchor.id,
      name: anchor.name,
      x,
      y,
      width,
      height,
      anchorX: anchor.x,
      anchorY: anchor.y,
      hasLeader: Math.abs(chosen.x * scale) > 0
        || Math.abs(chosen.y * scale + CONTINUOUS_SYSTEM_NAME_HEIGHT_PIXELS + 8) > 6,
    })
  }
  return labels
}

function systemNameWidthPixels(name: string): number {
  if (textMeasureContext === undefined && typeof document !== 'undefined') {
    textMeasureContext = document.createElement('canvas').getContext('2d')
    if (textMeasureContext) textMeasureContext.font = `600 ${CONTINUOUS_SYSTEM_NAME_FONT_PIXELS}px Georgia, serif`
  }
  const textWidth = textMeasureContext?.measureText(name).width ?? name.length * 9
  return Math.max(72, Math.ceil(textWidth + 24))
}

function namePlacementOffsets(widthPixels: number): Point[] {
  const side = widthPixels / 2 + 10
  const offsets: Point[] = []
  for (let ring = 0; ring <= CONTINUOUS_SYSTEM_NAME_LAYOUT_RING_COUNT; ring += 1) {
    const distance = ring * CONTINUOUS_SYSTEM_NAME_LAYOUT_RING_SPACING_PIXELS
    offsets.push(
      { x: 0, y: -CONTINUOUS_SYSTEM_NAME_HEIGHT_PIXELS - 8 - distance },
      { x: 0, y: 8 + distance },
      { x: -side - distance, y: -CONTINUOUS_SYSTEM_NAME_HEIGHT_PIXELS / 2 },
      { x: side + distance, y: -CONTINUOUS_SYSTEM_NAME_HEIGHT_PIXELS / 2 },
      { x: -side - distance, y: -CONTINUOUS_SYSTEM_NAME_HEIGHT_PIXELS - 8 },
      { x: side + distance, y: -CONTINUOUS_SYSTEM_NAME_HEIGHT_PIXELS - 8 },
      { x: -side - distance, y: 8 },
      { x: side + distance, y: 8 },
    )
  }
  return offsets
}

function clampToViewport(value: number, minimum: number, maximum: number): number {
  return maximum < minimum ? (minimum + maximum) / 2 : Math.max(minimum, Math.min(maximum, value))
}
