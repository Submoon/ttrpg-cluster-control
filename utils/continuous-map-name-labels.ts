import type { Point } from '../domain/workspace'
import type { MapViewport, SvgViewportRect } from './map-zoom'
import { CONTINUOUS_SYSTEM_FRAME_CORNER_RADIUS } from './continuous-map-route-geometry'

export const CONTINUOUS_SYSTEM_NAME_FONT_PIXELS = 24
export const CONTINUOUS_SYSTEM_NAME_HEIGHT_PIXELS = 36
export const CONTINUOUS_SYSTEM_NAME_VIEWPORT_MARGIN_PIXELS = 8
export const CONTINUOUS_SYSTEM_RESIZE_HANDLE_PIXELS = 44
export const CONTINUOUS_SYSTEM_NAME_LAYOUT_RING_COUNT = 12
export const CONTINUOUS_SYSTEM_NAME_LAYOUT_RING_SPACING_PIXELS = 42

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
  /** Keep anchor and envelope in the same scene coordinate basis when applying preview offsets. */
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

/** Interpolates a screen-space name from its overview placement to the top-left of its visible frame. */
export function continuousMapNameLabelFramePosition(
  label: Pick<ContinuousMapNameLabel, 'x' | 'y' | 'width'>,
  frame: SvgViewportRect,
  viewport: MapViewport,
  svgPixelScale: number,
  progress: number,
  viewportRect?: SvgViewportRect,
  insetPixels = 12,
  resizeHandleHitAreaPixels = 0,
  resizeHandleGapPixels = 6,
): Pick<Point, 'x' | 'y'> {
  const scale = Number.isFinite(svgPixelScale) && svgPixelScale > 0 ? svgPixelScale : 1
  const amount = Number.isFinite(progress) ? Math.max(0, Math.min(1, progress)) : 0
  const inset = Math.max(0, insetPixels) / scale
  let targetX = viewport.x + frame.x * viewport.k + inset + label.width / 2
  let targetY = viewport.y + frame.y * viewport.k + inset
  let handleCenterX: number | undefined
  let handleCenterY: number | undefined
  let handleEdge = Number.NEGATIVE_INFINITY
  const handleGap = Math.max(0, resizeHandleGapPixels) / scale
  if (resizeHandleHitAreaPixels > 0 && frame.width > 0 && frame.height > 0) {
    const cornerRadius = Math.min(CONTINUOUS_SYSTEM_FRAME_CORNER_RADIUS, frame.width / 2, frame.height / 2)
    const cornerInset = cornerRadius * (1 - Math.SQRT1_2)
    handleCenterX = viewport.x + (frame.x + cornerInset) * viewport.k
    handleCenterY = viewport.y + (frame.y + cornerInset) * viewport.k
    handleEdge = handleCenterX + resizeHandleHitAreaPixels / (2 * scale)
    targetX = handleEdge + handleGap + label.width / 2
  }
  if (viewportRect) {
    const margin = CONTINUOUS_SYSTEM_NAME_VIEWPORT_MARGIN_PIXELS / scale
    const halfWidth = label.width / 2
    targetX = clampToViewport(
      targetX,
      viewportRect.x + margin + halfWidth,
      viewportRect.x + viewportRect.width - margin - halfWidth,
    )
    targetY = clampToViewport(
      targetY,
      viewportRect.y + margin,
      viewportRect.y + viewportRect.height - margin - CONTINUOUS_SYSTEM_NAME_HEIGHT_PIXELS / scale,
    )
    if (handleCenterY !== undefined && targetX - halfWidth < handleEdge) {
      targetY = clampToViewport(
        handleCenterY - resizeHandleHitAreaPixels / (2 * scale) - handleGap - CONTINUOUS_SYSTEM_NAME_HEIGHT_PIXELS / scale,
        viewportRect.y + margin,
        viewportRect.y + viewportRect.height - margin - CONTINUOUS_SYSTEM_NAME_HEIGHT_PIXELS / scale,
      )
    }
  }
  return {
    x: label.x + (targetX - label.x) * amount,
    y: label.y + (targetY - label.y) * amount,
  }
}

let textMeasureContext: CanvasRenderingContext2D | null | undefined
const systemNameWidthPixelsCache = new Map<string, number>()
const namePlacementOffsetsCache = new Map<number, readonly Point[]>()

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
    const hasFrame = Number.isFinite(envelope.width) && envelope.width > 0
      && Number.isFinite(envelope.height) && envelope.height > 0
    const preferredOffset = hasFrame ? {
      x: (envelope.x + delta.x + envelope.width / 2 - anchor.x) * viewport.k * scale,
      y: (envelope.y + delta.y + envelope.height / 2 - anchor.y) * viewport.k * scale
        - CONTINUOUS_SYSTEM_NAME_HEIGHT_PIXELS / 2,
    } : { x: 0, y: 0 }
    const anchorNearViewport = point.x >= expandedViewport.left && point.x <= expandedViewport.right
      && point.y >= expandedViewport.top && point.y <= expandedViewport.bottom
    const envelopeNearViewport = envelopeBounds.right >= expandedViewport.left
      && envelopeBounds.left <= expandedViewport.right
      && envelopeBounds.bottom >= expandedViewport.top
      && envelopeBounds.top <= expandedViewport.bottom
    return anchorNearViewport || envelopeNearViewport ? [{ ...point, preferredOffset }] : []
  })

  const scoredPositions: number[] = []
  for (const anchor of anchorPoints) {
    const widthPixels = systemNameWidthPixels(anchor.name)
    const width = widthPixels / scale
    const height = CONTINUOUS_SYSTEM_NAME_HEIGHT_PIXELS / scale
    const placementOffsets = namePlacementOffsets(widthPixels)
    let chosenX = anchor.preferredOffset.x / scale
    let chosenY = anchor.preferredOffset.y / scale
    let chosenScore = Number.POSITIVE_INFINITY
    scoredPositions.length = 0
    for (let candidateIndex = 0; candidateIndex <= placementOffsets.length; candidateIndex += 1) {
      const offsetX = candidateIndex === 0
        ? anchor.preferredOffset.x / scale
        : placementOffsets[candidateIndex - 1]!.x / scale
      const offsetY = candidateIndex === 0
        ? anchor.preferredOffset.y / scale
        : placementOffsets[candidateIndex - 1]!.y / scale
      const centerX = clampToViewport(
        anchor.x + offsetX,
        viewportRect.x + margin + width / 2,
        viewportRect.x + viewportRect.width - margin - width / 2,
      )
      const top = clampToViewport(
        anchor.y + offsetY,
        viewportRect.y + margin,
        viewportRect.y + viewportRect.height - margin - height,
      )
      let alreadyScored = false
      for (let positionIndex = 0; positionIndex < scoredPositions.length; positionIndex += 2) {
        if (scoredPositions[positionIndex] === centerX && scoredPositions[positionIndex + 1] === top) {
          alreadyScored = true
          break
        }
      }
      if (alreadyScored) continue
      scoredPositions.push(centerX, top)

      const left = centerX - width / 2
      const right = centerX + width / 2
      const bottom = top + height
      const outsideWidth = Math.max(0, viewportRect.x + margin - left)
        + Math.max(0, right - (viewportRect.x + viewportRect.width - margin))
      const outsideHeight = Math.max(0, viewportRect.y + margin - top)
        + Math.max(0, bottom - (viewportRect.y + viewportRect.height - margin))
      const outsideArea = outsideWidth * height + outsideHeight * width
      let labelOverlapArea = 0
      for (const prior of occupied) {
        const overlapWidth = Math.max(0, Math.min(right + 6 / scale, prior.right)
          - Math.max(left - 6 / scale, prior.left))
        const overlapHeight = Math.max(0, Math.min(bottom + 4 / scale, prior.bottom)
          - Math.max(top - 4 / scale, prior.top))
        labelOverlapArea += overlapWidth * overlapHeight
      }
      let anchorOverlapArea = 0
      for (const other of anchorPoints) {
        if (other.id === anchor.id) continue
        const radius = 18 / scale
        const overlapWidth = Math.max(0, Math.min(right, other.x + radius) - Math.max(left, other.x - radius))
        const overlapHeight = Math.max(0, Math.min(bottom, other.y + radius) - Math.max(top, other.y - radius))
        anchorOverlapArea += overlapWidth * overlapHeight
      }
      let duplicatePosition = false
      for (const label of labels) {
        if (label.x === centerX && label.y === top) {
          duplicatePosition = true
          break
        }
      }
      const candidateOffsetX = centerX - anchor.x
      const candidateOffsetY = top - anchor.y
      const score = labelOverlapArea * 100 + anchorOverlapArea * 30 + outsideArea * 10
        + (duplicatePosition ? 1_000_000_000 : 0) + Math.hypot(candidateOffsetX, candidateOffsetY) * 0.01
      if (score < chosenScore) {
        chosenX = candidateOffsetX
        chosenY = candidateOffsetY
        chosenScore = score
      }
      if (labelOverlapArea === 0 && anchorOverlapArea === 0 && outsideArea === 0 && !duplicatePosition) break
    }
    const x = anchor.x + chosenX
    const y = anchor.y + chosenY
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
      hasLeader: Math.hypot(chosenX, chosenY + height / 2) * scale > 24,
    })
  }
  return labels
}

function systemNameWidthPixels(name: string): number {
  const cached = systemNameWidthPixelsCache.get(name)
  if (cached !== undefined) return cached
  if (textMeasureContext === undefined && typeof document !== 'undefined') {
    textMeasureContext = document.createElement('canvas').getContext('2d')
    if (textMeasureContext) textMeasureContext.font = `600 ${CONTINUOUS_SYSTEM_NAME_FONT_PIXELS}px Georgia, serif`
  }
  const textWidth = textMeasureContext?.measureText(name).width ?? name.length * 9
  const width = Math.max(72, Math.ceil(textWidth + 24))
  if (typeof document !== 'undefined') rememberCacheEntry(systemNameWidthPixelsCache, name, width)
  return width
}

function namePlacementOffsets(widthPixels: number): readonly Point[] {
  const cached = namePlacementOffsetsCache.get(widthPixels)
  if (cached) return cached
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
  rememberCacheEntry(namePlacementOffsetsCache, widthPixels, offsets)
  return offsets
}

function rememberCacheEntry<TKey, TValue>(cache: Map<TKey, TValue>, key: TKey, value: TValue): void {
  if (cache.size >= 256 && !cache.has(key)) {
    const oldest = cache.keys().next()
    if (!oldest.done) cache.delete(oldest.value)
  }
  cache.set(key, value)
}

function clampToViewport(value: number, minimum: number, maximum: number): number {
  return maximum < minimum ? (minimum + maximum) / 2 : Math.max(minimum, Math.min(maximum, value))
}
