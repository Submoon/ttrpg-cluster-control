/** A measured client-space rectangle used while choosing an unobstructed map region. */
export interface ClientRectBounds {
  left: number
  top: number
  right: number
  bottom: number
}

/**
 * Finds the largest axis-aligned area left visible by a bounded set of overlay rectangles.
 * Ties prefer the candidate closest to the center of the board, then its top-left edge.
 */
export function largestUnobstructedClientRect(
  bounds: ClientRectBounds,
  obstructions: readonly ClientRectBounds[],
): ClientRectBounds | undefined {
  if (!isPositiveRect(bounds)) return undefined

  const clipped = obstructions
    .filter(isPositiveRect)
    .map(rect => ({
      left: Math.max(bounds.left, rect.left),
      top: Math.max(bounds.top, rect.top),
      right: Math.min(bounds.right, rect.right),
      bottom: Math.min(bounds.bottom, rect.bottom),
    }))
    .filter(isPositiveRect)

  const xEdges = uniqueSorted([bounds.left, bounds.right, ...clipped.flatMap(rect => [rect.left, rect.right])])
  const yEdges = uniqueSorted([bounds.top, bounds.bottom, ...clipped.flatMap(rect => [rect.top, rect.bottom])])
  const centerX = (bounds.left + bounds.right) / 2
  const centerY = (bounds.top + bounds.bottom) / 2
  let best: ClientRectBounds | undefined
  let bestArea = 0
  let bestCenterDistance = Number.POSITIVE_INFINITY

  for (let leftIndex = 0; leftIndex < xEdges.length - 1; leftIndex += 1) {
    const left = xEdges[leftIndex]!
    for (let rightIndex = leftIndex + 1; rightIndex < xEdges.length; rightIndex += 1) {
      const right = xEdges[rightIndex]!
      for (let topIndex = 0; topIndex < yEdges.length - 1; topIndex += 1) {
        const top = yEdges[topIndex]!
        for (let bottomIndex = topIndex + 1; bottomIndex < yEdges.length; bottomIndex += 1) {
          const bottom = yEdges[bottomIndex]!
          const candidate = { left, top, right, bottom }
          if (clipped.some(rect => intersects(candidate, rect))) continue

          const width = right - left
          const height = bottom - top
          const area = width * height
          const candidateCenterX = left + width / 2
          const candidateCenterY = top + height / 2
          const centerDistance = (candidateCenterX - centerX) ** 2 + (candidateCenterY - centerY) ** 2
          if (area > bestArea || (area === bestArea && centerDistance < bestCenterDistance)) {
            best = candidate
            bestArea = area
            bestCenterDistance = centerDistance
          }
        }
      }
    }
  }

  return best
}

function isPositiveRect(rect: ClientRectBounds): boolean {
  return [rect.left, rect.top, rect.right, rect.bottom].every(Number.isFinite)
    && rect.right > rect.left
    && rect.bottom > rect.top
}

function intersects(left: ClientRectBounds, right: ClientRectBounds): boolean {
  return left.left < right.right
    && left.right > right.left
    && left.top < right.bottom
    && left.bottom > right.top
}

function uniqueSorted(values: number[]): number[] {
  return [...new Set(values)].sort((left, right) => left - right)
}
