import { clusterRoutePresentationLabel } from './cluster-route-presentation'

const captionFontPixels = 11
const captionHorizontalPaddingPixels = 10
const captionVerticalPaddingPixels = 5
const captionLineHeightPixels = 14

export interface ContinuousSystemRouteCaptionLayout {
  jumpLabel: string
  destinationLabel?: string
  x: number
  y: number
  width: number
  height: number
  bounds: { x: number; y: number; width: number; height: number }
  fontPixels: number
}

export interface ContinuousSystemRouteCaptionRequest {
  jumpLevel: number
  destinationLabel?: string
  selectedAnchor: { x: number; y: number }
  remoteEndpoint: { x: number; y: number }
}

/** Places compact labels beyond route stubs and separates captions for coincident routes. */
export function continuousSystemRouteCaptionLayouts(
  requests: readonly ContinuousSystemRouteCaptionRequest[],
  pixelsPerSceneUnit = 1,
  obstacles: readonly ContinuousSystemRouteCaptionLayout['bounds'][] = [],
): ContinuousSystemRouteCaptionLayout[] {
  const scale = Number.isFinite(pixelsPerSceneUnit) && pixelsPerSceneUnit > 0 ? pixelsPerSceneUnit : 1
  const occupied = obstacles.map(bounds => ({ ...bounds }))
  return requests.map((request) => {
    const jumpLabel = clusterRoutePresentationLabel(request.jumpLevel)
    const destinationText = request.destinationLabel
    const longestLine = Math.max(jumpLabel.length, destinationText?.length ?? 0)
    const widthPixels = Math.max(56, longestLine * captionFontPixels * .62 + captionHorizontalPaddingPixels * 2)
    const heightPixels = captionVerticalPaddingPixels * 2
      + captionLineHeightPixels * (destinationText ? 2 : 1)
    const dx = request.remoteEndpoint.x - request.selectedAnchor.x
    const dy = request.remoteEndpoint.y - request.selectedAnchor.y
    const distance = Math.hypot(dx, dy)
    const outwardX = distance > 0 && Number.isFinite(distance) ? dx / distance : 1
    const outwardY = distance > 0 && Number.isFinite(distance) ? dy / distance : 0
    const width = widthPixels / scale
    const height = heightPixels / scale
    // Project the full axis-aligned badge onto the route direction, leaving a small gap
    // beyond the stub even when the caption is much wider than it is tall.
    const radialClearance = Math.abs(outwardX) * widthPixels / 2
      + Math.abs(outwardY) * heightPixels / 2 + 8
    const perpendicularX = -outwardY
    const perpendicularY = outwardX
    const candidateHalfExtent = (Math.abs(perpendicularX) * widthPixels
      + Math.abs(perpendicularY) * heightPixels) / (2 * scale)
    const occupiedReach = occupied.reduce((maximum, other) => {
      const otherCenterX = other.x + other.width / 2
      const otherCenterY = other.y + other.height / 2
      const projectedCenter = Math.abs((otherCenterX - request.remoteEndpoint.x - outwardX * radialClearance / scale) * perpendicularX
        + (otherCenterY - request.remoteEndpoint.y - outwardY * radialClearance / scale) * perpendicularY)
      const projectedHalfExtent = (Math.abs(perpendicularX) * other.width + Math.abs(perpendicularY) * other.height) / 2
      return Math.max(maximum, projectedCenter + projectedHalfExtent)
    }, 0)
    const perpendicularStep = candidateHalfExtent + occupiedReach + 8 / scale
    const candidateCount = Math.min(101, Math.max(13, requests.length * 4 + 1))
    let bounds: ContinuousSystemRouteCaptionLayout['bounds'] | undefined
    const baseX = request.remoteEndpoint.x + outwardX * radialClearance / scale
    const baseY = request.remoteEndpoint.y + outwardY * radialClearance / scale
    for (let attempt = 0; attempt < candidateCount; attempt += 1) {
      const offsetIndex = attempt === 0 ? 0 : Math.ceil(attempt / 2) * (attempt % 2 ? 1 : -1)
      const perpendicularOffset = offsetIndex * perpendicularStep
      const x = baseX + perpendicularX * perpendicularOffset
      const y = baseY + perpendicularY * perpendicularOffset
      const candidate = { x: x - width / 2, y: y - height / 2, width, height }
      if (!occupied.some(other => overlaps(candidate, other))) {
        bounds = candidate
        break
      }
    }
    if (!bounds) {
      // A final projected offset sits beyond every occupied rectangle on the perpendicular axis.
      const safeOffset = occupied.reduce((maximum, other) => {
        const otherCenterX = other.x + other.width / 2
        const otherCenterY = other.y + other.height / 2
        const projectedCenter = Math.abs((otherCenterX - baseX) * perpendicularX
          + (otherCenterY - baseY) * perpendicularY)
        const projectedHalfExtent = (Math.abs(perpendicularX) * other.width
          + Math.abs(perpendicularY) * other.height) / 2
        return Math.max(maximum, projectedCenter + projectedHalfExtent + candidateHalfExtent + 8 / scale)
      }, 0)
      const x = baseX + perpendicularX * safeOffset
      const y = baseY + perpendicularY * safeOffset
      bounds = { x: x - width / 2, y: y - height / 2, width, height }
    }
    occupied.push(bounds)
    return {
      jumpLabel,
      ...(destinationText ? { destinationLabel: destinationText } : {}),
      x: bounds.x + width / 2,
      y: bounds.y + height / 2,
      width,
      height,
      bounds,
      fontPixels: captionFontPixels,
    }
  })
}

function overlaps(
  first: ContinuousSystemRouteCaptionLayout['bounds'],
  second: ContinuousSystemRouteCaptionLayout['bounds'],
): boolean {
  return first.x < second.x + second.width && first.x + first.width > second.x
    && first.y < second.y + second.height && first.y + first.height > second.y
}
